CREATE OR REPLACE FUNCTION public.check_email_exists(email_in text)
RETURNS TABLE(existe boolean, nombre_completo text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT true, p.nombre_completo
  FROM public.perfiles p
  WHERE p.email = email_in AND p.activo = true
  LIMIT 1;
END;
$$;

GRANT ALL ON FUNCTION public.check_email_exists(text) TO anon, authenticated, service_role;