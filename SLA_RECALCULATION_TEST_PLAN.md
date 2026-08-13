# SLA Recalculation Test Plan

## Overview
This document outlines test scenarios to verify that the SLA recalculation system works correctly after configuration changes.

## Implementation Summary
1. **New Function**: `recalculate_sla_for_all_tickets()` in `backend/app/services/sla.py`
   - Fetches all tickets (or filtered by priority)
   - Recalculates SLA using new configuration
   - Performs bulk update to database
   - Preserves original creation time and resolution time

2. **Updated Endpoint**: `PUT /api/sla-config` in `backend/app/api/sla_config.py`
   - Saves new SLA configuration
   - Immediately calls recalculation function
   - Tracks which priorities were changed
   - Handles errors gracefully

## Test Scenarios

### Scenario 1: Increase Critical SLA Target (2h → 4h)
**Objective**: Verify that tickets within new SLA are no longer marked as breached

**Setup**:
1. Create 3 Critical tickets at different times:
   - Ticket A: Created 1 hour ago (elapsed: 1h)
   - Ticket B: Created 2.5 hours ago (elapsed: 2.5h)
   - Ticket C: Created 3 hours ago (elapsed: 3h)

2. Initial SLA Config: Critical = 2 hours
   - Expected status: A=Active, B=Breached, C=Breached

**Action**:
1. Admin updates Critical SLA to 4 hours via SLAConfigPanel

**Expected Results**:
1. Ticket A: sla_status = "Active", sla_breached = false
2. Ticket B: sla_status = "Active" or "Near Breach", sla_breached = false
3. Ticket C: sla_status = "Active" or "Near Breach", sla_breached = false
4. API response: SLAConfigRead shows critical.sla_target_hours = 4.0
5. KPI metrics updated: fewer "Breached" tickets

### Scenario 2: Decrease High SLA Target (8h → 4h)
**Objective**: Verify that tickets exceeding new SLA remain breached

**Setup**:
1. Create 3 High tickets:
   - Ticket A: Created 2 hours ago (elapsed: 2h)
   - Ticket B: Created 5 hours ago (elapsed: 5h)
   - Ticket C: Created 7 hours ago (elapsed: 7h)

2. Initial SLA Config: High = 8 hours
   - Expected status: A=Active, B=Active, C=Near Breach

**Action**:
1. Admin updates High SLA to 4 hours

**Expected Results**:
1. Ticket A: sla_status = "Active", sla_breached = false
2. Ticket B: sla_status = "Breached", sla_breached = true
3. Ticket C: sla_status = "Breached", sla_breached = true
4. KPI metrics updated: more "Breached" tickets

### Scenario 3: Change Near-Breach Threshold (80% → 60%)
**Objective**: Verify that near-breach status recalculates for all tickets

**Setup**:
1. Create 2 Medium tickets:
   - Ticket A: Created 14 hours ago (elapsed: 14h, 58% of 24h SLA)
   - Ticket B: Created 15 hours ago (elapsed: 15h, 62.5% of 24h SLA)

2. Initial Config: Medium = 24h, near_breach_percent = 80%
   - Expected: A=Active (14h < 19.2h), B=Active (15h < 19.2h)

**Action**:
1. Admin updates near_breach_percent to 60%

**Expected Results**:
1. Ticket A: sla_status = "Near Breach" (14h >= 14.4h)
2. Ticket B: sla_status = "Near Breach" (15h >= 14.4h)
3. KPI metrics: nearBreach count increases

### Scenario 4: Multiple Priority Changes
**Objective**: Verify that only affected priority tickets are recalculated

**Setup**:
1. Database has 10 tickets: 3 Critical, 3 High, 2 Medium, 2 Low
2. Admin updates both Critical and Medium SLA

**Action**:
1. Update Critical: 4h → 2h
2. Update Medium: 24h → 12h

**Expected Results**:
1. Only Critical and Medium tickets are recalculated
2. High and Low tickets remain unchanged
3. Log shows recalculated count matches affected tickets

### Scenario 5: Resolved Tickets with Resolution Time
**Objective**: Verify that resolved tickets preserve resolution time

