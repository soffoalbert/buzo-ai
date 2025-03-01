-- Education Categories Table
CREATE TABLE IF NOT EXISTS "public"."education_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "order" INT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Education Articles Table
CREATE TABLE IF NOT EXISTS "public"."education_articles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "category_id" UUID REFERENCES "public"."education_categories"("id"),
    "image_url" TEXT,
    "read_time" TEXT NOT NULL,
    "content" TEXT,
    "video_url" TEXT,
    "is_featured" BOOLEAN DEFAULT FALSE,
    "has_quiz" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Education Quizzes Table
CREATE TABLE IF NOT EXISTS "public"."education_quizzes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "article_id" UUID REFERENCES "public"."education_articles"("id") NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Education Quiz Questions Table
CREATE TABLE IF NOT EXISTS "public"."education_quiz_questions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quiz_id" UUID REFERENCES "public"."education_quizzes"("id") NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB NOT NULL, -- JSON array of option strings
    "correct_option" INT NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Education Progress Table
CREATE TABLE IF NOT EXISTS "public"."user_education_progress" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "completed_articles" JSONB DEFAULT '[]'::jsonb, -- Array of article IDs
    "quiz_scores" JSONB DEFAULT '{}'::jsonb, -- Object with article ID keys and score objects
    "last_accessed_article" TEXT,
    "favorite_articles" JSONB DEFAULT '[]'::jsonb, -- Array of article IDs
    "completed_categories" JSONB DEFAULT '[]'::jsonb, -- Array of category IDs
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE ("user_id")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS education_articles_category_idx ON "public"."education_articles" ("category");
CREATE INDEX IF NOT EXISTS education_articles_category_id_idx ON "public"."education_articles" ("category_id");
CREATE INDEX IF NOT EXISTS education_quizzes_article_id_idx ON "public"."education_quizzes" ("article_id");
CREATE INDEX IF NOT EXISTS education_quiz_questions_quiz_id_idx ON "public"."education_quiz_questions" ("quiz_id");
CREATE INDEX IF NOT EXISTS user_education_progress_user_id_idx ON "public"."user_education_progress" ("user_id");

-- Add RLS (Row Level Security) policies
-- For categories and articles, allow public read-only access
ALTER TABLE "public"."education_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."education_articles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."education_quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."education_quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_education_progress" ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Everyone can read education content
CREATE POLICY "Allow public read access to education categories" 
ON "public"."education_categories" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to education articles" 
ON "public"."education_articles" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to education quizzes" 
ON "public"."education_quizzes" FOR SELECT USING (true);

CREATE POLICY "Allow public read access to education quiz questions" 
ON "public"."education_quiz_questions" FOR SELECT USING (true);

-- Users can only read and update their own progress
CREATE POLICY "Allow users to read their own progress" 
ON "public"."user_education_progress" FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own progress" 
ON "public"."user_education_progress" FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own progress" 
ON "public"."user_education_progress" FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add functions to update timestamps automatically
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_education_categories_updated_at
BEFORE UPDATE ON "public"."education_categories"
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_education_articles_updated_at
BEFORE UPDATE ON "public"."education_articles"
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_education_quizzes_updated_at
BEFORE UPDATE ON "public"."education_quizzes"
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_education_quiz_questions_updated_at
BEFORE UPDATE ON "public"."education_quiz_questions"
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_user_education_progress_updated_at
BEFORE UPDATE ON "public"."user_education_progress"
FOR EACH ROW EXECUTE FUNCTION update_modified_column();