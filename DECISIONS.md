# Decisions

Record of choices made while implementing SPEC.md that the spec left open, in the order they came up.

---

## Workbook sample is synthetic, not the real 1997–2019 archive

The file placed at `data/Dock_Schedule.xlsx` is named "Dock Schedule - Synthetic Sample.xlsx" — a synthetic stand-in with the same sheet structure (`1997`…`2019`, `8YR Dock Summary`, `Science`, `Yachts`, `Tours`), not the facility's real historical workbook. The importer (Phase 4) is built and tested against this file and against small hand-built fixtures. Section 7.8's comparison against `8YR Dock Summary` and any DECISIONS.md notes about discrepancies should be re-checked if the real workbook is substituted later, since real-world messiness may differ from the synthetic sample.

## `vessel_contacts` gets its own `id`, `created_at`, `updated_at`

Section 5 opens with "All tables have `id` (integer PK), `created_at`, `updated_at`" before listing tables, and the `vessel_contacts` join table's column list (`vessel_id, contact_id, role`) reads the same way every other table's list does — as the columns *in addition to* that blanket rule, not a replacement for it. So `vessel_contacts` has a surrogate `id` PK plus the standard timestamps, and `vessel_id`/`contact_id` are plain (non-composite-PK) foreign keys. No uniqueness constraint on `(vessel_id, contact_id, role)` — the spec doesn't ask for one, and best-effort imported contacts (7.5) may legitimately produce duplicates that need cleanup later rather than a rejected insert.

## `audit_events` has `id` and `at`, but no `created_at`/`updated_at`

The blanket "all tables have `created_at`, `updated_at`" rule is dropped for this one table: audit events are append-only (the spec says so directly — "Written by `services/audit.py` inside the same transaction as the change" with no update path), so an `updated_at` that can never legitimately change is actively misleading. The spec's own column list gives this table an explicit `at` timestamp, which already serves the purpose `created_at` would. Keeping both would be two columns recording the same moment. `id` is still added as the integer PK per the blanket rule, since nothing in this table replaces that.

## `OVERLAP` is only checked when the proposal's own status is tentative/confirmed

Section 6's `OVERLAP` condition talks about *other* bookings ("Another booking... with status tentative/confirmed overlaps..."), without saying whether the check applies when the booking being saved is itself cancelled or `legacy_conflict`. It must gate on the proposal's own resultant status too, for two reasons: (1) it has to mirror what `bookings_no_overlap` actually enforces — that exclusion constraint's `WHERE` clause only fires for rows whose own status is tentative/confirmed, so a service-layer check that's stricter would block saves the database would accept; (2) admins need to edit a `legacy_conflict` booking's dates/notes while leaving it `legacy_conflict`, and cancelling a booking must never be blocked by the very conflict it's resolving. So `validate_booking` skips the `OVERLAP` check entirely when `proposal.status` is `cancelled` or `legacy_conflict`.

## FK existence (berth_id/vessel_id) is the caller's responsibility, not a validation Issue

`validate_booking` assumes `berth_id`, and `vessel_id` when given, reference rows that exist — the spec's error-code table has no "berth not found" / "vessel not found" code, and mixing a 404-shaped problem into a 422 `ValidationResult` would blur the two. The API router (section 8.4, Phase 2) is responsible for fetching berth/vessel first and returning a plain 404 before calling `validate_booking`. Within `booking_rules.py`, a missing berth/vessel is treated as "nothing to check" rather than an error, so unit tests can call the function directly with a valid session without needing a full HTTP-layer 404 path.

## Local tooling

`uv` and `node`/`npm` were not present on the development machine and were installed via Homebrew (`brew install uv node`) to match the fixed tech stack in section 2.

---

## Phase 2 decisions

## Session cookie carries only `user_id` and `role`; `require_admin` trusts the cookie's role, not a fresh DB read

Section 8.1 says the cookie stores user id and role. `require_admin` checks `user.role` off the `User` row loaded fresh from the DB in `get_current_user` (not off the cookie payload), so a role change takes effect on the user's very next request rather than only after their cookie expires — the cookie's `role` field is effectively unused today. It's kept in the token anyway because the spec asks for it, in case a future optimization wants to skip the DB lookup for low-stakes checks.

