-- Statement of Work (SOW) Generation System Migration
-- Creates tables for automated SOW document generation, templates, signatures, and version control

-- =====================================================
-- SOW TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_type VARCHAR(100) NOT NULL UNIQUE, -- web_development, mobile_app, api_development, etc.
  description TEXT,
  category VARCHAR(100), -- development, design, consulting, etc.
  
  -- Template structure
  sections JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of section objects with title and content
  default_terms JSONB DEFAULT '{}'::jsonb, -- Default legal terms for this template type
  
  -- Customization
  custom_fields JSONB DEFAULT '[]'::jsonb, -- Additional fields specific to template
  required_fields TEXT[] DEFAULT ARRAY[]::TEXT[], -- Fields that must be filled
  
  -- Template metadata
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'en',
  region VARCHAR(50) DEFAULT 'US', -- For regional legal requirements
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_template_type CHECK (template_type ~ '^[a-z_]+$')
);

-- =====================================================
-- SOW DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES sow_templates(id),
  
  -- Parties
  client_user_id UUID NOT NULL REFERENCES auth.users(id),
  developer_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Document details
  document_number VARCHAR(50) UNIQUE NOT NULL, -- SOW-2025-001234
  title VARCHAR(500) NOT NULL,
  template_type VARCHAR(100) NOT NULL,
  version INTEGER DEFAULT 1,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, pending_signatures, signed, cancelled, expired
  
  -- Document storage
  document_url TEXT, -- URL to generated PDF
  document_hash VARCHAR(64), -- SHA-256 hash for verification
  file_size_bytes INTEGER,
  
  -- SOW data
  sow_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Complete SOW data structure
  
  -- Timeline
  effective_date DATE,
  expiration_date DATE,
  estimated_completion_date DATE,
  
  -- Signatures
  signature_request_id VARCHAR(255), -- External signature service ID
  client_signed_at TIMESTAMPTZ,
  developer_signed_at TIMESTAMPTZ,
  fully_executed_at TIMESTAMPTZ,
  
  -- Financial
  total_budget DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms TEXT,
  
  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending_review', 'pending_signatures', 'signed', 'cancelled', 'expired')),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT positive_budget CHECK (total_budget >= 0),
  CONSTRAINT valid_dates CHECK (
    expiration_date IS NULL OR effective_date IS NULL OR expiration_date > effective_date
  )
);

-- =====================================================
-- SOW VERSIONS TABLE (Version Control)
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_document_id UUID NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Version details
  document_url TEXT NOT NULL,
  document_hash VARCHAR(64) NOT NULL,
  sow_data JSONB NOT NULL,
  
  -- Change tracking
  changes_summary TEXT,
  changed_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  change_reason VARCHAR(50), -- amendment, correction, update, revision
  
  -- Approval
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  UNIQUE(sow_document_id, version_number)
);

-- =====================================================
-- SOW SIGNATURES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_document_id UUID NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  
  -- Signer information
  signer_user_id UUID NOT NULL REFERENCES auth.users(id),
  signer_role VARCHAR(50) NOT NULL, -- client, developer, witness
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(255) NOT NULL,
  signer_title VARCHAR(255), -- Job title
  
  -- Signature details
  signature_type VARCHAR(50) DEFAULT 'digital', -- digital, electronic, wet_signature
  signature_data TEXT, -- Base64 encoded signature image or digital signature
  signature_method VARCHAR(100), -- docusign, hellosign, adobe_sign, manual
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, signed, declined, expired
  
  -- Tracking
  invitation_sent_at TIMESTAMPTZ,
  document_viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  
  -- IP and location for legal compliance
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB, -- {country, region, city}
  
  -- External service integration
  external_signature_id VARCHAR(255),
  external_envelope_id VARCHAR(255),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_signer_role CHECK (signer_role IN ('client', 'developer', 'witness', 'admin')),
  CONSTRAINT valid_signature_type CHECK (signature_type IN ('digital', 'electronic', 'wet_signature')),
  CONSTRAINT valid_signature_status CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined', 'expired'))
);

-- =====================================================
-- SOW MILESTONES TABLE (Linked to Project Milestones)
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_document_id UUID NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id), -- Link to actual project milestone
  
  -- Milestone details in SOW
  milestone_number INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  
  -- Deliverables
  deliverables TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  acceptance_criteria TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Financial
  budget DECIMAL(12, 2) NOT NULL,
  payment_percentage DECIMAL(5, 2), -- Percentage of total budget
  
  -- Timeline
  estimated_start_date DATE,
  estimated_completion_date DATE,
  estimated_duration_days INTEGER,
  
  -- Dependencies
  depends_on_milestone_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Order
  display_order INTEGER NOT NULL,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT positive_budget CHECK (budget >= 0),
  CONSTRAINT valid_percentage CHECK (payment_percentage >= 0 AND payment_percentage <= 100),
  CONSTRAINT valid_dates CHECK (
    estimated_start_date IS NULL OR 
    estimated_completion_date IS NULL OR 
    estimated_completion_date >= estimated_start_date
  ),
  UNIQUE(sow_document_id, milestone_number)
);

