# Alert System Fixes and Agent Alert UI Updates

## Summary
This update completes the final alert system work by:

- Fixing duplicate auto-detected alert generation in the backend.
- Creating a dedicated **Agent Alert Center** UI matching the admin alert management experience.
- Removing admin alert notifications from the bell for admins.
- Keeping ticket-related notifications available for agents only.

## What Changed

### Files Added
- `frontend/src/pages/AgentAlertManagement.tsx`
- `backend/tests/test_ticket_assignment_notifications.py`

### Files Updated
- `backend/app/services/anomaly_scheduler.py`
- `backend/tests/test_anomaly_scheduler.py`
- `frontend/src/modules/agent/Sidebar.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/NotificationCenter.tsx`
- `frontend/src/components/TopNavbar.tsx`
- `backend/app/services/tickets.py`
- `ALERTS_UI_CHANGELOG.md`
- `README.md`

### Backend
- `backend/app/services/anomaly_scheduler.py`
  - Updated auto-detected alert handling so repeated runs within the same open window update the existing active alert instead of resolving and recreating it.
  - Prevents duplicate auto-detected alerts during rapid ticket bursts.

- `backend/tests/test_anomaly_scheduler.py`
  - Added regression coverage to verify same-window ticket bursts update the existing auto-detected alert without inserting duplicates.

### Frontend
- Added `frontend/src/pages/AgentAlertManagement.tsx`
  - New agent-facing alert center page.
  - Displays two alert sections: **Manual Alerts** and **Automatic Alerts**.
  - Shows active alerts with category, message, KB recommendation, and ticket navigation.

- Updated `frontend/src/modules/agent/Sidebar.tsx`
  - Added `Alert Center` navigation link for agents.

- Updated `frontend/src/App.tsx`
  - Registered `/agent/alerts` route under `AgentLayout`.

- Updated notification behavior in `frontend/src/components/NotificationCenter.tsx`
  - Agents no longer see alert cards in the bell.
  - Admins no longer receive alert notifications in the bell.
  - Ticket-related notifications still display for agents.

- Updated `frontend/src/components/TopNavbar.tsx`
  - Hidden the notification bell for admins so alert management remains centralized in the admin alert page.

## Problems Fixed

1. Duplicate auto-detected alert creation when ticket bursts were processed in the same open anomaly window.
2. Admins receiving alert notifications in the bell instead of viewing alerts only in alert management.
3. Agents not having a dedicated alert section; agent alerts were mixed in the notification center.
4. Legacy agent bell behavior for manual alerts that greys out and stays until admin resolves, which is no longer needed when alerts are moved to a dedicated page.

## Verification
- Backend regression tests passed: `python -m pytest tests/test_anomaly_scheduler.py -q`
- Frontend build passed: `npm run build --if-present`

## Notes
- Admin alert visibility is now centralized in `AdminAlertManagement` only.
- Agent alert visibility is centralized in `AgentAlertManagement` only.
- Ticket notifications remain in the agent notification bell and can be marked as read by agents to disappear.
- In the agent alert page, manual alerts no longer show a "View tickets" action because manual alerts may not have ticket matches.
- Agent-created tickets now receive a notification saying "Ticket has been created." instead of "Your ticket has been assigned to an IT agent." when the creator is also the assignee.
