-- =============================================
-- Tabla: recien_nacidos_temporales
-- Módulo independiente para registros temporales de RN
-- =============================================

CREATE TABLE IF NOT EXISTS public.recien_nacidos_temporales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cod_temporal TEXT UNIQUE NOT NULL,
    fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    nombre_rn TEXT NOT NULL,
    fecha_nacimiento DATE,
    tipo_doc_mama TEXT,
    num_doc_mama BIGINT,
    nombre_mama TEXT,
    establecimiento TEXT,
    tipo_doc_papa TEXT,
    num_doc_papa BIGINT,
    tipo_seguro_papa TEXT,
    estado_temporal TEXT DEFAULT 'ACTIVO',
    creado_por UUID REFERENCES auth.users(id),
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- Comentarios descriptivos
COMMENT ON TABLE public.recien_nacidos_temporales IS 'Registros temporales de recién nacidos, importados desde Excel o ingresados manualmente';
COMMENT ON COLUMN public.recien_nacidos_temporales.cod_temporal IS 'Código temporal único del recién nacido';
COMMENT ON COLUMN public.recien_nacidos_temporales.num_doc_mama IS 'Número de documento de la madre (formato numérico)';
COMMENT ON COLUMN public.recien_nacidos_temporales.num_doc_papa IS 'Número de documento del padre (formato numérico)';

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_rn_cod_temporal ON public.recien_nacidos_temporales (cod_temporal);
CREATE INDEX IF NOT EXISTS idx_rn_num_doc_mama ON public.recien_nacidos_temporales (num_doc_mama);
CREATE INDEX IF NOT EXISTS idx_rn_estado ON public.recien_nacidos_temporales (estado_temporal);
CREATE INDEX IF NOT EXISTS idx_rn_fecha_registro ON public.recien_nacidos_temporales (fecha_registro);

-- Habilitar RLS
ALTER TABLE public.recien_nacidos_temporales ENABLE ROW LEVEL SECURITY;

-- Política: Lectura pública (anon + authenticated) para consultas sin login
DO $$ BEGIN
    CREATE POLICY "Lectura publica de recien nacidos"
        ON public.recien_nacidos_temporales
        FOR SELECT
        TO anon, authenticated
        USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Política: Inserción para usuarios autenticados
DO $$ BEGIN
    CREATE POLICY "Insercion por usuarios autenticados"
        ON public.recien_nacidos_temporales
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Política: Actualización para usuarios autenticados
DO $$ BEGIN
    CREATE POLICY "Actualizacion por usuarios autenticados"
        ON public.recien_nacidos_temporales
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Política: Eliminación para usuarios autenticados
DO $$ BEGIN
    CREATE POLICY "Eliminacion por usuarios autenticados"
        ON public.recien_nacidos_temporales
        FOR DELETE
        TO authenticated
        USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Trigger: Pasar a mayúsculas campos de texto
CREATE OR REPLACE FUNCTION public.uppercase_rn_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.nombre_rn IS NOT NULL THEN NEW.nombre_rn = UPPER(NEW.nombre_rn); END IF;
    IF NEW.nombre_mama IS NOT NULL THEN NEW.nombre_mama = UPPER(NEW.nombre_mama); END IF;
    IF NEW.establecimiento IS NOT NULL THEN NEW.establecimiento = UPPER(NEW.establecimiento); END IF;
    IF NEW.tipo_doc_mama IS NOT NULL THEN NEW.tipo_doc_mama = UPPER(NEW.tipo_doc_mama); END IF;
    IF NEW.tipo_doc_papa IS NOT NULL THEN NEW.tipo_doc_papa = UPPER(NEW.tipo_doc_papa); END IF;
    IF NEW.tipo_seguro_papa IS NOT NULL THEN NEW.tipo_seguro_papa = UPPER(NEW.tipo_seguro_papa); END IF;
    IF NEW.estado_temporal IS NOT NULL THEN NEW.estado_temporal = UPPER(NEW.estado_temporal); END IF;
    IF NEW.cod_temporal IS NOT NULL THEN NEW.cod_temporal = UPPER(NEW.cod_temporal); END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_uppercase_rn ON public.recien_nacidos_temporales;
CREATE TRIGGER trigger_uppercase_rn
    BEFORE INSERT OR UPDATE ON public.recien_nacidos_temporales
    FOR EACH ROW
    EXECUTE FUNCTION public.uppercase_rn_fields();

-- Auditoría (reutiliza la función existente)
DROP TRIGGER IF EXISTS audit_recien_nacidos_temporales ON public.recien_nacidos_temporales;
CREATE TRIGGER audit_recien_nacidos_temporales
    AFTER INSERT OR DELETE OR UPDATE ON public.recien_nacidos_temporales
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_log_changes();