**Setup**:
1. Create Critical ticket and immediately resolve it
   - Created: now - 2h
   - Resolved: now - 1h
   - Elapsed resolution time: 1h

2. Initial SLA: Critical = 2h
   - Expected: sla_status = "Within SLA", sla_compliant = true

**Action**:
1. Admin changes Critical SLA to 0.5h (30 minutes)

**Expected Results**:
1. Ticket: sla_status = "Breached", sla_compliant = false
2. resolution_duration_hours = 1.0 (preserved)
3. created_at and resolved_at unchanged

### Scenario 6: Closed Tickets with Updated Timestamp
**Objective**: Verify that closed tickets use updated_at when resolved_at is missing

**Setup**:
1. Create Medium ticket that reaches closed status
   - Created: now - 30h
   - Updated: now - 2h
   - Status: Closed
   - (No explicit resolved_at field)

2. Initial SLA: Medium = 24h
   - Expected: Uses updated_at (2h ago) for calculation

**Action**:
1. Admin changes Medium SLA to 1h

**Expected Results**:
1. Ticket: sla_status = "Breached", sla_breached = true
2. sla_due_at = created_at + 1h
3. Ticket lifecycle preserved

## Verification Checklist

### Backend Verification
- [ ] `recalculate_sla_for_all_tickets()` imported correctly in endpoint
- [ ] No Python syntax errors in both files
- [ ] Bulk update operation executes without errors
- [ ] Tickets table updated with new SLA values
- [ ] Log shows number of updated tickets

### Database Verification
- [ ] `tickets` collection has updated sla_* fields
- [ ] `app_settings` collection has updated config
- [ ] Original `created_at` and `resolved_at` fields preserved
- [ ] No tickets deleted or corrupted

### API Verification
- [ ] `PUT /api/sla-config` returns SLAConfigRead with updated values
- [ ] Response time acceptable (< 5 seconds)
- [ ] No 500 errors even if recalculation partially fails
- [ ] Subsequent GET requests show updated config

### KPI/Dashboard Verification
- [ ] Metrics endpoint returns updated SLA metrics
- [ ] "Resolved Within SLA" count updates correctly
- [ ] "SLA Breached" count updates correctly
- [ ] "Active SLA Tickets" count updates correctly
- [ ] "Near Breach" count updates correctly
- [ ] SLA priority chart reflects new values

### Frontend Verification
- [ ] SLAConfigPanel saves successfully
- [ ] No errors in browser console
- [ ] Dashboard updates after configuration change
- [ ] Metrics charts update automatically

## How to Run Tests

### Manual Testing
1. Start the backend server
2. Open SLAConfigPanel in admin dashboard
3. Change an SLA value
4. Observe server logs for recalculation message
5. Verify ticket list shows updated SLA status
6. Check KPI dashboard for updated metrics

### Automated Testing
```python
# Example test to add to test suite
async def test_sla_recalculation_on_config_change():
    # Setup
    await db.tickets.insert_many([...])
    
    # Call endpoint
    response = await client.put("/api/sla-config", json={
        "critical": {"sla_target_hours": 4.0, "first_response_minutes": 15}
    })
    
    # Verify
    assert response.status_code == 200
    tickets = await db.tickets.find({}).to_list(None)
    assert all(t["sla_target_hours"] == 4.0 for t in tickets if t["priority"] == "Critical")
```

## Expected Behavior After Changes

### Immediate (On Configuration Save)
1. Config saved to `app_settings` collection
2. Module constants updated via `apply_sla_config()`
3. All affected tickets recalculated and updated
4. Log message shows count of updated tickets
5. API response returns immediately with updated config

### On Next KPI Query
1. `snapshot_for_ticket()` recalculates using new config
2. Metrics computed from updated SLA values
3. Dashboard displays new metrics

### On Next Ticket Query
1. Ticket details show updated SLA fields
2. SLA status badge shows correct status
3. Ticket history preserved (created_at, resolved_at unchanged)

## Success Criteria
- ✅ No hardcoded SLA values
- ✅ Original ticket creation/resolution times preserved
- ✅ SLA recalculation happens immediately on config change
- ✅ All metrics updated consistently
- ✅ Near-breach calculation dynamic
- ✅ No existing functionality broken
- ✅ No data loss or corruption
