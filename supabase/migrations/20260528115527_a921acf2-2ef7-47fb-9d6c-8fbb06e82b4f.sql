
-- Roles enum + user_roles + has_role
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Staff',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_admin_select_all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default staff role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tables
CREATE TABLE public.club_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('snooker', 'pool')),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_tables TO authenticated;
GRANT ALL ON public.club_tables TO service_role;
ALTER TABLE public.club_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tables_select_auth" ON public.club_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "tables_admin_manage" ON public.club_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  visits int NOT NULL DEFAULT 0,
  last_visit timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_auth_all" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sessions
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.club_tables(id) ON DELETE RESTRICT,
  table_name text NOT NULL,
  table_type text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  accumulated_ms bigint NOT NULL DEFAULT 0,
  run_started_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','ended')),
  hourly_rate numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  manual_adjustment numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  extras_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment text NOT NULL DEFAULT 'unpaid' CHECK (payment IN ('paid','unpaid')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_started_at_idx ON public.sessions(started_at DESC);
CREATE INDEX sessions_status_idx ON public.sessions(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_auth_all" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Session extras (tea, cigarette, etc.)
CREATE TABLE public.session_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL,
  qty int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_extras_session_id_idx ON public.session_extras(session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_extras TO authenticated;
GRANT ALL ON public.session_extras TO service_role;
ALTER TABLE public.session_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extras_auth_all" ON public.session_extras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings singleton
CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  club_name text NOT NULL DEFAULT 'Green Table',
  currency text NOT NULL DEFAULT 'PKR',
  snooker_rate numeric NOT NULL DEFAULT 600,
  pool_rate numeric NOT NULL DEFAULT 400,
  tax_rate numeric NOT NULL DEFAULT 5,
  country_code text NOT NULL DEFAULT '+92',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_update" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "settings_admin_insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO public.club_tables (name, type, sort_order) VALUES
  ('Royal Snooker 1', 'snooker', 1),
  ('Royal Snooker 2', 'snooker', 2),
  ('Mini Pool 1', 'pool', 3),
  ('Mini Pool 2', 'pool', 4),
  ('Mini Pool 3', 'pool', 5);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_extras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
