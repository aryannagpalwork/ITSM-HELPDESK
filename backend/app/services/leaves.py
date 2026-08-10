from datetime import date, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.leave import (
    AgentAvailabilityRead,
    CurrentlyOnLeaveRead,
    LeaveRequestCreate,
    LeaveRequestRead,
    LeaveRequestReject,
    LeaveRequestStatus,
)


def _serialize_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _today_iso() -> str:
    return date.today().isoformat()


def _active_leave_query(day_iso: str, agent_ids: list[str] | None = None) -> dict:
    query: dict = {
        "status": LeaveRequestStatus.approved.value,
        "start_date": {"$lte": day_iso},
        "end_date": {"$gte": day_iso},
    }
    if agent_ids is not None:
        query["agent_id"] = {"$in": agent_ids}
    return query


async def _list_active_agents(db: AsyncIOMotorDatabase) -> list[dict]:
    return await db.users.find(
        {"role": "agent", "is_active": True, "deleted": {"$ne": True}}
    ).to_list(length=None)


async def _count_open_tickets(db: AsyncIOMotorDatabase, agent_id: str) -> int:
    return await db.tickets.count_documents(
        {
            "assigned_to": agent_id,
            "status": {"$in": ["Open", "In Progress"]},
        }
    )


async def _list_current_leave_documents(
    db: AsyncIOMotorDatabase,
    agent_ids: list[str],
) -> list[dict]:
    if not agent_ids:
        return []

    documents = await db.leave_requests.find(
        _active_leave_query(_today_iso(), agent_ids)
    ).sort(
        [("start_date", 1), ("end_date", 1), ("requested_at", -1)]
    ).to_list(length=None)

    current_by_agent: dict[str, dict] = {}
    for document in documents:
        existing = current_by_agent.get(document["agent_id"])
        if existing is None:
            current_by_agent[document["agent_id"]] = dict(document)
            continue

        if _serialize_date(document["start_date"]) < _serialize_date(existing["start_date"]):
            existing["start_date"] = document["start_date"]
        if _serialize_date(document["end_date"]) > _serialize_date(existing["end_date"]):
            existing["end_date"] = document["end_date"]

    return list(current_by_agent.values())


async def _serialize_leave_request(
    db: AsyncIOMotorDatabase,
    leave_request: dict,
) -> LeaveRequestRead:
    agent_name = None
    if leave_request.get("agent_id"):
        agent = await db.users.find_one({"_id": leave_request["agent_id"]})
        if agent:
            agent_name = agent.get("full_name")

    return LeaveRequestRead(
        id=leave_request["_id"],
        agent_id=leave_request["agent_id"],
        agent_name=agent_name,
        start_date=_serialize_date(leave_request["start_date"]),
        end_date=_serialize_date(leave_request["end_date"]),
        reason=leave_request["reason"],
        status=leave_request["status"],
        requested_at=leave_request["requested_at"],
        reviewed_by=leave_request.get("reviewed_by"),
        reviewed_at=leave_request.get("reviewed_at"),
        rejection_reason=leave_request.get("rejection_reason"),
    )


async def create_leave_request(
    db: AsyncIOMotorDatabase,
    payload: LeaveRequestCreate,
    agent_id: str,
) -> LeaveRequestRead:
    leave_request = {
        "_id": str(uuid4()),
        "agent_id": agent_id,
        "start_date": payload.start_date.isoformat(),
        "end_date": payload.end_date.isoformat(),
        "reason": payload.reason,
        "status": LeaveRequestStatus.pending.value,
        "requested_at": datetime.utcnow(),
        "reviewed_by": None,
        "reviewed_at": None,
        "rejection_reason": None,
    }
    await db.leave_requests.insert_one(leave_request)
    return await _serialize_leave_request(db, leave_request)


