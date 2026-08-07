# Implementation Plan - Verified Role Matrix, Alert System & Execution Roadmap

Final specification and step-by-step roadmap for the **Alerts & Personal Notifications System**, incorporating exact DB schema verification, git safety re-checks, and exhaustive manual API testing.

## User Review Required

> [!IMPORTANT]
> 1. **Verified DB User Role Value**:
>    - Checked [seed.py](file:///c:/ITSM/backend/app/database/seed.py#L28) and [dependencies.py](file:///c:/ITSM/backend/app/auth/dependencies.py#L20).
>    - **Backend DB role string** for employee user documents is strictly `"end_user"`.
>    - `_trigger_resolution_feedback_notification` in `tickets.py` checks `creator.get("role") == "end_user"` directly (no multi-guess sets).
> 2. **Git Merge Safety Check**:
>    - Will re-check `git status` / `git diff` on `backend/app/services/tickets.py` immediately prior to applying final code edits.
> 3. **Exhaustive Manual Test Execution**:
>    - In addition to Python import compile check and `npx tsc --noEmit` type checking, we will execute a complete 7-point live API manual test suite against `http://127.0.0.1:8000` to verify all 6 role matrix combinations and clear history operations.

---

## Detailed Step-by-Step Implementation Roadmap

### Step 1: Backend Router Updates (`backend/app/api/alerts.py`)

- **Role-Based Matrix in `GET /alerts/active`**:
  - Employee (`internal_role == "end_user"`): `{"status": "active", "source": "manual"}`
  - Agent (`internal_role == "agent"`): `{"status": "active"}`
  - Admin (`internal_role == "admin"`): `{"status": "active", "source": "manual", "created_by": {"$ne": str(current_user["id"])}}`
- **Parameterized Filtering in `GET /alerts`**:
  - `GET /alerts?status=active&source=auto_detected` returns active auto-detected anomaly alerts for the Admin Dashboard banner.
- **`DELETE /alerts/history`**:
  - Admin-only endpoint deleting all alerts where `status="resolved"`. Returns `{"deleted_count": count}`.

### Step 2: Employee Resolution Trigger (`backend/app/services/tickets.py`)

- In `_trigger_resolution_feedback_notification`:
  - Fetch `creator = await db.users.find_one({"_id": creator_id})`.
  - Verify `creator.get("role") == "end_user"`. Create `feedback_request` notification only for employee creators.

### Step 3: Frontend API Methods & Types (`shared/api.ts` & `shared/types.ts`)

- `clearAlertHistory()` calling `DELETE /alerts/history`.
- `getAutoDetectedActiveAlerts()` calling `GET /alerts?status=active&source=auto_detected`.

### Step 4: Dedicated Alert Management Page & Navigation

- **[AdminAlertManagement.tsx](file:///c:/ITSM/frontend/src/pages/AdminAlertManagement.tsx)** at `/admin/alerts`:
  - Create Alert Form (title, category, description) with KB recommendation lookup/attachment.
  - Filterable Alert List by status (`active`/`resolved`) and source (`manual`/`auto_detected`).
  - Resolve Action button.
  - "Clear history" button gated by modal confirmation calling `clearAlertHistory()`.
- **[Sidebar.tsx](file:///c:/ITSM/frontend/src/components/Sidebar.tsx)**:
  - Add `{ name: 'Alert Management', path: '/admin/alerts', icon: Megaphone, roles: ['Administrator'] }`.
- **[App.tsx](file:///c:/ITSM/frontend/src/App.tsx)**:
  - Register route `/admin/alerts` inside `<RoleProtectedRoute allowedRoles={['Administrator']}>`.

### Step 5: Admin Dashboard Persistent Anomaly Banner (`AdminDashboard.tsx`)

- Remove old embedded alert creation card.
- Add persistent **"Active Anomalies" Banner** showing active `auto_detected` alerts fetched via `getAutoDetectedActiveAlerts()`, polling every ~30s.

### Step 6: NotificationCenter Bell Cleanup (`NotificationCenter.tsx`)

- Confirm 100% solid opaque background (`bg-zinc-900`/`#121215`), `Mark all as read` button (`PATCH /notifications/read-all`), click-to-read, and zero hover-text popups.

---

## Exhaustive Live API Verification Suite

We will run test requests against the running Uvicorn server (`http://127.0.0.1:8000`) for:

1. **Admin Manual Alert Creation**: `POST /alerts` -> verify alert saved & recommendation attached.
2. **Employee Bell View**: `GET /alerts/active` as Employee -> verify sees manual alerts, hides `auto_detected`.
3. **Agent Bell View**: `GET /alerts/active` as Agent -> verify sees manual AND `auto_detected` alerts.
4. **Admin Bell View**: `GET /alerts/active` as Admin -> verify excludes self-created manual alert and `auto_detected` alerts.
5. **Admin Banner Query**: `GET /alerts?status=active&source=auto_detected` as Admin -> verify returns active anomalies.
6. **Clear History**: `DELETE /alerts/history` as Admin -> verify deletes resolved alerts and preserves active alerts.
7. **Ticket Resolution Feedback**: Resolve ticket created by employee -> verify `feedback_request` notification created in DB.
