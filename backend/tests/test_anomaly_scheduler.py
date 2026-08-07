import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services import anomaly_scheduler


class FakeFind:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length=None):
        return list(self.documents)


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])
        self.inserted = []
        self.updated = []

    async def find_one(self, query=None):
        if not self.documents:
            return None
        for doc in self.documents:
            if all(doc.get(k) == v for k, v in query.items() if k != "$in"):
                return doc
        return None

    async def update_one(self, query, update, upsert=False):
        self.updated.append((query, update, upsert))
        if not self.documents:
            self.documents.append({**query, **update.get("$set", {})})
            return
        for doc in self.documents:
            if doc.get("_id") == query.get("_id"):
                doc.update(update.get("$set", {}))
                return
        if upsert:
            self.documents.append({**query, **update.get("$set", {})})

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.documents.append(doc)

    async def insert_many(self, docs):
        self.inserted.extend(docs)
        self.documents.extend(docs)

    def find(self, query=None, projection=None):
        return FakeFind(self.documents)


class FakeDB:
    def __init__(self, tickets):
        self.tickets = FakeCollection(list(tickets))
        self.alerts = FakeCollection()
        self.notifications = FakeCollection()
        self.users = FakeCollection([
            {"_id": "agent-1", "role": "agent", "is_active": True, "deleted": False},
            {"_id": "admin-1", "role": "admin", "is_active": True, "deleted": False},
        ])
        self.system_state = FakeCollection([])


class AnomalySchedulerTests(unittest.IsolatedAsyncioTestCase):
    async def test_ticket_creation_run_keeps_the_current_window_open_until_scheduler_closes_it(self):
        now = datetime.utcnow()
        tickets = [
            {"_id": "t1", "title": "Network issue", "description": "wifi down", "category": "General", "created_at": now - timedelta(seconds=30)},
            {"_id": "t2", "title": "Network issue", "description": "wifi down again", "category": "General", "created_at": now - timedelta(seconds=10)},
        ]
        db = FakeDB(tickets)
        anomaly_scheduler.get_settings = lambda: SimpleNamespace(alert_ticket_threshold=2, alert_window_minutes=2)

        await anomaly_scheduler.run_anomaly_detection(db, advance_cursor=False)

        self.assertEqual(len(db.alerts.inserted), 1)
        self.assertEqual(db.alerts.inserted[0]["source"], "auto_detected")
        self.assertEqual(db.alerts.inserted[0]["category"], "Network")

    async def test_new_window_creates_a_fresh_alert_after_previous_active_alert(self):
        now = datetime.utcnow()
        db = FakeDB([])
        anomaly_scheduler.get_settings = lambda: SimpleNamespace(alert_ticket_threshold=2, alert_window_minutes=2)
        db.alerts.documents.append({
            "_id": "old-alert",
            "category": "Network",
            "status": "active",
            "source": "auto_detected",
        })
        db.tickets.documents = [
            {"_id": "t1", "title": "Network issue", "description": "wifi down", "category": "General", "created_at": now - timedelta(seconds=10)},
            {"_id": "t2", "title": "Network issue", "description": "wifi down again", "category": "General", "created_at": now - timedelta(seconds=5)},
        ]

        await anomaly_scheduler.run_anomaly_detection(db, advance_cursor=True)

        self.assertEqual(len(db.alerts.inserted), 1)
        self.assertEqual(db.alerts.inserted[0]["category"], "Network")
        updated = db.alerts.documents[0]
        self.assertEqual(updated["status"], "resolved")

    async def test_same_window_ticket_burst_updates_existing_alert_without_duplicates(self):
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=2)
        db = FakeDB([])
        anomaly_scheduler.get_settings = lambda: SimpleNamespace(alert_ticket_threshold=2, alert_window_minutes=2)
        db.system_state.documents.append({"_id": "anomaly_scheduler", "last_checked_at": window_start})
        db.alerts.documents.append({
            "_id": "current-alert",
            "category": "Network",
            "status": "active",
            "source": "auto_detected",
            "window_start": window_start,
            "window_end": window_start,
            "ticket_count": 1,
            "related_ticket_ids": ["t1"],
        })
        db.tickets.documents = [
            {"_id": "t1", "title": "Network issue", "description": "wifi down", "category": "General", "created_at": now - timedelta(seconds=90)},
            {"_id": "t2", "title": "Network issue", "description": "wireless down", "category": "General", "created_at": now - timedelta(seconds=10)},
        ]

        await anomaly_scheduler.run_anomaly_detection(db, advance_cursor=False)

        self.assertEqual(len(db.alerts.inserted), 0)
        self.assertEqual(len(db.alerts.updated), 1)
        self.assertEqual(db.alerts.documents[0]["ticket_count"], 2)
        self.assertEqual(db.alerts.documents[0]["related_ticket_ids"], ["t1", "t2"])
        self.assertEqual(db.alerts.documents[0]["status"], "active")


if __name__ == "__main__":
    unittest.main()
