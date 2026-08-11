ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS requires_submission boolean NOT NULL DEFAULT false;

CREATE TYPE public.submission_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.lesson_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_path text NOT NULL,
  note text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_submissions TO authenticated;
GRANT ALL ON public.lesson_submissions TO service_role;

ALTER TABLE public.lesson_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_select_own_or_admin" ON public.lesson_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "submissions_insert_own" ON public.lesson_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "submissions_update_own_or_admin" ON public.lesson_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "submissions_delete_own_or_admin" ON public.lesson_submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lesson_submissions_updated_at
  BEFORE UPDATE ON public.lesson_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_submission_video(_path text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.lesson_submissions s
    WHERE s.video_path = _path AND s.user_id = auth.uid()
  );
$$;