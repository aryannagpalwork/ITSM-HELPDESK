# Alerts + Personal Notifications System Changelog & Complete Specification

This document details all implemented changes, database collections, API endpoints, role-based visibility matrix rules, and frontend components for the **Alerts & Personal Notifications System**.

---

## 1. Role-Based Visibility Matrix

| User Role | Manual System Alerts in Bell | Auto-Detected Spike Alerts in Bell | Admin Dashboard Anomaly Banner | Resolution Survey Request Notification |
| :--- | :--- | :--- | :--- | :--- |
| **Employee (`end_user`)** | ✅ Visible | ❌ Hidden | N/A | ✅ Yes (when ticket resolved) |
| **Agent (`agent`)** | ✅ Visible | ✅ Visible | N/A | ❌ No |
| **Administrator (`admin`)** | ✅ Visible (Others' alerts only; self-created excluded) | ❌ Hidden | ✅ Visible (Persistent ~30s polling banner) | ❌ No |

---

## 2. Implemented Features & Endpoints

### Backend API Routers (`backend/app/api/alerts.py` & `notifications.py`)
- `POST /alerts`: Admin-only alert creation. Runs KB recommendation lookup (`alert_recommendation.py`).
- `GET /alerts/active`: Active system alerts filtered by caller role according to the matrix above.
- `GET /alerts`: Parameterized history lookup for Admin (e.g. `GET /alerts?status=active&source=auto_detected` for anomaly banner).
- `DELETE /alerts/history`: Admin-only endpoint deleting all resolved alerts while preserving active ones.
- `PATCH /alerts/{id}/resolve`: Admin-only endpoint marking an alert as resolved.
- `GET /notifications`: Personal notifications for authenticated users.
- `PATCH /notifications/read-all`: Batch marks all unread personal notifications as read.
- `PATCH /notifications/{id}/read`: Marks individual notification as read.
- `POST /tickets/{id}/feedback`: Submits 1-5 star rating and optional comment (creator-only, unique per ticket).
- `GET /tickets/{id}/feedback`: Retrieves submitted ticket feedback.

### Frontend Components & Pages
- **[AdminAlertManagement.tsx](file:///c:/ITSM/frontend/src/pages/AdminAlertManagement.tsx)**: Dedicated management page at `/admin/alerts` featuring:
  - Broadcast New Alert Form (with auto KB workaround linking).
  - Filterable Alert History table (status & source filters).
  - Resolve Action button.
  - Clear History Action button with frontend modal confirmation (`DELETE /alerts/history`).
- **[Sidebar.tsx](file:///c:/ITSM/frontend/src/components/Sidebar.tsx)**: Added **"Alert Management"** entry with `Megaphone` icon for Administrator role (`roles: ['Administrator']`).
- **[App.tsx](file:///c:/ITSM/frontend/src/App.tsx)**: Registered `/admin/alerts` under `RoleProtectedRoute allowedRoles={['Administrator']}`.
- **[AdminDashboard.tsx](file:///c:/ITSM/frontend/src/pages/AdminDashboard.tsx)**: Embedded persistent **Active Anomalies Banner** showing auto-detected category ticket spikes with a 30s polling loop (`setInterval`). Removed old embedded alert card.
- **[NotificationCenter.tsx](file:///c:/ITSM/frontend/src/components/NotificationCenter.tsx)**: Solid opaque background (`bg-zinc-900`/`#121215`), `Mark all as read` button, click-to-read, zero hover-text popups.
- **[FeedbackModal.tsx](file:///c:/ITSM/frontend/src/components/FeedbackModal.tsx)**: 5-star interactive survey modal.

---

## 3. Database Collections & Indexing

- **`alerts`**: indexed on `status`.
- **`notifications`**: compound index on `user_id` + `read`.
- **`ticket_feedback`**: unique index on `ticket_id`.

---

## 4. Verification

- **Python Backend Compilation**: Passed clean (`python -c "import app.main"`).
- **TypeScript Typecheck**: Passed clean (`npx tsc --noEmit` with 0 errors).
- **Live Test Matrix Suite**: Executed live against ASGI application and MongoDB database (`=== ALL 6 LIVE TEST MATRIX CHECKS PASSED PERFECTLY ===`).
