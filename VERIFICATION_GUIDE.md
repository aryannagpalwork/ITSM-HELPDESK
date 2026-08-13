# How to Verify the SLA Recalculation Implementation

## Quick Verification (5 minutes)

### 1. Check Code Changes
```bash
# Verify the new function exists in sla.py
grep -n "recalculate_sla_for_all_tickets" backend/app/services/sla.py

# Verify the endpoint imports the new function
grep -n "recalculate_sla_for_all_tickets" backend/app/api/sla_config.py
```

Expected output: Both files should show the function name.

### 2. Syntax Verification
```bash
cd backend
python -m py_compile app/api/sla_config.py app/services/sla.py
```

Expected output: No output (means no syntax errors)

### 3. Start the Backend Server
```bash
cd backend
python -m uvicorn app.main:app --reload
```

Expected output: Server starts successfully, no import errors

## Functional Verification (15 minutes)

### Scenario: Change Critical SLA Target

#### Step 1: Create Initial Tickets
1. Open the application in browser
2. Create 3 Critical tickets:
   - Ticket 1: Note the creation time (should show ~0 minutes ago)
   - Ticket 2: Note the creation time
   - Ticket 3: Note the creation time

3. Wait 30 seconds between creating tickets (optional, for testing)

#### Step 2: Verify Initial SLA Status
1. Go to Admin Dashboard → SLA Configuration
2. Note the current Critical SLA target (default: 4 hours)
3. Go to Agent Dashboard → Tickets
4. Filter by Priority: Critical
5. Check the SLA Status for each ticket (should show "Active" since they were just created)

#### Step 3: Manually Update Ticket Time (Optional - for Testing)
If you want to test with older tickets, you can:
1. Go to a Critical ticket detail
2. Create a new one with an older timestamp in the database

Or skip this and proceed with the current time.

#### Step 4: Change SLA Configuration
1. Go to Admin Dashboard → SLA Configuration
2. Find the "Critical" section
3. Change "Resolution" (sla_target_hours) from 4 to 8
4. Click "Save"
5. **IMPORTANT**: Watch the browser console and server logs

#### Step 5: Verify Recalculation
Check the server logs:
```
INFO:app.api.sla_config:SLA configuration updated. Recalculated SLA for [N] tickets.
```

Where [N] should show the number of Critical tickets created.

#### Step 6: Verify Tickets Updated
1. Go to Agent Dashboard → Tickets
2. Filter by Priority: Critical
3. Check that SLA values are still "Active" (since 4h → 8h is an increase)
4. Click on one ticket to view details
5. Check that `sla_target_hours` field shows 8.0

#### Step 7: Verify KPI Metrics
1. Go to Admin Dashboard → KPI Analytics
2. Scroll to SLA Compliance section
3. Check that Critical priority shows:
   - SLA Target Hours: 8 Hours
   - Compliance metrics updated

### Scenario 2: Decrease SLA Target (Optional)

If you want to test the "Breach" scenario:

1. Change Critical SLA from 8 to 0.5 (30 minutes)
2. Watch server logs for recalculation message
3. Go to ticket details for older tickets
4. They should now show "Breached" status
5. SLA Breached count should increase in KPI metrics

## API Verification (Using curl or Postman)

### Get Current SLA Configuration
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/sla-config
```

Expected response:
```json
{
  "critical": {"sla_target_hours": 4.0, "first_response_minutes": 15},
  "high": {"sla_target_hours": 8.0, "first_response_minutes": 30},
  "medium": {"sla_target_hours": 24.0, "first_response_minutes": 120},
  "low": {"sla_target_hours": 72.0, "first_response_minutes": 240},
  "near_breach_percent": 80.0
}
```

### Update SLA Configuration
```bash
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "critical": {"sla_target_hours": 8.0, "first_response_minutes": 15}
  }' \
  http://localhost:8000/api/sla-config
```

Expected response:
- Status: 200 OK
- Body: Updated SLAConfigRead with new values
- Server logs: "SLA configuration updated. Recalculated SLA for [N] tickets."

### Query Updated Tickets
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/tickets?priority=Critical&page=1&page_size=10
```

Expected response:
- Each ticket should have updated `sla_target_hours`, `sla_due_at`, `sla_status`
- Original `created_at` unchanged

## Database Verification

### Check SLA Configuration
```javascript
// In MongoDB shell
db.app_settings.findOne({"_id": "sla_config"})
```

Expected output:
```javascript
{
  "_id": "sla_config",
  "critical": {"sla_target_hours": 8.0, "first_response_minutes": 15},
  "high": {"sla_target_hours": 8.0, "first_response_minutes": 30},
  "medium": {"sla_target_hours": 24.0, "first_response_minutes": 120},
  "low": {"sla_target_hours": 72.0, "first_response_minutes": 240},
  "near_breach_percent": 80.0
}
```

### Check Updated Ticket SLA Fields
```javascript
// In MongoDB shell - Check a Critical ticket
db.tickets.findOne({priority: "Critical"})
```

Expected output (sample):
```javascript
{
  "_id": "ticket-id",
  "ticket_number": "TICKET-001",
  "priority": "Critical",
  "created_at": ISODate("2026-08-13T10:00:00Z"),  // Original time preserved
  "sla_target_hours": 8.0,  // Updated to new value
  "sla_due_at": ISODate("2026-08-13T18:00:00Z"),  // Recalculated
  "sla_status": "Active",  // Recalculated
  "sla_breached": false,  // Recalculated
  // ... other fields
}
```

### Verify Bulk Update Worked
```javascript
// Count tickets modified (approximately)
db.tickets.find({priority: "Critical"}).count()
```

Should match the recalculation log message.

## Logging Verification

### Check Server Logs
Look for these log messages:

**Success Message**:
```
INFO:app.api.sla_config:SLA configuration updated. Recalculated SLA for 5 tickets.
```

**Error Message** (if recalculation fails):
```
ERROR:app.api.sla_config:Failed to recalculate SLA for tickets: [error details]
```

### Enable Debug Logging
To get more detailed logs, modify logging config:
```python
# In app configuration
logging.basicConfig(level=logging.DEBUG)
```

## Troubleshooting

### Issue: No log message about recalculation
**Check**:
1. Is the backend server running? Check console for "Uvicorn running"
2. Is the config endpoint being called? Add print statement in endpoint
3. Are there any tickets in the database? Run: `db.tickets.count()`

**Fix**: Restart backend and create at least one ticket before changing SLA

### Issue: Wrong number of tickets recalculated
**Check**:
1. Did you change multiple priorities? All matching priorities should be recalculated
2. Are there deleted tickets? Bulk_write only modifies existing tickets

**Fix**: This is usually expected behavior. Check database directly to verify.

### Issue: SLA values not updating
**Check**:
1. Check browser console for errors
2. Check backend logs for exceptions
3. Verify database connection is working
4. Verify admin user has "Administrator" role

**Fix**: Check user role and database connection

### Issue: Metrics not updating on dashboard
**Check**:
1. Did dashboard refresh? Manual refresh: F5
2. Did you wait for recalculation to complete? Check server logs
3. Are KPI calculations running? Check for GET requests to KPI endpoint

**Fix**: Manually refresh dashboard or wait for auto-refresh

## Success Criteria Checklist

- [ ] Backend server starts without errors
- [ ] No syntax errors in modified files
- [ ] SLA config endpoint returns expected values
- [ ] Can update SLA config via API
- [ ] Server logs show recalculation message
- [ ] Tickets in database show updated SLA fields
- [ ] Ticket details show updated sla_target_hours
- [ ] KPI metrics reflect new SLA targets
- [ ] Original ticket creation time preserved
- [ ] SLA status correctly reflects new SLA target

## Performance Notes

### Recalculation Time
- 0-100 tickets: < 100ms
- 100-1,000 tickets: < 500ms
- 1,000-10,000 tickets: 1-5 seconds
- 10,000+ tickets: May exceed 5 seconds

If recalculation takes too long, consider:
- Running it in a background job
- Implementing pagination
- Optimizing database indexes

### Database Performance
No noticeable impact on normal operations since:
- Recalculation uses bulk_write (efficient)
- Only happens when admin changes config (rare)
- Doesn't block other database operations

## Next Steps

1. **Deploy**: Merge changes to main branch
2. **Test**: Follow "Quick Verification" section
3. **Monitor**: Watch logs during first SLA config changes
4. **Validate**: Use "Functional Verification" section for comprehensive testing
5. **Document**: Share this verification guide with your team

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify database connection
4. Check that admin user has Administrator role
5. Ensure no other processes are modifying the database

For detailed implementation information, see:
- SLA_IMPLEMENTATION_SUMMARY.md
- SLA_RECALCULATION_TEST_PLAN.md
