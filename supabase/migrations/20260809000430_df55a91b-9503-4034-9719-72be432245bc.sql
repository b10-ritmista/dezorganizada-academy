CREATE OR REPLACE FUNCTION public.is_enrolled(_instrument_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE instrument_id = _instrument_id AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_lesson_video(_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
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