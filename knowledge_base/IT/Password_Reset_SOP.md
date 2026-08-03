
---
title: Password Reset Standard Operating Procedure
department: IT
category: User Access
version: 1.2
author: Sarah Jenkins (IT Support Manager)
created: 2026-02-15
last_updated: 2026-06-20
tags: password reset, access management, IT support, SOP
---

# Password Reset Standard Operating Procedure

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2026-02-15 | Sarah Jenkins | Initial creation |
| 1.1 | 2026-04-10 | David Chen | Added MFA enforcement notes |
| 1.2 | 2026-06-20 | Lisa Rodriguez | Updated escalation path |

## Purpose
This document outlines the standard operating procedure for resetting user passwords at EnterpriseTech Solutions to ensure secure and consistent access management practices.

## Scope
This SOP applies to all employees, contractors, and third-party vendors of EnterpriseTech Solutions.

## Prerequisites
1. Valid employee ID or vendor number
2. Ability to verify identity (see Verification Methods below)
3. Access to Okta Verify or configured MFA device (if applicable)

## Identity Verification Methods
| Verification Level | Method | Use Case |
|---------------------|--------|----------|
| Level 1 | Security question + MFA | Remote password reset |
| Level 2 | Manager approval + MFA | After 3 failed attempts |
| Level 3 | In-person ID check | Account lockout &gt; 24 hours |

## Procedure
### Scenario 1: Self-Service Password Reset
1. Navigate to [https://okta.enterprisetechsolutions.com](https://okta.enterprisetechsolutions.com)
2. Click on "Forgot password?"
3. Enter your enterprise email address
4. Complete MFA via Okta Verify push notification or SMS code
5. Answer your pre-configured security question
6. Create new password adhering to [Password Policy](../Security/Password_Policy.md)
7. Click "Reset Password"
8. Confirm successful reset by logging in immediately

### Scenario 2: Assisted Password Reset (IT Support)
1. User contacts IT Support via phone, email, or ticketing system
2. IT Support verifies identity using at least Level 1 or Level 2 method
3. IT Support opens Okta Admin Console
4. Searches for user by email or employee ID
5. Clicks "Reset Password"
6. Enters a temporary password (must comply with Password Policy)
7. Instructs user to log in immediately and change temporary password
8. Creates audit log entry in ServiceNow (INC number must be referenced)

## Troubleshooting
| Error Message | Cause | Solution |
|---------------|-------|----------|
| "MFA device not responding" | User has new phone, device unenrolled | Follow [MFA Reset Guide](./MFA_Setup_Guide.md#reset-mfa-device) |
| "Security question answer incorrect" | User forgot answer | Escalate to manager for approval |
| "Password does not meet complexity requirements" | Password violates [Password Policy](../Security/Password_Policy.md) | Review password requirements and try again |
| "Account locked due to excessive failed attempts" | 5+ failed login attempts | Follow [Password Lockout Runbook](../Incident_Runbooks/Password_Lockout_Runbook.md) |

## Best Practices
- Always verify identity before resetting a password
- Never send passwords via plain text email
- Encourage users to use password managers (e.g., 1Password)
- Remind users to change temporary passwords within 1 hour
- Document all password resets in ServiceNow

## Warnings
- **WARNING**: Never reset a password without verifying user identity. This could lead to unauthorized account access.
- **WARNING**: Temporary passwords must be communicated via secure channels only (encrypted email, phone, or in-person).

## Escalation Path
1. Level 1 Support → Level 2 Support (for complex lockout scenarios)
2. Level 2 Support → IT Security Team (for suspected account compromise)
3. IT Security Team → CISO (for large-scale breaches)

## Notes
- All password resets are logged in Okta and retained for 90 days
- For privileged accounts (Admin, Domain Admin), password resets require manager and IT Security approval
- Contractors must have their vendor manager approve any password reset

## Related Documents
- [Password Policy](../Security/Password_Policy.md)
- [MFA Setup Guide](./MFA_Setup_Guide.md)
- [MFA Policy](../Security/MFA_Policy.md)
- [Password Lockout Runbook](../Incident_Runbooks/Password_Lockout_Runbook.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- IT Security Team: security@enterprisetechsolutions.com
- Okta Admin Team: okta-admins@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.2 | 2026-06-20 | Lisa Rodriguez | Added escalation path to CISO |
| 1.1 | 2026-04-10 | David Chen | Added MFA enforcement notes |
| 1.0 | 2026-02-15 | Sarah Jenkins | Initial release |
