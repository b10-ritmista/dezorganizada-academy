DROP POLICY IF EXISTS chat_messages_read ON public.chat_messages;
CREATE POLICY chat_messages_read_members ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'student') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "certificate templates read authenticated" ON storage.objects;
CREATE POLICY "certificate templates read owner or admin" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'certificate-templates' AND (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.certificate_templates t
      JOIN public.certificates c ON c.user_id = auth.uid()
        AND (t.instrument_id IS NULL OR t.instrument_id = c.instrument_id)
      WHERE t.image_path = storage.objects.name
    )
  )
);