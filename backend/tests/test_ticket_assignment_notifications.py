import unittest
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.services import tickets

class FakeCollection:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.inserted = []

    async def find_one(self, query):
        for row in self.rows:
            matched = True
            for key, value in query.items():
                if key == "deleted":
                    if row.get("deleted") is not None and row.get("deleted") != value.get("$ne"):
                        matched = False
                    continue
                if row.get(key) != value:
                    matched = False
                    break
            if matched:
                return row
        return None

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.rows.append(doc)

    async def insert_many(self, docs):
        self.inserted.extend(docs)
        self.rows.extend(docs)

class FakeDB:
    def __init__(self):
        self.notifications = FakeCollection()
        self.users = FakeCollection([
            {"_id": "employee-1", "role": "end_user", "deleted": None},
            {"_id": "agent-1", "role": "agent", "full_name": "Ada Agent", "deleted": None},
            {"_id": "agent-2", "role": "agent", "deleted": None},
        ])

class TicketAssignmentNotificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_agent_created_ticket_receives_created_notification(self):
        db = FakeDB()
        ticket = {
            "_id": "ticket-1",
            "ticket_number": "T-1001",
            "created_by": "agent-1",
        }
        agent = {"_id": "agent-1"}

        await tickets._notify_assignment(db, ticket, agent)

        self.assertEqual(len(db.notifications.inserted), 1)
        self.assertEqual(db.notifications.inserted[0]["user_id"], "agent-1")
        self.assertEqual(db.notifications.inserted[0]["message"], "Ticket has been created and assigned to you.")

    async def test_agent_created_ticket_notification_for_different_requester(self):
        db = FakeDB()
        ticket = {
            "_id": "ticket-2",
            "ticket_number": "T-1002",
            "created_by": "employee-1",
        }
        agent = {"_id": "agent-2"}

        await tickets._notify_assignment(db, ticket, agent)

        messages = {doc["user_id"]: doc["message"] for doc in db.notifications.inserted}
        self.assertEqual(messages["agent-2"], "Ticket T-1002 has been assigned to you.")
        self.assertEqual(messages["employee-1"], "Your ticket has been assigned to an IT agent.")

    async def test_agent_response_notifies_employee_and_marks_ticket_waiting_for_user(self):
        db = FakeDB()
        ticket = {
            "_id": "ticket-3",
            "ticket_number": "T-1003",
            "created_by": "employee-1",
            "status": "In Progress",
        }
        actor = {"_id": "agent-1", "role": "agent", "full_name": "Ada Agent"}

        await tickets._notify_employee_for_agent_response(db, ticket, actor)

        self.assertEqual(len(db.notifications.inserted), 1)
        self.assertEqual(db.notifications.inserted[0]["user_id"], "employee-1")
        self.assertEqual(db.notifications.inserted[0]["type"], "ticket.response")
        self.assertIn("response is required", db.notifications.inserted[0]["message"].lower())

    async def test_ai_ticket_assignment_skips_employee_and_agent_notifications(self):
        db = FakeDB()
        ticket = {
            "_id": "ticket-4",
            "ticket_number": "T-1004",
            "created_by": "employee-1",
        }
        agent = {"_id": "agent-2"}

        await tickets._notify_assignment(
            db,
            ticket,
            agent,
            skip_requester_notification=True,
            skip_agent_notification=True,
        )

        self.assertEqual(len(db.notifications.inserted), 0)

if __name__ == "__main__":
    unittest.main()
