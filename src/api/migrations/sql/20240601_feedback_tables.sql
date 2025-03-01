-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NULL,
    type TEXT NOT NULL,
    context TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ratings JSONB,
    message TEXT,
    survey_responses JSONB,
    metadata JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS public.surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    context TEXT NOT NULL,
    questions JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Create feature engagement table for analytics
CREATE TABLE IF NOT EXISTS public.feature_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_id TEXT NOT NULL,
    context TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_type_idx ON public.feedback(type);
CREATE INDEX IF NOT EXISTS feedback_context_idx ON public.feedback(context);
CREATE INDEX IF NOT EXISTS feedback_timestamp_idx ON public.feedback(timestamp);
CREATE INDEX IF NOT EXISTS surveys_is_active_idx ON public.surveys(is_active);
CREATE INDEX IF NOT EXISTS feature_engagement_user_id_idx ON public.feature_engagement(user_id);
CREATE INDEX IF NOT EXISTS feature_engagement_feature_id_idx ON public.feature_engagement(feature_id);
CREATE INDEX IF NOT EXISTS feature_engagement_timestamp_idx ON public.feature_engagement(timestamp);

-- Add RLS policies
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_engagement ENABLE ROW LEVEL SECURITY;

-- Users can only read and insert their own feedback
CREATE POLICY feedback_select_policy ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY feedback_insert_policy ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add a new policy to allow insertion of feedback with null user_id
CREATE POLICY feedback_insert_null_policy ON public.feedback
    FOR INSERT WITH CHECK (user_id IS NULL);

-- Add a policy to allow authenticated users to insert anonymous feedback
CREATE POLICY feedback_insert_anonymous_policy ON public.feedback
    FOR INSERT WITH CHECK (user_id = 'anonymous' AND auth.uid() IS NOT NULL);

-- Everyone can read active surveys
CREATE POLICY surveys_select_policy ON public.surveys
    FOR SELECT USING (is_active = TRUE);

-- Only authenticated users can insert feature engagement data
CREATE POLICY feature_engagement_insert_policy ON public.feature_engagement
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only read their own feature engagement data
CREATE POLICY feature_engagement_select_policy ON public.feature_engagement
    FOR SELECT USING (auth.uid() = user_id);

-- Insert default surveys
INSERT INTO public.surveys (id, title, description, context, questions, is_active, created_at)
VALUES 
(
    'ai-recommendation-survey',
    'AI Recommendation Feedback',
    'Help us improve Buzo''s financial advice',
    'ai_recommendation',
    '[
        {
            "id": "relevance",
            "text": "How relevant was this advice to your financial situation?",
            "type": "rating"
        },
        {
            "id": "clarity",
            "text": "How clear and easy to understand was the advice?",
            "type": "rating"
        },
        {
            "id": "actionability",
            "text": "How actionable was this advice?",
            "type": "rating"
        },
        {
            "id": "improvement",
            "text": "How could we improve this recommendation?",
            "type": "text"
        }
    ]'::jsonb,
    TRUE,
    NOW()
),
(
    'app-experience-survey',
    'App Experience Feedback',
    'Tell us about your experience with Buzo',
    'general',
    '[
        {
            "id": "ease-of-use",
            "text": "How easy is Buzo to use?",
            "type": "rating"
        },
        {
            "id": "most-useful",
            "text": "Which feature do you find most useful?",
            "type": "multiple_choice",
            "options": ["Budget Tracking", "Expense Management", "Savings Goals", "AI Financial Advice", "Reports & Insights"]
        },
        {
            "id": "missing-features",
            "text": "What features would you like to see added to Buzo?",
            "type": "text"
        },
        {
            "id": "recommendation",
            "text": "How likely are you to recommend Buzo to a friend?",
            "type": "rating"
        }
    ]'::jsonb,
    TRUE,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create a function to submit feedback that bypasses RLS
CREATE OR REPLACE FUNCTION public.submit_feedback(feedback_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Insert the feedback and return the inserted row
    INSERT INTO public.feedback (
        id, 
        user_id, 
        type, 
        context, 
        timestamp, 
        ratings, 
        message, 
        survey_responses, 
        metadata, 
        status
    )
    VALUES (
        COALESCE(feedback_data->>'id', uuid_generate_v4()::text)::uuid,
        CASE 
            WHEN feedback_data->>'user_id' = 'anonymous' THEN NULL
            ELSE (feedback_data->>'user_id')::uuid
        END,
        feedback_data->>'type',
        feedback_data->>'context',
        COALESCE((feedback_data->>'timestamp')::timestamptz, NOW()),
        feedback_data->'ratings',
        feedback_data->>'message',
        feedback_data->'survey_responses',
        feedback_data->'metadata',
        COALESCE(feedback_data->>'status', 'pending')
    )
    RETURNING to_jsonb(feedback.*) INTO result;
    
    RETURN result;
END;
$$; 