## `editing a cancelled or legacy_conflict booking requires admin` is enforced in the router, not in `validate_booking`

Section 6 says cancelled bookings "can't be edited except by admins" and legacy_conflict bookings are edited "by admins" into a valid state, but doesn't say which layer enforces that — it's an authorization rule (who), not a data-validity rule (what), so it belongs with the other role checks in `app/api/bookings.py::update_booking_endpoint`, not in `booking_rules.py`. `validate_booking` stays purely about whether a proposed state is legal, independent of who's asking.

## Availability with a hypothetical vessel (`loa_ft`, no `vessel_id`) computes fit locally instead of through `validate_booking`

Section 8.5 says to implement availability "by calling `validate_booking` per berth so the rules stay in one place," but `validate_booking`'s fit checks (`VESSEL_TOO_LONG`, `TIGHT_FIT`) all read from a `Vessel` row — there's no parameter for a bare length. For the `vessel_id` case this is used directly (a `kind=vessel` proposal), keeping fit and overlap logic in the one place the spec asks for. For the `loa_ft`-only case, `validate_booking` is still used for the overlap/free check (via a `kind=event` proposal, since events skip fit checks and only test whether the berth is free), but the fit comparison itself is a small local re-implementation of the same `length_ft - (loa_ft + FIT_MARGIN_FT)` formula, since there's no vessel entity to hand the real function. If that formula changes, both spots need updating — an acceptable small duplication given the constraint, but worth knowing about.

## Vessel duplicate-key conflict (409) puts `vessel_id` inside `detail`, not as a top-level response field

Section 8.3 says creating a vessel with a normalized key that already exists "returns 409 with the existing vessel's id," without specifying the shape. FastAPI's `HTTPException(detail=...)` is the standard way to attach a body to an error response, and `detail` accepts any JSON value, so `{"message": ..., "vessel_id": ...}` is used there rather than inventing a non-standard top-level response field that would need its own exception handler.

## CSV export lives at `GET /api/bookings/export.csv`, registered before `GET /api/bookings/{id}`

Section 8.6 names the route `/api/bookings/export.csv?` with the same filters as the list endpoint. Since `export.csv` would otherwise be swallowed by the `/{booking_id}` path parameter, it's registered earlier in the router so Starlette matches it first — routes are tried in registration order.

## Organization name uniqueness returns 409 on conflict, even though section 8.3 only spells this out for vessels

`organizations.name` is `unique` in the data model (section 5) but section 8.3's 409-with-id behavior is described only for vessels. Letting a duplicate organization name reach the database and raise a raw `IntegrityError` would surface as an unhandled 500, which is worse than a clear 409, so `create_organization`/`update_organization` catch it. Unlike vessels, there's no normalized-key lookup to return an existing id (name uniqueness is exact, case-sensitive, at the DB level), so the 409 body is just a message.

---

## Phase 3 decisions

## React 18 and React Router v6, pinned above the scaffold defaults; `openapi-fetch` added as the typed HTTP client

