-- AI Analysis Schema Migration for §36 Compliance
-- Evidence-based AI session tracking and multi-model consensus analysis
-- Part of ChittyOS litigation workflow requirements

-- ============= AI ANALYSIS TABLES =============

-- AI Analysis Sessions (Claude, GPT, etc.)
CREATE TABLE IF NOT EXISTS ai_analysis_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    model_provider VARCHAR(50) NOT NULL, -- claude, openai, anthropic
    model_version VARCHAR(100) NOT NULL, -- claude-3-5-sonnet, gpt-4, etc.
    session_type VARCHAR(50) NOT NULL, -- evidence_analysis, legal_research, document_review
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, failed, aborted
    input_hash VARCHAR(64) NOT NULL, -- SHA256 of input content
    output_hash VARCHAR(64), -- SHA256 of final output
    token_count_input INTEGER,
    token_count_output INTEGER,
    cost_usd DECIMAL(10, 4),
    metadata JSONB DEFAULT '{}',
    compliance_verified BOOLEAN DEFAULT FALSE,
    blockchain_anchored BOOLEAN DEFAULT FALSE,
    blockchain_tx_hash VARCHAR(100)
);

-- Individual AI Analysis Results
CREATE TABLE IF NOT EXISTS ai_analysis_results (
    result_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id VARCHAR(100) REFERENCES ai_analysis_sessions(session_id) ON DELETE CASCADE,
    analysis_type VARCHAR(100) NOT NULL, -- contract_review, risk_assessment, legal_precedent
    input_content TEXT NOT NULL,
    output_content TEXT NOT NULL,
    confidence_score DECIMAL(5, 2), -- 0-100
    processing_time_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    citations JSONB DEFAULT '[]', -- Legal citations, case law references
    extracted_entities JSONB DEFAULT '{}', -- Named entities, dates, amounts
    risk_flags JSONB DEFAULT '[]', -- Identified risks or concerns
    metadata JSONB DEFAULT '{}'
);

-- Multi-Model Consensus Analysis
CREATE TABLE IF NOT EXISTS ai_consensus_analysis (
    consensus_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    document_id VARCHAR(100) REFERENCES documents(document_id) ON DELETE CASCADE,
    analysis_topic VARCHAR(255) NOT NULL,
    models_used JSONB NOT NULL, -- Array of {provider, model, version}
    consensus_score DECIMAL(5, 2), -- 0-100, agreement level
    majority_conclusion TEXT,
    dissenting_opinions JSONB DEFAULT '[]',
    confidence_level VARCHAR(20), -- high, medium, low
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_by VARCHAR(100), -- Human verification
    verification_notes TEXT,
    blockchain_hash VARCHAR(100),
    evidence_weight DECIMAL(5, 2) DEFAULT 50.00 -- Weight for legal proceedings
);

-- AI Model Performance Tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    performance_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    model_provider VARCHAR(50) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    analysis_type VARCHAR(100) NOT NULL,
    accuracy_score DECIMAL(5, 2),
    precision_score DECIMAL(5, 2),
    recall_score DECIMAL(5, 2),
    f1_score DECIMAL(5, 2),
    human_verification_rate DECIMAL(5, 2),
    cost_per_analysis DECIMAL(10, 4),
    avg_processing_time_ms INTEGER,
    sample_size INTEGER,
    evaluation_period_start TIMESTAMP WITH TIME ZONE,
    evaluation_period_end TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Evidence Chain Tracking (for AI analysis evidence)
