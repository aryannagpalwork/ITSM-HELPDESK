# API Reference

## Base URL

The backend API base URL is typically `http://127.0.0.1:8000`.

## Health

### GET /health

- Description: Checks whether the backend service is running.
- Response: `200 OK`
- Response body:
  - `status`: `ok`

## Authentication

### POST /auth/login

- Description: Authenticate user credentials and return JWT tokens.
- Request body:
  - `email` (string)
  - `password` (string)
- Response: `200 OK`
- Response body:
  - `access_token` (string)
  - `refresh_token` (string)
  - `token_type` (string)
  - `expires_in` (int)
  - `user` (UserRead)

### POST /auth/refresh

- Description: Refresh access and refresh tokens using a valid refresh token.
- Request body:
  - `refresh_token` (string)
- Response: `200 OK`
- Response body: same as `/auth/login`

### POST /auth/logout

- Description: Invalidate the current session locally.
- Response: `200 OK`
- Response body:
  - `detail` (string)

## Tickets

### POST /tickets

- Description: Create a new incident ticket.
- Authentication: required.
- Request body:
  - `title` (string)
  - `description` (string)
  - `category` (string)
  - `priority` (TicketPriority)
  - `status` (TicketStatus)
  - `assigned_to` (string | null)
  - `created_by` (string | null)
  - `ai_summary` (string | null)
  - `resolution` (string | null)
- Response: `201 Created`
- Response body: `TicketRead`

### GET /tickets

- Description: List tickets with pagination, search, filtering, and sorting.
- Authentication: required.
- Query parameters:
  - `page` (int, default `1`)
  - `page_size` (int, default `25`, max `100`)
  - `search` (string)
  - `status` (string)
  - `priority` (string)
  - `category` (string)
  - `assigned_to` (string)
  - `created_by` (string)
  - `sort_by` (TicketSortField)
  - `sort_order` (SortOrder)
- Response: `200 OK`
- Response body:
  - `items` (TicketRead[])
  - `total` (int)
  - `page` (int)
  - `page_size` (int)
  - `pages` (int)

### GET /tickets/{ticket_id}

- Description: Retrieve ticket by UUID.
- Authentication: required.
- Path parameters:
  - `ticket_id` (string)
- Response: `200 OK`
- Response body: `TicketRead`

### PATCH /tickets/{ticket_id}

- Description: Update existing ticket metadata.
- Authentication: required.
- Authorization: `Support Agent` or `Administrator`.
- Request body: same fields as `TicketUpdate`, all optional.
- Response: `200 OK`
- Response body: `TicketRead`

### DELETE /tickets/{ticket_id}

- Description: Delete ticket and related comments.
- Authentication: required.
- Authorization: `Administrator`.
- Response: `204 No Content`

## Documents

### GET /documents

- Description: List knowledge documents.
- Current status: Not implemented. Returns `501 Not Implemented`.

## Admin

### GET /admin/status

- Description: Admin health/status endpoint.
- Current status: Not implemented. Returns `501 Not Implemented`.

## Models

### UserRead

- `id` (string)
- `email` (string)
- `full_name` (string)
- `role` (string)
- `department` (string | null)
- `is_active` (bool)
- `created_at` (datetime)
- `updated_at` (datetime | null)

### TicketRead

- `id` (string)
- `ticket_number` (string)
- `title` (string)
- `description` (string)
- `category` (string)
- `priority` (TicketPriority)
- `status` (TicketStatus)
- `assigned_to` (string | null)
- `assigned_to_name` (string | null)
- `created_by` (string | null)
- `created_by_name` (string | null)
- `ai_summary` (string | null)
- `resolution` (string | null)
- `created_at` (datetime)
- `updated_at` (datetime)
- `comments` (TicketCommentRead[])

### TicketCommentRead

- `id` (string)
- `ticket_id` (string)
- `author_id` (string | null)
- `author_name` (string | null)
- `author_role` (string | null)
- `content` (string)
- `is_internal` (bool)
- `created_at` (datetime)

### TicketCreate / TicketUpdate

- `title` (string)
- `description` (string)
- `category` (string)
- `priority` (TicketPriority)
- `status` (TicketStatus)
- `assigned_to` (string | null)
- `created_by` (string | null)
- `ai_summary` (string | null)
- `resolution` (string | null)

### Enums

- `TicketPriority`: `Low`, `Medium`, `High`, `Critical`
- `TicketStatus`: `Open`, `In Progress`, `Resolved`, `Closed`
- `TicketSortField`: `created_at`, `updated_at`, `priority`, `status`, `ticket_number`, `title`
- `SortOrder`: `asc`, `desc`