`npm create vite@latest` (the tool used to scaffold `frontend/`) defaults to React 19 and Vite 8 today, but section 2 fixes React 18, so `package.json` was hand-written pinning `react`/`react-dom` to `^18.3.1` rather than accepting the scaffold's versions. Section 2 also says API types come from `openapi-typescript` but doesn't name a fetch layer; `openapi-fetch` (from the same maintainer, built specifically to consume `openapi-typescript`'s generated `paths` type) is added so every request is checked against the generated schema instead of hand-typed, in the spirit of "never hand-write API types."

## `react-router-dom` pinned to `^6.30.6`, and a known open advisory in the v6 line is accepted

`npm audit` flags GHSA-wrjc-x8rr-h8h6 (an open-redirect via a backslash in `<Link>`/`useNavigate`) as unfixed on any 6.x release — the fix only landed in 7.18.4. Section 2 fixes React Router v6, so upgrading to v7 to clear the advisory isn't an option here. Exposure is low regardless: every `<Link to=...>` and `navigate(...)` call in this app passes a literal, app-defined path (`/vessels/${id}`, `/berths`, etc.), never a value read from user input or an external redirect parameter, which is what the advisory requires to be exploitable. Noted here rather than silently ignored.

## The API client's `unwrap()` takes a loose `{data?, error?, response}` shape instead of `openapi-fetch`'s exact `FetchResponse<...>` generic

Typing `unwrap<T>` against `openapi-fetch`'s precise `FetchResponse<Op, Options, Media>` generic fought TypeScript's variance rules when called with an explicit `T` at each call site (list vs. detail vs. create all return different `Op` types). Since every call site already names the expected type explicitly (`unwrap<Booking[]>(...)`, `unwrap<Vessel>(...)`), the extra precision bought nothing; a structural `{data?: T; error?: unknown; response: Response}` parameter type accepts anything `openapi-fetch` returns and keeps the actual runtime check (`error !== undefined` -> throw) in one place.

## Contacts and organizations get no dedicated pages in Phase 3

Section 9's top nav (Schedule, Find a berth, Vessels, Berths, Reports, Data review) has no Contacts or Organizations entry, and section 11's Phase 3 "done when" doesn't mention them either — they only surface as read-only data on the vessel detail page (contacts list, organization name). A full CRUD UI for them isn't built until something in a later phase actually needs to create or edit one; today's write endpoints (`POST`/`PATCH /api/organizations`, `/api/contacts`) exist from Phase 2 but have no frontend caller yet.

## "Find a berth that fits" link (booking form) and the Availability/Reports/Data review nav items are deferred to Phase 5

Section 9.2 mentions a "Find a berth that fits" link next to the berth field, and section 9's nav lists Find a berth, Reports, and Data review — all backed by section 8.5–8.7 endpoints, which section 11 assigns to Phase 5 ("Review, find-a-berth UI, reports"). Building the link or nav entries now would point at pages that don't exist. The booking form and top nav only include what Phase 3 delivers (Schedule, Vessels, Berths, login); Phase 5 adds the rest.

## Drag-to-select on an empty schedule cell uses mousedown/mouseenter/mouseup, not the HTML5 drag-and-drop API

Section 9.1 asks for "click an empty cell (or drag across cells)" to open the booking form. HTML5 drag-and-drop (`draggable`, `dragstart`/`dragover`/`drop`) is built for moving/reordering elements between drop targets, not for painting a selection across a row of same-type cells, and it requires more ceremony (a `DataTransfer` payload, `preventDefault` on `dragover` to allow a drop) for no benefit here. Plain mouse events accumulate a `[dragStart, dragEnd]` ISO-date pair per berth row; releasing the mouse (or leaving the row) opens the booking form prefilled with that range, collapsing to a single day when `dragStart === dragEnd` (an ordinary click).

## Booking bar continuation arrows and CSS-grid placement, not absolute positioning, per section 9.1's literal wording

Section 9.1 says bars are "absolutely positioned... using `grid-column: start / span n`, clipped at the range edges with an arrow indicating they continue." Taken literally this mixes two layout models, so it's read as "positioned via CSS Grid placement" rather than `position: absolute`: each berth row is one CSS Grid container (`grid-template-columns` = one column per visible day), and both the empty-cell click targets and the booking bars are grid items placed with explicit `gridColumn`/`gridRow` — including bars sharing row space with lanes (see below) and empty-cell buttons spanning `1 / -1` underneath them. This gets the exact "start / span n" placement the spec describes without fighting Grid and absolute positioning against each other.

## Overlapping bookings on the same berth (mainly `legacy_conflict` rows) stack via a greedy lane assignment, computed client-side

Section 9.1: "since these overlap other bookings, stack overlapping bars within a row in sub-lanes so both are visible." The backend doesn't return a lane/sub-row number (nothing in section 8.4's `BookingRead` shape suggests it should — lane assignment is a rendering concern, not stored state, and would go stale the moment the visible date range changed). `features/schedule/laneAssignment.ts` sorts a berth's bookings by start date and greedily assigns each to the lowest sub-lane whose last occupant's end date is before its own start date, recomputed on every render from whatever bookings are currently in view.
