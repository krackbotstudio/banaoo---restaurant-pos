-- Create saved_menus table for storing user menus
CREATE TABLE public.saved_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  restaurant_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT '₹',
  menu_data JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.saved_menus ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own menus
CREATE POLICY "Users can manage their own menus"
  ON public.saved_menus FOR ALL
  USING (auth.uid() = user_id);

-- Policy: Anyone can view published menus
CREATE POLICY "Anyone can view published menus"
  ON public.saved_menus FOR SELECT
  USING (is_published = true);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_menus_updated_at
  BEFORE UPDATE ON public.saved_menus
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for menu images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('menu-images', 'menu-images', true);

-- Storage policies
CREATE POLICY "Public read access for menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can upload menu images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own menu images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own menu images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');