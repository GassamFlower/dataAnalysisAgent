-- Database schema for data-analysis-agent
-- Target: PostgreSQL 15+
-- Note: Run this script against an empty database for initial setup.

SET client_encoding = 'UTF8';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Trigger function for auto-updating updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    openid VARCHAR(64) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verify_code_hash VARCHAR(255),
    email_verify_expires_at TIMESTAMP WITH TIME ZONE,
    nickname VARCHAR(100),
    avatar VARCHAR(500),
    plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'single', 'subscription')),
    plan_expires_at TIMESTAMP WITH TIME ZONE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    refresh_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_openid ON users(openid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'inspected', 'hypothesized', 'simulated', 'analyzed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_user_id_status ON projects(user_id, status);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    index INT NOT NULL,
    text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('likert5', 'likert7', 'demographic', 'other')),
    dimension VARCHAR(100) NOT NULL,
    is_reverse BOOLEAN NOT NULL DEFAULT false,
    confidence VARCHAR(10) NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'low')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (project_id, index)
);

CREATE INDEX idx_questions_project_id ON questions(project_id);
CREATE INDEX idx_questions_deleted_at ON questions(deleted_at);

CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. hypotheses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_hypotheses_project_id ON hypotheses(project_id);
CREATE INDEX idx_hypotheses_deleted_at ON hypotheses(deleted_at);

CREATE TRIGGER trg_hypotheses_updated_at
BEFORE UPDATE ON hypotheses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. hypothesis_paths
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hypothesis_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hypothesis_id UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
    predictor VARCHAR(100) NOT NULL,
    outcome VARCHAR(100) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('positive', 'negative')),
    strength VARCHAR(10) NOT NULL CHECK (strength IN ('weak', 'medium', 'strong')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_hypothesis_paths_hypothesis_id ON hypothesis_paths(hypothesis_id);
CREATE INDEX idx_hypothesis_paths_deleted_at ON hypothesis_paths(deleted_at);

-- ---------------------------------------------------------------------------
-- 6. correlation_matrices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correlation_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dimensions JSONB NOT NULL,
    cells JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_correlation_matrices_project_id ON correlation_matrices(project_id);
CREATE INDEX idx_correlation_matrices_deleted_at ON correlation_matrices(deleted_at);

CREATE TRIGGER trg_correlation_matrices_updated_at
BEFORE UPDATE ON correlation_matrices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. simulation_configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sample_size INT NOT NULL CHECK (sample_size > 0),
    hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE SET NULL,
    matrix_id UUID REFERENCES correlation_matrices(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_simulation_configs_project_id ON simulation_configs(project_id);
CREATE INDEX idx_simulation_configs_hypothesis_id ON simulation_configs(hypothesis_id);
CREATE INDEX idx_simulation_configs_matrix_id ON simulation_configs(matrix_id);
CREATE INDEX idx_simulation_configs_deleted_at ON simulation_configs(deleted_at);

CREATE TRIGGER trg_simulation_configs_updated_at
BEFORE UPDATE ON simulation_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. datasets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_config_id UUID REFERENCES simulation_configs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL DEFAULT 'simulation' CHECK (source IN ('simulation', 'real')),
    sample_size INT NOT NULL CHECK (sample_size > 0),
    columns JSONB NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_datasets_simulation_config_id ON datasets(simulation_config_id);
CREATE INDEX idx_datasets_project_id ON datasets(project_id);
CREATE INDEX idx_datasets_deleted_at ON datasets(deleted_at);
CREATE INDEX idx_datasets_project_id_source ON datasets(project_id, source);
-- partial unique index：仅 simulation 数据要求 simulation_config_id 唯一
CREATE UNIQUE INDEX idx_datasets_simulation_config_id_unique
    ON datasets(simulation_config_id) WHERE source = 'simulation';

CREATE TRIGGER trg_datasets_updated_at
BEFORE UPDATE ON datasets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 9. reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    overall_alpha DECIMAL(4,3),
    passed_count INT,
    total_count INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_dataset_id ON reports(dataset_id);
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 10. reliability_results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reliability_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    dimension VARCHAR(100) NOT NULL,
    alpha DECIMAL(4,3) NOT NULL,
    kmo DECIMAL(4,3) NOT NULL,
    bartlett_p_value DECIMAL(12,10) NOT NULL,
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (report_id, dimension)
);

CREATE INDEX idx_reliability_results_report_id ON reliability_results(report_id);
CREATE INDEX idx_reliability_results_deleted_at ON reliability_results(deleted_at);

CREATE TRIGGER trg_reliability_results_updated_at
BEFORE UPDATE ON reliability_results
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 11. diagnoses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_diagnoses_report_id ON diagnoses(report_id);
CREATE INDEX idx_diagnoses_deleted_at ON diagnoses(deleted_at);

CREATE TRIGGER trg_diagnoses_updated_at
BEFORE UPDATE ON diagnoses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 12. diagnosis_issues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnosis_id UUID NOT NULL REFERENCES diagnoses(id) ON DELETE CASCADE,
    dimension VARCHAR(100) NOT NULL,
    metric VARCHAR(50) NOT NULL,
    value DECIMAL(10,8) NOT NULL,
    threshold DECIMAL(10,8) NOT NULL,
    reason TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_diagnosis_issues_diagnosis_id ON diagnosis_issues(diagnosis_id);
CREATE INDEX idx_diagnosis_issues_deleted_at ON diagnosis_issues(deleted_at);

CREATE TRIGGER trg_diagnosis_issues_updated_at
BEFORE UPDATE ON diagnosis_issues
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 13. orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('single', 'subscription')),
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
    provider_transaction_id VARCHAR(128) UNIQUE,
    paid_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_project_id ON orders(project_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_provider_transaction_id ON orders(provider_transaction_id);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 14. user_agreements（合规 F-SYS-005/006）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    agreement_type VARCHAR(50) NOT NULL,
    agreement_version VARCHAR(20) NOT NULL,
    agreed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, agreement_type, agreement_version)
);

