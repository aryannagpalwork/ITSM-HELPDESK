
---
title: Enterprise Password Policy
department: Security
category: Policies
version: 3.1
author: Lisa Rodriguez (Chief Information Security Officer)
created: 2024-10-05
last_updated: 2026-06-01
tags: password, security, policy, access management
---

# Enterprise Password Policy

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2024-10-05 | Lisa Rodriguez | Initial creation |
| 2.0 | 2025-08-15 | David Chen | Increased minimum length to 14 characters, added passphrase support |
| 3.0 | 2026-02-20 | Sarah Jenkins | Added password manager requirement |
| 3.1 | 2026-06-01 | Lisa Rodriguez | Updated expiration schedule for privileged accounts |

## Purpose
This policy defines password complexity, management, and usage requirements to protect EnterpriseTech Solutions information systems and data from unauthorized access.

## Scope
This policy applies to all users of EnterpriseTech Solutions information systems, including employees, contractors, vendors, partners, and customers with system access.

## Password Requirements
### Minimum Complexity
All passwords must meet or exceed the following requirements:
| Characteristic | Requirement |
|----------------|-------------|
| Minimum length | 14 characters |
| Maximum length | 64 characters |
| Uppercase letters | At least 1 |
| Lowercase letters | At least 1 |
| Numeric digits | At least 1 |
| Special characters | At least 1 (e.g., !, @, #, $, %, ^, &amp; *) |
| Passphrase alternative | Minimum 20 characters, no complexity requirements (encouraged for better usability) |

### Prohibited Content
Passwords must NOT contain:
- Your first, middle, or last name
- Your username or employee ID
- Your birthdate, anniversary, or other personal information
- The company name, product names, or internal terms (e.g., "EnterpriseTech", "Okta", "ServiceNow")
- Sequential characters (e.g., "12345", "abcde")
- Repetitive characters (e.g., "aaaaa", "11111")
- Common dictionary words or phrases (e.g., "password", "qwerty", "letmein")
- Previously used passwords (last 24 passwords cannot be reused)

## Password Expiration
| Account Type | Expiration Period |
|--------------|------------------|
| Regular user accounts | Every 90 days |
| Privileged accounts (Admin, Domain Admin, Root) | Every 30 days |
| Service accounts | Every 180 days (automated rotation preferred) |

## Password Management
1. **Password Managers**: All users must use an approved enterprise password manager (1Password) to store and manage passwords.
2. **Unique Passwords**: Every account must have a unique, non-reused password.
3. **Sharing Prohibited**: Passwords must never be shared with anyone, including IT staff.
4. **Storage**: Passwords must never be written down on paper, stored in plain text files, or saved in browser password managers. Use 1Password only.
5. **MFA Mandatory**: All accounts must have MFA enabled (see [MFA Policy](./MFA_Policy.md)).

## Password Reset
Follow [Password Reset SOP](../IT/Password_Reset_SOP.md) for all password reset requests.

## Passphrase Recommendations
Passphrases are strongly encouraged instead of traditional passwords! They are easier to remember and more secure. Examples:
- `PurplePenguinDancesAtDawn2026!`
- `BrewingLatteWithCinnamonAndMaple` (28 characters, no complexity requirements needed)

## Enforcement
1. Okta automatically enforces password complexity and expiration requirements
2. Privileged account password changes are audited weekly
3. Quarterly password security audits are performed by IT Security
4. Users failing to comply may have their accounts suspended pending corrective action

## Best Practices
- Use passphrases instead of passwords
- Use 1Password to generate unique, secure passwords
- Change passwords immediately if there is any suspicion of compromise
- Enable biometric authentication (Face ID, fingerprint) where available
- Regularly review accounts in 1Password for weak or reused passwords

## Warnings
- **WARNING**: Sharing your password with anyone is grounds for disciplinary action up to and including termination of employment or contract.
- **WARNING**: Storing passwords in plain text, browser password managers, or on paper violates this policy and may result in account suspension.
- **CRITICAL**: Privileged account passwords must be rotated immediately if there is any indication of compromise, and IT Security must be notified within 1 hour.

## Escalation Path
1. Policy violations → IT Security Team
2. Suspected password compromise → IT Security Team immediately (within 1 hour)
3. Policy clarification → CISO or IT Security Manager

## Notes
- Service account passwords must be stored in the enterprise secrets vault (HashiCorp Vault)
- Emergency "break‑glass" accounts have unique, long passphrases that are only used for emergency access
- All password changes are logged in Okta and retained for 180 days

## Related Documents
- [MFA Policy](./MFA_Policy.md)
- [Acceptable Use Policy](../Policies/Acceptable_Use_Policy.md)
- [Data Classification Policy](./Data_Classification_Policy.md)
- [Password Reset SOP](../IT/Password_Reset_SOP.md)
- [Password Lockout Runbook](../Incident_Runbooks/Password_Lockout_Runbook.md)

## Contact Information
- IT Security Team: security@enterprisetechsolutions.com
- CISO: lisa.rodriguez@enterprisetechsolutions.com
- IT Support Desk: +1 (800) 555-1234

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 3.1 | 2026-06-01 | Lisa Rodriguez | Updated privileged account expiration |
| 3.0 | 2026-02-20 | Sarah Jenkins | Added password manager requirement |
| 2.0 | 2025-08-15 | David Chen | Increased minimum length, added passphrases |
| 1.0 | 2024-10-05 | Lisa Rodriguez | Initial release |
