from typing import Annotated, Optional
from datetime import datetime

from fastapi import APIRouter, Query, status
from fastapi import Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.deps import DatabaseSession
from app.auth.dependencies import get_current_user, require_roles
from app.schemas.ticket import (
    CommentCreate,
    SortOrder,
    TicketCommentRead,
    TicketCreate,
    TicketListResponse,
    TicketRead,
    TicketSortField,
    TicketUpdate,
    TicketAnalyzeRequest,
    TicketAnalyzeResponse,
)
from app.schemas.audit_log import AuditLogRead
from app.services.tickets import (
    add_comment,
    create_ticket,
    delete_ticket,
    get_ticket,
    list_tickets,
    update_ticket,
    assign_ticket,
    escalate_ticket,
    resolve_ticket,
    close_ticket,
    reopen_ticket,
    get_ticket_audit_logs,
    get_agent_metrics,
)
from app.services.search_service import SearchService
from app.services.llm.llm_factory import LLMServiceFactory
from app.config.settings import get_settings

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("/metrics/agent", status_code=status.HTTP_200_OK)
async def get_agent_metrics_endpoint(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> dict:
    """Get workload and performance metrics for the current agent.
    Returns read-only analytics computed from existing ticket data.
    """
    return await get_agent_metrics(db, current_user["id"])


@router.post("/analyze", response_model=TicketAnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_ticket_endpoint(
    payload: TicketAnalyzeRequest,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> TicketAnalyzeResponse:
    """Analyze a ticket using AI with RAG and return structured insights"""
    settings = get_settings()
    
    # Step 1: Build a query for search (title + description)
    query = f"{payload.title} {payload.description}"
    
    # Step 2: Retrieve relevant chunks from knowledge base
    search_service = SearchService(db=db)
    retrieved_context = search_service.search(query=query, top_k=5, similarity_threshold=0.5)
    
    # Step 3: Build context string from retrieved chunks
    context_str = ""
    if retrieved_context.chunks:
        context_str = "Here is the relevant information from our knowledge base:\n\n"
        for i, chunk in enumerate(retrieved_context.chunks):
            context_str += f"--- Document Chunk {i + 1} ---\n"
            if chunk.heading:
                context_str += f"Heading: {chunk.heading}\n"
            if chunk.section:
                context_str += f"Section: {chunk.section}\n"
            context_str += f"Content: {chunk.text}\n\n"
            
    # Step 4: Call LLM to analyze ticket
    llm_service = LLMServiceFactory.create(settings.llm_provider)
    analysis, _ = llm_service.analyze_ticket(
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        context_str=context_str
    )
    
    # Step 5: Map retrieved document titles to knowledge_articles if available
    knowledge_articles = analysis.get("knowledge_articles", [])
    # if we have search results with document titles, we could add them here
    if retrieved_context.search_results:
        document_ids = list(set(r.chunk.document_id for r in retrieved_context.search_results if r.chunk.document_id))
        if document_ids:
            documents_cursor = db["knowledge_documents"].find({"_id": {"$in": document_ids}})
            docs = await documents_cursor.to_list(length=None)
            for doc in docs:
                title = doc.get("title")
                if title and title not in knowledge_articles:
                    knowledge_articles.append(title)
            analysis["knowledge_articles"] = knowledge_articles
            
    # Step 6: Calculate confidence based on retrieval similarity
    confidence = analysis.get("confidence", 50)
    if retrieved_context.search_results:
        avg_similarity = sum(r.similarity_score for r in retrieved_context.search_results) / len(retrieved_context.search_results)
        # Average LLM confidence with retrieval similarity (weighted 50/50)
        retrieval_confidence = int(avg_similarity * 100)
        confidence = int((confidence + retrieval_confidence) / 2)
    analysis["confidence"] = max(0, min(100, confidence))  # Clamp between 0 and 100
    
    return TicketAnalyzeResponse(**analysis)


class AssignTicketRequest(BaseModel):
    assigned_to: str | None = None
    reason: str | None = None


class EscalateTicketRequest(BaseModel):
    priority: str = Field(..., description="New priority level (Low, Medium, High, Critical)")
    reason: str = Field(..., description="Reason for escalation (required)")


class ResolveTicketRequest(BaseModel):
    resolution: str | None = None
    reason: str = Field(..., description="Reason for resolving (required)")


class CloseTicketRequest(BaseModel):
    reason: str = Field(..., description="Reason for closing (required)")


class ReopenTicketRequest(BaseModel):
    reason: str = Field(..., description="Reason for reopening (required)")


class UpdateTicketRequest(BaseModel):
    ticket: TicketUpdate
    reason: str | None = None


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
async def create_ticket_endpoint(
    payload: TicketCreate,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
    reason: str | None = None,
) -> TicketRead:
    """Create a new incident ticket with an automatically generated ticket number."""
    if payload.created_by is None:
        payload.created_by = current_user["id"]
    return await create_ticket(db, payload, reason, current_user)


@router.get("", response_model=TicketListResponse)
async def list_tickets_endpoint(
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: str | None = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    priority_filter: Annotated[str | None, Query(alias="priority")] = None,
    category: str | None = None,
    assigned_to: str | None = None,
    assigned_team: str | None = None,
    created_by: str | None = None,
    assignment: str | None = None,
    sort_by: TicketSortField = TicketSortField.created_at,
    sort_order: SortOrder = SortOrder.desc,
) -> TicketListResponse:
    """List tickets with pagination, filtering, search, and sorting.
    
    For agents, the `assignment` parameter controls the smart ticket view:
    - "assigned": only tickets assigned to the agent
    - "unassigned": only unassigned tickets matching the agent's specialization
    - omit: all tickets the agent can work on (assigned + matching unassigned)
    """
    return await list_tickets(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        priority_filter=priority_filter,
        category=category,
        assigned_to=assigned_to,
        assigned_team=assigned_team,
        created_by=created_by,
        sort_by=sort_by,
        sort_order=sort_order,
        current_user=current_user,
        assignment=assignment,
    )


@router.get("/agents", status_code=status.HTTP_200_OK)
async def list_agents(
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
) -> list[dict]:
    """List all active agents with their specialization and current workload."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.debug(f"[list_agents] Query: role='agent', is_active=True, deleted!=True")
    agents = await db.users.find(
        {"role": "agent", "is_active": True, "deleted": {"$ne": True}}
    ).to_list(length=None)
    
    logger.debug(f"[list_agents] Found {len(agents)} agent(s) in DB:")
    for agent in agents:
        logger.debug(f"  - id={agent['_id']}, name={agent.get('full_name')}, "
                     f"email={agent.get('email')}, role={agent.get('role')}, "
                     f"is_active={agent.get('is_active')}")

    result = []
    for agent in agents:
        # Count currently open tickets assigned to this agent
        open_tickets = await db.tickets.count_documents({
            "assigned_to": agent["_id"],
            "status": {"$in": ["Open", "In Progress"]}
        })
        result.append({
            "id": agent["_id"],
            "name": agent.get("full_name", ""),
            "email": agent.get("email", ""),
            "department": agent.get("department"),
            "specialization": agent.get("specialization"),
            "status": agent.get("status", "ACTIVE"),
            "activeTicketCount": open_tickets,
            "available": open_tickets < 10,  # Simple heuristic: < 10 open tickets = available
        })
    
    logger.debug(f"[list_agents] Returning {len(result)} agent(s): {result}")
    return result


@router.get("/{ticket_id}", response_model=TicketRead)
async def get_ticket_endpoint(
    ticket_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> TicketRead:
    """Get a single ticket by UUID."""
    return await get_ticket(db, ticket_id, current_user)


@router.get("/{ticket_id}/audit-logs", response_model=list[AuditLogRead])
async def get_ticket_audit_logs_endpoint(
    ticket_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> list[AuditLogRead]:
    """Get audit logs for a single ticket."""
    return await get_ticket_audit_logs(db, ticket_id, current_user)


@router.post("/{ticket_id}/comments", response_model=TicketCommentRead, status_code=status.HTTP_201_CREATED)
async def add_comment_endpoint(
    ticket_id: str,
    payload: CommentCreate,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
) -> TicketCommentRead:
    """Add a comment or internal note to a ticket. Visible in lifecycle timeline."""
    return await add_comment(
        db,
        ticket_id=ticket_id,
        content=payload.content,
        is_internal=payload.is_internal,
        current_user_id=current_user["id"],
    )


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_ticket_endpoint(
    ticket_id: str,
    payload: UpdateTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> TicketRead:
    """Partially update ticket metadata and resolution fields."""
    return await update_ticket(db, ticket_id, payload.ticket, current_user["id"], payload.reason)


@router.post("/{ticket_id}/assign", response_model=TicketRead)
async def assign_ticket_endpoint(
    ticket_id: str,
    payload: AssignTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> TicketRead:
    """Assign a ticket to a support agent or reassign to another agent (if already assigned)."""
    return await assign_ticket(db, ticket_id, payload.assigned_to, current_user["id"], payload.reason)


@router.post("/{ticket_id}/escalate", response_model=TicketRead)
async def escalate_ticket_endpoint(
    ticket_id: str,
    payload: EscalateTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> TicketRead:
    """Escalate a ticket to a higher priority."""
    return await escalate_ticket(db, ticket_id, payload.priority, current_user["id"], payload.reason)


@router.post("/{ticket_id}/resolve", response_model=TicketRead)
async def resolve_ticket_endpoint(
    ticket_id: str,
    payload: ResolveTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> TicketRead:
    """Mark a ticket as resolved with an optional resolution note."""
    return await resolve_ticket(db, ticket_id, payload.resolution, current_user["id"], payload.reason)


@router.post("/{ticket_id}/close", response_model=TicketRead)
async def close_ticket_endpoint(
    ticket_id: str,
    payload: CloseTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator"])),
) -> TicketRead:
    """Mark a ticket as closed."""
    return await close_ticket(db, ticket_id, current_user["id"], payload.reason)


@router.post("/{ticket_id}/reopen", response_model=TicketRead)
async def reopen_ticket_endpoint(
    ticket_id: str,
    payload: ReopenTicketRequest,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Agent", "Administrator", "Employee"])),
) -> TicketRead:
    """Reopen a closed or resolved ticket."""
    return await reopen_ticket(db, ticket_id, current_user["id"], payload.reason)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket_endpoint(
    ticket_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(require_roles(["Administrator"])),
    reason: str | None = None,
) -> Response:
    """Delete a ticket and its comments."""
    await delete_ticket(db, ticket_id, current_user["id"], reason)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class TicketFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class TicketFeedbackRead(BaseModel):
    id: str
    ticket_id: str
    user_id: str
    rating: int
    comment: Optional[str] = None
    submitted_at: datetime


@router.post("/{ticket_id}/feedback", response_model=TicketFeedbackRead, status_code=status.HTTP_201_CREATED)
async def create_ticket_feedback(
    ticket_id: str,
    payload: TicketFeedbackCreate,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Submit rating/feedback for a ticket (Must be ticket's creator)."""
    ticket = await db.tickets.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    if ticket.get("created_by") != current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the ticket creator can submit feedback for this ticket",
        )

    existing = await db.ticket_feedback.find_one({"ticket_id": ticket_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback already exists for this ticket",
        )

    doc = {
        "_id": str(uuid4()),
        "ticket_id": ticket_id,
        "user_id": current_user.get("id"),
        "rating": payload.rating,
        "comment": payload.comment,
        "submitted_at": datetime.utcnow(),
    }
    await db.ticket_feedback.insert_one(doc)

    return TicketFeedbackRead(
        id=str(doc["_id"]),
        ticket_id=doc["ticket_id"],
        user_id=doc["user_id"],
        rating=doc["rating"],
        comment=doc.get("comment"),
        submitted_at=doc["submitted_at"],
    )


@router.get("/{ticket_id}/feedback", response_model=TicketFeedbackRead)
async def get_ticket_feedback(
    ticket_id: str,
    db: DatabaseSession,
    current_user: dict = Depends(get_current_user),
):
    """Get feedback submitted for a ticket."""
    existing = await db.ticket_feedback.find_one({"ticket_id": ticket_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found for this ticket",
        )

    return TicketFeedbackRead(
        id=str(existing["_id"]),
        ticket_id=existing["ticket_id"],
        user_id=existing["user_id"],
        rating=existing["rating"],
        comment=existing.get("comment"),
        submitted_at=existing["submitted_at"],
    )
