-- Create expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  category text NOT NULL CHECK (category IN ('cafe', 'table')),
  description text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_created_at_idx ON public.expenses(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_auth_all" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add category to session_extras
ALTER TABLE public.session_extras ADD COLUMN category text NOT NULL DEFAULT 'cafe';

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
