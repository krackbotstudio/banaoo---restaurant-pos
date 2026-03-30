-- Create platform_integrations table to store platform credentials per outlet
CREATE TABLE public.platform_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  credentials JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(outlet_id, platform)
);

-- Add new columns to orders table for platform tracking
ALTER TABLE public.orders
ADD COLUMN source TEXT NOT NULL DEFAULT 'pos',
ADD COLUMN external_order_id TEXT,
ADD COLUMN platform_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN customer_name TEXT,
ADD COLUMN customer_phone TEXT,
ADD COLUMN delivery_address TEXT,
ADD COLUMN delivery_status TEXT;

-- Create platform_sync_logs table for tracking sync history
CREATE TABLE public.platform_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.platform_integrations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for platform_integrations
CREATE POLICY "Outlet owners can manage integrations"
ON public.platform_integrations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM outlets
  WHERE outlets.id = platform_integrations.outlet_id
  AND outlets.owner_id = auth.uid()
));

-- RLS policies for platform_sync_logs
CREATE POLICY "Outlet owners can view sync logs"
ON public.platform_sync_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM platform_integrations pi
  JOIN outlets o ON o.id = pi.outlet_id
  WHERE pi.id = platform_sync_logs.integration_id
  AND o.owner_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_orders_source ON public.orders(source);
CREATE INDEX idx_orders_external_order_id ON public.orders(external_order_id);
CREATE INDEX idx_platform_integrations_outlet ON public.platform_integrations(outlet_id);
CREATE INDEX idx_platform_sync_logs_integration ON public.platform_sync_logs(integration_id);

-- Add trigger for updated_at on platform_integrations
CREATE TRIGGER update_platform_integrations_updated_at
BEFORE UPDATE ON public.platform_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();