CREATE TABLE IF NOT EXISTS evidence_chain (
    chain_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chitty_id VARCHAR(100) UNIQUE NOT NULL,
    parent_chain_id UUID REFERENCES evidence_chain(chain_id),
    case_id VARCHAR(100) REFERENCES cases(case_id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL, -- ai_analysis, consensus, human_review
    evidence_hash VARCHAR(64) NOT NULL,
    source_session_id VARCHAR(100) REFERENCES ai_analysis_sessions(session_id),
    source_consensus_id UUID REFERENCES ai_consensus_analysis(consensus_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NOT NULL,
    integrity_verified BOOLEAN DEFAULT FALSE,
    blockchain_anchored BOOLEAN DEFAULT FALSE,
    blockchain_tx_hash VARCHAR(100),
    legal_weight DECIMAL(5, 2) DEFAULT 1.00, -- Weight in legal proceedings
    admissibility_status VARCHAR(50) DEFAULT 'pending', -- pending, admitted, excluded
    metadata JSONB DEFAULT '{}'
);

-- ============= INDEXES =============

CREATE INDEX idx_ai_sessions_case_id ON ai_analysis_sessions(case_id);
CREATE INDEX idx_ai_sessions_model ON ai_analysis_sessions(model_provider, model_version);
CREATE INDEX idx_ai_sessions_status ON ai_analysis_sessions(status);
CREATE INDEX idx_ai_sessions_started_at ON ai_analysis_sessions(started_at DESC);
CREATE INDEX idx_ai_sessions_chitty_id ON ai_analysis_sessions(chitty_id);

CREATE INDEX idx_ai_results_session_id ON ai_analysis_results(session_id);
CREATE INDEX idx_ai_results_analysis_type ON ai_analysis_results(analysis_type);
CREATE INDEX idx_ai_results_confidence ON ai_analysis_results(confidence_score DESC);
CREATE INDEX idx_ai_results_timestamp ON ai_analysis_results(timestamp DESC);

CREATE INDEX idx_consensus_case_id ON ai_consensus_analysis(case_id);
CREATE INDEX idx_consensus_document_id ON ai_consensus_analysis(document_id);
CREATE INDEX idx_consensus_score ON ai_consensus_analysis(consensus_score DESC);
CREATE INDEX idx_consensus_confidence ON ai_consensus_analysis(confidence_level);
CREATE INDEX idx_consensus_created_at ON ai_consensus_analysis(created_at DESC);

CREATE INDEX idx_model_performance_provider ON ai_model_performance(model_provider, model_version);
CREATE INDEX idx_model_performance_type ON ai_model_performance(analysis_type);
CREATE INDEX idx_model_performance_accuracy ON ai_model_performance(accuracy_score DESC);

CREATE INDEX idx_evidence_chain_case_id ON evidence_chain(case_id);
CREATE INDEX idx_evidence_chain_chitty_id ON evidence_chain(chitty_id);
CREATE INDEX idx_evidence_chain_parent ON evidence_chain(parent_chain_id);
CREATE INDEX idx_evidence_chain_type ON evidence_chain(evidence_type);
CREATE INDEX idx_evidence_chain_created_at ON evidence_chain(created_at DESC);
CREATE INDEX idx_evidence_chain_legal_weight ON evidence_chain(legal_weight DESC);

-- ============= TRIGGERS =============

-- Auto-update completion timestamp for AI sessions
CREATE OR REPLACE FUNCTION update_ai_session_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_session_completion_trigger
    BEFORE UPDATE ON ai_analysis_sessions
    FOR EACH ROW EXECUTE FUNCTION update_ai_session_completion();

-- Audit trail for AI analysis tables
CREATE TRIGGER audit_ai_sessions AFTER INSERT OR UPDATE OR DELETE ON ai_analysis_sessions
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

CREATE TRIGGER audit_ai_consensus AFTER INSERT OR UPDATE OR DELETE ON ai_consensus_analysis
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

CREATE TRIGGER audit_evidence_chain AFTER INSERT OR UPDATE OR DELETE ON evidence_chain
    FOR EACH ROW EXECUTE FUNCTION create_audit_entry();

-- ============= VIEWS =============

-- AI Analysis Dashboard
CREATE VIEW ai_analysis_dashboard AS
SELECT
    s.session_id,
    s.case_id,
    s.model_provider,
    s.model_version,
    s.session_type,
    s.status,
    s.started_at,
    s.completed_at,
    COUNT(r.result_id) as analysis_count,
    AVG(r.confidence_score) as avg_confidence,
    SUM(s.token_count_input + s.token_count_output) as total_tokens,
    SUM(s.cost_usd) as total_cost
FROM ai_analysis_sessions s
LEFT JOIN ai_analysis_results r ON s.session_id = r.session_id
GROUP BY s.session_id
ORDER BY s.started_at DESC;

-- Consensus Analysis Summary
CREATE VIEW consensus_summary AS
SELECT
    c.case_id,
    COUNT(*) as total_consensus_analyses,
    AVG(c.consensus_score) as avg_consensus_score,
    COUNT(CASE WHEN c.confidence_level = 'high' THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN c.verified_by IS NOT NULL THEN 1 END) as human_verified_count,
    AVG(c.evidence_weight) as avg_evidence_weight
FROM ai_consensus_analysis c
GROUP BY c.case_id
ORDER BY avg_consensus_score DESC;

-- Evidence Chain Integrity View
CREATE VIEW evidence_integrity_overview AS
SELECT
    e.case_id,
    COUNT(*) as evidence_count,
    COUNT(CASE WHEN e.integrity_verified = true THEN 1 END) as verified_count,
    COUNT(CASE WHEN e.blockchain_anchored = true THEN 1 END) as blockchain_anchored_count,
    COUNT(CASE WHEN e.admissibility_status = 'admitted' THEN 1 END) as admitted_count,
    SUM(e.legal_weight) as total_legal_weight
FROM evidence_chain e
GROUP BY e.case_id
ORDER BY total_legal_weight DESC;

-- ============= FUNCTIONS =============

-- Function to calculate consensus score based on model agreement
CREATE OR REPLACE FUNCTION calculate_consensus_score(
    model_results JSONB
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_models INTEGER;
    agreement_count INTEGER;
    consensus_score DECIMAL(5,2);
BEGIN
    total_models := jsonb_array_length(model_results);

    -- Simple majority consensus calculation
    -- In practice, this would be more sophisticated
    agreement_count := total_models / 2 + 1;
    consensus_score := (agreement_count::DECIMAL / total_models::DECIMAL) * 100;

    RETURN LEAST(consensus_score, 100.00);
END;
$$ LANGUAGE plpgsql;

-- Function to generate evidence chain hash
CREATE OR REPLACE FUNCTION generate_evidence_hash(
    evidence_data JSONB,
    parent_hash VARCHAR(64) DEFAULT NULL
) RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(
        digest(
            COALESCE(parent_hash, '') || evidence_data::text,
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;

-- ============= COMMENTS =============

COMMENT ON TABLE ai_analysis_sessions IS 'Tracks individual AI model analysis sessions with compliance verification';
COMMENT ON TABLE ai_analysis_results IS 'Stores detailed results from AI analysis with confidence scoring';
COMMENT ON TABLE ai_consensus_analysis IS 'Multi-model consensus analysis for critical legal determinations';
COMMENT ON TABLE ai_model_performance IS 'Performance metrics and benchmarking for AI models';
COMMENT ON TABLE evidence_chain IS 'Immutable evidence chain for AI analysis results in legal proceedings';

COMMENT ON COLUMN ai_analysis_sessions.input_hash IS 'SHA256 hash of input content for integrity verification';
COMMENT ON COLUMN ai_analysis_sessions.output_hash IS 'SHA256 hash of final output for integrity verification';
COMMENT ON COLUMN ai_consensus_analysis.consensus_score IS 'Agreement level between models (0-100)';
COMMENT ON COLUMN evidence_chain.legal_weight IS 'Weight assigned to evidence for legal proceedings';
COMMENT ON COLUMN evidence_chain.admissibility_status IS 'Legal admissibility status in court proceedings';

-- ============= SAMPLE DATA =============

-- Insert default AI model performance baselines
INSERT INTO ai_model_performance (
    model_provider,
    model_version,
    analysis_type,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    sample_size,
    evaluation_period_start,
    evaluation_period_end
) VALUES
    ('anthropic', 'claude-3-5-sonnet', 'contract_review', 92.5, 89.2, 94.1, 91.6, 1000, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP),
    ('openai', 'gpt-4', 'legal_research', 88.7, 85.3, 91.2, 88.2, 800, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP),
    ('anthropic', 'claude-3-5-sonnet', 'risk_assessment', 94.2, 92.1, 96.3, 94.2, 1200, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;