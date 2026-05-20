-- Restaurant printer fleet: multiple printers, category routing, print job log

CREATE TABLE public.outlet_print_settings (
  outlet_id UUID PRIMARY KEY REFERENCES public.outlets(id) ON DELETE CASCADE,
  category_routing_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_cut BOOLEAN NOT NULL DEFAULT true,
  consolidated_dine_in BOOLEAN NOT NULL DEFAULT false,
  min_auto_print_amount NUMERIC NOT NULL DEFAULT 0,
  default_billing_printer_id UUID,
  default_kitchen_printer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  printer_type TEXT NOT NULL CHECK (
    printer_type IN ('billing', 'kitchen', 'bar', 'dessert', 'packing')
  ),
  connection_type TEXT NOT NULL CHECK (
    connection_type IN ('network', 'bluetooth', 'usb', 'browser')
  ),
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_print BOOLEAN NOT NULL DEFAULT true,
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1 AND copies <= 5),
  network_host TEXT NOT NULL DEFAULT '',
  network_port INTEGER NOT NULL DEFAULT 9100,
  bluetooth_address TEXT NOT NULL DEFAULT '',
  usb_port_index INTEGER,
  baud_rate INTEGER NOT NULL DEFAULT 9600,
  print_mode TEXT NOT NULL DEFAULT 'serial' CHECK (print_mode IN ('serial', 'browser')),
  layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX printers_outlet_idx ON public.printers (outlet_id);
CREATE INDEX printers_outlet_type_idx ON public.printers (outlet_id, printer_type);

ALTER TABLE public.outlet_print_settings
  ADD CONSTRAINT outlet_print_settings_default_billing_fkey
  FOREIGN KEY (default_billing_printer_id) REFERENCES public.printers(id) ON DELETE SET NULL;

ALTER TABLE public.outlet_print_settings
  ADD CONSTRAINT outlet_print_settings_default_kitchen_fkey
  FOREIGN KEY (default_kitchen_printer_id) REFERENCES public.printers(id) ON DELETE SET NULL;

CREATE TABLE public.category_printer_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  printer_id UUID NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, category_id)
);

CREATE INDEX category_printer_mappings_outlet_idx ON public.category_printer_mappings (outlet_id);

CREATE TABLE public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  order_id UUID,
  job_type TEXT NOT NULL CHECK (
    job_type IN (
      'kot', 'kot_cancel', 'kot_delta',
      'bill', 'handoff', 'customer_token'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'printing', 'done', 'failed')
  ),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  device_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  printed_at TIMESTAMPTZ
);

CREATE INDEX print_jobs_outlet_created_idx ON public.print_jobs (outlet_id, created_at DESC);
CREATE INDEX print_jobs_outlet_status_idx ON public.print_jobs (outlet_id, status);

ALTER TABLE public.outlet_print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_printer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outlet_print_settings_owner_all"
  ON public.outlet_print_settings FOR ALL
  USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
  WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()));

CREATE POLICY "printers_owner_all"
  ON public.printers FOR ALL
  USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
  WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()));

CREATE POLICY "category_printer_mappings_owner_all"
  ON public.category_printer_mappings FOR ALL
  USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
  WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()));

CREATE POLICY "print_jobs_owner_all"
  ON public.print_jobs FOR ALL
  USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
  WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()));

CREATE TRIGGER update_outlet_print_settings_updated_at
  BEFORE UPDATE ON public.outlet_print_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_printers_updated_at
  BEFORE UPDATE ON public.printers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
