-- ==========================================
-- WorkDev Interview System Database Schema
-- ==========================================
-- Comprehensive interview system with video calling,
-- collaborative code editing, scheduling, and evaluations
--
-- Features:
-- - Interview scheduling and management
-- - Video call sessions with Twilio integration
-- - Collaborative code editing sessions
-- - Interview evaluations and feedback
-- - Recording storage and transcriptions
-- - Interview analytics and history
--
-- Author: WorkDev Platform Team
-- Date: October 1, 2025
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Table: interviews
-- Core interview records with scheduling info
-- ==========================================

CREATE TABLE IF NOT EXISTS interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 240),
    timezone TEXT NOT NULL DEFAULT 'UTC',
    
    -- Interview details
    interview_type TEXT NOT NULL CHECK (interview_type IN ('behavioral', 'technical', 'mixed', 'cultural_fit')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    
    -- Video call info
    room_sid TEXT, -- Twilio Room SID
    room_name TEXT,
    room_token_client TEXT, -- Encrypted token
    room_token_developer TEXT, -- Encrypted token
    
    -- Recording
    recording_enabled BOOLEAN NOT NULL DEFAULT true,
    recording_url TEXT,
    recording_sid TEXT,
    transcription_url TEXT,
    
    -- Interview content
    title TEXT NOT NULL,
    description TEXT,
    agenda JSONB DEFAULT '[]'::jsonb, -- Array of agenda items
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    actual_duration_minutes INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_scheduled_time CHECK (scheduled_at > created_at),
    CONSTRAINT valid_participants CHECK (client_user_id != developer_user_id)
);

-- Indexes for interviews
CREATE INDEX idx_interviews_client ON interviews(client_user_id);
CREATE INDEX idx_interviews_developer ON interviews(developer_user_id);
CREATE INDEX idx_interviews_project ON interviews(project_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_type ON interviews(interview_type);
CREATE INDEX idx_interviews_room_sid ON interviews(room_sid) WHERE room_sid IS NOT NULL;
CREATE INDEX idx_interviews_tags ON interviews USING gin(tags);

-- ==========================================
-- Table: interview_participants
-- Additional participants beyond client/developer
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    role TEXT NOT NULL CHECK (role IN ('interviewer', 'observer', 'note_taker', 'panelist')),
    
    -- Participation tracking
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    connection_quality JSONB, -- { video: 'good', audio: 'excellent', network: 'stable' }
    
    -- Permissions
    can_speak BOOLEAN DEFAULT true,
    can_share_screen BOOLEAN DEFAULT false,
    can_edit_code BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(interview_id, user_id)
);

CREATE INDEX idx_interview_participants_interview ON interview_participants(interview_id);
CREATE INDEX idx_interview_participants_user ON interview_participants(user_id);

-- ==========================================
-- Table: code_editor_sessions
-- Collaborative code editing sessions
-- ==========================================

CREATE TABLE IF NOT EXISTS code_editor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Editor configuration
    language TEXT NOT NULL DEFAULT 'javascript',
    theme TEXT NOT NULL DEFAULT 'vs-light' CHECK (theme IN ('vs-light', 'vs-dark', 'hc-black')),
    
    -- Code content
    initial_code TEXT DEFAULT '',
    final_code TEXT,
    code_snapshots JSONB DEFAULT '[]'::jsonb, -- Periodic snapshots with timestamps
    
    -- Execution results
    execution_results JSONB DEFAULT '[]'::jsonb, -- Array of { timestamp, output, error, runtime_ms }
    
    -- Collaboration metrics
    total_edits INTEGER DEFAULT 0,
    participants_edited TEXT[] DEFAULT ARRAY[]::TEXT[], -- User IDs who made edits
    
    -- Session timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_code_sessions_interview ON code_editor_sessions(interview_id);
CREATE INDEX idx_code_sessions_language ON code_editor_sessions(language);

