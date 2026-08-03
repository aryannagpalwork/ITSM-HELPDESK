import { Ticket, KnowledgeArticle, TicketComment, Department, DashboardStats } from './types';

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'DEPT01', name: 'Information Technology' },
  { id: 'DEPT02', name: 'Engineering' },
  { id: 'DEPT03', name: 'Human Resources' },
  { id: 'DEPT04', name: 'Finance & Procurement' },
  { id: 'DEPT05', name: 'Operations & Facilities' },
];

// NOTE: MOCK_USERS has been removed. All user data now comes exclusively from the backend API via listAllUsers() and listPendingUsers().
// The admin pages fetch live data from MongoDB through the backend APIs.

export const MOCK_KB_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'KB001',
    title: 'Resetting Corporate Password via Okta SSO',
    category: 'Authentication',
    content: 'To reset your corporate Okta password, navigate to okta.company.com, click on "Forgot Password", and enter your corporate email. You will receive a secure email reset link. If your account is locked out after 5 unsuccessful login attempts, wait 15 minutes for the automatic cooling-off period to elapse, or contact the IT Service Desk directly. For urgent unlock, verify your identity via the Google Authenticator push notification.',
    tags: ['password', 'reset', 'okta', 'sso', 'locked', 'credential'],
  },
  {
    id: 'KB002',
    title: 'Connecting to Corporate GlobalProtect VPN Client',
    category: 'Network',
    content: 'To establish a secure remote connection to the corporate network via GlobalProtect VPN:\n\n1. Launch the Palo Alto GlobalProtect client on your corporate workstation.\n2. In the portal field, type: vpn.enterprise.io.\n3. Click "Connect" and enter your Okta credentials when prompted.\n4. Complete the Multi-Factor Authentication (MFA) challenge on your registered mobile device.\n5. Once connected, your status will change to "Connected" with a shield icon.\n\nTroubleshooting: If connection fails with "Gateway Unreachable", flush your local DNS cache (`ipconfig /flushdns` on Windows or `sudo dscacheutil -flushcache` on macOS) or restart the GlobalProtect service daemon.',
    tags: ['vpn', 'network', 'remote', 'globalprotect', 'gateway', 'internet'],
  },
  {
    id: 'KB003',
    title: 'Corporate Wi-Fi Setup for macOS, Windows, and Linux',
    category: 'Network',
    content: 'To connect to the enterprise office wireless network, select the secure SSID named "Enterprise-Secure". Use your LDAP authentication identity (your corporate email prefix, e.g., "alex.mercer", without the "@enterprise.io" suffix) and standard corporate password. Accept the self-signed Enterprise Root Security Certificate if prompted by your operating system. For external guests and visitors, direct them to "Enterprise-Guest" and obtain the weekly rotated network passcode from the digital signage located in the reception lobby.',
    tags: ['wifi', 'network', 'wireless', 'internet', 'office', 'guest'],
  },
  {
    id: 'KB004',
    title: 'Hardware Procurement and Upgrade Cycles',
    category: 'Procurement',
    content: 'All hardware procurement, peripheral requests, and replacement orders must go through the IT Procurement catalog in the Helpdesk. Standard issued devices include the Apple MacBook Pro 16" (M3 Pro, 32GB RAM) and Lenovo ThinkPad T14 (Gen 5, AMD Ryzen 7). Monitors are standard Dell UltraSharp 27" 4K. Upgrades are permitted every 36 months of active service. All orders require direct budget-holder (Department Head) approval and typically take 3 to 5 business days for staging, asset tagging, and physical delivery.',
    tags: ['hardware', 'laptop', 'monitor', 'procurement', 'upgrade', 'equipment'],
  },
  {
    id: 'KB005',
    title: 'Configuring Corporate Email and Calendar on Mobile',
    category: 'Software',
    content: 'To configure corporate Exchange email and calendars securely on mobile devices:\n\n1. Download the official Microsoft Outlook application from the Apple App Store or Google Play Store.\n2. Open Outlook and enter your full corporate email address: [your_name]@enterprise.io.\n3. The app will redirect you to the Okta identity portal. Login and approve the mobile push notification.\n4. You will be prompted to enroll your device in Microsoft Intune Mobile Device Management (MDM).\n5. Agree to the device security policy compliance requirements to enable mailbox synchronization.\n\nNote: Native mail clients (e.g., Apple Mail or Samsung Mail) are blocked by active conditional access policies.',
    tags: ['email', 'outlook', 'mobile', 'intune', 'mdm', 'exchange', 'calendar'],
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'INC-2026-0412',
    title: 'VPN connection drops periodically every 30 minutes',
    description: 'My GlobalProtect VPN connection terminates automatically every 30 minutes. It requires me to re-authenticate and complete Okta MFA each time, which interrupts my active database sessions and ssh connections. I am running macOS Sonoma on an M3 MacBook Pro.',
    status: 'open',
    priority: 'high',
    userId: 'USR001',
    agentId: 'USR002',
    departmentId: 'DEPT01',
    aiSummary: 'User experiencing recurring disconnection issues on GlobalProtect VPN every 30 minutes, necessitating constant Okta re-authentication. Active SSH sessions disrupted.',
    suggestedResolution: 'Verify if the Okta token lifetime policy for GlobalProtect is set to 30 minutes instead of the standard 8 hours. Check Palo Alto gateway logs for idle-timeout parameters or keep-alive packets blocks.',
    createdAt: '2026-06-29T14:22:00Z',
    updatedAt: '2026-06-30T09:15:00Z',
    userName: 'Alex Mercer',
    agentName: 'Sarah Jenkins',
    departmentName: 'Information Technology',
  },
  {
    id: 'INC-2026-0415',
    title: 'Staging environment database connection timed out',
    description: 'All services in the staging Kubernetes cluster are receiving connection timeouts when trying to write to the staging PostgreSQL database. The database is hosted in AWS RDS, and we verified that the database instance is healthy and running.',
    status: 'in_progress',
    priority: 'critical',
    userId: 'USR001',
    agentId: 'USR002',
    departmentId: 'DEPT01',
    aiSummary: 'Critical database connection timeout issue affecting Kubernetes staging microservices connecting to AWS RDS Postgres. DB instance itself is reporting healthy status.',
    suggestedResolution: 'Investigate VPC security group settings. Check if a recent network security update removed the CIDR block permission of the Kubernetes node subnet from the RDS inbound rule list.',
    createdAt: '2026-06-30T08:45:00Z',
    updatedAt: '2026-06-30T10:00:00Z',
    userName: 'Alex Mercer',
    agentName: 'Sarah Jenkins',
    departmentName: 'Information Technology',
  },
  {
    id: 'INC-2026-0391',
    title: 'Okta MFA device synchronization error',
    description: 'I replaced my mobile phone yesterday and restored from backup. Now, when I try to log in to Okta, the push notification says "Invalid token" or doesn\'t arrive. I need to reset my MFA device enrollment.',
    status: 'resolved',
    priority: 'medium',
    userId: 'USR001',
    agentId: 'USR002',
    departmentId: 'DEPT01',
    aiSummary: 'Okta Multi-Factor Authentication push failure triggered by phone upgrade and backup restore. Device token mismatch.',
    suggestedResolution: 'Temporarily bypassed MFA using an administrator security bypass code, deleted the user\'s stale phone token in the Okta Admin dashboard, and sent a fresh QR enrollment link.',
    createdAt: '2026-06-25T11:10:00Z',
    updatedAt: '2026-06-26T15:30:00Z',
    userName: 'Alex Mercer',
    agentName: 'Sarah Jenkins',
    departmentName: 'Information Technology',
  },
  {
    id: 'INC-2026-0350',
    title: 'Request for secondary 27" Dell Monitor',
    description: 'I need a secondary monitor for my home office setup to increase productivity when doing code reviews. My department lead has already approved the budget.',
    status: 'closed',
    priority: 'low',
    userId: 'USR001',
    agentId: 'USR003',
    departmentId: 'DEPT04',
    aiSummary: 'Standard peripheral request for an additional 27" Dell Monitor. Budget approved by manager.',
    suggestedResolution: 'Procurement order placed. Shipped via FedEx tracking number: FDX-994110. Delivered on June 22nd, 2026.',
    createdAt: '2026-06-18T10:00:00Z',
    updatedAt: '2026-06-22T16:00:00Z',
    userName: 'Alex Mercer',
    agentName: 'Marcus Vance',
    departmentName: 'Finance & Procurement',
  },
];

