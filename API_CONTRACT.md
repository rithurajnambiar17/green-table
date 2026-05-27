# Green Table — Backend API Contract (FastAPI + MySQL)

This document defines the REST contract the **Green Table** frontend expects.
Implement these endpoints in FastAPI with PyMySQL/SQLAlchemy, mount under
`/api/v1`, and the frontend can be wired by setting `VITE_API_URL` and
swapping the localStorage store for `fetch` calls.

## Stack
- FastAPI + Uvicorn
- MySQL 8 via SQLAlchemy 2 + PyMySQL
- JWT auth (HS256), bcrypt password hashing (passlib)
- Pydantic v2 for validation, CORS enabled for the frontend origin

## Auth
JWT bearer in `Authorization: Bearer <token>`. Token payload:
```json
{ "sub": "<user_id>", "role": "admin|staff", "exp": 1700000000 }
```

### POST /api/v1/auth/login
Req: `{ "email": "admin@greentable.club", "password": "..." }`
Res: `{ "access_token": "...", "token_type": "bearer", "user": { "id": "...", "name": "...", "email": "...", "role": "admin" } }`

### GET /api/v1/auth/me   (auth)
Res: `{ "id": "...", "name": "...", "email": "...", "role": "admin" }`

## Settings  (admin-only writes)
### GET /api/v1/settings
```json
{ "club_name": "Green Table", "currency": "PKR",
  "snooker_rate": 600, "pool_rate": 400, "tax_rate": 5, "country_code": "+92" }
```
### PATCH /api/v1/settings  (admin)
Partial body of the same shape.

## Tables
### GET /api/v1/tables
`[ { "id": "t1", "name": "Royal Snooker 1", "type": "snooker" }, ... ]`
type ∈ `snooker | pool`.

## Customers
### GET /api/v1/customers
`[ { "id": "...", "name": "...", "phone": "3001234567", "visits": 4, "last_visit": "ISO|null", "lifetime_spend": 4800 } ]`
### POST /api/v1/customers
Req: `{ "name": "...", "phone": "..." }`  Res: customer object.
Phone is the unique key — POST should upsert.

## Sessions  (the core workflow)
A session is created in `running` status the moment the staff starts it.

Session object:
```json
{
  "id": "s_01HXXX",
  "table_id": "t1",
  "table_name": "Royal Snooker 1",
  "table_type": "snooker",
  "customer_id": "c_...",
  "customer_name": "Ali Raza",
  "customer_phone": "3001234567",
  "started_at": "2026-05-27T18:21:00Z",
  "ended_at": null,
  "accumulated_ms": 0,
  "run_started_at": "2026-05-27T18:21:00Z",
  "status": "running",      // running | paused | ended
  "hourly_rate": 600,
  "discount": 0,
  "manual_adjustment": 0,
  "tax_rate": 5,
  "total": 0,
  "payment": "unpaid"       // unpaid | paid
}
```

### GET /api/v1/sessions?status=&from=&to=&q=
Filters: `status`, `payment`, ISO range `from/to`, free-text `q`.

### POST /api/v1/sessions/start
Req: `{ "table_id": "t1", "customer_name": "...", "customer_phone": "..." }`
Server-side:
- Reject if the table already has an open session (`running|paused`).
- Upsert customer by phone, increment `visits`, set `last_visit=now`.
- Insert session with `status=running`, `run_started_at=now`, `hourly_rate` from settings.
Res: session object.

### POST /api/v1/sessions/{id}/pause
Pause if running. Server adds `now - run_started_at` to `accumulated_ms`, clears `run_started_at`, sets `status=paused`.

### POST /api/v1/sessions/{id}/resume
Set `run_started_at=now`, `status=running`.

### POST /api/v1/sessions/{id}/end
If running, add elapsed to `accumulated_ms`. Compute total:
```
hours = accumulated_ms / 3_600_000
base  = hours * hourly_rate
after = max(0, base - discount + manual_adjustment)
tax   = after * tax_rate / 100
total = after + tax
```
Set `ended_at=now`, `status=ended`, persist `total`.