CREATE INDEX idx_user_agreements_user_id ON user_agreements(user_id);
CREATE INDEX idx_user_agreements_type ON user_agreements(agreement_type);
CREATE INDEX idx_user_agreements_agreed_at ON user_agreements(agreed_at);

-- ---------------------------------------------------------------------------
-- 15. audit_logs（合规 F-SYS-008）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_id UUID,
    action_type VARCHAR(50) NOT NULL,
    action_detail JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- ---------------------------------------------------------------------------
-- 16. user_tutorial_progress（教程 F-TUT-004）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    current_step INT NOT NULL DEFAULT 0,
    total_steps INT NOT NULL DEFAULT 5,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    step_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_tutorial_progress_user_id ON user_tutorial_progress(user_id);

-- ---------------------------------------------------------------------------
-- 17. tutorial_articles（统计知识小课堂 F-TUT-002）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tutorial_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    content_markdown TEXT NOT NULL,
    summary VARCHAR(500),
    cover_image VARCHAR(500),
    order_index INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tutorial_articles_slug ON tutorial_articles(slug);
CREATE INDEX idx_tutorial_articles_category ON tutorial_articles(category);
CREATE INDEX idx_tutorial_articles_is_published ON tutorial_articles(is_published);
CREATE INDEX idx_tutorial_articles_order_index ON tutorial_articles(order_index);

CREATE TRIGGER trg_tutorial_articles_updated_at
BEFORE UPDATE ON tutorial_articles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 18. analytics_events（前端埋点）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    project_id UUID,
    metadata_json JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
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
CREATE TABLE IF NOT EXISTS user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    period_key VARCHAR(20) NOT NULL,
    used_count INT NOT NULL DEFAULT 0,
    max_count INT NOT NULL DEFAULT 6,
    reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, action_type, period_key)
);

CREATE INDEX idx_user_quotas_user_period ON user_quotas(user_id, period_key);

-- ---------------------------------------------------------------------------
-- 20. llm_configs（LLM 模型配置动态切换）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS llm_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_llm_configs_config_key ON llm_configs(config_key);

-- ---------------------------------------------------------------------------
-- 21. messages（售后留言 Task 2.1，3NF）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    tag VARCHAR(20) NOT NULL CHECK (tag IN ('presale', 'rescue', 'service', 'incident', 'feedback')),
    data_source VARCHAR(20) CHECK (data_source IN ('real', 'simulation') OR data_source IS NULL),
    entry_point VARCHAR(40),
    contact VARCHAR(120),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
    handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMP WITH TIME ZONE,
    handle_remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_tag ON messages(tag);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_deleted_at ON messages(deleted_at);

CREATE TRIGGER trg_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 22. research_scales / scale_dimensions / scale_items（学科量表库 Task 4.1，3NF）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    discipline VARCHAR(30) NOT NULL CHECK (discipline IN ('management', 'education', 'psychology')),
    description TEXT NOT NULL DEFAULT '',
    scoring_method TEXT NOT NULL DEFAULT '',
    source TEXT,
    reliability_ref TEXT,
    validity_ref TEXT,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_research_scales_discipline ON research_scales(discipline);
CREATE INDEX idx_research_scales_deleted_at ON research_scales(deleted_at);

CREATE TRIGGER trg_research_scales_updated_at
BEFORE UPDATE ON research_scales
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS scale_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scale_id UUID NOT NULL REFERENCES research_scales(id) ON DELETE CASCADE,
    index INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (scale_id, index)
);

CREATE INDEX idx_scale_dimensions_scale_id ON scale_dimensions(scale_id);

CREATE TABLE IF NOT EXISTS scale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension_id UUID NOT NULL REFERENCES scale_dimensions(id) ON DELETE CASCADE,
    index INT NOT NULL,
    text TEXT NOT NULL,
    is_reverse BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (dimension_id, index)
);

CREATE INDEX idx_scale_items_dimension_id ON scale_items(dimension_id);