-- =====================================================
-- SOW TERMS TABLE (Legal Terms and Clauses)
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_document_id UUID NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  
  -- Term details
  term_type VARCHAR(100) NOT NULL, -- intellectual_property, confidentiality, termination, liability, etc.
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  
  -- Organization
  section_number VARCHAR(20), -- 1.1, 2.3, etc.
  display_order INTEGER NOT NULL,
  
  -- Customization
  is_mandatory BOOLEAN DEFAULT true,
  is_customized BOOLEAN DEFAULT false, -- Modified from template default
  original_content TEXT, -- Store original if customized
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SOW ACTIVITY LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sow_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_document_id UUID NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type VARCHAR(100) NOT NULL, -- created, updated, signed, sent_for_signature, cancelled, etc.
  description TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  
  -- User
  user_id UUID REFERENCES auth.users(id),
  user_role VARCHAR(50), -- client, developer, admin
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- SOW Templates
CREATE INDEX idx_sow_templates_type ON sow_templates(template_type);
CREATE INDEX idx_sow_templates_category ON sow_templates(category);
CREATE INDEX idx_sow_templates_active ON sow_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_sow_templates_default ON sow_templates(is_default) WHERE is_default = true;

-- SOW Documents
CREATE INDEX idx_sow_documents_project ON sow_documents(project_id);
CREATE INDEX idx_sow_documents_client ON sow_documents(client_user_id);
CREATE INDEX idx_sow_documents_developer ON sow_documents(developer_user_id);
CREATE INDEX idx_sow_documents_status ON sow_documents(status);
CREATE INDEX idx_sow_documents_number ON sow_documents(document_number);
CREATE INDEX idx_sow_documents_created ON sow_documents(created_at DESC);
CREATE INDEX idx_sow_documents_executed ON sow_documents(fully_executed_at) WHERE fully_executed_at IS NOT NULL;
CREATE INDEX idx_sow_documents_pending_signatures ON sow_documents(status) WHERE status = 'pending_signatures';

-- SOW Versions
CREATE INDEX idx_sow_versions_document ON sow_versions(sow_document_id, version_number DESC);
CREATE INDEX idx_sow_versions_created ON sow_versions(created_at DESC);

-- SOW Signatures
CREATE INDEX idx_sow_signatures_document ON sow_signatures(sow_document_id);
CREATE INDEX idx_sow_signatures_signer ON sow_signatures(signer_user_id);
CREATE INDEX idx_sow_signatures_status ON sow_signatures(status);
CREATE INDEX idx_sow_signatures_pending ON sow_signatures(status) WHERE status IN ('pending', 'sent', 'viewed');

-- SOW Milestones
CREATE INDEX idx_sow_milestones_document ON sow_milestones(sow_document_id, display_order);
CREATE INDEX idx_sow_milestones_project_milestone ON sow_milestones(milestone_id);

-- SOW Terms
CREATE INDEX idx_sow_terms_document ON sow_terms(sow_document_id, display_order);
CREATE INDEX idx_sow_terms_type ON sow_terms(term_type);

-- SOW Activity Log
CREATE INDEX idx_sow_activity_document ON sow_activity_log(sow_document_id, created_at DESC);
CREATE INDEX idx_sow_activity_user ON sow_activity_log(user_id, created_at DESC);
CREATE INDEX idx_sow_activity_type ON sow_activity_log(activity_type);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate unique SOW document number
CREATE OR REPLACE FUNCTION generate_sow_document_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  doc_number TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(document_number FROM 'SOW-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM sow_documents
  WHERE document_number LIKE 'SOW-' || year_part || '-%';
  
  doc_number := 'SOW-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
  
  RETURN doc_number;
END;
$$ LANGUAGE plpgsql;

-- Update SOW status based on signatures
CREATE OR REPLACE FUNCTION update_sow_status_on_signature()
RETURNS TRIGGER AS $$
DECLARE
  required_signatures INTEGER;
  completed_signatures INTEGER;
BEGIN
  -- Count required and completed signatures for this SOW
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'signed')
  INTO required_signatures, completed_signatures
  FROM sow_signatures
  WHERE sow_document_id = NEW.sow_document_id;
  
  -- If all signatures are complete, mark SOW as signed
  IF completed_signatures = required_signatures AND required_signatures > 0 THEN
    UPDATE sow_documents
    SET 
      status = 'signed',
      fully_executed_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.sow_document_id AND status = 'pending_signatures';
    
    -- Update individual party signed_at timestamps
    IF NEW.signer_role = 'client' THEN
      UPDATE sow_documents
      SET client_signed_at = NEW.signed_at
      WHERE id = NEW.sow_document_id;
    ELSIF NEW.signer_role = 'developer' THEN
      UPDATE sow_documents
      SET developer_signed_at = NEW.signed_at
      WHERE id = NEW.sow_document_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for signature completion