-- ==========================================
-- Table: interview_evaluations
-- Structured evaluation and feedback
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    evaluator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Rating scores (1-5 scale)
    overall_rating DECIMAL(2,1) CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
    technical_skills DECIMAL(2,1) CHECK (technical_skills >= 1.0 AND technical_skills <= 5.0),
    communication DECIMAL(2,1) CHECK (communication >= 1.0 AND communication <= 5.0),
    problem_solving DECIMAL(2,1) CHECK (problem_solving >= 1.0 AND problem_solving <= 5.0),
    cultural_fit DECIMAL(2,1) CHECK (cultural_fit >= 1.0 AND cultural_fit <= 5.0),
    code_quality_score DECIMAL(2,1) CHECK (code_quality_score >= 1.0 AND code_quality_score <= 5.0),
    
    -- Detailed feedback
    strengths TEXT,
    areas_for_improvement TEXT,
    notes TEXT,
    
    -- Decision
    recommended_for_hire BOOLEAN,
    next_steps TEXT,
    
    -- Structured assessment
    skills_assessment JSONB DEFAULT '{}'::jsonb, -- { "React": 4, "TypeScript": 5, ... }
    questions_answered JSONB DEFAULT '[]'::jsonb, -- Array of question performance
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(interview_id, evaluator_user_id)
);

CREATE INDEX idx_evaluations_interview ON interview_evaluations(interview_id);
CREATE INDEX idx_evaluations_evaluator ON interview_evaluations(evaluator_user_id);
CREATE INDEX idx_evaluations_rating ON interview_evaluations(overall_rating);
CREATE INDEX idx_evaluations_recommended ON interview_evaluations(recommended_for_hire);

-- ==========================================
-- Table: interview_notes
-- Real-time note taking during interviews
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Note content
    content TEXT NOT NULL,
    note_type TEXT CHECK (note_type IN ('general', 'technical', 'behavioral', 'question', 'observation', 'concern')),
    
    -- Categorization
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    timestamp_in_interview INTEGER, -- Seconds from interview start
    
    -- Metadata
    is_private BOOLEAN DEFAULT false, -- Private notes visible only to author
    is_flagged BOOLEAN DEFAULT false, -- Important notes
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interview_notes_interview ON interview_notes(interview_id);
CREATE INDEX idx_interview_notes_author ON interview_notes(author_user_id);
CREATE INDEX idx_interview_notes_timestamp ON interview_notes(timestamp_in_interview);
CREATE INDEX idx_interview_notes_flagged ON interview_notes(is_flagged) WHERE is_flagged = true;

-- ==========================================
-- Table: interview_recordings
-- Video/audio recording metadata
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    
    -- Recording details
    recording_sid TEXT NOT NULL UNIQUE, -- Twilio Recording SID
    recording_url TEXT NOT NULL,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    
    -- Media info
    format TEXT DEFAULT 'mp4',
    resolution TEXT, -- e.g., "1280x720"
    
    -- Processing
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'available', 'failed', 'deleted')),
    transcription_status TEXT CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
    transcription_text TEXT,
    
    -- Access control
    is_public BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-delete after X days
    
    -- Compliance
    consent_obtained BOOLEAN DEFAULT false,
    gdpr_compliant BOOLEAN DEFAULT true,
    retention_policy TEXT, -- e.g., "30_days", "90_days", "indefinite"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recordings_interview ON interview_recordings(interview_id);
CREATE INDEX idx_recordings_status ON interview_recordings(status);
CREATE INDEX idx_recordings_expires_at ON interview_recordings(expires_at) WHERE expires_at IS NOT NULL;

