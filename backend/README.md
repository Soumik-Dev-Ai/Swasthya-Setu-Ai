# SwasthyaSetu AI — backend

Offline-first healthcare navigation & affordability backend (FastAPI + SQLAlchemy async).

## Quick start

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt

# 1. Auto-create tables (SQLite scaffold) and seed dummy data
python -m scripts.seed_data

# 2. Run the server
uvicorn app.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for the interactive API.

## Switching to PostgreSQL

Set `DATABASE_URL` in a `.env` file (see `app/core/config.py`):

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/swasthyasetu
```

Then run Alembic instead of the SQLite auto-create:

```bash
alembic upgrade head
```

## Auth

The seed script creates:
- `admin / admin123` (ADMIN)
- `asha1 / asha123` (ASHA)

`POST /api/auth/login` returns a JWT bearer token; pass it as
`Authorization: Bearer <token>` on protected routes.

## Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Get JWT | — |
| GET  | `/api/auth/me` | Current user | JWT |
| POST | `/api/triage/analyze` | Triage + red-flag safety override | — |
| POST | `/api/routing/recommend` | Ranked facilities + OOPE | — |
| POST | `/api/asha/upload-form` | Mock OCR for an uploaded image | ASHA/Admin |
| POST | `/api/asha/records` | Save structured ASHA record | ASHA/Admin |
| GET  | `/api/asha/records` | List caller's ASHA records | ASHA/Admin |
| POST | `/api/sync/batch` | Offline batch upsert (idempotent) | ASHA/Admin |
| GET  | `/api/admin/analytics` | Aggregate counts | ADMIN |

## Architecture

- **Logic-first**: `app/services/*` owns business logic; routers are thin HTTP adapters.
- **Deterministic safety**: `app/services/triage_service.py` wraps the mocked AI
  (`app/services/ai_client.py`) with a hardcoded red-flag keyword list that has
  final override authority — a red flag *always* escalates to `EMERGENCY`.
- **Offline-first sync**: `app/services/sync_service.py` upserts batches by
  `(worker_id, device_local_id)` / `device_local_id`, so flaky retransmissions
  are idempotent.
- **Portable DB**: configured via `DATABASE_URL`; SQLite for scaffold,
  Postgres for production (JSONB columns auto-promote).
