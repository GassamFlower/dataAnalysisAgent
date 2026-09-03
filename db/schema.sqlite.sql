-- SQLite schema for data-analysis-agent (development environment)
-- Target: SQLite 3.35+ with WAL mode enabled
-- Note: Run this script against the dev database for initial setup.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN TRANSACTION;

-- ---------------------------------------------------------------------------
-- Drop existing tables if any (reverse dependency order)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS diagnosis_issues;
DROP TABLE IF EXISTS diagnoses;
DROP TABLE IF EXISTS reliability_results;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS datasets;
DROP TABLE IF EXISTS simulation_configs;
DROP TABLE IF EXISTS correlation_matrices;
DROP TABLE IF EXISTS hypothesis_paths;
DROP TABLE IF EXISTS hypotheses;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    openid TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
    email_verify_code TEXT,
    email_verify_expires_at DATETIME,
    nickname TEXT,
    avatar TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'single', 'subscription')),
    plan_expires_at DATETIME,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    refresh_token VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ---------------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'inspected', 'hypothesized', 'simulated', 'analyzed')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_user_id_status ON projects(user_id, status);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);

-- ---------------------------------------------------------------------------
-- 3. questions
-- ---------------------------------------------------------------------------
CREATE TABLE questions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    "index" INTEGER NOT NULL,
    text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('likert5', 'likert7', 'demographic', 'other')),
    dimension TEXT NOT NULL,
    is_reverse INTEGER NOT NULL DEFAULT 0 CHECK (is_reverse IN (0, 1)),
    confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'low')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE (project_id, "index")
);

CREATE INDEX idx_questions_project_id ON questions(project_id);
CREATE INDEX idx_questions_deleted_at ON questions(deleted_at);

-- ---------------------------------------------------------------------------
-- 4. hypotheses
-- ---------------------------------------------------------------------------
CREATE TABLE hypotheses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_hypotheses_project_id ON hypotheses(project_id);
CREATE INDEX idx_hypotheses_deleted_at ON hypotheses(deleted_at);

-- ---------------------------------------------------------------------------
-- 5. hypothesis_paths
-- ---------------------------------------------------------------------------
CREATE TABLE hypothesis_paths (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
    predictor TEXT NOT NULL,
    outcome TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
    strength TEXT NOT NULL CHECK (strength IN ('weak', 'medium', 'strong')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_hypothesis_paths_hypothesis_id ON hypothesis_paths(hypothesis_id);
CREATE INDEX idx_hypothesis_paths_deleted_at ON hypothesis_paths(deleted_at);

-- ---------------------------------------------------------------------------
-- 6. correlation_matrices
-- ---------------------------------------------------------------------------
CREATE TABLE correlation_matrices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dimensions JSON NOT NULL,
    cells JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_correlation_matrices_project_id ON correlation_matrices(project_id);
CREATE INDEX idx_correlation_matrices_deleted_at ON correlation_matrices(deleted_at);

-- ---------------------------------------------------------------------------
-- 7. simulation_configs
-- ---------------------------------------------------------------------------
CREATE TABLE simulation_configs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    hypothesis_id TEXT REFERENCES hypotheses(id) ON DELETE SET NULL,
    matrix_id TEXT REFERENCES correlation_matrices(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_simulation_configs_project_id ON simulation_configs(project_id);
CREATE INDEX idx_simulation_configs_hypothesis_id ON simulation_configs(hypothesis_id);
CREATE INDEX idx_simulation_configs_matrix_id ON simulation_configs(matrix_id);
CREATE INDEX idx_simulation_configs_deleted_at ON simulation_configs(deleted_at);

-- ---------------------------------------------------------------------------
-- 8. datasets
-- ---------------------------------------------------------------------------
CREATE TABLE datasets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    simulation_config_id TEXT NOT NULL UNIQUE REFERENCES simulation_configs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    columns JSON NOT NULL,
    data JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_datasets_project_id ON datasets(project_id);
CREATE INDEX idx_datasets_deleted_at ON datasets(deleted_at);

-- ---------------------------------------------------------------------------
-- 9. reports
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dataset_id TEXT REFERENCES datasets(id) ON DELETE SET NULL,
    overall_alpha NUMERIC(4, 3),
    passed_count INTEGER,
    total_count INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_dataset_id ON reports(dataset_id);
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);

-- ---------------------------------------------------------------------------
-- 10. reliability_results
-- ---------------------------------------------------------------------------
CREATE TABLE reliability_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    alpha NUMERIC(4, 3) NOT NULL,
    kmo NUMERIC(4, 3) NOT NULL,
    bartlett_p_value NUMERIC(12, 10) NOT NULL,
    passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    UNIQUE (report_id, dimension)
);

CREATE INDEX idx_reliability_results_report_id ON reliability_results(report_id);
CREATE INDEX idx_reliability_results_deleted_at ON reliability_results(deleted_at);

-- ---------------------------------------------------------------------------
-- 11. diagnoses
-- ---------------------------------------------------------------------------
CREATE TABLE diagnoses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_diagnoses_report_id ON diagnoses(report_id);
CREATE INDEX idx_diagnoses_deleted_at ON diagnoses(deleted_at);

-- ---------------------------------------------------------------------------
-- 12. diagnosis_issues
-- ---------------------------------------------------------------------------
CREATE TABLE diagnosis_issues (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    diagnosis_id TEXT NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    metric TEXT NOT NULL,
    value NUMERIC(10, 8) NOT NULL,
    threshold NUMERIC(10, 8) NOT NULL,
    reason TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_diagnosis_issues_diagnosis_id ON diagnosis_issues(diagnosis_id);
CREATE INDEX idx_diagnosis_issues_deleted_at ON diagnosis_issues(deleted_at);

-- ---------------------------------------------------------------------------
-- 13. orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('single', 'subscription')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
    provider_transaction_id TEXT UNIQUE,
    paid_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_project_id ON orders(project_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);

-- ---------------------------------------------------------------------------
-- 14. user_agreements（合规 F-SYS-005/006）
-- ---------------------------------------------------------------------------
CREATE TABLE user_agreements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    agreement_type TEXT NOT NULL,
    agreement_version TEXT NOT NULL,
    agreed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, agreement_type, agreement_version)
);