-- ==========================================
-- Table: interview_questions
-- Question bank for technical interviews
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Question content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('coding', 'system_design', 'behavioral', 'theoretical')),
    
    -- Difficulty and categorization
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g., ["algorithms", "data-structures"]
    
    -- For coding questions
    starter_code JSONB DEFAULT '{}'::jsonb, -- { "javascript": "function...", "python": "def..." }
    test_cases JSONB DEFAULT '[]'::jsonb,
    solution_code JSONB DEFAULT '{}'::jsonb,
    hints JSONB DEFAULT '[]'::jsonb,
    
    -- Expected time and complexity
    estimated_time_minutes INTEGER,
    time_complexity TEXT,
    space_complexity TEXT,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    average_success_rate DECIMAL(4,2),
    
    -- Metadata
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_questions_type ON interview_questions(question_type);
CREATE INDEX idx_questions_difficulty ON interview_questions(difficulty);
CREATE INDEX idx_questions_skills ON interview_questions USING gin(skills);
CREATE INDEX idx_questions_topics ON interview_questions USING gin(topics);
CREATE INDEX idx_questions_public ON interview_questions(is_public) WHERE is_public = true;

-- ==========================================
-- Table: interview_question_usage
-- Tracking which questions were asked
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_question_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    
    -- Performance
    time_spent_seconds INTEGER,
    completed BOOLEAN DEFAULT false,
    solution_quality TEXT CHECK (solution_quality IN ('poor', 'fair', 'good', 'excellent')),
    
    -- Code submitted
    submitted_code TEXT,
    test_cases_passed INTEGER,
    total_test_cases INTEGER,
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(interview_id, question_id)
);

CREATE INDEX idx_question_usage_interview ON interview_question_usage(interview_id);
CREATE INDEX idx_question_usage_question ON interview_question_usage(question_id);

-- ==========================================
-- Table: interview_templates
-- Reusable interview templates
-- ==========================================

CREATE TABLE IF NOT EXISTS interview_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name TEXT NOT NULL,
    description TEXT,
    interview_type TEXT NOT NULL CHECK (interview_type IN ('behavioral', 'technical', 'mixed', 'cultural_fit')),
    
    -- Template content
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    agenda JSONB DEFAULT '[]'::jsonb,
    question_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Configuration
    requires_code_editor BOOLEAN DEFAULT false,
    requires_screen_share BOOLEAN DEFAULT false,
    recording_required BOOLEAN DEFAULT true,
    
    -- Evaluation criteria
    evaluation_criteria JSONB DEFAULT '{}'::jsonb,
    
    -- Usage
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    times_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON interview_templates(interview_type);
CREATE INDEX idx_templates_public ON interview_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_templates_creator ON interview_templates(created_by_user_id);

-- ==========================================
-- Functions: Interview Management
-- ==========================================

