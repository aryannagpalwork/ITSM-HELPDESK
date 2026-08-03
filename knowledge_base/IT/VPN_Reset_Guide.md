
---
title: VPN Setup & Reset Guide
department: IT
category: Networking
version: 2.1
author: Marcus Vance (Network Engineer)
created: 2025-02-10
last_updated: 2026-06-05
tags: VPN, remote access, networking, setup, reset
---

# VPN Setup & Reset Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-02-10 | Marcus Vance | Initial creation |
| 2.0 | 2025-11-01 | Sarah Jenkins | Added macOS instructions |
| 2.1 | 2026-06-05 | David Chen | Added Linux instructions, updated for split tunnel |

## Purpose
This guide provides step-by-step instructions for setting up and resetting the EnterpriseTech Solutions VPN (Cisco AnyConnect Secure Mobility Client).

## Scope
All employees, contractors, and third-party vendors requiring remote access to EnterpriseTech systems.

## Prerequisites
- Active EnterpriseTech Okta account with MFA enabled
- Company-issued laptop (Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+))
- Stable internet connection
- Cisco AnyConnect client installed (available from Company Portal/Self Service)

## VPN Setup
### Windows
1. Open Company Portal
2. Search for "Cisco AnyConnect Secure Mobility Client"
3. Click "Install"
4. Once installed, open Cisco AnyConnect
5. In the "Connect to" field, enter: `vpn.enterprisetechsolutions.com`
6. Click "Connect"
7. Enter your EnterpriseTech email and password
8. Complete MFA via Okta Verify
9. Click "Accept" to accept the terms of use
10. You are now connected to VPN!

### macOS
1. Open Self Service
2. Search for "Cisco AnyConnect Secure Mobility Client"
3. Click "Install"
4. Once installed, open Cisco AnyConnect from Applications
5. In the "Connect to" field, enter: `vpn.enterprisetechsolutions.com`
6. Click "Connect"
7. Enter your EnterpriseTech email and password
8. Complete MFA via Okta Verify
9. Click "Accept" to accept the terms of use
10. You are now connected to VPN!

### Linux (Ubuntu)
1. Open Terminal
2. Install Cisco AnyConnect dependencies:
   ```
   sudo apt update
   sudo apt install libgtk-3-0 libpangocairo-1.0-0 libatk1.0-0
   ```
3. Download AnyConnect from IT Portal: [https://it.enterprisetechsolutions.com/vpn](https://it.enterprisetechsolutions.com/vpn)
4. Extract the archive and run the installer
5. Follow the on-screen instructions
6. Once installed, open Cisco AnyConnect
7. In the "Connect to" field, enter: `vpn.enterprisetechsolutions.com`
8. Click "Connect"
9. Enter your EnterpriseTech email and password
10. Complete MFA via Okta Verify
11. Click "Accept" to accept the terms of use
12. You are now connected to VPN!

## VPN Reset
If you are experiencing issues with VPN:
1. Disconnect from VPN (if connected)
2. Close Cisco AnyConnect completely
3. Follow these steps for your OS:

### Windows
1. Open Command Prompt as Administrator
2. Run:
   ```
   ipconfig /flushdns
   netsh winsock reset
   ```
3. Restart your laptop
4. Reconnect to VPN following [VPN Setup](#vpn-setup)

### macOS
1. Open Terminal
2. Run:
   ```
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   ```
3. Restart your laptop
4. Reconnect to VPN following [VPN Setup](#vpn-setup)

### Linux (Ubuntu)
1. Open Terminal
2. Run:
   ```
   sudo systemd-resolve --flush-caches
   sudo systemctl restart systemd-resolved
   ```
3. Restart your laptop
4. Reconnect to VPN following [VPN Setup](#vpn-setup)

## Split Tunnel Configuration
EnterpriseTech VPN uses split tunneling, meaning only traffic destined for internal systems goes through VPN; internet traffic goes directly through your local connection. No user configuration needed!

## Troubleshooting
| Problem | Solution |
|---------|----------|
| "VPN connection failed" | Check internet connection, restart laptop, reset VPN (above), contact IT Support |
| "MFA prompt not appearing" | Check Okta Verify app, ensure you are logged in, restart Okta Verify |
| "No internet access while connected to VPN" | This is normal – split tunneling should route internet locally. If not, contact IT Support. |
| "VPN is slow" | Check your internet speed, move closer to router, try wired connection if possible, contact Networking Team |
| "Certificate error" | Ensure you are using the correct VPN server: `vpn.enterprisetechsolutions.com` |

## Best Practices
- Connect to VPN only when you need access to internal systems
- Disconnect from VPN when not in use
- Use a wired internet connection if possible for better VPN performance
- Keep Cisco AnyConnect updated to the latest version
- Do not share VPN access with anyone

## Warnings
- **WARNING**: VPN is for authorized users only. Unauthorized access is prohibited and may result in legal action.
- **WARNING**: All VPN activity is logged and monitored.
- **WARNING**: Do not use VPN for illegal activities or to access unauthorized systems.

## Escalation Path
1. Self-service troubleshooting (this guide)
2. IT Support Desk (Level 1)
3. Networking Team (Level 2)

## Notes
- VPN sessions automatically disconnect after 12 hours of inactivity
- VPN is not required for Office 365, Slack, or other SaaS applications (split tunneling)
- Full tunnel VPN is available for specific use cases – request via ServiceNow

## Related Documents
- [Remote Access Policy](../HR/Remote_Access_Policy.md)
- [Wi‑Fi Troubleshooting Guide](../Networking/WiFi_Troubleshooting.md)
- [VPN Failure Runbook](../Incident_Runbooks/VPN_Failure_Runbook.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- Networking Team: networking@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.1 | 2026-06-05 | David Chen | Added Linux instructions, split tunnel info |
| 2.0 | 2025-11-01 | Sarah Jenkins | Added macOS instructions |
| 1.0 | 2025-02-10 | Marcus Vance | Initial release |
