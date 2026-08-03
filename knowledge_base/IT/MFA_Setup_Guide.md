
---
title: Multi-Factor Authentication (MFA) Setup Guide
department: IT
category: User Access
version: 2.0
author: David Chen (IT Security Analyst)
created: 2025-11-20
last_updated: 2026-05-10
tags: MFA, Okta, security, authentication, setup guide
---

# Multi-Factor Authentication (MFA) Setup Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-11-20 | David Chen | Initial creation |
| 2.0 | 2026-05-10 | Sarah Jenkins | Added SMS backup method, removed deprecated hardware tokens |

## Purpose
This guide provides step-by-step instructions for setting up and managing Multi-Factor Authentication (MFA) using Okta Verify at EnterpriseTech Solutions. MFA is mandatory for all users to enhance account security.

## Scope
All employees, contractors, and third-party vendors with access to EnterpriseTech systems.

## Prerequisites
- Active EnterpriseTech email address
- Smartphone (iOS 14+ or Android 8+)
- Okta Verify app installed (from App Store or Google Play)
- Access to company Wi-Fi or cellular data

## Procedure
### Step 1: Install Okta Verify
1. Open App Store (iOS) or Google Play (Android)
2. Search for "Okta Verify"
3. Download and install the official Okta Verify app (developer: Okta, Inc.

### Step 2: Enroll Your Device
1. Navigate to [https://okta.enterprisetechsolutions.com](https://okta.enterprisetechsolutions.com)
2. Log in with your EnterpriseTech email and password
3. Follow the on-screen prompt to set up MFA
4. Select "Okta Verify" as your primary MFA method
5. Open Okta Verify and tap "Add Account"
6. Scan the QR code displayed in your browser using Okta Verify
7. Confirm the 6-digit code in Okta Verify matches the browser
8. Tap "Finish" in Okta Verify
9. Click "Verify" in your browser

### Step 3: Set Up Backup MFA Method (Recommended)
1. In Okta, go to Settings → Security Methods
2. Click "Add Method"
3. Select "SMS Authentication"
4. Enter your mobile phone number (must be a company-issued or personal (with manager approval)
5. Enter the verification code sent via SMS
6. Click "Verify"

## Reset MFA Device
If you get a new phone or lose your device:
1. Contact IT Support at +1 (800) 555-1234
2. Verify your identity (see [Password Reset SOP](./Password_Reset_SOP.md#identity-verification-methods))
3. IT Support will unenroll your old device
4. Follow Steps 1‑3 above to enroll your new device

## Troubleshooting
| Problem | Solution |
|---------|----------|
| Okta Verify won't open | Force close the app, restart your phone, and try again. If the issue persists, uninstall and reinstall Okta Verify. |
| QR code won't scan | Ensure the QR code is not blurry, your phone camera is clean, and there is sufficient lighting. |
| Push notifications not arriving | Check your phone's notification settings for Okta Verify, ensure you are connected to the internet, and verify your device is enrolled correctly. |
| Code not matching | Ensure the time on your phone is set to automatic (not manual). Okta Verify uses time-based one-time passwords (TOTP). |
| Locked out of account | Follow [Password Lockout Runbook](../Incident_Runbooks/Password_Lockout_Runbook.md). |

## Best Practices
- Use Okta Verify as your primary MFA method
- Set up SMS as a backup MFA method
- Never share your MFA codes with anyone, including IT staff
- Keep your phone's operating system and Okta Verify app updated to the latest version
- If you lose your device, notify IT Support immediately
- Unenroll old devices when replacing them

## Warnings
- **WARNING**: MFA is mandatory for all EnterpriseTech accounts. Failure to set up MFA within 7 days of account creation will result in account suspension.
- **WARNING**: Never take screenshots of your Okta Verify QR codes or backup codes. Store backup codes in a secure password manager if you generate them.

## Escalation Path
1. Level 1 Support → Level 2 Support (for persistent MFA issues)
2. Level 2 Support → Okta Admin Team (for account unenrollment)
3. Okta Admin Team → IT Security Team (for suspected MFA compromise)

## Notes
- Backup codes can be generated in Okta Settings → Security Methods (recommended for emergencies only)
- Okta Verify supports biometric authentication (Face ID or fingerprint) for faster login
- Contractors must have their vendor manager approve any MFA changes

## Related Documents
- [Password Policy](../Security/Password_Policy.md)
- [MFA Policy](../Security/MFA_Policy.md)
- [Password Reset SOP](./Password_Reset_SOP.md)
- [Password Lockout Runbook](../Incident_Runbooks/Password_Lockout_Runbook.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- IT Security Team: security@enterprisetechsolutions.com
- Okta Admin Team: okta-admins@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.0 | 2026-05-10 | Sarah Jenkins | Added SMS backup method, removed hardware tokens |
| 1.0 | 2025-11-20 | David Chen | Initial release |