-- Function: Get upcoming interviews for user
CREATE OR REPLACE FUNCTION get_upcoming_interviews(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    interview_type TEXT,
    status TEXT,
    participant_role TEXT,
    other_participant_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.title,
        i.scheduled_at,
        i.duration_minutes,
        i.interview_type,
        i.status,
        CASE 
            WHEN i.client_user_id = p_user_id THEN 'client'
            WHEN i.developer_user_id = p_user_id THEN 'developer'
            ELSE 'participant'
        END as participant_role,
        CASE 
            WHEN i.client_user_id = p_user_id THEN (SELECT name FROM profiles WHERE user_id = i.developer_user_id)
            ELSE (SELECT name FROM profiles WHERE user_id = i.client_user_id)
        END as other_participant_name
    FROM interviews i
    WHERE (i.client_user_id = p_user_id OR i.developer_user_id = p_user_id)
        AND i.status IN ('scheduled', 'in_progress')
        AND i.scheduled_at > NOW()
    ORDER BY i.scheduled_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get interview statistics
CREATE OR REPLACE FUNCTION get_interview_statistics(
    p_user_id UUID,
    p_role TEXT DEFAULT 'all' -- 'client', 'developer', or 'all'
)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_interviews', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'no_show', COUNT(*) FILTER (WHERE status = 'no_show'),
        'avg_duration_minutes', AVG(actual_duration_minutes) FILTER (WHERE status = 'completed'),
        'avg_rating', (
            SELECT AVG(overall_rating)
            FROM interview_evaluations ie
            WHERE ie.interview_id IN (
                SELECT id FROM interviews 
                WHERE (client_user_id = p_user_id OR developer_user_id = p_user_id)
            )
        )
    ) INTO v_stats
    FROM interviews
    WHERE (
        CASE p_role
            WHEN 'client' THEN client_user_id = p_user_id
            WHEN 'developer' THEN developer_user_id = p_user_id
            ELSE (client_user_id = p_user_id OR developer_user_id = p_user_id)
        END
    );
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check interview conflicts
CREATE OR REPLACE FUNCTION check_interview_conflicts(
    p_user_id UUID,
    p_scheduled_at TIMESTAMP WITH TIME ZONE,
    p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_conflict_count
    FROM interviews
    WHERE (client_user_id = p_user_id OR developer_user_id = p_user_id)
        AND status IN ('scheduled', 'in_progress')
        AND (
            (scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval) OVERLAPS
            (p_scheduled_at, p_scheduled_at + (p_duration_minutes || ' minutes')::interval)
        );
    
    RETURN v_conflict_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate room tokens (placeholder - implement with Twilio API)
CREATE OR REPLACE FUNCTION generate_interview_room_tokens(
    p_interview_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_interview RECORD;
    v_room_name TEXT;
BEGIN
    SELECT * INTO v_interview FROM interviews WHERE id = p_interview_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Interview not found';
    END IF;
    
    -- Generate unique room name
    v_room_name := 'interview-' || p_interview_id::text;
    
    -- Update interview with room name
    UPDATE interviews 
    SET room_name = v_room_name,
        updated_at = NOW()
    WHERE id = p_interview_id;
    
    -- Return placeholders (actual tokens should be generated via Twilio API)
    RETURN jsonb_build_object(
        'room_name', v_room_name,
        'client_token', 'TWILIO_TOKEN_CLIENT_' || gen_random_uuid()::text,
        'developer_token', 'TWILIO_TOKEN_DEVELOPER_' || gen_random_uuid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Triggers: Automatic timestamp updates
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_sessions_updated_at BEFORE UPDATE ON code_editor_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON interview_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON interview_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON interview_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON interview_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON interview_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Row Level Security Policies
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_editor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_question_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_templates ENABLE ROW LEVEL SECURITY;

-- Interviews: Users can view interviews they're part of
CREATE POLICY interviews_select_policy ON interviews
    FOR SELECT USING (
        auth.uid() = client_user_id 
        OR auth.uid() = developer_user_id
        OR EXISTS (
            SELECT 1 FROM interview_participants 
            WHERE interview_id = interviews.id AND user_id = auth.uid()
        )
    );

-- Interviews: Clients can create interviews
CREATE POLICY interviews_insert_policy ON interviews
    FOR INSERT WITH CHECK (auth.uid() = client_user_id);

-- Interviews: Participants can update their interviews
CREATE POLICY interviews_update_policy ON interviews
    FOR UPDATE USING (
        auth.uid() = client_user_id 
        OR auth.uid() = developer_user_id
    );

-- Interview participants: View if part of interview
CREATE POLICY participants_select_policy ON interview_participants
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM interviews 
            WHERE id = interview_participants.interview_id 
            AND (client_user_id = auth.uid() OR developer_user_id = auth.uid())
        )
    );

-- Code sessions: Access if part of interview
CREATE POLICY code_sessions_policy ON code_editor_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM interviews 
            WHERE id = code_editor_sessions.interview_id 
            AND (client_user_id = auth.uid() OR developer_user_id = auth.uid())
        )
    );

-- Evaluations: Evaluators can CRUD their own evaluations
CREATE POLICY evaluations_policy ON interview_evaluations
    FOR ALL USING (
        evaluator_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM interviews 
            WHERE id = interview_evaluations.interview_id 
            AND client_user_id = auth.uid()
        )
    );

-- Notes: Authors can CRUD their own notes, others can view non-private notes
CREATE POLICY notes_select_policy ON interview_notes
    FOR SELECT USING (
        author_user_id = auth.uid()
        OR (
            is_private = false
            AND EXISTS (
                SELECT 1 FROM interviews 
                WHERE id = interview_notes.interview_id 
                AND (client_user_id = auth.uid() OR developer_user_id = auth.uid())
            )
        )
    );

