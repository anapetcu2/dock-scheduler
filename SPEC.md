# Dock Scheduling System — Implementation Spec

This document is the source of truth for building the app. Read it fully before writing code. Build in the phases listed in section 11, and do not start a phase until the previous phase's "done when" checks pass. When you make a decision this spec doesn't cover, record it in `DECISIONS.md` with a one-paragraph rationale rather than silently choosing. Do not add features that aren't listed here.

---

## 1. Background

A marine research facility has berths (docking spots) of different lengths. Vessels reserve a berth for a range of days. Non-vessel events (community sail days, receptions, drills) and closures (pier repair, maintenance) also occupy berths.

Today the schedule lives in an Excel workbook with one tab per year (1997–2019). Staff type a name into a grid and color the days. Two problems motivate this project:

1. **Double-bookings.** Nothing prevents two bookings on the same berth on the same day. Because a cell can hold only one name, conflicts are usually hidden (overwritten, typed into an unlabeled row, or run together with an adjacent booking of the same color) rather than visible.
2. **Vessels that don't fit.** Nothing checks a vessel's length against its berth's length. Lengths live on separate tabs in unstructured text.

The goal is a web app where **invalid bookings cannot be saved**, plus an importer that loads the historical workbook and reports the problems already in it.

---

## 2. Tech stack (fixed — do not substitute)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | |
| Routing | React Router v6 | |
| Server state | TanStack Query | All API reads/writes go through it. No global state library. |
| Forms | react-hook-form | |
| Dates | date-fns | Dates only, never times. See section 4. |
| Styling | Tailwind CSS | |
| API types | `openapi-typescript` | Generate `frontend/src/api/schema.ts` from the backend's OpenAPI JSON. Never hand-write API types. |
| Backend | Python 3.12 + FastAPI | |
| ORM / migrations | SQLAlchemy 2.0 (sync, typed `Mapped[]` style) + Alembic | Sync is deliberate: simpler, and this app has no concurrency needs that justify async. |
| DB driver | psycopg 3 | |
| Validation | Pydantic v2, pydantic-settings for config | |
| Passwords | argon2 via `argon2-cffi` | |
| Excel parsing | openpyxl | Needs cell fills and merged ranges, which pandas discards. |
| Python tooling | uv (dependencies), ruff (lint/format), pytest | |
| Database | PostgreSQL 16 | **Required**, not optional. The no-double-booking guarantee depends on a Postgres exclusion constraint. Never use SQLite, including in tests. |
| Databases | Neon Postgres, three branches: `production` (Neon's default branch), `dev`, `test` | **No Docker and no local Postgres install.** Development and tests run against Neon branches. |
| Hosting | Vercel, using its zero-config FastAPI support (Python runtime, Vercel Functions) | See section 10. |

### Key structural decision: one deployable app

The FastAPI app serves the JSON API (under `/api`) and the built React app. On Vercel the FastAPI app becomes a single Vercel Function, and the React build is registered with `app.frontend("/", directory="frontend/dist")` (or, if that API is unavailable in the installed FastAPI version, `app.mount` with `StaticFiles` plus an `index.html` fallback for client-side routes). Vercel promotes those static files to its CDN, and API routes always take priority over frontend files. In development, Vite runs on its own port and proxies `/api` to uvicorn.

Rationale: frontend and backend share one origin, so there is no CORS configuration, auth cookies work without cross-site settings, and there is one URL, one deploy, and one set of logs. Two separate Vercel projects would add cross-origin cookie and URL configuration with no benefit at this scale.

Before writing deployment config, read the current Vercel docs at https://vercel.com/docs/frameworks/backend/fastapi, since this feature is recent and details may have changed. Record anything that differs from this spec in `DECISIONS.md`.

### Serverless database rules

Because each request may run in a fresh function instance:
- The app connects with Neon's **pooled** connection string (host contains `-pooler`) and uses SQLAlchemy `NullPool`, letting Neon's pooler manage connections.
- Neon's pooler runs in transaction mode, so disable psycopg prepared statements (`connect_args={"prepare_threshold": None}`).
- Alembic migrations, the importer, and tests use the **direct** (unpooled) connection string, via `DATABASE_URL_DIRECT` / `TEST_DATABASE_URL`.
- Migrations never run at app startup. They're run from the developer's machine (section 10).

---

## 3. Repository layout

The Python project sits at the repository root so Vercel auto-detects `app/main.py` as the entrypoint. The frontend is a subfolder whose build output (`frontend/dist`) the FastAPI app serves.

```
dock-scheduler/
├── SPEC.md                    # this file
├── DECISIONS.md               # decisions made during implementation
├── README.md                  # setup, deploy, demo login, assumptions
├── pyproject.toml             # Python deps; any [tool.vercel] settings
├── uv.lock
├── vercel.json                # build command (builds frontend), function settings
├── alembic.ini
├── alembic/versions/
├── .env.example               # committed; lists every variable, no real values
├── .env                       # NOT committed: dev + test connection strings
├── .env.production            # NOT committed: production direct URL for migrations/import
├── app/
│   ├── main.py                # FastAPI `app`: routers under /api + frontend serving
│   ├── config.py              # pydantic-settings
│   ├── db.py                  # engine (NullPool, pooled URL), session dependency
│   ├── models/                # SQLAlchemy models, one file per aggregate
│   ├── schemas/               # Pydantic request/response models
│   ├── api/                   # routers: auth, berths, vessels, contacts, bookings, availability, reports, review, health
│   ├── services/              # business logic (see below)
│   │   ├── booking_rules.py   # THE validation function — single source of truth
│   │   ├── bookings.py        # create/update/cancel, uses booking_rules
│   │   ├── availability.py
│   │   ├── integrity.py       # live data-health checks
│   │   ├── reports.py
│   │   └── audit.py
│   ├── auth/                  # password hashing, session cookie, role dependencies
│   └── cli.py                 # create-user, seed-demo, import-workbook, export-openapi
├── importer/                  # workbook → database, independent of the web app
│   ├── profile.py             # exploratory: dumps fills, layouts, name frequencies
│   ├── layout.py              # detects month blocks, berth rows, day columns
│   ├── spans.py               # reconstructs booking spans from cells
│   ├── classify.py            # vessel / event / closure / note
│   ├── vessels.py             # parses Science + Yachts tabs
│   ├── normalize.py           # name normalization
│   ├── load.py                # writes to DB, records issues
│   ├── report.py              # prints import summary
│   └── config.yaml            # berth aliases, keyword lists, fill meanings
├── tests/
│   ├── conftest.py            # uses TEST_DATABASE_URL (Neon test branch), rollback per test
│   ├── test_booking_rules.py
│   ├── test_overlap_constraint.py
│   ├── test_api_bookings.py
│   └── importer/              # tests against small hand-built .xlsx fixtures
├── data/                      # NOT committed: the sample workbook
└── frontend/
    ├── package.json
    ├── vite.config.ts         # proxies /api to localhost:8000; builds to frontend/dist
    └── src/
        ├── main.tsx, App.tsx, routes.tsx
        ├── api/               # schema.ts (generated), client.ts, query hooks per resource
        ├── features/
        │   ├── schedule/      # timeline grid
        │   ├── bookings/      # booking form drawer, booking detail
        │   ├── availability/  # find-a-berth
        │   ├── vessels/
        │   ├── berths/
        │   ├── contacts/
        │   ├── review/        # data review page
        │   ├── reports/
        │   └── auth/
        ├── components/        # shared UI primitives
        └── lib/dates.ts       # all date math lives here
```

`.gitignore` must include `.env`, `.env.production`, `data/`, `frontend/dist/`, `frontend/node_modules/`, and `.venv/`.

Services contain business logic and are called by routers. Routers stay thin: parse input, call a service, shape output. The importer is a separate package because it's a one-time migration tool, not a user feature; it reuses `app.models` but writes directly rather than through the booking service (see section 7.6).

---

## 4. Date semantics

- Bookings are **whole days**. `start_date` and `end_date` are `DATE` columns and both are **inclusive**. A booking on Oct 3–Oct 9 occupies 7 days.
- A booking ending on the 5th and another starting on the 5th **conflict**. This matches the spreadsheet, where each cell is one day. Arrival/departure times go in `notes`.
- No time zones anywhere. The frontend must never convert a date through a JS `Date` in local time in a way that can shift days; keep dates as `YYYY-MM-DD` strings at the API boundary and use date-fns helpers in `lib/dates.ts`.
- In Postgres, overlap is expressed as `daterange(start_date, end_date, '[]')`.

---

## 5. Data model

All tables have `id` (integer PK), `created_at`, `updated_at`.

### berths
| Column | Type | Rules |
|---|---|---|
| name | text, unique | e.g. "North Pier West" (no length in the name) |
| length_ft | numeric(6,1), nullable | Null means unknown. Bookings on a berth with unknown length fail the fit check. |
| max_draft_ft | numeric(5,1), nullable | Used for warnings only |
| is_active | bool, default true | Inactive berths hidden from booking form and availability, still shown in history |
| sort_order | int | Row order in the timeline |
| notes | text | |

### organizations
`name` (unique), `notes`.

### contacts
`name`, `organization_id` (nullable FK), `phone`, `email`, `notes`.

### vessels
| Column | Type | Rules |
|---|---|---|
| name | text | Display name, e.g. "Salt Dory" |
| type_prefix | text, nullable | "R/V", "M/V", "F/V", "S/V", "M/Y", "S/Y", "Tug", "Barge", "OSV" |
| normalized_key | text, unique | See section 7.4. Prevents duplicates like "SALT DORY" vs "Salt Dory". |
| loa_ft | numeric(6,1), nullable | Length overall |
| draft_ft | numeric(5,1), nullable | |
| organization_id | FK, nullable | |
| is_active | bool | |
| notes | text | |

Plus a `vessel_contacts` join table (vessel_id, contact_id, role text nullable).

### bookings
| Column | Type | Rules |
|---|---|---|
| berth_id | FK, not null | |
| kind | enum: `vessel`, `event`, `closure` | |
| vessel_id | FK, nullable | Required when kind = vessel; must be null otherwise (CHECK constraint) |
| title | text, nullable | Required when kind ≠ vessel (CHECK constraint). For vessel bookings, the UI displays the vessel name. |
| start_date, end_date | date | CHECK `end_date >= start_date` |
| status | enum: `tentative`, `confirmed`, `cancelled`, `legacy_conflict` | |
| notes | text | |
| source | enum: `app`, `import` | |
| source_ref | text, nullable | For imported rows: sheet and cell range, e.g. `1997!L26:Q26`. Shown on the booking detail so anyone can check the original. |
| created_by | FK users, nullable | Null for imported rows |

**The exclusion constraint** (write it in a raw SQL Alembic migration, since the ORM won't generate it):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    berth_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status IN ('tentative', 'confirmed'));
```

Tentative bookings **do** block the berth (a hold is a hold). `cancelled` and `legacy_conflict` do not. This constraint is the real guarantee; the service-layer checks exist to produce friendly error messages, but the database must reject overlaps even if application code has a bug or two requests race.

### users
`email` (unique), `name`, `password_hash`, `role` enum (`staff`, `admin`), `is_active`.

### audit_events
`user_id` (nullable), `action` (`create`, `update`, `cancel`, `delete`, `resolve_issue`), `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `at`. Written by `services/audit.py` inside the same transaction as the change.

### import_issues
`issue_type` (text enum, see 7.7), `severity` (`error`, `warning`, `info`), `message`, `source_ref`, `details` (jsonb), `entity_type` / `entity_id` (nullable), `resolved_at`, `resolved_by`, `resolution_note`.

---

## 6. Business rules

All rules live in one function, `services/booking_rules.py::validate_booking(session, proposal, exclude_booking_id=None) -> ValidationResult`. Both the create/update endpoints and the dry-run validate endpoint call it. Never duplicate these rules elsewhere on the backend. The frontend displays what this returns; it does not reimplement the rules.

`ValidationResult` = `{ ok: bool, errors: Issue[], warnings: Issue[] }`, where `Issue = { code, message, field?, related_booking_id? }`. `ok` is true when `errors` is empty.

**Errors (block saving):**

| Code | Condition |
|---|---|
| `OVERLAP` | Another booking on the same berth with status tentative/confirmed overlaps the date range. Excludes `exclude_booking_id` so editing a booking doesn't conflict with itself. One issue per conflicting booking, with its id, title, and dates in the message. |
| `VESSEL_TOO_LONG` | kind = vessel and `vessel.loa_ft + FIT_MARGIN_FT > berth.length_ft`. Message includes both numbers, e.g. "R/V High Strand is 145′; North Pier Face is 75′." |
| `VESSEL_LENGTH_UNKNOWN` | kind = vessel and `vessel.loa_ft` is null. Message tells the user to add the length on the vessel page. |
| `BERTH_LENGTH_UNKNOWN` | kind = vessel and `berth.length_ft` is null. |
| `BERTH_INACTIVE` | Berth is inactive. |
| `INVALID_DATES` | end before start. |
| `MISSING_VESSEL` / `MISSING_TITLE` | Kind-specific required fields. |

Events and closures skip fit checks; they only need the berth to be free.

**Warnings (shown, don't block):**

| Code | Condition |
|---|---|
| `TIGHT_FIT` | Vessel fits but with less than `TIGHT_FIT_FT` (default 5) to spare |
| `DRAFT_EXCEEDS_DEPTH` | Both drafts known and vessel draft > berth max draft |
| `IN_PAST` | Start date before today |

`FIT_MARGIN_FT` (default 0) and `TIGHT_FIT_FT` are settings in `config.py`.

**Saving:** `services/bookings.py` calls `validate_booking`; if not ok, return HTTP 422 with the result. If ok, insert/update. If the database still raises the exclusion-constraint violation (race), catch `IntegrityError` for `bookings_no_overlap`, re-run `validate_booking` to find the conflict, and return HTTP 409 with it. Write an audit event in the same transaction.

**Status changes:** tentative ↔ confirmed, either → cancelled. Cancelled bookings can't be edited except by admins. Reactivating a cancelled booking re-runs validation. Only admins can hard-delete. `legacy_conflict` bookings can be edited by admins into a valid state (moved, cancelled), which runs full validation.

**Changing a vessel's length or a berth's length** doesn't rewrite existing bookings. Instead, the integrity report (section 8.7) surfaces any bookings that no longer fit.

---

## 7. Importer

Command: `uv run python -m app.cli import-workbook PATH [--dry-run] [--reset]`. `--dry-run` parses and prints the report without writing. `--reset` wipes imported rows (source = import) and import issues before loading. The command must be idempotent with `--reset`.

**Principle: never silently guess.** When the workbook is ambiguous, import the most reasonable interpretation **and** record an `import_issue` pointing to the source cells. Every imported booking stores `source_ref`.

### 7.1 Step 0: profile before writing parsing logic

Write `importer/profile.py` first and run it against the workbook. It should print: sheet names; for each year sheet, the rows detected as month headers; distinct column-A labels with counts; a frequency table of cell fills (fill type + color) broken down by whether the cell has text, whether it's in a berth row, and whether it's in a weekend column; and all distinct text values in berth rows. Use this output to fill in `importer/config.yaml` (which fills are background vs. booking, keyword lists) and record findings in `DECISIONS.md`. Do not hard-code guesses about colors without checking.

### 7.2 Workbook structure (known facts from inspection)

- Year tabs `1997` through `2019`. Other tabs: `8YR Dock Summary`, `Science`, `Yachts`, `Tours`. Ignore `Tours` (it states tours are tracked elsewhere).
- **Two layouts:**
  - **Early (roughly 1997–2003):** A month block starts with a column-A cell like `AUGUST 1997`. The next row holds weekday letters (`M T W TR F S S`). The row after holds day numbers: `1` in column B, then `=SUM(B3+1)`-style formulas. Day *d* is in column `B + (d-1)`. Berth rows follow, then blank rows.
  - **Later (roughly 2004 onward):** Three title rows at the top (facility name, "YYYY Pier & Dock Schedule…", contact line). A month block starts with a column-A cell like `January` whose same row holds integer day numbers starting in a column that varies by month (calendar-style alignment). The next row holds weekday letters. Berth rows follow, including `North Finger Piers:` and `Small craft slips (institution boats)`. Later sheets use merged cells for some bookings.
- Detect layout per month block, not per sheet, by pattern-matching the header row. Determine each day's column from the header row itself (the column holding `1`, then consecutive). For early formula rows, compute rather than evaluate formulas.
- **Sanity check:** for each month block, verify the weekday-letter row matches the real calendar for that month/year (`TR` = Thursday). Record a `LAYOUT_MISMATCH` issue if not.
- **Berth labels** in column A embed length: `North Pier West - 410'`, `North Pier Face - 75'`, `North Pier East - 240'`, `Inner Channel - 55'`, `South Float West - 90'`, `South Float East - 90'`. Parse name and length; create berths from these. `North Finger Piers` and `Small craft slips (institution boats)` have no length → create berths with `length_ft = null` and an `UNKNOWN_BERTH_LENGTH` issue. `8YR Dock Summary` also names `Marsh Landing`, which doesn't appear in grids → record an `info` issue, don't create a berth. Put berth name aliases in `config.yaml`.

### 7.3 Reconstructing booking spans

Within each berth row of a month block, walk the day columns:

1. A **booking cell** is a cell that is part of a merged range, has a non-background fill (per config), or contains text.
2. A **merged range** is one span. Its text is the booking name.
3. Otherwise, group consecutive booking cells into runs. Within a run, each text cell starts a new span. Unnamed cells *before* the first name in a run belong to that first span (in the data, names are not always in the first colored cell). Unnamed cells after a name belong to that name until the next name or the end of the run.
4. A run with no text at all → `ORPHAN_FILL` issue, no booking.
5. Where a run contains two names back-to-back with no gap, create both spans and add an `AMBIGUOUS_BOUNDARY` warning (the grid can't show where one ends).
6. **Cross-month joins:** if a span reaches the last day of a month and the same berth's row in the next month block (including across year sheets) starts on day 1 with unnamed booking cells or the same normalized name, merge into one booking. Unnamed continuations with no preceding span → `ORPHAN_FILL`.
7. Text found in rows **without** a berth label inside a month block (e.g. a vessel name typed in a blank row under the last berth) → do not create a booking; record `UNLABELED_ROW_ENTRY` with the text, cell, and the berth row directly above.

### 7.4 Classifying text and normalizing names

`classify.py` assigns each span's text to one of:

- **vessel**: starts with a known prefix (`R/V`, `M/V`, `F/V`, `S/V`, `M/Y`, `S/Y`, `Tug`, `Barge`, `OSV`, case-insensitive).
- **closure**: contains keywords such as `repair`, `maintenance`, `no docking`, `no usage`, `closed`, `restricted`, `rebuild`, `crane access`, `inspection`, `concrete`, `paving`, `utility work`, `bollard`.
- **note**: operational notes that don't occupy a berth on their own, such as `ETA`, `ETD`, `Arrives`, `Arrival`, `Departs`, `Departure`, `Delayed due to weather`, `Touch and go`. If a note overlaps a vessel/event span on the same berth, append it to that booking's `notes`. Otherwise record `UNATTACHED_NOTE` (info).
- **event**: everything else (e.g. `Community sail day`, `Donor reception`, `Public open house`, `Rescue drill`, `Fueling`, `Bunkering`, `Film crew on dock`).

All keyword lists live in `config.yaml`. The profile script's list of distinct texts is the checklist: every distinct text must classify without falling through by accident; print the classification table in the import report.

**Vessel normalization** (`normalize.py`): `normalized_key` = prefix normalized (e.g. `RV`, `MV`, `TUG`) + `|` + name uppercased with whitespace collapsed and punctuation stripped. Example: `Barge SALT DORY` and `Barge Salt Dory` → `BARGE|SALT DORY`. Display name: the variant used most often, title-cased if it was all-caps. Report every merged group of variants.

### 7.5 Vessel details from Science and Yachts tabs

These tabs are loosely structured: a vessel name cell starts a record, and the following rows until the next vessel name hold operators, contacts, phones, emails, and notes in inconsistent columns.

- A **record start** is a cell matching a vessel prefix. A trailing length like `72'` in that cell is a length candidate.
- Within the record, cells matching `LOA:\s*(\d+)'` and `Draft:\s*(\d+)'` are length/draft candidates.
- If candidates disagree (e.g. `M/Y Western Strand 52'` with `LOA: 65'`), prefer the explicit `LOA:` value, store the other in vessel notes, and record `CONFLICTING_VESSEL_LENGTH`.
- Emails (regex), phone strings (`Cell: 555-0123`), names prefixed `Capt.`, and cells matching known organization names are collected into contacts/organizations best-effort. Mark these vessel notes "Contact details imported automatically — verify." Don't try to be clever about which phone belongs to which person.
- Match these vessels to schedule vessels via `normalized_key`. Vessels only in the schedule get `loa_ft = null`.

### 7.6 Loading

Write directly with SQLAlchemy, not through `services/bookings.py`, because historical data is expected to violate the rules and must still be imported. Process bookings in chronological order per berth. Insert each as `confirmed`; if it would overlap an already-inserted active booking, insert it as `legacy_conflict` instead (the exclusion constraint will otherwise reject it). Fit problems in historical data are not stored as issues; the live integrity report finds them (section 8.7).

### 7.7 Import issue types

`LAYOUT_MISMATCH`, `ORPHAN_FILL`, `AMBIGUOUS_BOUNDARY`, `UNLABELED_ROW_ENTRY`, `UNATTACHED_NOTE`, `CONFLICTING_VESSEL_LENGTH`, `UNKNOWN_BERTH_LENGTH`, `UNKNOWN_BERTH`, `NAME_VARIANTS_MERGED` (info), `HISTORICAL_OVERLAP` (one per `legacy_conflict` booking, linked to it and to the booking it clashed with).

### 7.8 Import report

Print at the end: counts of berths, vessels, bookings by kind and status; issue counts by type; the classification table; the name-variant groups; and a **validation table comparing computed days-booked per berth per year (2006–2013) against the `8YR Dock Summary` tab**, showing both numbers and the difference. Large differences are a signal the span logic is wrong; investigate before moving on and note conclusions in `DECISIONS.md`.

---

## 8. API

All routes under `/api`. JSON in and out. Dates as `YYYY-MM-DD`. Errors use FastAPI's standard shape except booking validation, which returns the `ValidationResult`. Read endpoints for the schedule, berths, vessels, and availability are public. Contacts, audit history, the review page, and all writes require login.

### 8.1 Auth
- `POST /api/auth/login` `{email, password}` → sets session cookie. `POST /api/auth/logout`. `GET /api/auth/me` → user or 401.
- Session cookie: signed (itsdangerous with `SECRET_KEY`), `HttpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry. Store user id and role.
- Role dependencies: `require_user`, `require_admin`. Staff can manage bookings and vessels/contacts. Admins additionally manage berths, users, hard deletes, and issue resolution.
- Because the app is same-origin with a `SameSite=Lax` cookie and all writes require a JSON body, no separate CSRF token is needed for the prototype. Note this in `DECISIONS.md`.

### 8.2 Berths
`GET /api/berths?include_inactive=`, `POST`, `PATCH /api/berths/{id}`, (admin for writes).

### 8.3 Vessels, organizations, contacts
`GET /api/vessels?q=&include_inactive=` (search by name, case-insensitive, matching variants via normalized key), `GET /api/vessels/{id}` (includes contacts and recent bookings), `POST`, `PATCH`. Same CRUD pattern for `/api/organizations` and `/api/contacts`. Creating a vessel whose normalized key already exists returns 409 with the existing vessel's id.

### 8.4 Bookings
- `GET /api/bookings?start=&end=&berth_id=&vessel_id=&kind=&status=` — returns bookings overlapping the range. Default excludes cancelled. Include vessel name/LOA and berth name in each row so the timeline needs one request.
- `GET /api/bookings/{id}` — includes `source_ref` and audit history (history only when logged in).
- `POST /api/bookings/validate` — body = booking proposal + optional `booking_id`. Returns `ValidationResult`. No side effects. Called by the form as the user types (debounced).
- `POST /api/bookings`, `PATCH /api/bookings/{id}` — 422 with `ValidationResult` on rule failure, 409 on race.
- `POST /api/bookings/{id}/cancel`, `DELETE /api/bookings/{id}` (admin).

### 8.5 Availability ("find me a berth")
`GET /api/availability?vessel_id=&start=&end=` (or `loa_ft=` instead of vessel_id for a hypothetical vessel). Returns every active berth with: `fits` (bool + reason), `free` (bool), `conflicts` (list of bookings), and warnings. Sort: fits-and-free first (tightest suitable fit first, so big berths stay open for big ships), then fits-but-busy, then doesn't fit. Implement by calling `validate_booking` per berth so the rules stay in one place.

### 8.6 Reports
- `GET /api/reports/utilization?year_from=&year_to=` → days booked per berth per year (confirmed + legacy_conflict; tentative reported separately), plus percentage of days occupied.
- `GET /api/bookings/export.csv?` with the same filters as the list endpoint.

### 8.7 Data review
- `GET /api/review/integrity` — **computed live** from current data, not stored: active or legacy bookings whose vessel doesn't fit the berth; vessel bookings with unknown vessel or berth length; all `legacy_conflict` bookings with the booking each clashes with. Because it's computed, fixing a vessel's length makes its issues disappear immediately.
- `GET /api/review/import-issues?type=&resolved=` — the stored parse-time issues.
- `POST /api/review/import-issues/{id}/resolve` `{note}` (admin).
- `GET /api/review/summary` — counts for dashboard cards.

Rationale for the split: problems that depend on current data (fit, overlaps) are computed so they're never stale; problems that only exist in the original file (orphan fills, ambiguous cells) can only be recorded at import time.

### 8.8 OpenAPI
`uv run python -m app.cli export-openapi > frontend/openapi.json`, then `npm run gen:api` generates `src/api/schema.ts`. Give every route an explicit `response_model` and `operation_id` so generated types are clean.

---

## 9. Frontend

Layout: top nav with Schedule, Find a berth, Vessels, Berths, Reports, Data review (logged in only), and login/user menu. Responsive down to tablet width; the timeline scrolls horizontally on small screens.

### 9.1 Schedule (home page, `/`)
- A grid: berths as rows (ordered by `sort_order`), days as columns. Header shows day number and weekday; weekends shaded; today highlighted; month boundaries marked.
- View ranges: 2 weeks, month (default), 3 months. Previous/next/today buttons and a date picker to jump (the data goes back to 1997). Keep the visible range in the URL query string (`?start=2019-06-01&view=month`) so views are linkable.
- Build with CSS grid, not a scheduler library. Bookings are absolutely positioned bars using `grid-column: start / span n`, clipped at the range edges with an arrow indicating they continue. At ~8 berths × ~90 days no virtualization is needed.
- Bar styling by kind: vessel, event, closure each a distinct color, with a text label or icon too (never color alone). Tentative = hatched pattern. `legacy_conflict` = red outline and warning icon; since these overlap other bookings, stack overlapping bars within a row in sub-lanes so both are visible.
- Hover/focus shows a tooltip: title, dates, vessel LOA vs. berth length, status. Click opens the booking detail drawer.
- Logged-in users: click an empty cell (or drag across cells) to open the booking form prefilled with that berth and dates.
- Filters: kind, status, vessel search (highlights matching bars).
- Bars are keyboard-focusable buttons with descriptive `aria-label`s.

### 9.2 Booking form (drawer)
- Fields: kind (segmented control), vessel (searchable select with "add new vessel" inline) or title, berth, start date, end date, status, notes.
- On any change, debounce 300 ms and call `POST /api/bookings/validate`. Show a live checklist: ✓/✗ "Berth free for these dates", ✓/✗ "Vessel fits (72′ on 90′ berth)", plus warnings. Conflicts link to the conflicting booking.
- Save is disabled while there are errors. If save returns 409 (someone else booked it first), show the conflict and keep the form open.
- Next to the berth field, a "Find a berth that fits" link opens availability with the current vessel and dates.
- Editing an existing booking uses the same drawer, with Cancel booking and (admin) Delete actions. Booking detail shows `source_ref` for imported bookings and the audit history.

### 9.3 Find a berth (`/availability`)
Inputs: vessel (or a length in feet), start, end. Results list grouped "Available and fits", "Fits but booked" (showing conflicts), "Too small". Each available result has "Book this berth", which opens the booking form prefilled.

### 9.4 Vessels (`/vessels`, `/vessels/:id`)
Searchable table: name, type, LOA, draft, organization, flags (length unknown). Detail page: edit fields, contacts, upcoming and past bookings. Vessels with unknown length show a prominent prompt, since they can't be booked until fixed.

### 9.5 Berths (`/berths`)
Table of berths with length, max draft, active flag, and utilization this year. Admins edit inline.

### 9.6 Data review (`/review`, logged in)
- Summary cards: historical double-bookings, vessels on too-short berths, vessels with unknown length, berths with unknown length, parse issues.
- Tabs: **Integrity** (live checks) and **Import issues** (stored). Each row shows the problem in plain language, the source cell reference, and a link to fix it (open booking, open vessel, open berth). Admins can resolve import issues with a note.
- This page is the centerpiece of the demo: it shows what the system found in 23 years of data.

### 9.7 Reports (`/reports`)
Utilization table and a bar chart (use a small chart library such as Recharts) of days booked per berth per year, with a year-range selector. CSV export button for bookings with current filters.

### 9.8 Conventions
- One query hook per resource in `src/api/` (e.g. `useBookings(range)`, `useValidateBooking()`); invalidate booking queries after any write.
- All date math in `lib/dates.ts`, with unit tests (Vitest), including month boundaries and leap years.
- Loading and error states on every page. Empty states with helpful text.

---

## 10. Configuration, deployment, and scripts

### Environment variables

`.env.example` lists every variable with a placeholder. `config.py` loads `.env` by default, or the file named by `ENV_FILE` (so `ENV_FILE=.env.production` targets production).

| Variable | `.env` (local dev) | `.env.production` (local, for prod admin tasks) | Vercel project settings |
|---|---|---|---|
| `DATABASE_URL` | Neon `dev` branch, pooled | Neon `production` branch, pooled | Neon `production` branch, pooled |
| `DATABASE_URL_DIRECT` | Neon `dev` branch, direct | Neon `production` branch, direct | not needed |
| `TEST_DATABASE_URL` | Neon `test` branch, direct | — | — |
| `SECRET_KEY` | any random string | same as Vercel's | random string, generated once |
| `ENVIRONMENT` | `development` | `production` | `production` |
| `FIT_MARGIN_FT`, `TIGHT_FIT_FT` | optional | optional | optional |

Never print secret values in logs, test output, or commit messages.

### Local development (no Docker)
- Backend: `uv sync`, then `uv run alembic upgrade head`, then `uv run uvicorn app.main:app --reload` (port 8000). Alembic reads `DATABASE_URL_DIRECT`.
- Frontend: `cd frontend && npm install && npm run dev` (Vite proxies `/api` to port 8000).
- `uv run python -m app.cli seed-demo` creates an admin user and a demo staff user (passwords read from the prompt or from `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD`, never hard-coded).
- Tests: `uv run pytest`. conftest runs migrations against `TEST_DATABASE_URL` once per session and wraps each test in a rolled-back transaction (the concurrency test uses its own committed transactions and cleans up after itself). Refuse to run if `TEST_DATABASE_URL` equals `DATABASE_URL_DIRECT` or points at the `production` branch.

### Production (Vercel + Neon)
- `vercel.json` sets the build command to build the frontend (`cd frontend && npm ci && npm run build`). Vercel installs Python dependencies from `pyproject.toml`/`uv.lock`; if the build can't find them, generate `requirements.txt` with `uv export --no-dev --no-hashes` and note it in `DECISIONS.md`.
- Every push to `main` on GitHub deploys to production.
- Schema changes are applied from the developer machine **before** pushing code that needs them: `ENV_FILE=.env.production uv run alembic upgrade head`.
- The one-time historical import and demo users are also run from the developer machine: `ENV_FILE=.env.production uv run python -m app.cli import-workbook data/Dock_Schedule.xlsx --reset` and `ENV_FILE=.env.production uv run python -m app.cli seed-demo`.
- `GET /api/health` returns 200 and checks DB connectivity.
- The `app/` code must not write to the filesystem at runtime (serverless functions have a read-only bundle).

### README must include
Live URL (the production `*.vercel.app` domain); demo login credentials (demo staff account); note that the first request after a quiet period can take a few seconds while the function and database wake up; local setup; how to run the import; architecture summary; the assumptions list below; and known limitations.

### Assumptions to state in README
Whole-day bookings with inclusive dates; same-day turnover counts as a conflict; each berth holds one booking at a time; tentative bookings block the berth; tours are out of scope; how fill colors were interpreted (from `DECISIONS.md`); contact details were imported best-effort and need verification.

---

## 11. Build phases

### Phase 1 — Foundation and the core guarantee
Repo scaffold, config, all models and migrations including the exclusion constraint, `booking_rules.py`, `services/bookings.py`, audit logging, CLI `create-user`.
**Done when** pytest covers and passes: overlapping bookings rejected; same-day end/start rejected; adjacent (end 4th, start 5th) accepted; cancelled and legacy_conflict don't block; editing a booking doesn't conflict with itself; two concurrent inserts for the same berth/dates result in exactly one success (use two sessions/threads); too-long vessel rejected; unknown lengths rejected; events skip fit checks; kind-specific CHECK constraints enforced at the DB level.

### Phase 2 — API and auth
All routers in section 8 except review and reports; session auth and roles; OpenAPI export.
**Done when** API tests cover auth (401/403 cases), booking create/update/cancel with 422 and 409 paths, availability ordering, and vessel duplicate detection.

### Phase 3 — Frontend core
App shell, login, schedule timeline, booking drawer with live validation, vessels and berths pages, generated API types.
**Done when** a logged-in user can create, edit, and cancel bookings from the timeline; invalid bookings can't be saved and show clear reasons; logged-out users can view the schedule but not edit; date utils have unit tests.

### Phase 4 — Importer
Profile script first, then config, parsing, loading, report.
**Done when** fixture-workbook tests pass for both layouts, merged cells, name-not-in-first-cell, back-to-back names, cross-month joins, unlabeled-row entries, and conflicting lengths; the real workbook imports with `--reset` repeatably; the report's comparison against `8YR Dock Summary` has been reviewed and discrepancies explained in `DECISIONS.md`.

### Phase 5 — Review, find-a-berth UI, reports
Integrity service, review endpoints and page, availability page, utilization report and chart, CSV export.
**Done when** fixing a vessel's length on the vessel page removes its integrity issues on reload; availability results link into a prefilled booking form.

### Phase 6 — Deploy and polish
`vercel.json`, health check, connect the GitHub repo to Vercel, run migrations and the import against production, seed demo users, write README.
**Done when** the public production URL loads in a private browser window without any Vercel login prompt, the demo login works, deep links like `/vessels` load directly, and the README is complete.

---

## 12. Out of scope (don't build)
Tours; payments or invoicing; email/SMS notifications; hourly scheduling; multiple vessels sharing one berth by length; public self-service booking by vessel operators; mobile app. These can be listed in the README as future work, along with draft-vs-depth enforcement and expiring tentative holds.
