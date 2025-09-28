-- ChittyOS Unified Database Schema for Neon
-- Comprehensive legal tech infrastructure database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============= CORE TABLES =============

-- Legal Cases
CREATE TABLE IF NOT EXISTS cases (
    case_id VARCHAR(100) PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    case_type VARCHAR(50) NOT NULL,
    jurisdiction VARCHAR(100) DEFAULT 'US',
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    infrastructure JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    assigned_team VARCHAR(100),
    blockchain_anchored BOOLEAN DEFAULT FALSE,
    blockchain_tx_hash VARCHAR(100)
);

-- Cloudflare Deployments
CREATE TABLE IF NOT EXISTS deployments (
    deployment_id VARCHAR(100) PRIMARY KEY,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- worker, r2, d1, kv
    resource_name VARCHAR(255) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production',
    status VARCHAR(50) DEFAULT 'deployed',
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deployed_by VARCHAR(100),
    config JSONB DEFAULT '{}',
    cloudflare_id VARCHAR(255),
    url TEXT,
    metadata JSONB DEFAULT '{}',
    compliance_checked BOOLEAN DEFAULT FALSE,
    compliance_results JSONB DEFAULT '{}'
);

-- Financial Transactions
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(100) PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    from_account VARCHAR(255) NOT NULL,
    to_account VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) DEFAULT 'transfer',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    blockchain_tx_hash VARCHAR(100),
    blockchain_confirmed BOOLEAN DEFAULT FALSE,
    fee DECIMAL(15, 2) DEFAULT 0
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    document_id VARCHAR(100) PRIMARY KEY,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    document_name VARCHAR(500) NOT NULL,
    document_type VARCHAR(100),
    file_path TEXT,
    storage_bucket VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(100),
    analysis_status VARCHAR(50) DEFAULT 'pending',
    analysis_results JSONB DEFAULT '{}',
    risk_score DECIMAL(5, 2),
    compliance_status VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    blockchain_hash VARCHAR(100),
    tags TEXT[] DEFAULT '{}'
);

-- Property Listings
CREATE TABLE IF NOT EXISTS properties (
    listing_id VARCHAR(100) PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE SET NULL,
    address TEXT NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    listed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB DEFAULT '{}',
    location JSONB DEFAULT '{}',
    valuation JSONB DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    mls_number VARCHAR(100),
    tax_id VARCHAR(100),
    zoning VARCHAR(50),
    metadata JSONB DEFAULT '{}'
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
    asset_id VARCHAR(100) PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE SET NULL,
    asset_name VARCHAR(500) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    value DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tokenized BOOLEAN DEFAULT FALSE,
    token_contract_address VARCHAR(100),
    token_id VARCHAR(100),
    blockchain_network VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    provenance JSONB DEFAULT '[]',
    custody JSONB DEFAULT '{}'
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
    audit_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    changes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    case_id VARCHAR(100),
    blockchain_anchored BOOLEAN DEFAULT FALSE
);

