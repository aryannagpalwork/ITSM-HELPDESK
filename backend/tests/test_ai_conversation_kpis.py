import datetime as dt

import pytest

from app.services.kpi import _ticket_resolution_hours, compute_admin_kpis


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length=None):
        return list(self.rows)


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = rows or []

    def find(self, *args, **kwargs):
        return FakeCursor(self.rows)

    def distinct(self, field):
        return list({row.get(field) for row in self.rows if field in row})

    async def count_documents(self, query=None):
        if not query:
            return len(self.rows)
        count = 0
        for row in self.rows:
            matches = True
            for key, expected in query.items():
                value = row.get(key)
                if isinstance(expected, dict):
                    if key == "metadata_json":
                        if not isinstance(value, str):
                            matches = False
                            break
                        if "ticket_id" not in value:
                            matches = False
                            break
                    else:
                        matches = False
                        break
                elif value != expected:
                    matches = False
                    break
            if matches:
                count += 1
        return count

    async def aggregate(self, pipeline):
        return FakeCursor([])


class FakeDB:
    def __init__(self):
        self.users = FakeCollection([
            {"_id": "u1", "role": "admin", "is_active": True, "status": "ACTIVE", "deleted": False},
            {"_id": "u2", "role": "agent", "is_active": True, "status": "ACTIVE", "deleted": False},
        ])
        self.tickets = FakeCollection([])
        self.chat_history = FakeCollection([])
        self.ai_conversations = FakeCollection([
            {
                "conversation_id": "c1",
                "user_id": "u1",
                "conversation_status": "RESOLVED",
                "resolved_by_ai": True,
                "escalated": False,
                "created_at": dt.datetime(2024, 1, 1, 9, 0, 0),
                "first_message_at": dt.datetime(2024, 1, 1, 8, 0, 0),
            },
            {
                "conversation_id": "c2",
                "user_id": "u1",
                "conversation_status": "ESCALATED",
                "resolved_by_ai": False,
                "escalated": True,
                "ticket_id": "T-42",
                "created_at": dt.datetime(2024, 1, 2, 9, 0, 0),
                "first_message_at": dt.datetime(2024, 1, 2, 8, 0, 0),
            },
        ])


@pytest.mark.asyncio
async def test_compute_admin_kpis_uses_ai_conversation_records():
    metrics = await compute_admin_kpis(FakeDB())

    assert metrics.aiCopilot.totalAIChats == 2
    assert metrics.aiCopilot.aiResolved == 1
    assert metrics.aiCopilot.aiEscalated == 1
    assert metrics.aiResolutionRate == 50.0


def test_ai_ticket_resolution_hours_uses_first_message_as_start():
    ticket = {
        "status": "Resolved",
        "ai_resolved": True,
        "created_at": dt.datetime(2024, 1, 1, 9, 0, 0),
        "assigned_at": dt.datetime(2024, 1, 1, 8, 30, 0),
        "resolved_at": dt.datetime(2024, 1, 1, 9, 40, 0),
        "updated_at": dt.datetime(2024, 1, 1, 9, 40, 0),
    }

    assert _ticket_resolution_hours(ticket) == 1.1666666666666667