export const MOCK_COMMENTS: TicketComment[] = [
  {
    id: 'COM001',
    ticketId: 'INC-2026-0412',
    commenterId: 'USR002',
    commenterName: 'Sarah Jenkins',
    commenterRole: 'Agent',
    content: 'Hi Alex, I have checked the firewall and Okta logs. I do see a disconnect event every exactly 30 minutes. Are you using a wired dock connection or pure Wi-Fi?',
    isInternal: false,
    timestamp: '2026-06-29T16:40:00Z',
  },
  {
    id: 'COM002',
    ticketId: 'INC-2026-0412',
    commenterId: 'USR001',
    commenterName: 'Alex Mercer',
    commenterRole: 'Employee',
    content: 'Hi Sarah, I am using the CalDigit TS4 Thunderbolt dock over a wired ethernet connection. I checked and the same drops occur even when connected directly over Wi-Fi.',
    isInternal: false,
    timestamp: '2026-06-29T17:12:00Z',
  },
  {
    id: 'COM003',
    ticketId: 'INC-2026-0412',
    commenterId: 'USR002',
    commenterName: 'Sarah Jenkins',
    commenterRole: 'Agent',
    content: 'Internal Note: Checked the Palo Alto Gateway settings. The "GlobalProtect-User-Portal-Session-Timeout" parameter is set to 1800 seconds (30 mins) for users assigned to the engineering security group. This is likely an accidental policy override. Contacting network security to review.',
    isInternal: true,
    timestamp: '2026-06-30T09:15:00Z',
  },
  {
    id: 'COM004',
    ticketId: 'INC-2026-0415',
    commenterId: 'USR002',
    commenterName: 'Sarah Jenkins',
    commenterRole: 'Agent',
    content: 'Urgent update: The security group rule change was verified. Terraform apply had run at 08:30 UTC which modified RDS ingress rules. I am restoring the inbound permission now.',
    isInternal: false,
    timestamp: '2026-06-30T09:55:00Z',
  },
  {
    id: 'COM005',
    ticketId: 'INC-2026-0415',
    commenterId: 'USR001',
    commenterName: 'Alex Mercer',
    commenterRole: 'Employee',
    content: 'Verified. Staging databases are responding again, and the k8s pods have successfully completed their connection pool health checks. Thank you!',
    isInternal: false,
    timestamp: '2026-06-30T10:00:00Z',
  },
];

