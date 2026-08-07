import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Info,
  CheckCircle2,
  X,
  Sparkles,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';
import { SystemAlert, UserNotification } from '../shared/types';
import { getActiveAlerts, getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../shared/api';
import { useApp } from '../shared/AppContext';

interface MergedItem {
  id: string;
  itemType: 'alert' | 'notification';
  title: string;
  message: string;
  recommendation?: string | null;
  category?: string | null;
  source?: 'manual' | 'auto_detected';
  ticketId?: string | null;
  alertId?: string | null;
  read: boolean;
  createdAt: string;
  originalAlert?: SystemAlert;
  originalNotif?: UserNotification;
}

/**
 * Treat bare ISO timestamps (no trailing Z or offset) as UTC,
 * because the backend stores everything in datetime.utcnow().
 */
function parseUtcDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }
  return new Date(dateStr + 'Z');
}

export const NotificationCenter: React.FC = () => {
  const { currentUser } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [toasts, setToasts] = useState<MergedItem[]>([]);

  // Employee-only: track dismissed alert IDs (persisted in localStorage)
  const [employeeDismissedAlertIds, setEmployeeDismissedAlertIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('employee_dismissed_alert_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const knownItemIds = useRef<Set<string>>(new Set());

  const isEmployee = currentUser?.role === 'Employee';
  const isAgent = currentUser?.role === 'Agent';

  const fetchItems = async () => {
    try {
      const [fetchedAlerts, fetchedNotifs] = await Promise.all([
        getActiveAlerts().catch(() => []),
        getMyNotifications().catch(() => []),
      ]);

      setAlerts(fetchedAlerts);
      setNotifications(fetchedNotifs);

      const activeAlertIds = new Set(fetchedAlerts.map(a => a.id));

      // Determine visible alerts/notifications according to role so the
      // toast detection and unread counts remain consistent with the
      // dropdown list rendering (avoids duplicate toasts for alert+notif).
      const visibleAlerts = currentUser?.role === 'Employee'
        ? fetchedAlerts.filter((a) => {
            try {
              return !employeeDismissedAlertIds.has(a.id);
            } catch {
              return true;
            }
          })
        : []; // Agents and admins no longer receive alerts in the bell; alerts are shown in dedicated alert pages.

      // Role-specific notification visibility for toast detection
      const visibleNotifs = currentUser?.role === 'Employee'
        ? fetchedNotifs.filter((n) => !n.read && (!n.alertId || activeAlertIds.has(n.alertId)))
        : currentUser?.role === 'Agent'
        ? fetchedNotifs.filter((n) => !n.read && (!n.alertId || !activeAlertIds.has(n.alertId)))
        : /* Administrator */ [];

      // Build merged items for toast detection from the visible sets only
      const allCurrent: MergedItem[] = [
        ...visibleAlerts.map((a) => ({
          id: `alert-${a.id}`,
          itemType: 'alert' as const,
          title: a.title,
          message: a.message,
          recommendation: a.recommendation,
          category: a.category,
          source: a.source,
          read: false,
          createdAt: a.createdAt,
          originalAlert: a,
        })),
        ...visibleNotifs.map((n) => ({
          id: `notif-${n.id}`,
          itemType: 'notification' as const,
          title: n.title,
          message: n.message,
          ticketId: n.ticketId,
          alertId: n.alertId,
          read: n.read,
          createdAt: n.createdAt,
          originalNotif: n,
        })),
      ];

      if (isInitialMount.current) {
        allCurrent.forEach((item) => knownItemIds.current.add(item.id));
        isInitialMount.current = false;
      } else {
        const newlyArrived = allCurrent.filter((item) => !knownItemIds.current.has(item.id));
        if (newlyArrived.length > 0) {
          newlyArrived.forEach((item) => knownItemIds.current.add(item.id));
          setToasts((prev) => [...newlyArrived, ...prev].slice(0, 3));
        }
      }
    } catch {
      // Ignore polling errors silently
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss toasts after 8 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

    const activeAlertIds = new Set(alerts.map((a) => a.id));

  // ── Build the merged dropdown list based on role ──
  //
  // AGENT: sees ALL active alerts + standalone notifications only.
  //        Notifications that are linked to an active alert (alertId is set and
  //        that alert is still active) are hidden here because the alert card
  //        already represents them — showing both would be a duplicate.
  //        Read notifications are dimmed but stay in the list.
  //        Items only disappear when the admin resolves the alert.
  //
  // EMPLOYEE: sees undismissed alerts + unread notifications.
  //           "Mark all as read" dismisses everything.

  // Keep existing behaviour for rendering but derive from the already-fetched
  // `alerts` and `notifications` state so counts remain consistent.
  const visibleAlerts = isEmployee
    ? alerts.filter((a) => !employeeDismissedAlertIds.has(a.id))
    : []; // remove alerts from agent/admin bell view

  const visibleNotifs = isEmployee
    ? notifications.filter((n) => !n.read && (!n.alertId || activeAlertIds.has(n.alertId)))
    : currentUser?.role === 'Agent'
    ? notifications.filter((n) => !n.read && (!n.alertId || !activeAlertIds.has(n.alertId)))
    : []; // admins no longer use the bell for alerts or other notification tab behavior

  const mergedHistory: MergedItem[] = [
    ...visibleAlerts.map((a) => ({
      id: `alert-${a.id}`,
      itemType: 'alert' as const,
      title: a.title,
      message: a.message,
      recommendation: a.recommendation,
      category: a.category,
      source: a.source,
      read: false,
      createdAt: a.createdAt,
      originalAlert: a,
    })),
    ...visibleNotifs.map((n) => ({
      id: `notif-${n.id}`,
      itemType: 'notification' as const,
      title: n.title,
      message: n.message,
      ticketId: n.ticketId,
      alertId: n.alertId,
      read: n.read,
      createdAt: n.createdAt,
      originalNotif: n,
    })),
  ].sort((a, b) => parseUtcDate(b.createdAt).getTime() - parseUtcDate(a.createdAt).getTime());

  // Unread count
  const unreadNotifCount = visibleNotifs.filter((n) => !n.read).length;
  const unreadAlertCount = visibleAlerts.length;
  const totalUnreadCount = unreadAlertCount + unreadNotifCount;

  // ── Click handlers ──

  const handleItemClick = async (item: MergedItem) => {
    if (item.itemType === 'notification' && item.originalNotif) {
      const notif = item.originalNotif;
      if (!notif.read) {
        try {
          await markNotificationRead(notif.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
          );
        } catch {
          // ignore
        }
      }
      // For Employee: marking read causes it to disappear (filtered out above).
      // For Agent: marking read only dims it — item stays in list.
    }
    // Clicking an alert item: no action for agents (stays as-is).
    // For employees: dismiss it.
    if (item.itemType === 'alert' && item.originalAlert && isEmployee) {
      const newDismissed = new Set(employeeDismissedAlertIds).add(item.originalAlert.id);
      setEmployeeDismissedAlertIds(newDismissed);
      try {
        localStorage.setItem('employee_dismissed_alert_ids', JSON.stringify(Array.from(newDismissed)));
      } catch { /* ignore */ }
    }
  };

  // Employee-only: Mark all as read (marks all notifications + dismisses all alerts)
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      // Also dismiss all alerts for employee session
      const newDismissed = new Set(employeeDismissedAlertIds);
      alerts.forEach((a) => newDismissed.add(a.id));
      setEmployeeDismissedAlertIds(newDismissed);
      try {
        localStorage.setItem('employee_dismissed_alert_ids', JSON.stringify(Array.from(newDismissed)));
      } catch { /* ignore */ }

      setToasts([]);
    } catch {
      // ignore
    }
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = parseUtcDate(dateStr);
      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diff < 0 || diff < 10) return 'Just now';
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all focus:outline-none"
        title="Notifications & Alerts"
      >
        <Bell className="w-5 h-5 text-zinc-300 hover:text-white transition-colors" />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-[10px] font-bold text-white shadow-md animate-pulse">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      {/* ── Toast Popups ── wider, fully opaque, high z-index */}
      <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ width: '420px', maxWidth: '95vw' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl shadow-2xl shadow-black/80 border border-zinc-600 flex items-start gap-3 animate-slideInRight"
            style={{ padding: '16px 18px', backgroundColor: '#0e0e11' }}
          >
            <div className="shrink-0 mt-0.5">
              {toast.itemType === 'alert' || toast.alertId ? (
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Info className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-1.5">
                <span className="text-[13px] font-bold text-white truncate flex-1">{toast.title}</span>
                <span className="text-[11px] text-zinc-400 shrink-0 whitespace-nowrap">{formatRelativeTime(toast.createdAt)}</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">{toast.message}</p>
            </div>

            <button
              type="button"
              onClick={() => handleDismissToast(toast.id)}
              className="shrink-0 text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-700/60 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Dropdown Menu ── */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl overflow-hidden border border-zinc-700 z-[9999] animate-fadeIn"
          style={{ backgroundColor: '#0e0e11' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between" style={{ backgroundColor: '#09090b' }}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">Notifications & Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mark all as read: ONLY for Employee role */}
              {isEmployee && totalUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-amber-500/10"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all as read</span>
                </button>
              )}
              {totalUnreadCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {totalUnreadCount}
                </span>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/60" style={{ backgroundColor: '#0e0e11' }}>
            {mergedHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-50" />
                No active notifications or alerts
              </div>
            ) : (
              mergedHistory.map((item) => {
                const isAlertItem = item.itemType === 'alert';
                const isRead = item.read;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 transition-colors cursor-pointer hover:bg-zinc-800/80 relative ${
                      isRead ? 'opacity-50' : ''
                    }`}
                    style={{ backgroundColor: '#0e0e11' }}
                  >
                    {/* Unread dot — only for unread items */}
                    {!isRead && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}

                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {isAlertItem || item.alertId ? (
                          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Info className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold truncate ${isRead ? 'text-zinc-400' : 'text-white'}`}>{item.title}</span>
                          {isAlertItem && (
                            <>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                                  item.source === 'auto_detected'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}
                              >
                                {item.source === 'auto_detected' ? 'Auto-Detected' : 'Manual'}
                              </span>
                              {item.category && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                  {item.category}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <p className={`text-xs leading-relaxed ${isRead ? 'text-zinc-500' : 'text-zinc-300'}`}>{item.message}</p>

                        {/* KB Recommendation */}
                        {isAlertItem && item.recommendation && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed">
                            <div className="flex items-center gap-1 font-bold text-amber-400 mb-1 text-[10px] uppercase tracking-wider">
                              <Sparkles className="w-3 h-3" />
                              <span>KB Recommended Resolution</span>
                            </div>
                            {item.recommendation}
                          </div>
                        )}

                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-zinc-400">
                          <span>{formatRelativeTime(item.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            {!isAlertItem && !isRead && isAgent && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item);
                                }}
                                className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                Mark as read
                              </button>
                            )}
                            {!isAlertItem && !isRead && isAgent && (
                              <span className="text-zinc-500">Click to mark read</span>
                            )}
                            {!isAlertItem && !isRead && isEmployee && (
                              <span className="text-zinc-500">Click to dismiss</span>
                            )}
                            {isRead && (
                              <span className="text-zinc-600 italic">Read</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