DROP TRIGGER IF EXISTS trigger_update_sow_on_signature ON sow_signatures;
CREATE TRIGGER trigger_update_sow_on_signature
  AFTER UPDATE OF status ON sow_signatures
  FOR EACH ROW
  WHEN (NEW.status = 'signed' AND OLD.status != 'signed')
  EXECUTE FUNCTION update_sow_status_on_signature();

-- Create new version when SOW is updated
CREATE OR REPLACE FUNCTION create_sow_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if significant fields changed and status is not draft
  IF (OLD.status != 'draft' AND NEW.version != OLD.version) OR
     (OLD.sow_data::text != NEW.sow_data::text AND OLD.status != 'draft') THEN
    
    INSERT INTO sow_versions (
      sow_document_id,
      version_number,
      document_url,
      document_hash,
      sow_data,
      changes_summary,
      created_by
    ) VALUES (
      NEW.id,
      NEW.version,
      NEW.document_url,
      NEW.document_hash,
      NEW.sow_data,
      'SOW document updated',
      NEW.client_user_id -- Or get from context
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_sow_version ON sow_documents;
CREATE TRIGGER trigger_create_sow_version
  AFTER UPDATE ON sow_documents
  FOR EACH ROW
  EXECUTE FUNCTION create_sow_version();

-- Get SOW statistics for a user
CREATE OR REPLACE FUNCTION get_sow_statistics(user_id_param UUID)
RETURNS TABLE (
  total_sows INTEGER,
  draft_sows INTEGER,
  pending_signatures INTEGER,
  signed_sows INTEGER,
  cancelled_sows INTEGER,
  total_contract_value DECIMAL(12, 2),
  avg_time_to_signature_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_sows,
    COUNT(*) FILTER (WHERE status = 'draft')::INTEGER AS draft_sows,
    COUNT(*) FILTER (WHERE status = 'pending_signatures')::INTEGER AS pending_signatures,
    COUNT(*) FILTER (WHERE status = 'signed')::INTEGER AS signed_sows,
    COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER AS cancelled_sows,
    COALESCE(SUM(total_budget) FILTER (WHERE status = 'signed'), 0) AS total_contract_value,
    COALESCE(AVG(
      EXTRACT(EPOCH FROM (fully_executed_at - created_at)) / 86400
    ) FILTER (WHERE fully_executed_at IS NOT NULL), 0)::NUMERIC AS avg_time_to_signature_days
  FROM sow_documents
  WHERE client_user_id = user_id_param OR developer_user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE sow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_activity_log ENABLE ROW LEVEL SECURITY;

-- SOW Templates: Everyone can read active templates, only admins can modify
CREATE POLICY sow_templates_read ON sow_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY sow_templates_admin_all ON sow_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- SOW Documents: Users can see documents where they are client or developer
CREATE POLICY sow_documents_read ON sow_documents
  FOR SELECT
  USING (
    client_user_id = auth.uid() OR
    developer_user_id = auth.uid()
  );

CREATE POLICY sow_documents_create ON sow_documents
  FOR INSERT
  WITH CHECK (
    client_user_id = auth.uid() OR
    developer_user_id = auth.uid()
  );

CREATE POLICY sow_documents_update ON sow_documents
  FOR UPDATE
  USING (
    client_user_id = auth.uid() OR
    developer_user_id = auth.uid()
  );

-- SOW Versions: Users can see versions of their documents
CREATE POLICY sow_versions_read ON sow_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sow_documents
      WHERE sow_documents.id = sow_versions.sow_document_id
      AND (sow_documents.client_user_id = auth.uid() OR sow_documents.developer_user_id = auth.uid())
    )
  );

-- SOW Signatures: Users can see and update their own signatures
CREATE POLICY sow_signatures_read ON sow_signatures
  FOR SELECT
  USING (
    signer_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sow_documents
      WHERE sow_documents.id = sow_signatures.sow_document_id
      AND (sow_documents.client_user_id = auth.uid() OR sow_documents.developer_user_id = auth.uid())
    )
  );

CREATE POLICY sow_signatures_update ON sow_signatures
  FOR UPDATE
  USING (signer_user_id = auth.uid());

-- SOW Milestones: Users can see milestones of their documents
CREATE POLICY sow_milestones_read ON sow_milestones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sow_documents
      WHERE sow_documents.id = sow_milestones.sow_document_id
      AND (sow_documents.client_user_id = auth.uid() OR sow_documents.developer_user_id = auth.uid())
    )
  );

