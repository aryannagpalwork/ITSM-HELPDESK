# Agent-to-Agent Ticket Reassignment ✅ COMPLETED

## Backend ✅

1. Modified `assign_ticket()` in `services/tickets.py` to detect assign vs reassign
   - If ticket already assigned and new agent provided → `is_reassign = true`
   - Validates target agent exists, is active, has Agent role
   - Writes `ticket.reassigned` audit action (vs `ticket.assigned` / `ticket.unassigned`)
   - Preserves old assigned/new assigned values in audit metadata

2. Added `GET /tickets/agents` endpoint in `api/tickets.py`
   - Returns active agents with: id, name, specialization, activeTicketCount, available status
   - Protected by `require_roles(["Agent", "Administrator"])`

3. Updated `POST /tickets/{id}/assign` description to reflect reassign support

## Frontend ✅

4. Added `listAgents()` to `api.ts`
5. Added `reassignTicket` + `listAgents` to `AppContext.tsx`
   - `reassignTicket` reuses `assignTicket` API (backend decides assign vs reassign)
   - After reassignment: refreshes metrics, tickets, dashboard
6. Updated `TicketDetails.tsx` UI:
   - **Reassign button**: Shows in Support Assignment card when agent is assigned (Agent/Admin only)
   - **Agent dropdown**: Lists active agents excluding current user + current assignee
   - **Specialization/workload**: Shown in dropdown options + detail card
   - **Available status**: Green/amber indicator
   - **Optional reason**: Textarea in modal
   - **Confirm/Cancel**: Modal buttons
   - **Audit trail**: `ticket.reassigned` appears in timeline with amber icon/color
   - **Dashboard refresh**: Loads metrics + tickets after reassignment
   - **Employees**: Can only see static card (no Reassign button)

