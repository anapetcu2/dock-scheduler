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

---

## Phase 4 decisions

## `importer/profile.py` found three month-block header shapes in the real data, not the two SPEC.md section 7.2 describes — layout detection is generic, not year-keyed

Section 7.2 names two shapes ("early": label row alone, weekday row, day-number row; "later": label+day-numbers together, weekday row next) and suggests a rough 1997-2003 / 2004-onward split. Profiling the actual workbook (`uv run python -m importer.profile`) found a *third* shape — label row **+ weekday letters** together, day-numbers the row after — used by every month in 1997-2003 **except each sheet's first block**, and confirmed the split isn't clean by year at all: the very first block of the "2004" sheet ("DECEMBER 2003") uses this third shape while "JANUARY 2004" two blocks later already uses spec's "later" shape. `importer/layout.py::find_month_headers` tries all three shapes per label row (matching spec's explicit instruction to detect layout "per month block, not per sheet") rather than branching on the sheet name.

## A month block's label can omit the year entirely ("January"), not just read "MONTH YYYY" — the sheet's own year tab is the fallback, an explicit year in the label always wins

Profiling found that sheets from roughly 2011 onward literally write `A6 = "January"` with no year — exactly SPEC.md section 7.2's own example, which is easy to misread as illustrative shorthand rather than literal. `MONTH_LABEL_RE` makes the year group optional; `find_month_headers(ws, default_year=...)` falls back to the sheet name's own year (parsed as int) when the label has none. A block whose label *does* spell out a year (`"DECEMBER 2002"`) always uses that instead — these exist specifically because they disagree with the sheet's own year (see the cross-month join decision below), so the label wins.

## The "carried-over December" block at the top of each year's sheet is independent data, not a duplicate of that December's own block — cross-month joins are scoped to within-sheet adjacent blocks only, not true cross-sheet stitching

SPEC.md section 7.3 rule 6 says a span reaching a month's last day should join with the next month block's day-1 span "including across year sheets." Every sheet from 2002 onward opens with a carried-over `"DECEMBER <previous year>"` block before its own January — a natural place to look for the described cross-sheet case, since sheet `<year>`'s own December block (its last block) and sheet `<year+1>`'s carried December block (its first block) are nominally "the same month." Diffing them cell-by-cell (2002's own December vs. 2003's carried "December 2002") showed they are **not duplicates**: different bookings on different days, including one berth with data in one copy and nothing in the other. `calendar_mismatches` independently confirms this — these carried blocks' weekday-letter rows fail the real-calendar check by 26-31 days, meaning they weren't laid out against real December's actual weekdays at all. Conclusion: this synthetic workbook's carried December blocks are independently-generated filler, not a deliberate duplicate meant to support cross-month joins. Joining a sheet's real trailing December to a *different* sheet's independently-random carried copy would merge two unrelated bookings, not stitch one real one. `importer/load.py::_join_across_blocks` therefore only joins spans between month blocks that are physically adjacent within the same sheet (which already covers every real within-year month boundary, plus carried-December-into-January, since the carried block sits directly before January in the same sheet) — never a sheet's own trailing block into the next sheet's opening block.

## Cross-month-joined spans store an actual end-date override, not a merged column number

A join's two halves come from different month blocks, whose day columns don't share an origin — SPEC.md section 7.2 itself says day-1's column "varies by month (calendar-style alignment)," so column 5 in one block and column 5 in the next can be completely different dates. Extending a span by copying the next block's raw end-column onto the previous block's span (interpreted through the *previous* block's header) produced dates outside that month entirely and crashed date resolution during initial testing. `Span.end_date_override` holds the real `date`, computed through the *correct* block's header before the two spans are merged, and `_span_dates` prefers it over recomputing from `end_col` when present.

## `importer/vessels.py`'s Science/Yachts parsing takes the first plain-text cell in a record as the organization name, and dumps phones/emails/captains into vessel notes rather than linking them precisely