CREATE POLICY notes_insert_policy ON interview_notes
    FOR INSERT WITH CHECK (author_user_id = auth.uid());

CREATE POLICY notes_update_delete_policy ON interview_notes
    FOR ALL USING (author_user_id = auth.uid());

-- Recordings: Access if part of interview and consent obtained
CREATE POLICY recordings_policy ON interview_recordings
    FOR SELECT USING (
        consent_obtained = true
        AND EXISTS (
            SELECT 1 FROM interviews 
            WHERE id = interview_recordings.interview_id 
            AND (client_user_id = auth.uid() OR developer_user_id = auth.uid())
        )
    );

-- Questions: View public questions or own created questions
CREATE POLICY questions_select_policy ON interview_questions
    FOR SELECT USING (
        is_public = true 
        OR created_by_user_id = auth.uid()
    );

CREATE POLICY questions_insert_update_delete_policy ON interview_questions
    FOR ALL USING (created_by_user_id = auth.uid());

-- Templates: View public templates or own templates
CREATE POLICY templates_select_policy ON interview_templates
    FOR SELECT USING (
        is_public = true 
        OR created_by_user_id = auth.uid()
    );

CREATE POLICY templates_insert_update_delete_policy ON interview_templates
    FOR ALL USING (created_by_user_id = auth.uid());

-- ==========================================
-- Sample Data (Optional)
-- ==========================================

-- Insert sample interview questions
INSERT INTO interview_questions (title, description, question_type, difficulty, skills, starter_code, test_cases) VALUES
(
    'Two Sum',
    'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    'coding',
    'easy',
    ARRAY['algorithms', 'arrays', 'hash-tables'],
    '{"javascript": "function twoSum(nums, target) {\n  // Your code here\n}", "python": "def two_sum(nums, target):\n    # Your code here\n    pass"}'::jsonb,
    '[{"input": {"nums": [2,7,11,15], "target": 9}, "output": [0,1]}, {"input": {"nums": [3,2,4], "target": 6}, "output": [1,2]}]'::jsonb
),
(
    'Design a URL Shortener',
    'Design a URL shortening service like bit.ly. Discuss the system architecture, database schema, and scaling considerations.',
    'system_design',
    'medium',
    ARRAY['system-design', 'databases', 'scalability'],
    '{}'::jsonb,
    '[]'::jsonb
),
(
    'Tell me about a challenging project',
    'Describe a technically challenging project you worked on. What made it challenging and how did you overcome those challenges?',
    'behavioral',
    'medium',
    ARRAY['communication', 'problem-solving'],
    '{}'::jsonb,
    '[]'::jsonb
);

-- Insert sample interview template
INSERT INTO interview_templates (name, description, interview_type, duration_minutes, requires_code_editor, agenda) VALUES
(
    'Standard Technical Interview',
    'A comprehensive 60-minute technical interview covering algorithms, system design, and coding skills.',
    'technical',
    60,
    true,
    '[
        {"time": 5, "activity": "Introduction and ice breaker"},
        {"time": 15, "activity": "Coding problem 1 - Easy"},
        {"time": 20, "activity": "Coding problem 2 - Medium"},
        {"time": 15, "activity": "System design discussion"},
        {"time": 5, "activity": "Q&A and closing"}
    ]'::jsonb
);

COMMENT ON TABLE interviews IS 'Core interview records with scheduling and video call information';
COMMENT ON TABLE code_editor_sessions IS 'Collaborative code editing sessions during interviews';
COMMENT ON TABLE interview_evaluations IS 'Structured evaluations and feedback from interviewers';
COMMENT ON TABLE interview_notes IS 'Real-time notes taken during interviews';
COMMENT ON TABLE interview_recordings IS 'Video/audio recording metadata and storage';
COMMENT ON TABLE interview_questions IS 'Question bank for technical and behavioral interviews';
COMMENT ON TABLE interview_templates IS 'Reusable interview templates and structures';
