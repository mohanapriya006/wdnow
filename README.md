# VNDLY CWM — Contingent Workforce Management System

A VNDLY-inspired Vendor / Contractor / Assignment platform, built as a real,
end-to-end connected application: React + TypeScript frontend, FastAPI
backend, PostgreSQL persistence, JWT auth, and backend-enforced RBAC.

This is **Phase 1** of the platform: Login → RBAC → Vendor → Contractor →
Assignment/Work Order → Rates → Contractor sees Assignment. Timesheets,
expenses, milestones, invoicing, and payroll are intentionally out of scope
for this phase but the data model is built so they attach cleanly to
`assignment_id` later (see "Future Phase 2" below).

---

## 1. Project structure

```
vndly-cwm/
├── backend/                     FastAPI + SQLAlchemy + PostgreSQL API
│   ├── app/
│   │   ├── main.py              App entrypoint, CORS, routers
│   │   ├── config.py            Settings (env vars)
│   │   ├── database.py          SQLAlchemy engine/session
│   │   ├── models.py            ORM models: User, Vendor, Contractor, Assignment
│   │   ├── schemas.py           Pydantic request/response schemas
│   │   ├── security.py          Password hashing + JWT encode/decode
│   │   ├── deps.py              Auth dependencies + RBAC/ownership checks
│   │   ├── seed.py              Demo data seed script
│   │   └── routers/
│   │       ├── auth.py          POST /api/auth/login
│   │       ├── vendors.py       Vendor profile + dashboard
│   │       ├── contractors.py   Contractor CRUD + self-service endpoints
│   │       └── assignments.py   Assignment/work order CRUD
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                    React + TypeScript + Tailwind + shadcn-style UI
│   ├── src/
│   │   ├── api/                 Axios client + typed API modules
│   │   ├── context/AuthContext.tsx
│   │   ├── components/
│   │   │   ├── ui/               Reusable UI primitives (Button, Card, Input, Badge…)
│   │   │   └── layout/AppShell.tsx  Sidebar + topbar shell
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── vendor/           Vendor dashboard, contractors, assignments
│   │   │   └── contractor/       Contractor dashboard, profile, assignment
│   │   └── App.tsx               Route table + role-based route guards
│   ├── package.json
│   └── .env.example
│
└── README.md                    This file
```

---

## 2. Database schema

**users** — id, email, password_hash, role (`VENDOR`/`CONTRACTOR`), vendor_id (nullable FK), contractor_id (nullable FK), created_at

**vendors** — id, name, email, phone, address, tax_id, status, created_at

**contractors** — id, vendor_id (FK), name, email, phone, skills, experience, location, status, created_at

**assignments** — id, vendor_id (FK), contractor_id (FK), project_name, role, start_date, end_date, working_hours, pay_rate, bill_rate, currency, status, notes, created_at, updated_at

Relationships: `Vendor 1:N Contractors`, `Vendor 1:N Assignments`, `Contractor 1:N Assignments`. Every assignment belongs to exactly one vendor and one contractor, enforced with foreign keys.

The `assignments` table is intentionally the richest table — every Phase 2
module (timesheets, expenses, milestones, invoices, payroll) is designed to
hang off `assignment_id` as a foreign key.

---

## 3. API list

| Method | Path                              | Access                | Description |
|--------|------------------------------------|------------------------|--------------|
| POST   | `/api/auth/login`                  | Public                | Login, returns JWT |
| GET    | `/api/vendors/me`                  | Vendor                | Own vendor profile |
| PATCH  | `/api/vendors/me`                  | Vendor                | Update own profile |
| GET    | `/api/vendors/me/dashboard`        | Vendor                | Dashboard counts |
| GET    | `/api/vendors/me/contractors`      | Vendor                | List own contractors |
| POST   | `/api/vendors/me/contractors`      | Vendor                | Add contractor + create their login |
| GET    | `/api/contractors/{id}`            | Vendor (own) / Contractor (self) | Contractor detail |
| GET    | `/api/contractors/me`              | Contractor             | Own profile + vendor name |
| GET    | `/api/contractors/me/assignment`   | Contractor             | Own current assignment (no bill_rate) |
| POST   | `/api/assignments`                 | Vendor                 | Create assignment for own contractor |
| GET    | `/api/assignments`                 | Vendor                 | List own assignments |
| GET    | `/api/assignments/{id}`            | Vendor (own) / Contractor (own) | Assignment detail |
| PATCH  | `/api/assignments/{id}`            | Vendor (own)            | Update rates/status/dates |
| GET    | `/api/health`                      | Public                | Health check |

Interactive OpenAPI docs are available at `/docs` once the backend is running.

