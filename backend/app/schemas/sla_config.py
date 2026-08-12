"""SLA configuration schema — admin-editable thresholds and resolution targets."""

from pydantic import BaseModel, Field


class PrioritySLAConfig(BaseModel):
    sla_target_hours: float = Field(ge=0.1, description="SLA resolution target in hours")
    first_response_minutes: float = Field(ge=0, description="First response target in minutes")


class SLAConfigUpdate(BaseModel):
    critical: PrioritySLAConfig | None = None
    high: PrioritySLAConfig | None = None
    medium: PrioritySLAConfig | None = None
    low: PrioritySLAConfig | None = None
    near_breach_percent: float | None = Field(default=None, ge=1, le=100, description="Near-breach threshold as percentage of SLA target")


class SLAConfigRead(BaseModel):
    critical: PrioritySLAConfig
    high: PrioritySLAConfig
    medium: PrioritySLAConfig
    low: PrioritySLAConfig
    near_breach_percent: float
