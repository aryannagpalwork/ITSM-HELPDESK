
---
title: Device Encryption Policy
department: Security
category: Policies
version: 1.1
author: David Chen (IT Security Analyst)
created: 2025-01-20
last_updated: 2026-06-01
tags: device encryption, security, policy, BitLocker, FileVault
---

# Device Encryption Policy

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-01-20 | David Chen | Initial creation |
| 1.1 | 2026-06-01 | Sarah Jenkins | Added Linux encryption instructions |

## Purpose
This policy requires encryption of all company-issued devices to protect sensitive data from unauthorized access in case of loss or theft.

## Scope
All company-issued devices: laptops, desktops, tablets, smartphones.

## Policy Requirements
- **All company-issued devices must be encrypted**
- Windows devices: Use BitLocker
- macOS devices: Use FileVault
- Linux devices: Use LUKS
- Smartphones/tablets: Use built-in encryption (iOS: Passcode/Touch ID/Face ID; Android: Screen lock with encryption)

## Encryption Setup
### Windows (BitLocker)
1. Go to Control Panel → System and Security → BitLocker Drive Encryption
2. Click "Turn on BitLocker"
3. Follow the on-screen instructions
4. Save recovery key to Azure AD (IT will help with this)
5. Restart your device

### macOS (FileVault)
1. Go to System Settings → Privacy & Security → FileVault
2. Click "Turn On"
3. Enter your password
4. Save recovery key to iCloud or give to IT
5. Restart your device

### Linux (LUKS)
1. During OS installation, enable full-disk encryption
2. For existing devices, contact IT Support

## Key Management
- Recovery keys must be stored in Azure AD (IT-managed)
- Do not store recovery keys locally on the device
- If you need your recovery key, contact IT Support

## Compliance Checks
- IT will perform monthly compliance checks
- Non-compliant devices may have network access restricted
- Employees must encrypt their devices within 7 days of receiving them

## Best Practices
- Use a strong password/PIN to unlock your device
- Enable auto-lock after 5 minutes of inactivity
- Never leave your device unattended in public places
- Report lost or stolen devices to IT immediately (within 1 hour)
- Do not disable encryption without IT approval

## Warnings
- **WARNING**: Disabling device encryption violates this policy and may result in disciplinary action.
- **WARNING**: If your device is lost or stolen and unencrypted, sensitive company data may be compromised.

## Related Documents
- Incident Response Playbook
- Device Loss/Theft Policy
- Data Classification Policy
- Acceptable Use Policy

## Contact Information
- IT Support Desk: +1 (800) 555-1234
- IT Security Team: security@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-01 | Sarah Jenkins | Added Linux encryption instructions |
| 1.0 | 2025-01-20 | David Chen | Initial release |
