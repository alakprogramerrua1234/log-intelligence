"""initial schema: dimensions + technique hierarchy + detection fact table

Revision ID: 001
Revises:
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Dimension tables ──────────────────────────────────────────────────────
    op.create_table(
        "platform",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("name", name="uq_platform_name"),
    )

    op.create_table(
        "log_source",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("name", name="uq_log_source_name"),
    )

    op.create_table(
        "channel",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("name", name="uq_channel_name"),
    )

    op.create_table(
        "tactic",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("name", name="uq_tactic_name"),
    )

    # ── MITRE technique hierarchy ─────────────────────────────────────────────
    op.create_table(
        "technique",
        sa.Column("id", sa.Text(), primary_key=True),  # ATT&CK ID e.g. "T1059"
        sa.Column("name", sa.Text(), nullable=False),
    )

    op.create_table(
        "subtechnique",
        sa.Column("id", sa.Text(), primary_key=True),  # ATT&CK ID e.g. "T1059.001"
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("technique_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["technique_id"], ["technique.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_subtechnique_technique_id", "subtechnique", ["technique_id"])

    # ── Fact table ────────────────────────────────────────────────────────────
    op.create_table(
        "detection",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("platform_id", sa.BigInteger(), nullable=False),
        sa.Column("log_source_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("tactic_id", sa.BigInteger(), nullable=False),
        sa.Column("technique_id", sa.Text(), nullable=False),
        sa.Column("subtechnique_id", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["platform_id"], ["platform.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["log_source_id"], ["log_source.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["channel_id"], ["channel.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tactic_id"], ["tactic.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technique_id"], ["technique.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["subtechnique_id"], ["subtechnique.id"], ondelete="RESTRICT"),
    )

    # UNIQUE NULLS NOT DISTINCT — dedup across re-ingests.
    # Cannot be expressed via op.create_table kwargs, so raw SQL.
    op.execute("""
        ALTER TABLE detection ADD CONSTRAINT uq_detection_combination
        UNIQUE NULLS NOT DISTINCT
        (platform_id, log_source_id, channel_id, tactic_id, technique_id, subtechnique_id)
    """)

    # FK indexes on detection
    for col in ("platform_id", "log_source_id", "channel_id", "tactic_id", "technique_id", "subtechnique_id"):
        op.create_index(f"ix_detection_{col}", "detection", [col])

    # ── Filter category catalogue ─────────────────────────────────────────────
    op.create_table(
        "filter_category",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("source_table", sa.Text(), nullable=False),
        sa.Column("value_column", sa.Text(), nullable=False),
        sa.Column("detection_fk", sa.Text(), nullable=False),
        sa.Column("value_type", sa.Text(), nullable=False),
        sa.Column("ui_hint", sa.Text(), nullable=False),
        sa.Column("order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_table("filter_category")
    op.drop_table("detection")
    op.drop_table("subtechnique")
    op.drop_table("technique")
    op.drop_table("tactic")
    op.drop_table("channel")
    op.drop_table("log_source")
    op.drop_table("platform")
