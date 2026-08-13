"""rename channel dimension to event_id

Revision ID: 002
Revises: 001
Create Date: 2026-05-23

"""

from collections.abc import Sequence

from alembic import op

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Rename the dimension table
    op.rename_table("channel", "event_id")

    # 2. Rename the unique constraint on the table
    op.execute("ALTER INDEX uq_channel_name RENAME TO uq_event_id_name")

    # 3. Rename the FK column in detection
    op.alter_column("detection", "channel_id", new_column_name="event_id_id")

    # 4. Rename the FK index on detection
    op.execute("ALTER INDEX ix_detection_channel_id RENAME TO ix_detection_event_id_id")

    # 5. Update filter_category rows seeded during ingest
    op.execute("""
        UPDATE filter_category
        SET key          = 'event_id',
            label        = 'Event ID',
            source_table = 'event_id',
            detection_fk = 'event_id_id'
        WHERE key = 'channel'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE filter_category
        SET key          = 'channel',
            label        = 'Channel',
            source_table = 'channel',
            detection_fk = 'channel_id'
        WHERE key = 'event_id'
    """)
    op.execute("ALTER INDEX ix_detection_event_id_id RENAME TO ix_detection_channel_id")
    op.alter_column("detection", "event_id_id", new_column_name="channel_id")
    op.execute("ALTER INDEX uq_event_id_name RENAME TO uq_channel_name")
    op.rename_table("event_id", "channel")
