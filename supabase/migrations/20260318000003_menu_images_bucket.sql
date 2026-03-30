-- Storage bucket for menu item photos (public read, 5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images', 'menu-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view menu images (they're public)
DROP POLICY IF EXISTS "menu_images_public_read" ON storage.objects;
CREATE POLICY "menu_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Only the folder owner can upload
DROP POLICY IF EXISTS "menu_images_owner_insert" ON storage.objects;
CREATE POLICY "menu_images_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "menu_images_owner_update" ON storage.objects;
CREATE POLICY "menu_images_owner_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "menu_images_owner_delete" ON storage.objects;
CREATE POLICY "menu_images_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND auth.uid()::text = (storage.foldername(name))[1]);