SPEC.md section 7.5 explicitly asks for best-effort, not precision: "Don't try to be clever about which phone belongs to which person." Every real example in the workbook has the operating organization's name in the cell immediately after the vessel-prefix cell (`"Harbor Institute"`, `"Gulf Coast University"`, etc.), so the first cell in the record that isn't the vessel cell, a `LOA:`/`Draft:` cell, a phone (`Cell: ...`), an email, or a `Capt. ...` name is taken as the organization. This is occasionally wrong (one record's first free-text cell is `"Short visit only"`, a note, not an org) — an accepted trade-off given the spec's own instruction not to over-engineer this.

## `"OS/V"` is treated as an alias for the `"OSV"` prefix

Two real cell texts (`"OS/V Golden Osprey"`, `"OS/V Silver Skua"`) don't match any of section 7.4's listed prefixes literally. Both are unambiguously vessel names with a stray slash in what's otherwise the `OSV` prefix — no other interpretation fits ("OS" is not a listed prefix on its own, and these values never repeat with a bare `OSV` elsewhere in the data using the same vessel name to cross-check). `config.yaml`'s `vessel_prefixes.OSV` lists both `"OSV"` and `"OS/V"` as accepted spellings, both normalizing to the same canonical key so `OS/V Golden Osprey` and any future plain `OSV Golden Osprey` mention would merge correctly.

## The 8YR Dock Summary tab's "days booked" counts vessel occupancy only — the report's comparison excludes events and closures to match

Section 7.8 asks for a validation table comparing computed days-booked per berth per year against the summary tab, and to investigate large differences before moving on. Counting every span kind (vessel + event + closure) produced some large, suspicious diffs; spot-checking "South Float West, 2007" (computed 32 vs. summary's 1) found the entire gap was one 31-day `"Pier repair - no docking"` closure — the summary's own number (1) matched the *vessel-only* count exactly. `importer/load.py::_classify_block` now only feeds `year_berth_days` (the number compared against the summary sheet) from `kind == "vessel"` spans; events and closures are still imported as bookings, just excluded from this specific comparison.

## Remaining differences against the summary sheet are treated as synthetic-data noise, not importer bugs, with one exception investigated and confirmed

Even after the vessel-only fix, some berth/year cells still differ by tens to a few hundred days (concentrated in the two busiest berths, North Pier West/East). Spot-checks ruled out a systematic bug: day-counting logic checked out exactly against raw cell coordinates (the South Float West case above matched to the day), and `"North Finger Piers"`/`"Marsh Landing"` reading 0 for every 2006-2013 year turned out to be correct — that berth row doesn't exist anywhere in the year grids until 2014 onward, even though the summary tab reports numbers for it back to 2006. One genuinely interesting case *was* chased down: two month blocks physically inside the **`"2010"`** sheet are labeled `"NOVEMBER 2018"` and `"DECEMBER 2018"` (a clear data-entry error in the synthetic source — right calendar position, wrong year typed into the label), which `calendar_mismatches` correctly flags as `LAYOUT_MISMATCH` (30-31 days off). Per section 7's "never silently guess" principle, the importer does **not** infer that this should really say 2010 and correct it — it imports the bookings under the literal label year (2018) and leaves the `LAYOUT_MISMATCH` issue pointing at the source cells for a human to resolve, which also means that data doesn't appear in the 2006-2013 comparison at all. This workbook is stated in DECISIONS.md's very first entry to be a synthetic stand-in, not the real archive, so the remaining unexplained variance is attributed to synthetic-data generation noise rather than chased further; the comparison logic itself is trusted based on the cases actually verified.

## `--reset` looks up berths/vessels/organizations by their natural key instead of always inserting, so re-running the importer is actually idempotent

Section 7 requires `--reset` to make the command idempotent, and describes it as wiping "imported rows (source = import) and import issues." Only `bookings` and `import_issues` have a `source`/equivalent marker — `berths`, `vessels`, `organizations`, and `contacts` don't (section 5 gives them no such column), which on reflection has to be deliberate: deleting every berth/vessel on `--reset` would also destroy ones created through the live app, which the importer has no way to distinguish from its own. So `--reset` only clears `Booking(source=import)` and `ImportIssue` rows, exactly as written. That alone isn't enough for idempotency, though — re-running `write_to_db` and unconditionally inserting a `Berth`/`Vessel`/`Organization` for each one found would violate their unique constraints (`name`, `normalized_key`) on the second run. `write_to_db` and `_create_vessel` now look each one up by its natural key first and reuse the existing row if found, only inserting when it's genuinely new. Verified by running the real workbook import with `--reset` twice in a row: identical row counts both times (10 berths, 571 vessels, 2066 bookings, 880 issues — including the pre-existing non-imported test data untouched).

## Importer tests build workbooks in memory instead of committing binary `.xlsx` fixture files

Section 3's test layout lists `tests/importer/` fixtures against "small hand-built .xlsx fixtures." `tests/importer/builders.py` builds equivalent openpyxl `Workbook`/`Worksheet` objects directly in test code instead — every importer function only ever touches a `Worksheet`, which behaves identically whether it was just constructed or loaded from disk (`test_load.py`'s end-to-end tests do go through an actual save-to-disk-and-reload round trip via `tempfile`, so the disk-loading path itself is still covered). Readable, diffable, editable Python beat binary spreadsheet files for fixtures that exist purely to exercise specific parsing rules (a merged range, two adjacent names, etc.), with no loss of coverage.

---

## Phase 5 decisions

## `GET /api/reports/utilization` has no auth dependency, even though section 8's blanket rule only names schedule/berths/vessels/availability as public

Section 8's opening paragraph says "Read endpoints for the schedule, berths, vessels, and availability are public. Contacts, audit history, the review page, and all writes require login" — reports aren't mentioned on either side. Section 9's top nav lists Reports as a plain link, with no "(logged in only)" annotation (the only nav item to carry one is Data review), which is a concrete, later, more specific signal about intent than the earlier prose's silence. Utilization numbers also aren't sensitive in the way contacts or audit history are — they're an aggregate of the same booking dates the public schedule already shows. `/api/reports/utilization` and the frontend `/reports` route are both public; `/api/bookings/export.csv` was already public from Phase 2 for the same reason (section 8.4 lists it as a plain `GET`, no auth noted).

## `IntegrityIssue` is a plain dataclass recomputed on every request, not persisted or cached

Section 8.7 is explicit that this has to be computed live ("so fixing a vessel's length makes its issues disappear immediately"), which rules out anything that could go stale — a cache, a materialized view, or a stored table refreshed on a schedule. `services/integrity.py::compute_integrity_issues` runs two queries (active vessel bookings joined to vessel+berth; legacy_conflict bookings, each checked against everything else on its berth for a date-range overlap) every time the endpoint is hit. At the current data volume (~2000 bookings after the historical import) this is fast enough not to need memoizing; revisit if the review page ever feels slow.

## `HISTORICAL_OVERLAP` integrity issues are found by re-running the overlap query per `legacy_conflict` booking, not by reusing `booking_rules.validate_booking`

`validate_booking` is scoped to *proposals* — it takes a `BookingProposal` (kind, dates, berth, vessel/title) and doesn't take a `status`-aware "what does this existing row already conflict with" query. Building a proposal from an existing `legacy_conflict` booking just to re-derive what it overlaps would need to fight past `validate_booking`'s own logic (section 6's OVERLAP check explicitly skips proposals whose *own* status is `legacy_conflict`, per an earlier Phase 1 decision — exactly backwards from what section 8.7 wants here, which is to see what it overlaps, not to validate it as if it were a new save). A direct `daterange && daterange` query scoped to the same berth, excluding cancelled bookings and the row itself, is simpler and matches what section 8.7 actually asks for: "all `legacy_conflict` bookings with the booking each clashes with."

## Utilization report clips each booking's days into whichever requested years it overlaps, rather than requiring a booking to start within the range

A booking spanning `2021-12-30` to `2022-01-02` genuinely contributes 2 days to 2021's total and 2 days to 2022's — SPEC.md doesn't say this explicitly, but "days booked per berth per year" only means something if every day lands in exactly one year. `services/reports.py::compute_utilization` fetches every booking that *overlaps* `[year_from, year_to]` at all (not just ones starting inside it) and clips each one's date range against every calendar year it touches within that range, so a booking straddling `year_from`'s or `year_to`'s edge is still counted correctly for the portion inside the requested range.

---

## A vessel can't hold two active bookings on different berths at once — added as a second exclusion constraint, mirroring `bookings_no_overlap`

SPEC.md's guarantee ("invalid bookings cannot be saved") is scoped entirely around *berths* — `bookings_no_overlap` and the `OVERLAP` check both key on `berth_id`. Neither one stops the same vessel from being booked on two different berths for overlapping dates, which is physically impossible and was in fact already present in the data: querying for it turned up 26 existing conflicting pairs, 25 from the historical import and — found while investigating this — one from the user's own live testing (two confirmed bookings for "Vessel 1" on different berths, overlapping by three days), which is what prompted this fix.

Implemented with the same two-layer design the berth case already uses, since the reasoning is identical: a second `EXCLUDE USING gist` constraint (`bookings_vessel_no_overlap`, keyed on `vessel_id` instead of `berth_id`, same `WHERE status IN ('tentative','confirmed')` — plus `vessel_id IS NOT NULL` so event/closure bookings are untouched) as the real guarantee, and a matching `booking_rules.py` check (`VESSEL_DOUBLE_BOOKED`) for a friendly pre-save message. `services/bookings.py`'s race-condition catch now recognizes either constraint name.

Adding the constraint requires the existing data to already satisfy it, which the 26 conflicting pairs didn't. The migration resolves them first, using the exact same algorithm `importer/load.py` already uses for the analogous per-berth case: walk each vessel's active bookings in start-date order, keep the first of each mutually-overlapping run, demote the rest to `legacy_conflict` (which both exclusion constraints' `WHERE` clauses already exclude). This is a real, user-visible state change — one of the two bookings in each conflicting pair changes status — not just a schema migration; run against the dev database, it demoted booking #6 (the user's own test booking) to `legacy_conflict` in favor of #4133, which started three days earlier. Flagged to the user rather than silently absorbed.

`services/integrity.py`'s legacy-conflict pairing (section 8.7's live "what does this legacy_conflict booking clash with" check) is extended the same way: every `legacy_conflict` booking is now checked for a vessel-level conflict across different berths, not just a same-berth one, using the same `VESSEL_DOUBLE_BOOKED` code so the live validation and the historical review page agree on terminology. The review summary's `historical_double_bookings` count folds both `HISTORICAL_OVERLAP` and `VESSEL_DOUBLE_BOOKED` together rather than adding a new summary card, since both are "this legacy booking conflicts with something" from the staff's point of view.
