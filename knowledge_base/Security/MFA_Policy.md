
---
title: Multi-Factor Authentication (MFA) Policy
department: Security
category: Policies
version: 2.1
author: David Chen (IT Security Analyst)
created: 2025-01-20
last_updated: 2026-06-15
tags: MFA, security, policy, Okta, authentication
---

# Multi-Factor Authentication (MFA) Policy

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-01-20 | David Chen | Initial creation |
| 2.0 | 2025-12-01 | Sarah Jenkins | Mandated MFA for all accounts, added vendor requirements |
| 2.1 | 2026-06-15 | Lisa Rodriguez | Clarified emergency access procedures |

## Purpose
This policy requires all users to use Multi-Factor Authentication (MFA) to access EnterpriseTech Solutions information systems, reducing the risk of unauthorized account access from compromised passwords.

## Scope
This policy applies to all users of EnterpriseTech Solutions information systems, including:
- Full-time and part-time employees
- Contractors and temporary workers
- Third-party vendors and partners
- Customers with access to customer portals

## Definitions
- **MFA**: Multi-Factor Authentication – a security system that requires more than one form of verification to access an account
- **Factor**: Something you know (password), something you have (phone, token), or something you are (biometrics)
- **Primary MFA Method**: Okta Verify push notification or TOTP code
- **Backup MFA Method**: SMS or voice call authentication

## Policy Requirements
1. **Mandatory Enrollment**: All users must enroll in MFA within 7 calendar days of account creation. Failure to enroll will result in account suspension.
2. **Primary Method Requirement**: All users must use Okta Verify as their primary MFA method.
3. **Backup Method Recommendation**: All users are strongly recommended to set up SMS or voice call as a backup MFA method.
4. **Device Security**: MFA devices must be secured with a PIN, passcode, or biometric lock.
5. **Device Loss/Theft**: If an MFA‑enrolled device is lost or stolen, IT Support must be notified immediately (within 1 hour).
6. **Device Unenrollment**: When replacing a device, old devices must be unenrolled from MFA before disposal.

## Approved MFA Methods
| Method | Type | Status |
|--------|------|--------|
| Okta Verify Push Notification | Something you have | Primary – Mandatory |
| Okta Verify TOTP Code | Something you have | Primary – Optional alternative |
| SMS Authentication | Something you have | Backup – Recommended |
| Voice Call Authentication | Something you have | Backup – Optional |
| Hardware Security Key (FIDO2) | Something you have | Optional – Available on request |
| Email Authentication | Something you have | Prohibited |
| Security Questions | Something you know | Prohibited |

## Emergency Access
For emergency scenarios where MFA is unavailable (e.g., lost device, network outage):
1. Contact IT Security immediately at security@enterprisetechsolutions.com
2. Provide identity verification (Level 3 – in-person or video ID check)
3. IT Security will temporarily disable MFA for your account for a maximum of 4 hours
4. You must set up MFA on a new device within the temporary window
5. All emergency MFA bypasses are logged and audited by IT Security

## Exceptions
Exceptions to this policy must be approved in writing by the CISO and the user's department VP. Exceptions are reviewed quarterly.

## Enforcement
1. Okta automatically checks for MFA enrollment during login
2. Monthly MFA compliance reports are sent to department VPs
3. Accounts without MFA are suspended after 7 days
4. Policy violations may result in disciplinary action up to termination

## Best Practices
- Use Okta Verify as your primary MFA method
- Set up SMS as a backup method
- Keep your MFA device secure with a passcode or biometric lock
- Notify IT immediately if your device is lost or stolen
- Unenroll old devices when replacing them
- Do not share your MFA device with anyone

## Warnings
- **WARNING**: MFA is mandatory for all accounts. No exceptions without written CISO approval.
- **WARNING**: If you lose your MFA‑enrolled device and fail to notify IT within 1 hour, you may be subject to disciplinary action.
- **WARNING**: Emergency MFA bypasses are only for true emergencies and are logged for audit purposes.

## Escalation Path
1. MFA enrollment issues → IT Support Desk
2. Lost/stolen MFA device → IT Support Desk + IT Security
3. Policy questions/exceptions → CISO
4. Suspected MFA compromise → IT Security immediately

## Notes
- Okta Verify supports biometric authentication (Face ID, fingerprint) for faster login
- FIDO2 hardware security keys are available upon request for users requiring additional security
- All MFA activity is logged and retained for 180 days

## Related Documents
- [Password Policy](./Password_Policy.md)
- [MFA Setup Guide](../IT/MFA_Setup_Guide.md)
- [Acceptable Use Policy](../Policies/Acceptable_Use_Policy.md)
- [Data Classification Policy](./Data_Classification_Policy.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- IT Security Team: security@enterprisetechsolutions.com
- CISO: lisa.rodriguez@enterprisetechsolutions.com
- Okta Admin Team: okta-admins@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.1 | 2026-06-15 | Lisa Rodriguez | Added emergency access procedures |
| 2.0 | 2025-12-01 | Sarah Jenkins | Mandated MFA for all accounts |
| 1.0 | 2025-01-20 | David Chen | Initial release |
