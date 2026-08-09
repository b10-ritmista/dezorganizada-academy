-- 1. Harden SECURITY DEFINER functions callable by signed-in users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_certificate(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 2. Gate course content by enrollment (admins keep full access)
CREATE OR REPLACE FUNCTION public.is_enrolled(_instrument_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE instrument_id = _instrument_id AND user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_enrolled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS modules_read_auth ON public.modules;
CREATE POLICY modules_read_enrolled ON public.modules
FOR SELECT TO authenticated
USING (public.is_enrolled(instrument_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS lessons_read_auth ON public.lessons;
CREATE POLICY lessons_read_enrolled ON public.lessons
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = lessons.module_id AND public.is_enrolled(m.instrument_id)
  )
);

-- 3. Gate lesson video files by enrollment
CREATE OR REPLACE FUNCTION public.can_read_lesson_video(_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.enrollments e ON e.instrument_id = m.instrument_id AND e.user_id = auth.uid()
    WHERE l.video_path = _path
  );
$function$;

REVOKE ALL ON FUNCTION public.can_read_lesson_video(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_lesson_video(text) TO authenticated, service_role;

DROP POLICY IF EXISTS lesson_videos_read_auth ON storage.objects;
CREATE POLICY lesson_videos_read_enrolled ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'lesson-videos' AND public.can_read_lesson_video(name));