-- SOW Terms: Users can see terms of their documents
CREATE POLICY sow_terms_read ON sow_terms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sow_documents
      WHERE sow_documents.id = sow_terms.sow_document_id
      AND (sow_documents.client_user_id = auth.uid() OR sow_documents.developer_user_id = auth.uid())
    )
  );

-- SOW Activity Log: Users can see activity of their documents
CREATE POLICY sow_activity_log_read ON sow_activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sow_documents
      WHERE sow_documents.id = sow_activity_log.sow_document_id
      AND (sow_documents.client_user_id = auth.uid() OR sow_documents.developer_user_id = auth.uid())
    )
  );

-- =====================================================
-- SEED DEFAULT TEMPLATES
-- =====================================================

-- Web Development Template
INSERT INTO sow_templates (name, template_type, description, category, sections, default_terms, is_default, required_fields)
VALUES (
  'Web Development Project',
  'web_development',
  'Standard SOW template for web development projects including frontend, backend, and full-stack work',
  'development',
  '[
    {
      "title": "Project Overview",
      "content": "This Statement of Work outlines the terms and conditions for the development of {{project_title}}. The work will be performed by {{developer_name}} for {{client_company}}.",
      "order": 1
    },
    {
      "title": "Scope of Work",
      "content": "The Developer will provide web development services including design, development, testing, and deployment as specified in the project requirements.",
      "order": 2
    },
    {
      "title": "Deliverables and Milestones",
      "content": "Project will be delivered in milestones as outlined in the milestone schedule. Each milestone includes specific deliverables and acceptance criteria.",
      "order": 3
    },
    {
      "title": "Timeline and Schedule",
      "content": "Estimated project duration: {{estimated_timeline}}. Specific milestone deadlines are outlined in the milestone schedule.",
      "order": 4
    },
    {
      "title": "Payment Terms",
      "content": "Total project budget: {{total_budget}} {{currency}}. Payment will be made through the WorkDev platform upon milestone completion and client approval.",
      "order": 5
    },
    {
      "title": "Intellectual Property Rights",
      "content": "Upon full payment, all intellectual property rights for the deliverables will transfer to the Client. Developer retains rights to pre-existing materials and general knowledge.",
      "order": 6
    }
  ]'::jsonb,
  '{
    "intellectual_property": "Upon full payment, Client receives all IP rights to deliverables",
    "confidentiality": "Both parties agree to maintain confidentiality of proprietary information",
    "termination": "Either party may terminate with 14 days written notice",
    "liability": "Developer liability limited to project fees paid",
    "dispute_resolution": "Disputes resolved through WorkDev platform mediation"
  }'::jsonb,
  true,
  ARRAY['project_title', 'project_description', 'total_budget', 'milestones']
);

-- Mobile App Template
INSERT INTO sow_templates (name, template_type, description, category, sections, is_default, required_fields)
VALUES (
  'Mobile Application Development',
  'mobile_app',
  'SOW template for iOS, Android, and cross-platform mobile application development',
  'development',
  '[
    {
      "title": "Project Overview",
      "content": "This Statement of Work covers the development of a mobile application: {{project_title}}.",
      "order": 1
    },
    {
      "title": "Platform and Technology",
      "content": "The mobile application will be developed for {{platforms}} using {{technologies}}.",
      "order": 2
    },
    {
      "title": "Deliverables",
      "content": "Includes app development, testing, app store deployment, and source code delivery.",
      "order": 3
    }
  ]'::jsonb,
  true,
  ARRAY['project_title', 'platforms', 'technologies', 'milestones']
);

-- API Development Template
INSERT INTO sow_templates (name, template_type, description, category, sections, is_default, required_fields)
VALUES (
  'API Development Project',
  'api_development',
  'SOW template for RESTful API, GraphQL, and microservices development',
  'development',
  '[
    {
      "title": "Project Overview",
      "content": "This Statement of Work covers the development of API services for {{project_title}}.",
      "order": 1
    },
    {
      "title": "API Specifications",
      "content": "API will be developed according to {{api_type}} standards with {{endpoints_count}} endpoints.",
      "order": 2
    }
  ]'::jsonb,
  false,
  ARRAY['project_title', 'api_type', 'endpoints_count']
);

COMMENT ON TABLE sow_templates IS 'Templates for generating Statement of Work documents';
COMMENT ON TABLE sow_documents IS 'Generated SOW documents for projects';
COMMENT ON TABLE sow_versions IS 'Version history for SOW documents';
COMMENT ON TABLE sow_signatures IS 'Digital signatures for SOW documents';
COMMENT ON TABLE sow_milestones IS 'Milestones included in SOW documents';
COMMENT ON TABLE sow_terms IS 'Legal terms and clauses in SOW documents';
COMMENT ON TABLE sow_activity_log IS 'Activity history for SOW documents';
