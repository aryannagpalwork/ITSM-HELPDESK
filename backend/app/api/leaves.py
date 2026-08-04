from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.leave import (
    AgentAvailabilityRead,
    CurrentlyOnLeaveRead,
    LeaveRequestCreate,
    LeaveRequestRead,
    LeaveRequestReject,
)
from app.services.leaves import (
    approve_leave_request,
    create_leave_request,
    delete_leave_request,
    list_agents_availability,
    list_currently_on_leave,
    list_leave_requests,
    reject_leave_request,
)

router = APIRouter(tags=["leaves"])


@router.post("/leaves", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
async def create_leave_request_endpoint(
    payload: LeaveRequestCreate,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent"])),
) -> LeaveRequestRead:
    return await create_leave_request(db, payload, current_user["id"])


@router.get("/leaves", response_model=list[LeaveRequestRead], status_code=status.HTTP_200_OK)
async def list_leave_requests_endpoint(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    agent_id: str | None = None,
) -> list[LeaveRequestRead]:
    return await list_leave_requests(db, current_user, status_filter=status_filter, agent_id=agent_id)


@router.get("/leaves/currently-on-leave", response_model=list[CurrentlyOnLeaveRead], status_code=status.HTTP_200_OK)
async def list_currently_on_leave_endpoint(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> list[CurrentlyOnLeaveRead]:
    return await list_currently_on_leave(db)


@router.patch("/leaves/{leave_request_id}/approve", response_model=LeaveRequestRead, status_code=status.HTTP_200_OK)
async def approve_leave_request_endpoint(
    leave_request_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> LeaveRequestRead:
    return await approve_leave_request(db, leave_request_id, current_user["id"])


@router.patch("/leaves/{leave_request_id}/reject", response_model=LeaveRequestRead, status_code=status.HTTP_200_OK)
async def reject_leave_request_endpoint(
    leave_request_id: str,
    payload: LeaveRequestReject,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> LeaveRequestRead:
    return await reject_leave_request(db, leave_request_id, payload, current_user["id"])


@router.delete("/leaves/{leave_request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave_request_endpoint(
    leave_request_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent"])),
) -> Response:
    await delete_leave_request(db, leave_request_id, current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/agents/availability", response_model=list[AgentAvailabilityRead], status_code=status.HTTP_200_OK)
async def list_agents_availability_endpoint(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> list[AgentAvailabilityRead]:
    return await list_agents_availability(db)
