CREATE POLICY "lesson_videos_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos');
CREATE POLICY "lesson_videos_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "lesson_videos_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "lesson_videos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(),'admin'));