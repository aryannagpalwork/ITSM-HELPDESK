import datetime as dt
import json
import unittest

from app.services.kpi import compute_agent_kpis


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = rows or []

    def find(self, query=None, projection=None, *args, **kwargs):
        query = query or {}
        rows = [row for row in self.rows if self._matches(row, query)]
        if projection:
            rows = [{k: row.get(k) for k in projection if k != 0} for row in rows]
        return FakeCursor(rows)

    def _matches(self, row, query):
        for key, expr in query.items():
            if key == "_id" and isinstance(expr, dict) and "$in" in expr:
                if row.get("_id") not in expr["$in"]:
                    return False
                continue
            if isinstance(expr, dict) and "$in" in expr:
                if row.get(key) not in expr["$in"]:
                    return False
                continue
            if row.get(key) != expr:
                return False
        return True

    async def to_list(self, length=None):
        return list(self.rows)

    async def count_documents(self, query=None):
        return sum(1 for row in self.rows if self._matches(row, query or {}))

    def aggregate(self, pipeline):
        match = pipeline[0].get("$match", {})
        group = pipeline[1].get("$group", {})
        counts = {}
        for row in self.rows:
            if self._matches(row, match):
                key = row.get(group["_id"].replace("$", ""))
                counts[key] = counts.get(key, 0) + 1
        return FakeCursor([{"_id": key, "count": count} for key, count in counts.items()])


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length=None):
        return list(self.rows)


class KPIFCRTests(unittest.IsolatedAsyncioTestCase):
    def _build_fake_db(self, tickets=None, audit_logs=None, users=None):
        return type(
            "FakeDB",
            (),
            {
                "tickets": FakeCollection(tickets or []),
                "audit_logs": FakeCollection(audit_logs or []),
                "users": FakeCollection(users or []),
                "chat_history": FakeCollection([]),
                "ai_conversations": FakeCollection([]),
                "ticket_comments": FakeCollection([]),
            },
        )()

    async def test_agent_fcr_counts_resolved_ticket_without_reopen_or_escalation(self):
        db = self._build_fake_db(
            tickets=[
                {
                    "_id": "t1",
                    "assigned_to": "agent1",
                    "status": "Resolved",
                    "created_at": dt.datetime(2026, 8, 12, 9, 0, 0),
                    "updated_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                    "resolved_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                }
            ],
            audit_logs=[
                {
                    "_id": "a1",
                    "entity_type": "ticket",
                    "entity_id": "t1",
                    "action": "ticket.resolved",
                    "metadata_json": json.dumps({"field": "Status", "old_value": "In Progress", "new_value": "Resolved"}),
                    "created_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                }
            ],
            users=[{"_id": "agent1", "role": "agent", "is_active": True, "status": "ACTIVE", "deleted": False}],
        )

        metrics = await compute_agent_kpis(db, "agent1")
        self.assertEqual(metrics.agentFcrRate, 100.0)

    async def test_agent_fcr_excludes_resolved_then_open_transition(self):
        db = self._build_fake_db(
            tickets=[
                {
                    "_id": "t2",
                    "assigned_to": "agent1",
                    "status": "Resolved",
                    "created_at": dt.datetime(2026, 8, 12, 9, 0, 0),
                    "updated_at": dt.datetime(2026, 8, 12, 12, 0, 0),
                    "resolved_at": dt.datetime(2026, 8, 12, 12, 0, 0),
                }
            ],
            audit_logs=[
                {
                    "_id": "a2",
                    "entity_type": "ticket",
                    "entity_id": "t2",
                    "action": "ticket.updated",
                    "metadata_json": json.dumps({
                        "field": "Status",
                        "old_value": "Resolved",
                        "new_value": "Open",
                    }),
                    "created_at": dt.datetime(2026, 8, 12, 11, 0, 0),
                },
                {
                    "_id": "a3",
                    "entity_type": "ticket",
                    "entity_id": "t2",
                    "action": "ticket.resolved",
                    "metadata_json": json.dumps({"field": "Status", "old_value": "Open", "new_value": "Resolved"}),
                    "created_at": dt.datetime(2026, 8, 12, 12, 0, 0),
                },
            ],
            users=[{"_id": "agent1", "role": "agent", "is_active": True, "status": "ACTIVE", "deleted": False}],
        )

        metrics = await compute_agent_kpis(db, "agent1")
        self.assertEqual(metrics.agentFcrRate, 0.0)

    async def test_agent_fcr_excludes_escalated_ticket(self):
        db = self._build_fake_db(
            tickets=[
                {
                    "_id": "t3",
                    "assigned_to": "agent1",
                    "status": "Closed",
                    "created_at": dt.datetime(2026, 8, 12, 9, 0, 0),
                    "updated_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                    "resolved_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                }
            ],
            audit_logs=[
                {
                    "_id": "a4",
                    "entity_type": "ticket",
                    "entity_id": "t3",
                    "action": "ticket.escalated",
                    "metadata_json": json.dumps({"field": "Priority", "old_value": "Medium", "new_value": "High"}),
                    "created_at": dt.datetime(2026, 8, 12, 9, 30, 0),
                },
                {
                    "_id": "a5",
                    "entity_type": "ticket",
                    "entity_id": "t3",
                    "action": "ticket.closed",
                    "metadata_json": json.dumps({"field": "Status", "old_value": "Open", "new_value": "Closed"}),
                    "created_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                },
            ],
            users=[{"_id": "agent1", "role": "agent", "is_active": True, "status": "ACTIVE", "deleted": False}],
        )

        metrics = await compute_agent_kpis(db, "agent1")
        self.assertEqual(metrics.agentFcrRate, 0.0)

    async def test_employee_kpis_compute_first_response_from_comments(self):
        db = self._build_fake_db(
            tickets=[
                {
                    "_id": "emp_t1",
                    "created_by": "employee1",
                    "status": "Resolved",
                    "priority": "High",
                    "created_at": dt.datetime(2026, 8, 12, 9, 0, 0),
                    "updated_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                    "resolved_at": dt.datetime(2026, 8, 12, 10, 0, 0),
                }
            ],
            audit_logs=[],
            users=[{"_id": "employee1", "role": "Employee", "is_active": True, "status": "ACTIVE", "deleted": False}],
        )
        db.ticket_comments = FakeCollection([
            {
                "_id": "comment1",
                "ticket_id": "emp_t1",
                "created_at": dt.datetime(2026, 8, 12, 9, 30, 0),
                "author_id": "agent1",
            }
        ])

        metrics = await __import__('app.services.kpi', fromlist=['compute_employee_kpis']).compute_employee_kpis(db, "employee1")
        self.assertEqual(metrics.avgFirstResponseHours, 0.5)
        self.assertGreaterEqual(metrics.firstResponseSlaCompliance, 0.0)
