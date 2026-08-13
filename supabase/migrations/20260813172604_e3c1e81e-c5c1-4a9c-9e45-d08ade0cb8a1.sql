-- Internal schema (not exposed through the API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- has_role: privileged logic moves to private, public becomes an INVOKER wrapper
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.has_role(_user_id, _role);
$$;

-- handle_new_user: keep trigger reference, move privileged insert into private
CREATE OR REPLACE FUNCTION private.handle_new_user_impl(_id uuid, _full_name text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (_id, _full_name, _email)
  ON CONFLICT (id) DO NOTHING;
  -- new users only ever receive the 'student' role
  INSERT INTO public.user_roles (user_id, role) VALUES (_id, 'student') ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user_impl(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.handle_new_user_impl(uuid, text, text) TO service_role, supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM private.handle_new_user_impl(
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- issue_certificate: privileged insert moves to private, public becomes INVOKER wrapper
CREATE OR REPLACE FUNCTION private.issue_certificate_impl(_instrument_id uuid, _uid uuid)
RETURNS public.certificates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total int;
  _done int;
  _cert public.certificates;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT count(*) INTO _total
  FROM public.lessons l JOIN public.modules m ON m.id = l.module_id
  WHERE m.instrument_id = _instrument_id;

  SELECT count(*) INTO _done
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.lesson_completions c ON c.lesson_id = l.id AND c.user_id = _uid
  WHERE m.instrument_id = _instrument_id;

  IF _total = 0 OR _done < _total THEN
    RAISE EXCEPTION 'etapas incompletas';
  END IF;

  INSERT INTO public.certificates (user_id, instrument_id, code)
  VALUES (_uid, _instrument_id, 'DF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)))
  ON CONFLICT (user_id, instrument_id) DO UPDATE SET issued_at = public.certificates.issued_at
  RETURNING * INTO _cert;

  RETURN _cert;
END;
$$;
REVOKE ALL ON FUNCTION private.issue_certificate_impl(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.issue_certificate_impl(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_certificate(_instrument_id uuid)
RETURNS public.certificates LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.issue_certificate_impl(_instrument_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.issue_certificate(uuid) FROM anon;

-- Server-side validation of lesson completions
CREATE OR REPLACE FUNCTION private.validate_lesson_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _instrument_id uuid;
  _requires boolean;
BEGIN
  SELECT m.instrument_id, l.requires_submission
    INTO _instrument_id, _requires
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  WHERE l.id = NEW.lesson_id;

  IF _instrument_id IS NULL THEN
    RAISE EXCEPTION 'aula inexistente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.instrument_id = _instrument_id AND e.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'matricula necessaria para concluir a aula';
  END IF;

  IF _requires AND NOT EXISTS (
    SELECT 1 FROM public.lesson_submissions s
    WHERE s.lesson_id = NEW.lesson_id AND s.user_id = NEW.user_id AND s.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'envio de video aprovado necessario para concluir a aula';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_lesson_completion() FROM PUBLIC;

DROP TRIGGER IF EXISTS validate_lesson_completion ON public.lesson_completions;
CREATE TRIGGER validate_lesson_completion
BEFORE INSERT OR UPDATE ON public.lesson_completions
FOR EACH ROW EXECUTE FUNCTION private.validate_lesson_completion();