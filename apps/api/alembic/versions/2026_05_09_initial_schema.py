"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- platform ---
    op.create_table(
        "platform",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    # --- log_source ---
    op.create_table(
        "log_source",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "collection_method",
            postgresql.ARRAY(sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["platform_id"], ["platform.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- technique ---
    op.create_table(
        "technique",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("tactic", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("dataset_version", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- log ---
    op.create_table(
        "log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("log_source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.Text(), nullable=True),
        sa.Column("event_id", sa.Text(), nullable=True),
        sa.Column("provider", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sample_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("relevance", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["log_source_id"], ["log_source.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "log_source_id", "channel", "event_id", name="uq_log_source_channel_event"
        ),
    )
    op.create_index("ix_log_log_source_id", "log", ["log_source_id"])
    op.create_index(
        "ix_log_sample_fields_gin",
        "log",
        ["sample_fields"],
        postgresql_using="gin",
    )
    # Full-text search index on description
    op.execute(
        "CREATE INDEX ix_log_description_fts ON log "
        "USING gin(to_tsvector('english', coalesce(description, '')))"
    )

    # --- log_technique_mapping ---
    op.create_table(
        "log_technique_mapping",
        sa.Column("log_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technique_id", sa.Text(), nullable=False),
        sa.Column("confidence", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("dataset_version", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["log_id"], ["log.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["technique_id"], ["technique.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("log_id", "technique_id"),
    )
    op.create_index(
        "ix_log_technique_mapping_technique_id",
        "log_technique_mapping",
        ["technique_id"],
    )

    # --- filter_category ---
    op.create_table(
        "filter_category",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column("value_type", sa.Text(), nullable=False),
        sa.Column("ui_hint", sa.Text(), nullable=False),
        sa.Column("order", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("filter_category")
    op.drop_index("ix_log_technique_mapping_technique_id", table_name="log_technique_mapping")
    op.drop_table("log_technique_mapping")
    op.execute("DROP INDEX IF EXISTS ix_log_description_fts")
    op.drop_index("ix_log_sample_fields_gin", table_name="log")
    op.drop_index("ix_log_log_source_id", table_name="log")
    op.drop_table("log")
    op.drop_table("technique")
    op.drop_table("log_source")
    op.drop_table("platform")