-- Compliance Records
CREATE TABLE IF NOT EXISTS compliance (
    compliance_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    requirements TEXT[] NOT NULL,
    compliant BOOLEAN DEFAULT FALSE,
    score DECIMAL(5, 2),
    issues JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_check_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Blockchain Anchors
CREATE TABLE IF NOT EXISTS blockchain_anchors (
    anchor_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_hash VARCHAR(100) UNIQUE NOT NULL,
    block_number BIGINT,
    network VARCHAR(50) DEFAULT 'chittychain-mainnet',
    anchor_type VARCHAR(50) NOT NULL,
    anchor_data JSONB NOT NULL,
    case_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmations INT DEFAULT 0,
    gas_used DECIMAL(15, 8),
    metadata JSONB DEFAULT '{}'
);

-- Trust Scores
CREATE TABLE IF NOT EXISTS trust_scores (
    entity_id VARCHAR(100) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    score DECIMAL(5, 2) DEFAULT 100.00,
    factors JSONB DEFAULT '{}',
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    history JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- ============= INDEXES =============

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_case_type ON cases(case_type);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_cases_client_name ON cases(client_name);

CREATE INDEX idx_deployments_case_id ON deployments(case_id);
CREATE INDEX idx_deployments_resource_type ON deployments(resource_type);
CREATE INDEX idx_deployments_status ON deployments(status);

CREATE INDEX idx_transactions_case_id ON transactions(case_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_analysis_status ON documents(analysis_status);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at DESC);

CREATE INDEX idx_properties_case_id ON properties(case_id);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_property_type ON properties(property_type);

CREATE INDEX idx_assets_case_id ON assets(case_id);
CREATE INDEX idx_assets_owner ON assets(owner);
CREATE INDEX idx_assets_tokenized ON assets(tokenized);

CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_case_id ON audit_trail(case_id);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp DESC);

CREATE INDEX idx_compliance_resource ON compliance(resource_type, resource_id);
CREATE INDEX idx_compliance_case_id ON compliance(case_id);
CREATE INDEX idx_compliance_compliant ON compliance(compliant);

CREATE INDEX idx_blockchain_anchors_case_id ON blockchain_anchors(case_id);
CREATE INDEX idx_blockchain_anchors_type ON blockchain_anchors(anchor_type);

-- ============= FUNCTIONS =============

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trail function
CREATE OR REPLACE FUNCTION create_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_trail (
        entity_type,
        entity_id,
        action,
        changes,
        case_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.case_id, NEW.transaction_id, NEW.document_id, NEW.listing_id, NEW.asset_id),
        TG_OP,
        to_jsonb(NEW),
        NEW.case_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to main tables
CREATE TRIGGER audit_cases AFTER INSERT OR UPDATE OR DELETE ON cases
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

-- ============= VIEWS =============

-- Active cases dashboard
CREATE VIEW active_cases_dashboard AS
SELECT 
    c.case_id,
    c.chitty_id,
    c.client_name,
    c.case_type,
    c.status,
    c.priority,
    COUNT(DISTINCT d.deployment_id) as deployment_count,
    COUNT(DISTINCT t.transaction_id) as transaction_count,
    COUNT(DISTINCT doc.document_id) as document_count,
    SUM(t.amount) as total_transaction_value,
    c.created_at
FROM cases c
LEFT JOIN deployments d ON c.case_id = d.case_id
LEFT JOIN transactions t ON c.case_id = t.case_id
LEFT JOIN documents doc ON c.case_id = doc.case_id
WHERE c.status = 'active'
GROUP BY c.case_id;

-- Compliance overview
CREATE VIEW compliance_overview AS
SELECT 
    c.case_id,
    c.resource_type,
    c.compliant,
    c.score,
    c.checked_at,
    c.next_check_at,
    CASE 
        WHEN c.next_check_at < CURRENT_TIMESTAMP THEN 'overdue'
        WHEN c.next_check_at < CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 'due_soon'
        ELSE 'current'
    END as check_status
FROM compliance c
ORDER BY c.next_check_at;

-- ============= INITIAL DATA =============

-- Insert default trust scores
INSERT INTO trust_scores (entity_id, entity_type, score) VALUES
    ('SYSTEM', 'system', 100.00),
    ('DEFAULT', 'default', 85.00)
ON CONFLICT (entity_id) DO NOTHING;

-- ============= PERMISSIONS =============

-- Grant permissions for application user
-- Replace 'chittyos_app' with your actual application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chittyos_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chittyos_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO chittyos_app;

-- ============= COMMENTS =============

COMMENT ON TABLE cases IS 'Core legal case management table';
COMMENT ON TABLE deployments IS 'Cloudflare infrastructure deployments linked to cases';
COMMENT ON TABLE transactions IS 'Financial transactions with blockchain anchoring';
COMMENT ON TABLE documents IS 'Legal documents with AI analysis results';
COMMENT ON TABLE properties IS 'Real estate property listings and valuations';
COMMENT ON TABLE assets IS 'Digital and physical assets with tokenization support';
COMMENT ON TABLE audit_trail IS 'Complete audit trail for all operations';
COMMENT ON TABLE compliance IS 'Compliance verification records';
COMMENT ON TABLE blockchain_anchors IS 'Blockchain transaction records for immutability';
COMMENT ON TABLE trust_scores IS 'Trust scoring for entities in the system';