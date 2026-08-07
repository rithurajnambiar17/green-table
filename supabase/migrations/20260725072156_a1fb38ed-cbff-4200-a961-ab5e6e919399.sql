
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS mini_snooker_rate numeric NOT NULL DEFAULT 200;
UPDATE public.settings SET snooker_rate = 250, mini_snooker_rate = 200, pool_rate = 150 WHERE id = 1;

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  track_stock boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_read_auth" ON public.inventory_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_insert_admin" ON public.inventory_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "inventory_update_stock_or_admin" ON public.inventory_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inventory_delete_admin" ON public.inventory_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.inventory_items (name, category, price, stock, sort_order)
SELECT * FROM (VALUES
  ('Tea','beverage',80::numeric,100,1),
  ('Coffee','beverage',120::numeric,80,2),
  ('Cigarette','tobacco',30::numeric,200,3),
  ('Soft Drink','beverage',120::numeric,60,4),
  ('Snacks','food',150::numeric,50,5)
) AS v(name, category, price, stock, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items);
