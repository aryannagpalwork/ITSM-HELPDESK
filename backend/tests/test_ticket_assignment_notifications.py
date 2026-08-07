import unittest
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.services import tickets

class FakeCollection:
    def __init__(self):
        self.inserted = []

    async def insert_many(self, docs):
        self.inserted.extend(docs)

class FakeDB:
    def __init__(self):
        self.notifications = FakeCollection()

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
        self.assertEqual(db.notifications.inserted[0]["message"], "Ticket has been created.")

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

if __name__ == "__main__":
    unittest.main()
