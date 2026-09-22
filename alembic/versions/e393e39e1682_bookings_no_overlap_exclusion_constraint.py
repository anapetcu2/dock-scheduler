"""bookings no-overlap exclusion constraint

Revision ID: e393e39e1682
Revises: 97cf36952dca
Create Date: 2026-09-21 22:24:42.970549

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e393e39e1682"
down_revision: str | None = "97cf36952dca"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        """
        ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
          EXCLUDE USING gist (
            berth_id WITH =,
            daterange(start_date, end_date, '[]') WITH &&
          )
          WHERE (status IN ('tentative', 'confirmed'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap")
