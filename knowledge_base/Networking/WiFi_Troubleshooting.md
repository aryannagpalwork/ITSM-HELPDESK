
---
title: Enterprise WiFi Troubleshooting Guide
department: Networking
category: Troubleshooting
version: 2.0
author: Marcus Vance (Network Engineer)
created: 2025-04-01
last_updated: 2026-05-25
tags: Wi-Fi, wireless, network, troubleshooting, connectivity
---

# Enterprise WiFi Troubleshooting Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-04-01 | Marcus Vance | Initial creation |
| 2.0 | 2026-05-25 | Sarah Jenkins | Added 6GHz support, updated SSIDs |

## Purpose
This guide provides step-by-step troubleshooting for EnterpriseTech Solutions wireless network connectivity issues.

## Scope
All employees, contractors, and third-party vendors using EnterpriseTech's enterprise Wi-Fi networks (ETSI-Employee, ETSI-Guest, ETSI-IoT).

## Available Wi-Fi Networks
| SSID | Purpose | Authentication | Encryption |
|------|---------|----------------|------------|
| ETSI-Employee | Enterprise employees | 802.1X (Okta credentials) | WPA3-Enterprise |
| ETSI-Guest | Visitors, guests | Captive portal | WPA3-Personal |
| ETSI-IoT | Company-owned IoT devices | PSK | WPA3-Personal |

## Prerequisites
- For ETSI-Employee: Valid Okta credentials
- For ETSI-Guest: Invitation from employee (via Guest Wi-Fi portal)
- Device compatible with Wi-Fi 5 (802.11ac), Wi-Fi 6 (802.11ax), or Wi-Fi 6E (802.11ax 6GHz)

## Troubleshooting Decision Tree
```
Is Wi-Fi turned on?
├─ No → Turn on Wi-Fi
└─ Yes → Can you see ETSI-Employee SSID?
   ├─ No → Check Airplane Mode, move closer to AP, restart device
   └─ Yes → Can you connect?
      ├─ No → Forget network, rejoin, check credentials
      └─ Yes → Do you have internet access?
         ├─ No → Check DNS, flush DNS, restart router (if at home)
         └─ Yes → Issue resolved!
```

## Step-by-Step Troubleshooting Procedure
### Step 1: Basic Checks
1. Ensure Wi-Fi is enabled on your device
2. Ensure Airplane Mode is disabled
3. Move closer to a wireless access point (AP)
4. Restart your device

### Step 2: Verify Network Visibility
1. Open Wi-Fi settings on your device
2. Check if you can see "ETSI-Employee", "ETSI-Guest", or "ETSI-IoT"
3. If not:
   - Restart your device
   - Move to a different location in the office
   - Contact IT Support

### Step 3: Connect to ETSI-Employee
1. Select "ETSI-Employee" from Wi-Fi list
2. When prompted, enter:
   - Username: your EnterpriseTech email
   - Password: your EnterpriseTech password
3. Complete MFA via Okta Verify (if prompted)
4. Accept the certificate (if prompted – it should be from "DigiCert")

### Step 4: Forget and Rejoin the Network
If Step 3 fails:
1. Open Wi-Fi settings
2. Find "ETSI-Employee"
3. Click "Forget This Network" (or "Remove")
4. Rejoin the network following Step 3

### Step 5: Check IP Configuration
1. Open Command Prompt (Windows) or Terminal (macOS/Linux)
2. Windows: `ipconfig /all`
3. macOS/Linux: `ifconfig` or `ip addr`
4. Verify:
   - You have an IP address starting with 10.10.x.x (office) or 192.168.x.x (remote VPN)
   - DNS servers are set to 10.0.0.10 and 10.0.0.11

### Step 6: Flush DNS Cache
1. Windows:
   ```
   ipconfig /flushdns
   ```
2. macOS:
   ```
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   ```
3. Linux (systemd-resolved):
   ```
   sudo systemd-resolve --flush-caches
   ```

### Step 7: Test Connectivity
1. Open Command Prompt/Terminal
2. Ping Google DNS:
   ```
   ping 8.8.8.8
   ```
3. If ping succeeds, test DNS resolution:
   ```
   nslookup enterprisetechsolutions.com
   ```

## Common Error Messages & Solutions
| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Unable to join network" | Incorrect credentials, network congestion | Forget network, rejoin, verify credentials |
| "No internet connection" | DNS issue, DHCP failure | Flush DNS, check IP config, contact IT Support |
| "Wi-Fi connected but no internet" | DNS misconfiguration | Set DNS to 10.0.0.10/11, flush DNS |
| "Authentication failed" | Incorrect Okta credentials or MFA | Verify credentials, reset password if needed, check MFA device |
| "Certificate not trusted" | Missing root certificate | Accept the certificate or install DigiCert root from [IT Portal](https://it.enterprisetechsolutions.com) |

## Guest Wi-Fi Access
1. Employee sends invitation via Guest Wi-Fi Portal: [https://guest.enterprisetechsolutions.com](https://guest.enterprisetechsolutions.com)
2. Guest receives email with access code
3. Guest connects to "ETSI-Guest"
4. Guest opens browser, enters access code
5. Guest accepts Acceptable Use Policy
6. Guest has access for 24 hours (extendable via employee request)

## Best Practices
- Use ETSI-Employee for company devices
- Use ETSI-Guest for personal devices and visitors
- Keep your device's Wi-Fi drivers up to date
- Avoid using personal hotspots in the office to reduce interference
- Report dead zones to IT Support

## Warnings
- **WARNING**: Do not connect to untrusted Wi-Fi networks while using company devices.
- **WARNING**: Do not share your ETSI-Employee credentials with anyone, including guests.
- **WARNING**: ETSI-Guest traffic is isolated from the corporate network – do not access sensitive systems while on ETSI-Guest.

## Escalation Path
1. Self-service troubleshooting (this guide)
2. IT Support Desk (Level 1)
3. Networking Team (Level 2) for persistent issues
4. Network Engineering Team (Level 3) for outages

## Notes
- EnterpriseTech Wi-Fi uses 802.11ac (5GHz), 802.11ax (2.4GHz/5GHz), and 802.11ax 6GHz (Wi-Fi 6E) where available
- Wi-Fi coverage maps are available on the IT Portal
- IoT devices must be registered with IT before connecting to ETSI-IoT

## Related Documents
- [DNS Troubleshooting Guide](./DNS_Troubleshooting.md)
- [VPN Setup Guide](../IT/VPN_Reset_Guide.md)
- [Acceptable Use Policy](../Policies/Acceptable_Use_Policy.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- Networking Team: networking@enterprisetechsolutions.com
- Network Engineering Manager: marcus.vance@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 2.0 | 2026-05-25 | Sarah Jenkins | Added Wi-Fi 6E support, updated SSIDs |
| 1.0 | 2025-04-01 | Marcus Vance | Initial release |
