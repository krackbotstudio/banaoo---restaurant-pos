-- Drop existing permissive UPDATE and DELETE policies
DROP POLICY IF EXISTS "Users can update their own menu images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own menu images" ON storage.objects;

-- Create new UPDATE policy with ownership check
-- Files should be stored in folders like: {user_id}/{filename}
CREATE POLICY "Users can update their own menu images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'menu-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create new DELETE policy with ownership check
CREATE POLICY "Users can delete their own menu images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'menu-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );