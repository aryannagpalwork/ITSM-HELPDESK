
---
title: VPN Failure Incident Runbook
department: IT & Networking
category: Incident Response
version: 1.1
author: Marcus Vance (Network Engineer)
created: 2026-04-01
last_updated: 2026-06-12
tags: VPN, incident, runbook, failure, remote access
---

# VPN Failure Incident Runbook

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2026-04-01 | Marcus Vance | Initial creation |
| 1.1 | 2026-06-12 | Sarah Jenkins | Added service status check steps |

## Purpose
This runbook provides step-by-step instructions for resolving VPN failure incidents at EnterpriseTech Solutions.

## Scope
All users experiencing issues connecting to or using the EnterpriseTech VPN.

## Incident Classification
| Severity | Criteria | Target Resolution Time |
|----------|----------|-----------------------|
| P1 (Critical) | Complete VPN outage for all users | 30 minutes |
| P2 (High) | VPN outage for a large group of users | 1 hour |
| P3 (Medium) | VPN issues for single user or small group | 4 hours |

## Prerequisites for IT Support
1. Access to Cisco ASA VPN console
2. Access to SolarWinds NPM (network monitoring)
3. Access to ServiceNow for ticketing
4. Knowledge of [VPN Setup & Reset Guide](../IT/VPN_Reset_Guide.md)

## Procedure for IT Support
### Step 1: Verify the Incident
1. Open ServiceNow and locate the incident ticket
2. Verify if the issue is isolated to one user or multiple users
3. Check VPN service status at [https://status.enterprisetechsolutions.com](https://status.enterprisetechsolutions.com)
4. Check SolarWinds NPM for VPN alerts

### Step 2: Initial Troubleshooting (Single User)
If the issue is isolated to one user:
1. Guide user through [VPN Setup & Reset Guide – VPN Reset](../IT/VPN_Reset_Guide.md#vpn-reset)
2. Verify user has stable internet connection
3. Verify user is using correct VPN server: `vpn.enterprisetechsolutions.com`
4. Verify user can authenticate to Okta
5. Verify user's MFA is working (see [MFA Setup Guide – Troubleshooting](../IT/MFA_Setup_Guide.md#troubleshooting))

### Step 3: Initial Troubleshooting (Multiple Users/Outage)
If multiple users are affected:
1. Check VPN service status page: [https://status.enterprisetechsolutions.com](https://status.enterprisetechsolutions.com)
2. Log in to Cisco ASA VPN console
3. Check VPN tunnel status:
   ```
   show vpn-sessiondb
   ```
4. Check system logs for errors:
   ```
   show logging
   ```
5. Verify internet connectivity from VPN concentrator
6. Verify Okta is reachable from VPN concentrator
7. Check if any recent changes were made to VPN configuration

### Step 4: Escalate if Needed
- If P1/P2 outage, notify Networking Team immediately
- If issue is with Okta, notify Okta Admin Team
- If issue is with internet service provider (ISP), notify IT Director
- Update ServiceNow ticket with all actions taken

### Step 5: Resolve the Issue
- Apply appropriate fix based on root cause
- Test VPN connectivity
- Notify affected users
- Update ServiceNow ticket with resolution details

### Step 6: Post-Incident Review
- For P1/P2 incidents, conduct a post-incident review within 3 business days
- Document lessons learned
- Update runbook if needed

## Troubleshooting for Users
| Symptom | Solution |
|---------|----------|
| "VPN connection failed" | See [VPN Setup & Reset Guide – Troubleshooting](../IT/VPN_Reset_Guide.md#troubleshooting) |
| "MFA not working" | See [MFA Setup Guide – Troubleshooting](../IT/MFA_Setup_Guide.md#troubleshooting) |
| "No internet while on VPN" | Verify split tunnel is enabled; contact IT Support if not |
| "VPN is slow" | Check local internet speed, try wired connection, contact IT Support |

## Best Practices
- Always verify if issue is single user or widespread
- Check service status page first
- Document all actions taken in ServiceNow
- Escalate promptly for P1/P2 incidents
- Conduct post-incident reviews for major outages

## Warnings
- **WARNING**: Do not make untested changes to VPN configuration during an outage.
- **WARNING**: Always have a rollback plan before making changes.

## Escalation Path
1. Level 1 Support → Level 2 Support (Networking Team)
2. Level 2 Support → Network Engineering Team
3. Network Engineering Team → IT Director
4. IT Director → CIO (for major outages)

## Notes
- VPN service status is monitored 24/7
- All VPN configuration changes require approval from Network Engineering Manager
- VPN logs are retained for 180 days

## Related Documents
- [VPN Setup & Reset Guide](../IT/VPN_Reset_Guide.md)
- [Remote Access Policy](../HR/Remote_Access_Policy.md)
- [Incident Response Playbook](../Security/Incident_Response_Playbook.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- Networking Team: networking@enterprisetechsolutions.com
- VPN Service Status: [https://status.enterprisetechsolutions.com](https://status.enterprisetechsolutions.com)

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-12 | Sarah Jenkins | Added service status check steps |
| 1.0 | 2026-04-01 | Marcus Vance | Initial release |
