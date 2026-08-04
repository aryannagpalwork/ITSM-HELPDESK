# Leave Calendar & Agent Availability

## What this feature does

This feature adds leave request management for agents and availability visibility for administrators.

- Agents can submit full-day leave requests with a start date, end date, and reason.
- Administrators can approve or reject those requests.
- Administrators now have a dedicated `Leave Management` page in the left sidebar instead of managing leave inside the admin dashboard.
- The admin dashboard still shows a KPI card for agents currently on leave today, and that KPI now links to the dedicated leave page.
- The leave management page includes a separate `Currently On Leave` view in addition to the existing request-status views.
- Ticket assignment now uses live availability data so administrators can see:
  - whether an agent is on leave today
  - how many open or in-progress tickets are already assigned to that agent

## Backend flow

### New collection

`leave_requests`

Stored fields:

- `agent_id`
- `start_date`
- `end_date`
- `reason`
- `status`
- `requested_at`
- `reviewed_by`
- `reviewed_at`
- `rejection_reason`

Note: `start_date` and `end_date` are persisted as ISO `YYYY-MM-DD` strings so we can safely do date-only comparisons in MongoDB without changing the existing app conventions.

### New backend files

- `ithelpdesk-backend/app/schemas/leave.py`
- `ithelpdesk-backend/app/services/leaves.py`
- `ithelpdesk-backend/app/api/leaves.py`

### Registered router

The new router is included in:

- `ithelpdesk-backend/app/api/__init__.py`

### Endpoints

- `POST /leaves`
  - Agent only
  - Creates a pending leave request

- `GET /leaves`
  - Any authenticated user
  - Agents receive only their own leave requests
  - Administrators can optionally filter by `status` and `agent_id`

- `PATCH /leaves/{id}/approve`
  - Administrator only
  - Marks the request as approved and stores reviewer metadata

- `PATCH /leaves/{id}/reject`
  - Administrator only
  - Marks the request as rejected and stores the rejection reason plus reviewer metadata

- `DELETE /leaves/{id}`
  - Agent only
  - Only allowed for the requesting agent and only while the request is still pending

- `GET /agents/availability`
  - Administrator only
  - Returns:
    - `agent_id`
    - `name`
    - `on_leave_today`
    - `open_ticket_count`

- `GET /leaves/currently-on-leave`
  - Administrator only
  - Returns only agents who are on approved leave today
  - Returns:
    - `agent_id`
    - `agent_name`
    - `start_date`
    - `end_date`
    - `open_ticket_count`
    - `status`

### Availability rules

`on_leave_today` is `true` when an approved leave request exists where:

- `start_date <= today`
- `end_date >= today`

The `Currently On Leave` endpoint uses the same active approved leave logic so the KPI, leave page, and administrator availability view stay consistent.

`open_ticket_count` is based on tickets where:

- `assigned_to == agent_id`
- `status in ["Open", "In Progress"]`

No hard availability threshold is enforced.

## Frontend flow

### New agent page

- `ithelpdesk-frontend/src/pages/AgentLeave.tsx`

This page lets agents:

- submit a leave request
- view their own request history
- cancel pending requests

Route:

- `/agent/leaves`

Sidebar entry added in:

- `ithelpdesk-frontend/src/modules/agent/Sidebar.tsx`

### Admin availability and leave review

Administrators now have a dedicated leave management page:

- Route: `/admin/leaves`
- Sidebar entry: `Leave Management`
- The page contains:
  - `Currently On Leave`
  - `Pending First`
  - `Approved`
  - `Rejected`
  - `All Requests`

The admin dashboard still includes:

- a KPI card for `Agents On Leave Today`
- click-through navigation to `/admin/leaves?view=current`

Relevant files:

- `ithelpdesk-frontend/src/modules/admin/useAdminDashboard.ts`
- `ithelpdesk-frontend/src/modules/admin/Dashboard.tsx`
- `ithelpdesk-frontend/src/modules/admin/Sidebar.tsx`
- `ithelpdesk-frontend/src/modules/admin/components/LeaveManagementPanel.tsx`
- `ithelpdesk-frontend/src/pages/AdminLeaveManagement.tsx`
- `ithelpdesk-frontend/src/App.tsx`

### Shared API client updates

New frontend API mappings were added in:

- `ithelpdesk-frontend/src/shared/api.ts`
- `ithelpdesk-frontend/src/shared/types.ts`

These cover:

- leave request create/list/approve/reject/delete
- agent availability fetch
- current-on-leave fetch

## Ticket assignment integration

The ticket details assignment flow now uses live availability data for administrators.

Updated file:

- `ithelpdesk-frontend/src/pages/TicketDetails.tsx`

Behavior:

- administrators see an assignment picker backed by `GET /agents/availability`
- each option shows the agent name, open ticket count, and `On leave` when applicable
- on-leave agents are still selectable
- agents do not see other agents' availability data
- agents can still claim an unassigned ticket for themselves

## Currently On Leave behavior

The `Currently On Leave` view answers a different question from the `Approved` tab:

- `Approved` shows leave requests that were approved, including future and past approved requests
- `Currently On Leave` shows only agents who are unavailable today because an approved leave is active today

This means:

- pending requests are not shown
- rejected requests are not shown
- future approved leave is not shown yet
- historical approved leave is not shown anymore
- leave starting today is shown today
- leave ending today is still shown today
- multi-day approved leave is shown on every day in the leave window
- multiple active leave documents for the same agent are collapsed to a single row in the current view

The current view displays:

- agent name
- leave start date
- leave end date
- open or in-progress ticket count
- current status as `On Leave`

## Validation completed

- Backend leave modules compile with `python -m py_compile`
- Frontend type-check passes with `npm.cmd run lint`
- Frontend production build passes with `npm.cmd run build`
- Backend leave router and schemas import successfully in the project virtual environment

## Important note

Full FastAPI `/docs` runtime verification was not exercised in this shell session, but the leave router, service, and schema imports succeeded in the project virtual environment and the frontend build/type-check passed.