export const getInitialStats = (tickets: Ticket[]): DashboardStats => {
  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'open').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const resolved = tickets.filter(t => t.status === 'resolved').length;
  const closed = tickets.filter(t => t.status === 'closed').length;

  // Compute resolution times from ticket data where possible
  let avgResolutionHours = 14.5;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  if (resolvedTickets.length > 0) {
    const totalHours = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.createdAt).getTime();
      const updated = new Date(t.updatedAt).getTime();
      const hours = (updated - created) / (1000 * 60 * 60);
      return sum + (hours > 0 ? hours : 24); // default 24h if no diff
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
  }

  // Generate daily volume from actual tickets
  const dateMap = new Map<string, { created: number; resolved: number }>();
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    dateMap.set(key, { created: 0, resolved: 0 });
  }
  tickets.forEach(t => {
    const createdDate = new Date(t.createdAt);
    const cKey = `${String(createdDate.getMonth() + 1).padStart(2, '0')}/${String(createdDate.getDate()).padStart(2, '0')}`;
    if (dateMap.has(cKey)) dateMap.get(cKey)!.created++;
    const updatedDate = new Date(t.updatedAt);
    const uKey = `${String(updatedDate.getMonth() + 1).padStart(2, '0')}/${String(updatedDate.getDate()).padStart(2, '0')}`;
    if (dateMap.has(uKey) && (t.status === 'resolved' || t.status === 'closed')) dateMap.get(uKey)!.resolved++;
  });
  const dailyTicketVolume = Array.from(dateMap.entries()).map(([date, data]) => ({
    date, created: data.created, resolved: data.resolved,
  }));

  return {
    totalTickets: total,
    openTickets: open,
    resolvedTickets: resolved,
    closedTickets: closed,
    avgResolutionTimeHours: avgResolutionHours,
    kbUsageCount: 142,
    aiAccuracyRate: 94.2,
    ticketsByPriority: {
      low: tickets.filter(t => t.priority === 'low').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      high: tickets.filter(t => t.priority === 'high').length,
      critical: tickets.filter(t => t.priority === 'critical').length,
    },
    ticketsByStatus: {
      open,
      in_progress: inProgress,
      resolved,
      closed,
    },
    dailyTicketVolume,
  };
};
