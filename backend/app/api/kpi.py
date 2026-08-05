from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.kpi import EmployeeKPIs, AgentKPIs, AdminKPIs, TicketLifecycleTimeline, AICopilotTimeline, AdminAnalytics
from app.services.kpi import (
    compute_employee_kpis,
    compute_agent_kpis,
    compute_admin_kpis,
    get_ticket_lifecycle_timeline,
    get_ai_copilot_timeline,
    get_admin_monthly_analytics,
    TimelineRange,
)

router = APIRouter(prefix="/kpi", tags=["kpi"])


_ALLOWED_RANGES = ["today", "7d", "30d"]


@router.get(
    "/employee",
    response_model=EmployeeKPIs,
    status_code=status.HTTP_200_OK,
)
async def get_employee_kpis(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Employee", "end_user", "Agent", "Administrator", "admin"])),
) -> EmployeeKPIs:
    """Compute KPI metrics for the currently logged-in employee.

    Returns metrics computed over the tickets created by the calling user,
    together with AI Copilot utility data for that user's chat sessions.
    """
    user_id = current_user["id"]
    return await compute_employee_kpis(db, user_id)


@router.get(
    "/agent",
    response_model=AgentKPIs,
    status_code=status.HTTP_200_OK,
)
async def get_agent_kpis(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "agent", "Administrator", "admin"])),
) -> AgentKPIs:
    """Compute KPI metrics for the currently logged-in agent.

    Returns workload, SLA, and performance metrics computed from tickets
    assigned to the calling agent, plus AI Copilot utility KPIs.
    """
    agent_id = current_user["id"]
    return await compute_agent_kpis(db, agent_id)


@router.get(
    "/employee/timeline/tickets",
    response_model=TicketLifecycleTimeline,
    status_code=status.HTTP_200_OK,
)
async def get_employee_ticket_lifecycle_timeline(
    db: DatabaseSession,
    range: str = Query(default="7d", description="Time range: today | 7d | 30d"),
    current_user: dict = Depends(require_roles(["Employee", "end_user", "Agent", "Administrator", "admin"])),
) -> TicketLifecycleTimeline:
    """Return lifecycle activity for tickets created by the current user."""
    r: TimelineRange = "7d" if range not in _ALLOWED_RANGES else range
    return await get_ticket_lifecycle_timeline(db, r, {"created_by": current_user["id"]})


@router.get(
    "/agent/timeline/tickets",
    response_model=TicketLifecycleTimeline,
    status_code=status.HTTP_200_OK,
)
async def get_agent_ticket_lifecycle_timeline(
    db: DatabaseSession,
    range: str = Query(default="7d", description="Time range: today | 7d | 30d"),
    current_user: dict = Depends(require_roles(["Agent", "agent", "Administrator", "admin"])),
) -> TicketLifecycleTimeline:
    """Return lifecycle activity for tickets assigned to the current agent."""
    r: TimelineRange = "7d" if range not in _ALLOWED_RANGES else range
    return await get_ticket_lifecycle_timeline(db, r, {"assigned_to": current_user["id"]})


@router.get(
    "/admin",
    response_model=AdminKPIs,
    status_code=status.HTTP_200_OK,
)
async def get_admin_kpis(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator", "admin"])),
) -> AdminKPIs:
    """Compute organization-wide KPI metrics for administrators.

    Returns system-wide KPIs: user counts, aggregate MTTR / FCR,
    SLA compliance, backlog size, and AI Copilot totals.
    """
    return await compute_admin_kpis(db)


@router.get(
    "/admin/timeline/tickets",
    response_model=TicketLifecycleTimeline,
    status_code=status.HTTP_200_OK,
)
async def get_admin_ticket_lifecycle_timeline(
    db: DatabaseSession,
    range: str = Query(default="7d", description="Time range: today | 7d | 30d"),
    current_user: dict = Depends(require_roles(["Administrator", "admin"])),
) -> TicketLifecycleTimeline:
    """Created vs resolved ticket counts for the requested time range."""
    r: TimelineRange = "7d" if range not in _ALLOWED_RANGES else range
    return await get_ticket_lifecycle_timeline(db, r)


@router.get(
    "/admin/timeline/ai",
    response_model=AICopilotTimeline,
    status_code=status.HTTP_200_OK,
)
async def get_admin_ai_copilot_timeline(
    db: DatabaseSession,
    range: str = Query(default="7d", description="Time range: today | 7d | 30d"),
    current_user: dict = Depends(require_roles(["Administrator", "admin"])),
) -> AICopilotTimeline:
    """AI Copilot chats / resolved / escalated timeline for the requested range."""
    r: TimelineRange = "7d" if range not in _ALLOWED_RANGES else range
    return await get_ai_copilot_timeline(db, r)


@router.get(
    "/admin/analytics",
    response_model=AdminAnalytics,
    status_code=status.HTTP_200_OK,
)
async def get_admin_analytics(
    db: DatabaseSession,
    month: int = Query(default=datetime.utcnow().month, ge=1, le=12),
    year: int = Query(default=datetime.utcnow().year, ge=2000, le=2100),
    current_user: dict = Depends(require_roles(["Administrator", "admin"])),
) -> AdminAnalytics:
    """Return synchronized month/year analytics for the admin dashboard."""
    return await get_admin_monthly_analytics(db, month, year)
