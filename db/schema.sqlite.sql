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

COMMIT;
