-- Add Udhari (Credit) support to customers
ALTER TABLE customers
ADD COLUMN allow_credit BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN balance NUMERIC NOT NULL DEFAULT 0;

-- Create Customer Transactions table for Ledger (Khatabook)
CREATE TABLE customer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('given', 'received')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS for customer_transactions
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to customer_transactions"
    ON customer_transactions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
