from pydantic import BaseModel, Field
from typing import List


class TimelinePoint(BaseModel):
    label: str
    value: int = 0


class TimelineSeries(BaseModel):
    name: str
    data: List[TimelinePoint] = Field(default_factory=list)


class TicketLifecycleTimeline(BaseModel):
    created: List[TimelinePoint] = Field(default_factory=list)
    resolved: List[TimelinePoint] = Field(default_factory=list)
    aiResolved: List[TimelinePoint] = Field(default_factory=list)
    agentResolved: List[TimelinePoint] = Field(default_factory=list)
    inProgress: List[TimelinePoint] = Field(default_factory=list)


class AICopilotTimeline(BaseModel):
    chats: List[TimelinePoint] = Field(default_factory=list)
    resolved: List[TimelinePoint] = Field(default_factory=list)
    escalated: List[TimelinePoint] = Field(default_factory=list)


class AnalyticsMetric(BaseModel):
    name: str
    value: int = 0


class SLAAnalytics(BaseModel):
    priority: str
    slaTargetHours: float | None = None
    withinSla: int = 0
    breached: int = 0
    active: int = 0
    nearBreach: int = 0
    averageResolutionHours: float = 0.0
    compliance: float = 0.0


class AdminAnalytics(BaseModel):
    month: int
    year: int
    days: List[str] = Field(default_factory=list)
    ticketLifecycle: TicketLifecycleTimeline = Field(default_factory=TicketLifecycleTimeline)
    aiCopilot: AICopilotTimeline = Field(default_factory=AICopilotTimeline)
    resolution: List[AnalyticsMetric] = Field(default_factory=list)
    sla: List[AnalyticsMetric] = Field(default_factory=list)
    slaByPriority: List[SLAAnalytics] = Field(default_factory=list)
    totals: dict[str, int] = Field(default_factory=dict)


class AICopilotEmployeeKPIs(BaseModel):
    aiChats: int = 0
    aiResolved: int = 0
    aiEscalated: int = 0
    successRate: float = 0.0
    articlesViewed: int = 0
    timeSavedMinutes: float = 0.0


class EmployeeKPIs(BaseModel):
    totalTickets: int = 0
    openTickets: int = 0
    resolvedTickets: int = 0
    mttrHours: float = 0.0
    fcrRate: float = 0.0
    avgFirstResponseHours: float = 0.0
    firstResponseSlaCompliance: float = 0.0
    reopenedTickets: int = 0
    aiCopilot: AICopilotEmployeeKPIs = Field(default_factory=AICopilotEmployeeKPIs)


class AICopilotAgentKPIs(BaseModel):
    suggestionsGenerated: int = 0
    suggestionsAccepted: int = 0
    acceptanceRate: float = 0.0
    resolutionDrafts: int = 0
    kbSearches: int = 0
    timeSavedMinutes: float = 0.0


class AgentKPIs(BaseModel):
    assignedTickets: int = 0
    openTickets: int = 0
    inProgress: int = 0
    waiting: int = 0
    resolvedTickets: int = 0
    resolvedToday: int = 0
    overdueTickets: int = 0
    agentMttrHours: float = 0.0
    aiMttrHours: float = 0.0
    agentFcrRate: float = 0.0
    avgFirstResponseHours: float = 0.0
    firstResponseSlaCompliance: float = 0.0
    resolutionRate: float = 0.0
    slaCompliance: float = 0.0
    reopenRate: float = 0.0
    aiCopilot: AICopilotAgentKPIs = Field(default_factory=AICopilotAgentKPIs)


class AICopilotAdminKPIs(BaseModel):
    totalAIChats: int = 0
    aiResolved: int = 0
    aiEscalated: int = 0
    successRate: float = 0.0
    knowledgeHits: int = 0
    hoursSaved: float = 0.0


class AdminKPIs(BaseModel):
    systemUsers: int = 0
    totalTickets: int = 0
    activeAgents: int = 0
    agentMttrHours: float = 0.0
    aiMttrHours: float = 0.0
    orgAgentFcrRate: float = 0.0
    slaCompliance: float = 0.0
    slaBreaches: int = 0
    activeSlaTickets: int = 0
    nearBreachTickets: int = 0
    criticalSlaBreaches: int = 0
    firstResponseSlaCompliance: float = 0.0
    ticketBacklog: int = 0
    aiResolutionRate: float = 0.0
    aiQueries: int = 0
    aiCopilot: AICopilotAdminKPIs = Field(default_factory=AICopilotAdminKPIs)
