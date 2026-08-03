
---
title: Azure Virtual Machine (VM) Access Guide
department: Cloud Engineering
category: Cloud
version: 1.1
author: David Chen (Cloud Engineer)
created: 2025-07-01
last_updated: 2026-06-18
tags: Azure, VM, cloud, access, virtual machine
---

# Azure Virtual Machine (VM) Access Guide

## Version Control
| Version | Date | Author | Changes Made |
|---------|------|--------|--------------|
| 1.0 | 2025-07-01 | David Chen | Initial creation |
| 1.1 | 2026-06-18 | Sarah Jenkins | Added Microsoft Entra ID (Azure AD) instructions |

## Purpose
This guide provides step-by-step instructions for accessing EnterpriseTech Solutions Azure Virtual Machines (VMs).

## Scope
All employees, contractors, and third-party vendors requiring access to Azure VMs.

## Prerequisites
1. Active Azure account with appropriate RBAC (Role-Based Access Control) permissions
2. MFA enabled on Azure account (mandatory)
3. Company-issued laptop
4. VPN connection if accessing from outside the office (see [VPN Setup & Reset Guide](../IT/VPN_Reset_Guide.md))
5. Remote Desktop Protocol (RDP) client (Windows: built-in; macOS: Microsoft Remote Desktop; Linux: Remmina)
6. SSH client (for Linux VMs: built-in on macOS/Linux; PuTTY on Windows)

## Accessing Windows VMs via RDP
1. Connect to VPN (if remote)
2. Go to [Azure Portal](https://portal.azure.com)
3. Navigate to your VM
4. Click "Connect" → "RDP"
5. Download the RDP file
6. Open the RDP file
7. Enter your Azure AD credentials (email + password + MFA)
8. Click "Connect"
9. You should now be connected to the VM!

## Accessing Linux VMs via SSH
1. Connect to VPN (if remote)
2. Go to [Azure Portal](https://portal.azure.com)
3. Navigate to your VM
4. Click "Connect" → "SSH"
5. Copy the SSH command (e.g., `ssh username@vm-ip-address`)
6. Open Terminal (macOS/Linux) or PuTTY (Windows)
7. Paste the SSH command and run it
8. Enter your password or use SSH key
9. Complete MFA if prompted
10. You should now be connected to the VM!

## Accessing VMs via Azure Bastion
For VMs without public IP addresses:
1. Connect to VPN (if remote)
2. Go to [Azure Portal](https://portal.azure.com)
3. Navigate to your VM
4. Click "Connect" → "Bastion"
5. Enter your Azure AD credentials + MFA
6. Click "Connect"
7. You should now be connected to the VM via your browser!

## Requesting VM Access
1. Submit a ServiceNow request at [https://itsm.enterprisetechsolutions.com](https://itsm.enterprisetechsolutions.com)
2. Include:
   - VM name/ID
   - Required access level (Reader, Contributor, Owner)
   - Business justification
   - Manager's approval
3. IT Security will review and approve/reject the request
4. Once approved, access will be granted

## Troubleshooting
| Problem | Solution |
|---------|----------|
| "Cannot connect to VM" | Check VPN connection, verify VM is running, check NSG (Network Security Group) rules, contact Cloud Engineering |
| "Authentication failed" | Verify Azure credentials, ensure MFA is working, check RBAC permissions |
| "Connection timed out" | Check NSG rules, verify VM is running, check internet/VPN connection |

## Best Practices
- Use Azure Bastion for VMs without public IPs
- Use just-in-time (JIT) access for production VMs (request via ServiceNow)
- Do not share VM credentials
- Use Azure AD authentication instead of local accounts where possible
- Log off from VMs when not in use
- Keep RDP/SSH clients updated

## Warnings
- **WARNING**: Production VMs require JIT access – no permanent public IP access allowed.
- **WARNING**: Do not store sensitive data on VM local disks – use Azure Blob Storage or Managed Disks with encryption.
- **WARNING**: All VM access is logged and audited.

## Escalation Path
1. Self-service troubleshooting (this guide)
2. IT Support Desk (Level 1)
3. Cloud Engineering Team (Level 2)

## Notes
- JIT access requests are approved by Cloud Engineering
- VM access is reviewed monthly and removed if no longer needed
- Production VMs are backed up daily; non-production VMs are backed up weekly

## Related Documents
- [AWS RDS Connectivity Guide](./AWS_RDS_Connectivity.md)
- [VPN Setup & Reset Guide](../IT/VPN_Reset_Guide.md)
- [Data Classification Policy](../Security/Data_Classification_Policy.md)

## Contact Information
- IT Support Desk: +1 (800) 555-1234 | itsupport@enterprisetechsolutions.com
- Cloud Engineering Team: cloud@enterprisetechsolutions.com
- Cloud Engineering Manager: david.chen@enterprisetechsolutions.com

## Revision History
| Revision | Date | Author | Description |
|----------|------|--------|-------------|
| 1.1 | 2026-06-18 | Sarah Jenkins | Updated to Microsoft Entra ID |
| 1.0 | 2025-07-01 | David Chen | Initial release |