### PATCH /api/v1/sessions/{id}
Editable: `hourly_rate`, `discount`, `manual_adjustment`, `tax_rate`, `customer_name`, `customer_phone`. Recompute `total` if `ended`.

### POST /api/v1/sessions/{id}/mark-paid
Set `payment=paid`. Returns the session and a ready-to-send WhatsApp URL:
```json
{ "session": { ... }, "whatsapp_url": "https://wa.me/923001234567?text=..." }
```
Frontend opens the URL in a new tab (no Twilio required).

## Analytics
### GET /api/v1/analytics/summary
```json
{
  "today": 12000, "week": 86500, "month": 312000, "year": 2150000,
  "live_count": 2, "today_sessions": 9, "today_customers": 7
}
```
### GET /api/v1/analytics/trend?days=14
`[ { "date": "2026-05-14", "revenue": 8400, "sessions": 6 }, ... ]`
### GET /api/v1/analytics/peak-hours
`[ { "hour": 0, "sessions": 1 }, ... 24 entries ]`
### GET /api/v1/analytics/top-tables
`[ { "table_id": "t1", "name": "Royal Snooker 1", "type": "snooker", "sessions": 84, "revenue": 51200 } ]`

## Suggested MySQL schema
```sql
CREATE TABLE users (
  id CHAR(26) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  club_name VARCHAR(120) NOT NULL,
  currency CHAR(3) NOT NULL,
  snooker_rate DECIMAL(10,2) NOT NULL,
  pool_rate DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL,
  country_code VARCHAR(6) NOT NULL
);

CREATE TABLE tables (
  id CHAR(8) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  type ENUM('snooker','pool') NOT NULL
);

CREATE TABLE customers (
  id CHAR(26) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  visits INT NOT NULL DEFAULT 0,
  last_visit DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id CHAR(26) PRIMARY KEY,
  table_id CHAR(8) NOT NULL,
  customer_id CHAR(26) NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  accumulated_ms BIGINT NOT NULL DEFAULT 0,
  run_started_at DATETIME NULL,
  status ENUM('running','paused','ended') NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  manual_adjustment DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_payment_endedat (payment, ended_at),
  INDEX idx_sessions_table_status (table_id, status)
);
```

## Suggested FastAPI project structure
```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, routers
│   ├── core/
│   │   ├── config.py        # settings via pydantic-settings (.env)
│   │   ├── security.py      # JWT + bcrypt
│   │   └── deps.py          # get_db, current_user, require_admin
│   ├── db/
│   │   ├── base.py          # SQLAlchemy engine + Session
│   │   └── models.py
│   ├── schemas/             # pydantic models
│   ├── api/v1/
│   │   ├── auth.py
│   │   ├── settings.py
│   │   ├── tables.py
│   │   ├── customers.py
│   │   ├── sessions.py
│   │   └── analytics.py
│   └── services/
│       ├── billing.py       # calc_bill()
│       └── whatsapp.py      # wa.me URL builder
├── alembic/                 # migrations
├── requirements.txt
└── .env.example
```

## .env.example
```
DATABASE_URL=mysql+pymysql://greentable:secret@localhost:3306/greentable
JWT_SECRET=change-me-please
JWT_EXPIRES_MIN=720
CORS_ORIGINS=http://localhost:5173,https://your-domain.com
```

## Wiring the frontend to your backend
1. Add `VITE_API_URL=http://localhost:8000/api/v1` to `.env`.
2. Replace the `useApp` localStorage logic in `src/lib/store.tsx` with `fetch(`${import.meta.env.VITE_API_URL}/...`)` calls — the shape mirrors the contract above 1:1.
3. Store the JWT in `localStorage` under `gt_auth_v1` (same key the demo uses) and add `Authorization: Bearer <token>` to every request.

## WhatsApp
v1 uses **click-to-send** via `wa.me`. The frontend already builds the URL
locally; the optional `mark-paid` response field is just a convenience so
the backend can centralise the message template.