**RBAC & ownership enforcement (server-side):**
- `require_vendor` / `require_contractor` dependencies gate every route by role.
- `vendor_id` / `contractor_id` are **only** read from the verified JWT — never from the request body or query params.
- Explicit ownership checks (`assert_vendor_owns_contractor`, `assert_vendor_owns_assignment`, `assert_contractor_owns_assignment`) return `403` on any cross-tenant access attempt.
- A contractor's assignment view **omits `bill_rate`** — only pay_rate is exposed to contractors, matching real VMS practice where the bill rate is commercial info between vendor and client.

---

## 4. Environment variables

### Backend (`backend/.env`, copy from `.env.example`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy connection string | falls back to local SQLite (`sqlite:///./vndly.db`) if unset — for **production use PostgreSQL**: `postgresql+psycopg2://user:pass@host:5432/dbname` |
| `JWT_SECRET_KEY` | Secret used to sign JWTs | change in production |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime | `480` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |

### Frontend (`frontend/.env`, copy from `.env.example`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the FastAPI backend | `http://localhost:8000` |

---

## 5. How to run the backend

Requires Python 3.11+.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and point DATABASE_URL at your PostgreSQL instance.
# If you skip this step entirely, the app auto-falls-back to a local
# SQLite file so you can still run the full demo with zero setup.

# (Optional but recommended) create the Postgres database first:
#   createdb vndly_db

# Create tables + seed demo data (Vendor V001, Contractors C001/C002, Assignment A001)
python -m app.seed

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`.

---

## 6. How to run the frontend

Requires Node.js 20+.

```bash
cd frontend
npm install

cp .env.example .env
# Edit .env if your backend isn't on http://localhost:8000

npm run dev
```

The app will be live at `http://localhost:5173`.

To build for production: `npm run build` (outputs to `frontend/dist`), then
serve `dist/` with any static file host, making sure `VITE_API_URL` was set
correctly at build time.

---

## 7. Seed / demo credentials

| Role | Email | Password | Notes |
|---|---|---|---|
| Vendor | `vendor@abcstaffing.com` | `Vendor@123` | ABC Staffing Solutions (V001) |
| Contractor | `priya.sharma@example.com` | `Contractor@123` | Priya Sharma (C001) — **has** assignment A001 (Payment Platform) |
| Contractor | `arun.kumar@example.com` | `Contractor@123` | Arun Kumar (C002) — **no** assignment yet |

The login page also has one-click "fill demo credentials" buttons for all three.

---

## 8. End-to-end testing steps (matches acceptance criteria)

1. Go to `http://localhost:5173/login`, sign in as the **Vendor**.
2. Confirm the Vendor Dashboard loads with contractor/assignment counts.
3. Go to **Contractors → + Add Contractor**, create a new contractor (e.g. "Rahul Verma").
4. Confirm the contractor now appears in the list with status `ON BENCH` and "No assignment".
5. Log out, log back in as the new contractor using email `rahul.verma@example.com` / password `Contractor@123`.
6. Confirm the Contractor Dashboard shows **"No active assignment"**.
7. Log out, log back in as the **Vendor**.
8. Go to **Assignments → + Create Assignment**, select Rahul, fill in project/role/dates/pay rate/bill rate, submit.
9. Confirm the assignment appears in the Vendor's Assignments list with status `ACTIVE`.
10. Log out, log back in as Rahul (the contractor).
11. Confirm **My Assignment** now shows the project, role, vendor, dates, and pay rate — automatically, with no manual refresh needed beyond navigating/logging in — proving both portals share the same PostgreSQL data.
12. As Rahul, confirm **bill rate is not shown** anywhere (only pay rate).
13. Try to directly call `GET /api/contractors/C001` (Priya's ID) as Rahul's token via `/docs` or curl → expect `403`.
14. Log in as a second, different vendor (if you create one) and confirm they cannot see ABC Staffing's contractors or assignments → `403`.
15. Call any protected endpoint with no `Authorization` header → expect `401`.

All of the above was also verified directly against the running API with
curl during development (see commit history / build notes) — vendor login,
dashboard, contractor creation, assignment creation, contractor auto-sees
new assignment, and all four RBAC boundary checks (`403`/`403`/`403`/`401`)
passed.

---

## 9. Future Phase 2 features (not implemented yet, by design)

The data model already anchors these to `assignment_id` so they can be added
without restructuring the core schema:

- **Timesheets** — weekly time entry, submission, vendor approval
- **Expenses** — contractor expense submission and approval
- **Milestones** — project milestone tracking tied to assignments
- **Rate Cards** — reusable rate templates across assignments
- **Invoice automation** — generating client invoices from approved time/milestones
- **AI invoice validation** — anomaly detection on invoice line items
- **Payroll** — contractor payment processing
- **Real payment integrations** — ACH/wire/payment gateway connections
- **Advanced analytics** — program-level spend, utilization, and diversity reporting
- **Email notifications** — assignment/timesheet/invoice status alerts
- **WebSockets** — real-time dashboard updates
- **Complex KYC** — document verification, background checks
