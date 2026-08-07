-- Add notes column to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS notes text;
