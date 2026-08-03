
---
title: Laptop Provisioning Guide
department: IT
category: User Setup
version: 1.1
author: Sarah Jenkins (IT Support Manager)
created: 2025-03-01
last_updated: 2026-06-10
tags: laptop, provisioning, user setup, IT
---

# Laptop Provisioning Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-03-01 | Sarah Jenkins | Initial creation |
| 1.1 | 2026-06-10 | David Chen | Added Linux laptop instructions |

## Purpose
This guide outlines the process for setting up a new company-issued laptop at EnterpriseTech Solutions.

## Scope
All employees, contractors, and third-party vendors receiving a new company-issued laptop.

## Prerequisites
- Active Okta account
- MFA enabled (see MFA Setup Guide)
- Company email address

## Provisioning Steps
### 1. Unbox and Connect
1. Unbox your laptop
2. Connect charger
3. Connect to office Wi-Fi (ETSI-Employee) or use Ethernet
4. Power on the laptop

### 2. Initial Setup
- **Windows**:
  1. Follow on-screen prompts
  2. When asked to sign in, use your EnterpriseTech Okta credentials
  3. Complete MFA
  4. Accept the terms of use
- **macOS**:
  1. Follow on-screen prompts
  2. When asked to sign in, use your EnterpriseTech Okta credentials
  3. Complete MFA
  4. Enable FileVault encryption (mandatory – see Device Encryption Policy)
- **Linux**:
  1. Follow on-screen prompts
  2. Enable LUKS encryption during setup (mandatory)
  3. Sign in with Okta credentials

### 3. Install Software
1. Open **Company Portal** (Windows) or **Self Service** (macOS)
2. Install required software (Microsoft Office, Slack, Teams, 1Password, etc.)
3. Install any additional approved software you need
4. For Linux, use approved package repositories or request via ServiceNow

### 4. Configure Accounts
1. Sign in to Microsoft Office with Okta credentials
2. Sign in to Slack/Teams with Okta credentials
3. Set up 1Password (request access via ServiceNow if needed)
4. Sign in to any other work-related accounts

### 5. Final Checks
1. Verify BitLocker/FileVault/LUKS is enabled
2. Verify all required software is installed
3. Test email, calendar, and collaboration tools
4. Test VPN (if needed for remote work – see VPN Setup Guide)
5. Contact IT Support if you have any issues

## Troubleshooting
| Problem | Solution |
|---------|----------|
| "Cannot connect to Wi-Fi" | See Wi-Fi Troubleshooting Guide |
| "Cannot sign in to Okta" | Verify credentials, check MFA device, contact IT Support |
| "Software installation fails" | Check internet connection, contact IT Support |
| "VPN won't connect" | See VPN Reset Guide |

## Best Practices
- Keep your laptop up to date with OS and security updates
- Do not install unapproved software (see Software Installation Guide)
- Back up your data to OneDrive for Business regularly
- Do not leave your laptop unattended in public places
- Report any issues to IT Support immediately

## Warnings
- **WARNING**: Do NOT disable encryption on your laptop – this violates the Device Encryption Policy.
- **WARNING**: Do NOT install unapproved software – this may introduce security risks.

## Related Documents
- MFA Setup Guide
- VPN Reset Guide
- Software Installation Guide
- Device Encryption Policy
- Acceptable Use Policy

## Contact Information
- IT Support Desk: +1 (800) 555-1234
- IT Support Manager: sarah.jenkins@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-10 | David Chen | Added Linux laptop instructions |
| 1.0 | 2025-03-01 | Sarah Jenkins | Initial release |