async def list_leave_requests(
    db: AsyncIOMotorDatabase,
    current_user: dict,
    status_filter: str | None = None,
    agent_id: str | None = None,
) -> list[LeaveRequestRead]:
    if current_user["internal_role"] not in {"agent", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role privileges.",
        )

    query: dict = {}

    if current_user["internal_role"] == "agent":
        query["agent_id"] = current_user["id"]
    else:
        if status_filter:
            query["status"] = status_filter
        if agent_id:
            query["agent_id"] = agent_id

    documents = await db.leave_requests.find(query).sort(
        [("requested_at", -1)]
    ).to_list(length=None)
    return [await _serialize_leave_request(db, document) for document in documents]


async def approve_leave_request(
    db: AsyncIOMotorDatabase,
    leave_request_id: str,
    admin_id: str,
) -> LeaveRequestRead:
    leave_request = await db.leave_requests.find_one({"_id": leave_request_id})
    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    update_data = {
        "status": LeaveRequestStatus.approved.value,
        "reviewed_by": admin_id,
        "reviewed_at": datetime.utcnow(),
        "rejection_reason": None,
    }
    await db.leave_requests.update_one(
        {"_id": leave_request_id},
        {"$set": update_data},
    )
    leave_request.update(update_data)
    return await _serialize_leave_request(db, leave_request)


async def reject_leave_request(
    db: AsyncIOMotorDatabase,
    leave_request_id: str,
    payload: LeaveRequestReject,
    admin_id: str,
) -> LeaveRequestRead:
    leave_request = await db.leave_requests.find_one({"_id": leave_request_id})
    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    update_data = {
        "status": LeaveRequestStatus.rejected.value,
        "reviewed_by": admin_id,
        "reviewed_at": datetime.utcnow(),
        "rejection_reason": payload.rejection_reason,
    }
    await db.leave_requests.update_one(
        {"_id": leave_request_id},
        {"$set": update_data},
    )
    leave_request.update(update_data)
    return await _serialize_leave_request(db, leave_request)


async def delete_leave_request(
    db: AsyncIOMotorDatabase,
    leave_request_id: str,
    agent_id: str,
) -> None:
    leave_request = await db.leave_requests.find_one({"_id": leave_request_id})
    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    if leave_request["agent_id"] != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own leave requests.",
        )

    if leave_request["status"] != LeaveRequestStatus.pending.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be cancelled.",
        )

    await db.leave_requests.delete_one({"_id": leave_request_id})


async def list_agents_availability(
    db: AsyncIOMotorDatabase,
) -> list[AgentAvailabilityRead]:
    agents = await _list_active_agents(db)
    current_leaves = await _list_current_leave_documents(
        db,
        [agent["_id"] for agent in agents],
    )
    current_leave_agent_ids = {leave["agent_id"] for leave in current_leaves}

    availability: list[AgentAvailabilityRead] = []
    for agent in agents:
        open_ticket_count = await _count_open_tickets(db, agent["_id"])

        availability.append(
            AgentAvailabilityRead(
                agent_id=agent["_id"],
                name=agent.get("full_name", ""),
                on_leave_today=agent["_id"] in current_leave_agent_ids,
                open_ticket_count=open_ticket_count,
                department=agent.get("department"),
                specialization=agent.get("specialization", []),
            )
        )

    availability.sort(key=lambda item: item.name.lower())
    return availability


async def list_currently_on_leave(
    db: AsyncIOMotorDatabase,
) -> list[CurrentlyOnLeaveRead]:
    agents = await _list_active_agents(db)
    agents_by_id = {agent["_id"]: agent for agent in agents}
    current_leaves = await _list_current_leave_documents(db, list(agents_by_id.keys()))

    currently_on_leave: list[CurrentlyOnLeaveRead] = []
    for leave in current_leaves:
        agent = agents_by_id.get(leave["agent_id"])
        if agent is None:
            continue

        currently_on_leave.append(
            CurrentlyOnLeaveRead(
                agent_id=leave["agent_id"],
                agent_name=agent.get("full_name", ""),
                start_date=_serialize_date(leave["start_date"]),
                end_date=_serialize_date(leave["end_date"]),
                open_ticket_count=await _count_open_tickets(db, leave["agent_id"]),
            )
        )

    currently_on_leave.sort(key=lambda item: item.agent_name.lower())
    return currently_on_leave
