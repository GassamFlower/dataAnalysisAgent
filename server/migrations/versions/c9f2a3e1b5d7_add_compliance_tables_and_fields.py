"""add_compliance_tables_and_fields

Revision ID: c9f2a3e1b5d7
Revises: b8318b614246
Create Date: 2026-07-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f2a3e1b5d7'
down_revision: Union[str, None] = 'ad7d1c827b734b608e4c6d84c3b06dab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 创建 user_agreements 表（合规 F-SYS-005/006）
    op.create_table(
        'user_agreements',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('agreement_type', sa.String(50), nullable=False),
        sa.Column('agreement_version', sa.String(20), nullable=False),
        sa.Column('agreed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'agreement_type', 'agreement_version', name='uq_user_agreement_version'),
    )
    op.create_index('idx_user_agreements_user_id', 'user_agreements', ['user_id'])
    op.create_index('idx_user_agreements_type', 'user_agreements', ['agreement_type'])
    op.create_index('idx_user_agreements_agreed_at', 'user_agreements', ['agreed_at'])

    # 创建 audit_logs 表（合规 F-SYS-008）
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('project_id', sa.Uuid(), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('action_detail', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_logs_project_id', 'audit_logs', ['project_id'])
    op.create_index('idx_audit_logs_action_type', 'audit_logs', ['action_type'])
    op.create_index('idx_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('idx_audit_logs_user_created', 'audit_logs', ['user_id', 'created_at'])

    # 给 users 表添加合规字段（F-SYS-005）
    op.add_column('users', sa.Column('agreed_terms_version', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('agreed_terms_at', sa.DateTime(timezone=True), nullable=True))

    # 给 projects 表添加 mode 字段（F-SYS-007）
    op.add_column('projects', sa.Column('mode', sa.String(20), nullable=False, server_default='real'))
    op.create_index('idx_projects_mode', 'projects', ['mode'])


def downgrade() -> None:
    # 删除 projects 表的 mode 字段
    op.drop_index('idx_projects_mode', table_name='projects')
    op.drop_column('projects', 'mode')

    # 删除 users 表的合规字段
    op.drop_column('users', 'agreed_terms_at')
    op.drop_column('users', 'agreed_terms_version')

    # 删除 audit_logs 表
    op.drop_index('idx_audit_logs_user_created', table_name='audit_logs')
    op.drop_index('idx_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('idx_audit_logs_action_type', table_name='audit_logs')
    op.drop_index('idx_audit_logs_project_id', table_name='audit_logs')
    op.drop_index('idx_audit_logs_user_id', table_name='audit_logs')
    op.drop_table('audit_logs')

    # 删除 user_agreements 表
    op.drop_index('idx_user_agreements_agreed_at', table_name='user_agreements')
    op.drop_index('idx_user_agreements_type', table_name='user_agreements')
    op.drop_index('idx_user_agreements_user_id', table_name='user_agreements')
    op.drop_table('user_agreements')
