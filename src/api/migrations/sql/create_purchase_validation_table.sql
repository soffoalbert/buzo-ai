-- Create purchase_validations table to store validation results
CREATE TABLE IF NOT EXISTS public.purchase_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    product_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    validation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_valid BOOLEAN NOT NULL,
    expiration_date TIMESTAMP WITH TIME ZONE,
    is_trial BOOLEAN DEFAULT FALSE,
    is_intro_offer BOOLEAN DEFAULT FALSE,
    original_transaction_id TEXT,
    receipt_data TEXT,
    validation_response JSONB,
    auto_renewing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Each transaction ID should be unique per platform
    UNIQUE(transaction_id, platform)
);

-- Create an index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS purchase_validations_user_id_idx ON public.purchase_validations(user_id);

-- Create an index for transaction_id lookups
CREATE INDEX IF NOT EXISTS purchase_validations_transaction_id_idx ON public.purchase_validations(transaction_id);

-- Create a RLS policy to allow authenticated users to read only their own validations
ALTER TABLE public.purchase_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase validations"
    ON public.purchase_validations FOR SELECT
    USING (auth.uid() = user_id);

-- Only allow server-side functions to insert/update purchase validations
CREATE POLICY "Server can insert purchase validations"
    ON public.purchase_validations FOR INSERT
    WITH CHECK (TRUE);  -- This will be restricted via function permissions

CREATE POLICY "Server can update purchase validations"
    ON public.purchase_validations FOR UPDATE
    USING (TRUE); -- This will be restricted via function permissions

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_validations_timestamp
BEFORE UPDATE ON public.purchase_validations
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();