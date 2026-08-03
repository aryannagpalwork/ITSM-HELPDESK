
---
title: Software Installation Guide
department: IT
category: Software
version: 1.1
author: David Chen (IT Security Analyst)
created: 2025-04-01
last_updated: 2026-06-10
tags: software, installation, IT, policy
---

# Software Installation Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-04-01 | David Chen | Initial creation |
| 1.1 | 2026-06-10 | Sarah Jenkins | Added Linux software installation instructions |

## Purpose
This guide outlines how to install software on company-issued laptops and computers at EnterpriseTech Solutions.

## Scope
All employees, contractors, and third-party vendors with company-issued devices.

## Software Categories
### Approved Software
- Available in **Company Portal** (Windows) or **Self Service** (macOS)
- Can be installed without additional approval
- Examples: Microsoft Office, Slack, Microsoft Teams, 1Password, Zoom

### Requested Software
- Not available in Company Portal/Self Service
- Requires IT Security approval
- Submit a ServiceNow request to install

### Unapproved Software
- Must NOT be installed
- Includes: unlicensed software, pirated software, software from untrusted sources, personal antivirus software, games (unless approved by IT)

## Installing Approved Software
### Windows
1. Open **Company Portal** from Start menu
2. Search for the software you want
3. Click "Install"
4. Wait for installation to complete

### macOS
1. Open **Self Service** from Applications folder
2. Search for the software you want
3. Click "Install"
4. Wait for installation to complete

### Linux
1. Use approved package repositories (APT for Ubuntu/Debian, DNF for RHEL/CentOS)
2. For software not in standard repos, submit a ServiceNow request

## Requesting Unapproved Software
1. Go to [ServiceNow](https://itsm.enterprisetechsolutions.com)
2. Create a new "Software Installation Request"
3. Include:
   - Software name and version
   - Business justification
   - Manager's approval
4. IT Security will review and approve/reject within 3 business days
5. If approved, IT will either add it to Company Portal/Self Service or install it remotely

## Uninstalling Software
### Windows
1. Open Settings → Apps → Installed apps
2. Find the software
3. Click "Uninstall"
4. Follow on-screen prompts

### macOS
1. Open Applications folder
2. Drag the software to Trash
3. Empty Trash

### Linux
1. Use package manager (apt remove, dnf remove, etc.)

## Troubleshooting
| Problem | Solution |
|---------|----------|
| "Company Portal/Self Service won't open" | Restart your device, contact IT Support |
| "Software installation fails" | Check internet connection, verify you have space, contact IT Support |
| "Software is not in Company Portal/Self Service" | Submit a ServiceNow request |

## Best Practices
- Only install approved software
- Keep software up to date (install updates from Company Portal/Self Service)
- Uninstall software you no longer use
- Do not share software licenses
- Do not install software from untrusted sources

## Warnings
- **WARNING**: Installing unapproved software violates this policy and the Acceptable Use Policy.
- **WARNING**: Installing unlicensed or pirated software is illegal and may result in disciplinary action or termination.

## Related Documents
- Acceptable Use Policy
- Laptop Provisioning Guide
- Security Policies

## Contact Information
- IT Support Desk: +1 (800) 555-1234
- IT Security Team: security@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-10 | Sarah Jenkins | Added Linux software installation instructions |
| 1.0 | 2025-04-01 | David Chen | Initial release |
