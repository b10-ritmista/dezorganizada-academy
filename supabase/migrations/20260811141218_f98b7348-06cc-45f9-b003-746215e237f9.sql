CREATE POLICY "submissions_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "submissions_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "submissions_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));