CREATE INDEX idx_user_agreements_user_id ON user_agreements(user_id);
CREATE INDEX idx_user_agreements_type ON user_agreements(agreement_type);
CREATE INDEX idx_user_agreements_agreed_at ON user_agreements(agreed_at);

-- ---------------------------------------------------------------------------
-- 15. audit_logs（合规 F-SYS-008）
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    project_id TEXT,
    action_type TEXT NOT NULL,
    action_detail JSON,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- ---------------------------------------------------------------------------
-- 16. user_tutorial_progress（教程 F-TUT-004）
-- ---------------------------------------------------------------------------
CREATE TABLE user_tutorial_progress (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE,
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 5,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at DATETIME,
    step_details JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_tutorial_progress_user_id ON user_tutorial_progress(user_id);

-- ---------------------------------------------------------------------------
-- 17. tutorial_articles（统计知识小课堂 F-TUT-002）
-- ---------------------------------------------------------------------------
CREATE TABLE tutorial_articles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    summary TEXT,
    cover_image TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_tutorial_articles_slug ON tutorial_articles(slug);
CREATE INDEX idx_tutorial_articles_category ON tutorial_articles(category);
CREATE INDEX idx_tutorial_articles_is_published ON tutorial_articles(is_published);
CREATE INDEX idx_tutorial_articles_order_index ON tutorial_articles(order_index);

-- ---------------------------------------------------------------------------
-- 18. analytics_events（前端埋点）
-- ---------------------------------------------------------------------------
CREATE TABLE analytics_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type TEXT NOT NULL,
    user_id TEXT,
    project_id TEXT,
    metadata_json JSON,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_analytics_event_type ON analytics_events(event_type);
CREATE INDEX ix_analytics_user_id ON analytics_events(user_id);
CREATE INDEX ix_analytics_project_id ON analytics_events(project_id);
CREATE INDEX ix_analytics_created_at ON analytics_events(created_at);
CREATE INDEX ix_analytics_event_type_created ON analytics_events(event_type, created_at);
CREATE INDEX ix_analytics_user_created ON analytics_events(user_id, created_at);

-- ---------------------------------------------------------------------------
-- 19. user_quotas（周用量限制 F-SYS-001）
-- ---------------------------------------------------------------------------
CREATE TABLE user_quotas (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    period_key TEXT NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    max_count INTEGER NOT NULL DEFAULT 6,
    reset_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, action_type, period_key)
);

CREATE INDEX idx_user_quotas_user_period ON user_quotas(user_id, period_key);

-- ---------------------------------------------------------------------------
-- 20. llm_configs（LLM 模型配置动态切换）
-- ---------------------------------------------------------------------------
CREATE TABLE llm_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_llm_configs_config_key ON llm_configs(config_key);

-- ---------------------------------------------------------------------------
-- 21. messages（售后留言 Task 2.1，3NF）
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    tag TEXT NOT NULL CHECK (tag IN ('presale', 'rescue', 'service', 'incident', 'feedback')),
    data_source TEXT CHECK (data_source IN ('real', 'simulation') OR data_source IS NULL),
    entry_point TEXT,
    contact TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
    handled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    handled_at DATETIME,
    handle_remark TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_tag ON messages(tag);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at);

-- ---------------------------------------------------------------------------
-- 22. research_scales / scale_dimensions / scale_items（学科量表库 Task 4.1，3NF）
-- ---------------------------------------------------------------------------
CREATE TABLE research_scales (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    discipline TEXT NOT NULL CHECK (discipline IN ('management', 'education', 'psychology')),
    description TEXT NOT NULL DEFAULT '',
    scoring_method TEXT NOT NULL DEFAULT '',
    source TEXT,
    reliability_ref TEXT,
    validity_ref TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_research_scales_discipline ON research_scales(discipline);
CREATE INDEX idx_research_scales_deleted_at ON research_scales(deleted_at);

CREATE TABLE scale_dimensions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    scale_id TEXT NOT NULL REFERENCES research_scales(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (scale_id, index)
);

CREATE INDEX idx_scale_dimensions_scale_id ON scale_dimensions(scale_id);

CREATE TABLE scale_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dimension_id TEXT NOT NULL REFERENCES scale_dimensions(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    text TEXT NOT NULL,
    is_reverse INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (dimension_id, index)
);

CREATE INDEX idx_scale_items_dimension_id ON scale_items(dimension_id);

-- ---------------------------------------------------------------------------
-- 23. app_configs（后台运行时可调配置，F-ADM-003 增强；key-value，参照 llm_configs）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_configs_config_key ON app_configs(config_key);

COMMIT;
