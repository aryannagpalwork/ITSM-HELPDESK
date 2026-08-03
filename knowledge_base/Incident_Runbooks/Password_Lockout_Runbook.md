
---
title: Password Lockout Incident Runbook
department: IT
category: Incident Response
version: 1.1
author: Sarah Jenkins (IT Support Manager)
created: 2026-03-01
last_updated: 2026-06-10
tags: password lockout, incident, runbook, IT support, Okta
---

# Password Lockout Incident Runbook

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2026-03-01 | Sarah Jenkins | Initial creation |
| 1.1 | 2026-06-10 | David Chen | Added escalation to security for suspicious lockouts |

## Purpose
This runbook provides step-by-step instructions for resolving user password lockout incidents at EnterpriseTech Solutions.

## Scope
All employees, contractors, and third-party vendors experiencing an Okta password lockout.

## Definition of Lockout
An account is locked after **5 consecutive failed login attempts** within a 15-minute window. Locked accounts remain locked for **30 minutes** unless manually unlocked by IT Support.

## Prerequisites for IT Support
1. Access to Okta Admin Console
2. Access to ServiceNow for ticketing
3. Knowledge of [Password Reset SOP](../IT/Password_Reset_SOP.md)
4. Knowledge of [Password Policy](../Security/Password_Policy.md)

## Incident Classification
| Severity | Criteria | Target Resolution Time |
|----------|----------|-----------------------|
| P1 (Critical) | Executive account lockout, multiple users locked out | 15 minutes |
| P2 (High) | Single user lockout preventing critical work | 30 minutes |
| P3 (Medium) | Single user lockout with no critical impact | 1 hour |

## Procedure for IT Support
### Step 1: Verify the Incident
1. Open ServiceNow and locate the incident ticket
2. Confirm user identity using [Password Reset SOP – Identity Verification Methods](../IT/Password_Reset_SOP.md#identity-verification-methods)
3. Check Okta Admin Console for user's lockout status:
   - Navigate to Okta Admin → Directory → People
   - Search for user email
   - View "Account Status" (should show "Locked")

### Step 2: Determine Root Cause
Check Okta Admin Console → Reports → Authentication Logs to identify:
- Number of failed attempts
- Location/IP of failed attempts
- Time of failed attempts
- User agent (browser/device used)
- Look for signs of compromise:
  - Failed attempts from unknown locations/IPs
  - Multiple failed attempts in quick succession from unknown devices
  - Attempts to log in to other systems with the same credentials

### Step 3: Unlock the Account
#### If no signs of compromise:
1. In Okta Admin Console, go to user profile
2. Click "Unlock Account"
3. Instruct user to log in using their existing password
4. If user forgot their password, follow [Password Reset SOP](../IT/Password_Reset_SOP.md)

#### If signs of compromise:
1. **DO NOT UNLOCK ACCOUNT YET**
2. Immediately notify IT Security Team at security@enterprisetechsolutions.com
3. Follow instructions from IT Security
4. After IT Security clears the account, proceed with unlock/reset
5. Document all steps in the ServiceNow ticket

### Step 4: Educate the User
1. Remind user of [Password Policy](../Security/Password_Policy.md)
2. Encourage use of passphrases and 1Password
3. Advise against sharing passwords or writing them down
4. Instruct user to notify IT immediately if they suspect account compromise

### Step 5: Document the Incident
1. Update ServiceNow ticket with:
   - Lockout time
   - Number of failed attempts
   - Root cause
   - Actions taken
   - User education provided
2. Close ticket if resolved

## Troubleshooting for Users
| Symptom | Solution |
|---------|----------|
| "Your account has been locked due to excessive failed login attempts" | Wait 30 minutes, or contact IT Support for manual unlock |
| "Invalid username or password" after unlock | Ensure Caps Lock is off, verify you are using the correct password, or reset password |
| MFA prompts not appearing | See [MFA Setup Guide – Troubleshooting](../IT/MFA_Setup_Guide.md#troubleshooting) |

## Best Practices
- Always verify user identity before unlocking accounts
- Check Okta logs for signs of compromise
- Educate users on password best practices
- Document all steps in ServiceNow
- Escalate to IT Security immediately if compromise is suspected

## Warnings
- **WARNING**: Never unlock an account without first verifying user identity.
- **WARNING**: If you see signs of compromise, do not unlock the account – contact IT Security immediately.

## Escalation Path
1. Level 1 Support → Level 2 Support (for persistent lockouts)
2. Level 2 Support → IT Security Team (for suspected compromise)
3. IT Security Team → CISO (for large‑scale breaches)

## Notes
- All account unlocks are logged in Okta and retained for 180 days
- Okta automatically unlocks accounts after 30 minutes
- Executive accounts require additional manager approval before unlocking

## Related Documents
- [Password Reset SOP](../IT/Password_Reset_SOP.md)
- [Password Policy](../Security/Password_Policy.md)
- [MFA Policy](../Security/MFA_Policy.md)
- [Incident Response Playbook](../Security/Incident_Response_Playbook.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- IT Security Team: security@enterprisetechsolutions.com
- Okta Admin Team: okta-admins@enterprisetechsolutions.com
- CISO: lisa.rodriguez@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-10 | David Chen | Added security escalation steps |
| 1.0 | 2026-03-01 | Sarah Jenkins | Initial release |
