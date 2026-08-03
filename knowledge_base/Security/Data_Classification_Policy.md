
---
title: Data Classification Policy
department: Security
category: Policies
version: 2.0
author: Lisa Rodriguez (CISO)
created: 2024-11-15
last_updated: 2026-05-20
tags: data classification, security, policy, data protection
---

# Data Classification Policy

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2024-11-15 | Lisa Rodriguez | Initial creation |
| 2.0 | 2026-05-20 | David Chen | Added AI usage guidelines, updated handling procedures |

## Purpose
This policy defines data classification levels and handling procedures to protect EnterpriseTech Solutions sensitive and confidential information from unauthorized access, disclosure, modification, or destruction.

## Scope
This policy applies to all users of EnterpriseTech Solutions information systems, and all data created, collected, stored, processed, or transmitted by EnterpriseTech.

## Data Classification Levels
| Level | Definition | Examples |
|-------|------------|----------|
| **Restricted** | Data that, if compromised, could cause severe financial, legal, or reputational damage to the company, customers, or employees | Customer PII, employee payroll records, financial statements (before publication), trade secrets, source code, payment card information (PCI) |
| **Confidential** | Data that, if compromised, could cause significant financial, legal, or reputational damage | Internal financial reports, employee performance reviews, customer contracts, unannounced product plans |
| **Internal** | Data that is not intended for public release but would not cause significant damage if disclosed | Internal meeting minutes, employee directory, non-sensitive internal reports |
| **Public** | Data that is intended for public release | Company website content, press releases, marketing materials, public job postings |

## Data Handling Requirements
### Restricted Data
- Must be encrypted at rest and in transit
- Access limited to authorized personnel only (least privilege)
- Must not be stored on personal devices or unapproved cloud services
- Must not be shared via email or unapproved collaboration tools
- Must be disposed of securely (shredding, secure wipe)
- Must not be entered into unapproved AI tools
- Access must be logged and audited regularly

### Confidential Data
- Should be encrypted at rest and in transit
- Access limited to authorized personnel
- Must not be stored on personal devices
- Should not be shared via personal email
- Must be disposed of securely
- Must not be entered into unapproved AI tools
- Access should be logged

### Internal Data
- Can be stored on company devices
- Can be shared internally via approved tools (Slack, Teams, SharePoint)
- Should not be shared publicly
- Disposal should follow standard procedures

### Public Data
- No special handling required
- Can be shared freely
- Must be approved by Marketing before public release

## Data Classification Process
1. Data owner classifies data when created
2. Data is marked with appropriate classification level
3. Access controls are applied based on classification
4. Data is reclassified if its sensitivity changes
5. Data is disposed of securely when no longer needed

## Data Ownership
- **Data Owner**: Department VP or director – responsible for classifying data and ensuring appropriate handling
- **Data Steward**: Designated individual within department – responsible for day-to-day data management
- **Data Custodian**: IT or Security team – responsible for securing and storing data

## AI Usage & Data Classification
- **Restricted/Confidential Data**: Must NOT be entered into any AI tool (ChatGPT, GitHub Copilot, etc.)
- **Internal Data**: May be entered into approved AI tools only (approved list on IT Portal)
- **Public Data**: May be entered into any AI tool
- All AI-generated content must be reviewed and verified for accuracy and data leakage risks

## Consequences of Violation
Violations of this policy may result in:
1. Verbal or written warning
2. Suspension of system access
3. Disciplinary action up to and including termination of employment or contract
4. Legal action if applicable

## Reporting Violations
Suspected violations must be reported to IT Security at security@enterprisetechsolutions.com or via the Ethics Hotline.

## Best Practices
- Classify data when it is created
- Follow least privilege access principles
- Encrypt sensitive data
- Dispose of data securely
- Do not share sensitive data via unapproved channels
- Do not enter sensitive data into unapproved AI tools
- Review and update data classification regularly

## Warnings
- **WARNING**: Mishandling of Restricted or Confidential data may result in termination of employment or contract.
- **WARNING**: Unauthorized disclosure of Restricted data may result in legal action.

## Policy Review
This policy is reviewed annually by the IT Security Team and Legal Department.

## Related Documents
- [Acceptable Use Policy](../Policies/Acceptable_Use_Policy.md)
- [Password Policy](./Password_Policy.md)
- [MFA Policy](./MFA_Policy.md)
- [Incident Response Playbook](./Incident_Response_Playbook.md)

## Contact Information
- IT Security Team: security@enterprisetechsolutions.com
- CISO: lisa.rodriguez@enterprisetechsolutions.com
- Legal Department: legal@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.0 | 2026-05-20 | David Chen | Added AI usage guidelines |
| 1.0 | 2024-11-15 | Lisa Rodriguez | Initial release |
