"""bookings vessel no-overlap exclusion constraint

A vessel can't be in two places at once: this adds the same kind of
exclusion-constraint guarantee bookings_no_overlap gives per-berth, but
per-vessel instead, so the same vessel can never hold two active
(tentative/confirmed) bookings on different berths with overlapping dates.

Before adding the constraint, existing data that already violates it is
resolved the same way importer/load.py resolves per-berth conflicts:
processing each vessel's active bookings in start-date order and
demoting every booking that overlaps one already kept to legacy_conflict
(which the constraint's WHERE clause excludes, same as it already does
for berth-level conflicts).

Revision ID: a1b2c3d4e5f6
Revises: e393e39e1682
Create Date: 2026-09-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e393e39e1682"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _demote_existing_vessel_conflicts() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, vessel_id, start_date, end_date
            FROM bookings
            WHERE vessel_id IS NOT NULL AND status IN ('tentative', 'confirmed')
            ORDER BY vessel_id, start_date, id
            """
        )
    ).fetchall()

    by_vessel: dict[int, list] = {}
    for row in rows:
        by_vessel.setdefault(row.vessel_id, []).append(row)

    demote_ids: list[int] = []
    for bookings in by_vessel.values():
        active: list = []
        for row in bookings:
            conflict = any(
                row.start_date <= kept.end_date and kept.start_date <= row.end_date for kept in active
            )
            if conflict:
                demote_ids.append(row.id)
            else:
                active.append(row)

    if demote_ids:
        bind.execute(
            sa.text("UPDATE bookings SET status = 'legacy_conflict' WHERE id = ANY(:ids)"),
            {"ids": demote_ids},
        )


def upgrade() -> None:
    _demote_existing_vessel_conflicts()
    op.execute(
        """
        ALTER TABLE bookings ADD CONSTRAINT bookings_vessel_no_overlap
          EXCLUDE USING gist (
            vessel_id WITH =,
            daterange(start_date, end_date, '[]') WITH &&
          )
          WHERE (status IN ('tentative', 'confirmed') AND vessel_id IS NOT NULL)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP CONSTRAINT bookings_vessel_no_overlap")
    # Deliberately not reverting demoted legacy_conflict rows to their prior
    # status: which ones were touched isn't tracked, and re-confirming them
    # would silently recreate the exact conflicts this migration resolved.
