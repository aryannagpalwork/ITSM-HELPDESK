import unittest
from datetime import date, timedelta

from pydantic import ValidationError

from app.schemas.leave import LeaveRequestCreate


class LeaveRequestCreateTests(unittest.TestCase):
    def test_accepts_today_and_future_dates(self):
        today = date.today()

        request = LeaveRequestCreate(
            start_date=today,
            end_date=today + timedelta(days=1),
            reason="Scheduled leave",
        )

        self.assertEqual(request.start_date, today)

    def test_rejects_a_past_start_date(self):
        yesterday = date.today() - timedelta(days=1)

        with self.assertRaisesRegex(ValidationError, "start_date must be today or a future date"):
            LeaveRequestCreate(
                start_date=yesterday,
                end_date=date.today(),
                reason="Past leave",
            )

    def test_rejects_a_past_end_date(self):
        yesterday = date.today() - timedelta(days=1)

        with self.assertRaisesRegex(ValidationError, "end_date must be today or a future date"):
            LeaveRequestCreate(
                start_date=date.today(),
                end_date=yesterday,
                reason="Past leave",
            )
