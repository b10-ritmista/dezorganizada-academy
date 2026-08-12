-- 1) link submissions to profiles so admin listing can show student names
ALTER TABLE public.lesson_submissions
  ADD CONSTRAINT lesson_submissions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2) admins can read all profiles
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) admins manage roles
CREATE POLICY user_roles_select_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- 4) certificate templates
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES public.instruments(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  name_x numeric NOT NULL DEFAULT 50,
  name_y numeric NOT NULL DEFAULT 50,
  name_size numeric NOT NULL DEFAULT 5,
  name_color text NOT NULL DEFAULT '#111111',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX certificate_templates_instrument_key
  ON public.certificate_templates (COALESCE(instrument_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificate_templates_read ON public.certificate_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY certificate_templates_write_admin ON public.certificate_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) storage policies for certificate template images
CREATE POLICY "certificate templates read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificate-templates');
CREATE POLICY "certificate templates admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificate-templates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "certificate templates admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificate-templates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "certificate templates admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificate-templates' AND public.has_role(auth.uid(), 'admin'));

-- 6) student chat
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_read ON public.chat_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY chat_messages_insert_own ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY chat_messages_delete_own_or_admin ON public.chat_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX chat_messages_created_at_idx ON public.chat_messages (created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;