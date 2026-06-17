


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."audit_log_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.auditoria (id_usuario, accion, tabla, detalles)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        jsonb_build_object(
            'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
            'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
        )
    );
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_log_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_evento_hospitalizacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO historial_eventos (
        paciente_id,
        hospitalizacion_id,
        tipo_evento,
        fecha_evento,
        detalle,
        registrado_por
    ) VALUES (
        NEW.paciente_id,
        NEW.id,
        'Hospitalizado',
        NEW.fecha_ingreso,
        'Ingreso al servicio de ' || COALESCE(NEW.servicio, 'No especificado'),
        NEW.creado_por
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_evento_hospitalizacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("email_in" "text") RETURNS TABLE("existe" boolean, "nombre_completo" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT true, p.nombre_completo
  FROM public.perfiles p
  WHERE p.email = email_in AND p.activo = true
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("email_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    role_name text;
BEGIN
    SELECT r.nombre INTO role_name
    FROM public.perfiles p
    JOIN public.roles r ON p.id_rol = r.id_rol
    WHERE p.id_usuario = auth.uid();
    
    RETURN role_name;
END;
$$;


ALTER FUNCTION "public"."get_auth_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_login_info"("username_in" "text") RETURNS TABLE("auth_email" "text", "rol_nombre" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email::TEXT,
    r.nombre::TEXT
  FROM public.perfiles p
  JOIN auth.users u ON p.id_usuario = u.id
  JOIN public.roles r ON p.id_rol = r.id_rol
  WHERE p.nombre_usuario = username_in
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_login_info"("username_in" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sync_user_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.perfiles
  SET email = NEW.email
  WHERE id_usuario = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sync_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revertir_alta"("p_hospitalizacion_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_paciente_id UUID;
    v_ultimo_evento RECORD;
    v_hosp RECORD;
BEGIN
    -- 1. Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
    END IF;

    -- 2. Validar hospitalización
    SELECT * INTO v_hosp FROM hospitalizaciones WHERE id = p_hospitalizacion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Hospitalización no encontrada');
    END IF;
    IF v_hosp.activa THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La hospitalización aún está activa, no requiere reversión');
    END IF;

    v_paciente_id := v_hosp.paciente_id;

    -- 3. Verificar que no haya OTRA hospitalización activa para este paciente
    IF EXISTS (
        SELECT 1 FROM hospitalizaciones
        WHERE paciente_id = v_paciente_id AND activa = true
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El paciente ya tiene una hospitalización activa');
    END IF;

    -- 4. Verificar que el último evento sea Alta (no Fallecido)
    SELECT * INTO v_ultimo_evento
    FROM historial_eventos
    WHERE hospitalizacion_id = p_hospitalizacion_id
    ORDER BY fecha_evento DESC, creado_en DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se encontraron eventos en este registro');
    END IF;

    IF v_ultimo_evento.tipo_evento = 'Fallecido' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No se puede revertir un registro de fallecimiento');
    END IF;

    IF v_ultimo_evento.tipo_evento != 'Alta' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El último evento no es de tipo Alta');
    END IF;

    -- 5. Eliminar evento de Alta
    DELETE FROM historial_eventos WHERE id = v_ultimo_evento.id;

    -- 6. Reabrir hospitalización
    UPDATE hospitalizaciones
    SET activa = true, fecha_alta = NULL, hora_alta = NULL
    WHERE id = p_hospitalizacion_id;

    -- 7. Actualizar condición del paciente
    UPDATE pacientes SET condicion = 'Hospitalizado' WHERE id = v_paciente_id;

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Alta revertida correctamente',
        'paciente_id', v_paciente_id,
        'hospitalizacion_id', p_hospitalizacion_id,
        'revertido_por', auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."revertir_alta"("p_hospitalizacion_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_condicion_paciente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Alta: cerrar hospitalización y actualizar condición
    IF NEW.tipo_evento = 'Alta' THEN
        UPDATE pacientes SET condicion = 'Alta' WHERE id = NEW.paciente_id;
        UPDATE hospitalizaciones
          SET activa = false, fecha_alta = NEW.fecha_evento
          WHERE id = NEW.hospitalizacion_id;

    -- Fallecido: cerrar hospitalización y bloquear paciente
    ELSIF NEW.tipo_evento = 'Fallecido' THEN
        UPDATE pacientes SET condicion = 'Fallecido' WHERE id = NEW.paciente_id;
        UPDATE hospitalizaciones
          SET activa = false, fecha_alta = NEW.fecha_evento
          WHERE id = NEW.hospitalizacion_id;

    -- Cambio Cobertura: actualizar seguro del paciente
    ELSIF NEW.tipo_evento = 'Cambio Cobertura' THEN
        IF NEW.nuevo_seguro IS NOT NULL THEN
            UPDATE pacientes
            SET tipo_seguro = UPPER(NEW.nuevo_seguro),
                seguro_otros = NEW.nuevo_seguro_otros
            WHERE id = NEW.paciente_id;
        END IF;

    -- Cambio de Servicio: actualizar servicio del paciente y de la hospitalización
    ELSIF NEW.tipo_evento = 'Cambio de Servicio' THEN
        IF NEW.detalle IS NOT NULL AND NEW.detalle != '' THEN
            UPDATE pacientes
            SET servicio = UPPER(NEW.detalle)
            WHERE id = NEW.paciente_id;
            UPDATE hospitalizaciones
            SET servicio = UPPER(NEW.detalle)
            WHERE id = NEW.hospitalizacion_id;
        END IF;

    -- Hospitalizado: actualizar condición (para re-hospitalizaciones)
    ELSIF NEW.tipo_evento = 'Hospitalizado' THEN
        UPDATE pacientes SET condicion = 'Hospitalizado' WHERE id = NEW.paciente_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_condicion_paciente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fecha_actualizacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fecha_actualizacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uppercase_rn_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."uppercase_rn_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."uppercase_text_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'pacientes' THEN
        IF NEW.apellidos IS NOT NULL THEN NEW.apellidos = UPPER(NEW.apellidos); END IF;
        IF NEW.nombres IS NOT NULL THEN NEW.nombres = UPPER(NEW.nombres); END IF;
        IF NEW.tipo_seguro IS NOT NULL THEN NEW.tipo_seguro = UPPER(NEW.tipo_seguro); END IF;
        IF NEW.condicion IS NOT NULL THEN NEW.condicion = UPPER(NEW.condicion); END IF;
        IF NEW.servicio IS NOT NULL THEN NEW.servicio = UPPER(NEW.servicio); END IF;
        IF NEW.seguro_otros IS NOT NULL THEN NEW.seguro_otros = UPPER(NEW.seguro_otros); END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'perfiles' THEN
        IF NEW.nombre_completo IS NOT NULL THEN NEW.nombre_completo = UPPER(NEW.nombre_completo); END IF;
        IF NEW.apellidos IS NOT NULL THEN NEW.apellidos = UPPER(NEW.apellidos); END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."uppercase_text_fields"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auditoria" (
    "id_auditoria" integer NOT NULL,
    "id_usuario" "uuid",
    "accion" "text" NOT NULL,
    "tabla" "text" NOT NULL,
    "detalles" "jsonb",
    "fecha" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auditoria" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."auditoria_id_auditoria_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."auditoria_id_auditoria_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."auditoria_id_auditoria_seq" OWNED BY "public"."auditoria"."id_auditoria";



CREATE TABLE IF NOT EXISTS "public"."checks_diarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "fecha_check" "date" DEFAULT CURRENT_DATE NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checks_diarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultas_datos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dni" "text" NOT NULL,
    "nombres" "text",
    "apellidos" "text",
    "fecha_nacimiento" "date",
    "codigo_verificacion" "text",
    "seguro_validado" "text",
    "estado_consulta" "text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."consultas_datos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_eventos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "tipo_evento" character varying NOT NULL,
    "fecha_evento" "date" NOT NULL,
    "detalle" "text",
    "nuevo_seguro" character varying,
    "nuevo_seguro_otros" "text",
    "registrado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "hospitalizacion_id" "uuid" NOT NULL,
    CONSTRAINT "historial_eventos_tipo_evento_check" CHECK ((("tipo_evento")::"text" = ANY ((ARRAY['Hospitalizado'::character varying, 'Cambio Cobertura'::character varying, 'Cambio de Servicio'::character varying, 'Alta'::character varying, 'Fallecido'::character varying])::"text"[])))
);


ALTER TABLE "public"."historial_eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hospitalizaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "fecha_ingreso" "date",
    "fecha_alta" "date",
    "servicio" "text" NOT NULL,
    "activa" boolean DEFAULT true,
    "creado_por" "uuid",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "numero_registro" integer DEFAULT 1 NOT NULL,
    "hora_ingreso" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "hora_alta" time without time zone
);


ALTER TABLE "public"."hospitalizaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pacientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "dni" character varying(15) NOT NULL,
    "historia_clinica" character varying(20),
    "fecha_nacimiento" "date" NOT NULL,
    "apellidos" character varying(100) NOT NULL,
    "nombres" character varying(100) NOT NULL,
    "tipo_seguro" character varying(50) NOT NULL,
    "codigo_verificacion" character varying(50),
    "servicio" character varying(100),
    "condicion" character varying(50) NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"(),
    "creado_por" "uuid",
    "seguro_otros" "text",
    "seguro_extraido" character varying(100),
    "estado_rpa" character varying(50) DEFAULT 'PENDIENTE'::character varying,
    "ultima_validacion_rpa" timestamp with time zone,
    "tipo_documento" "text" DEFAULT 'DNI'::"text" NOT NULL
);


ALTER TABLE "public"."pacientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id_usuario" "uuid" NOT NULL,
    "nombre_completo" "text",
    "id_rol" integer NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    "fecha_actualizacion" timestamp with time zone DEFAULT "now"(),
    "activo" boolean DEFAULT true NOT NULL,
    "email" "text",
    "nombre_usuario" character varying(50),
    "susalud_usuario" "text",
    "susalud_clave" "text",
    "apellidos" "text"
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."perfiles"."susalud_usuario" IS 'Usuario personal para el portal SUSALUD';



COMMENT ON COLUMN "public"."perfiles"."susalud_clave" IS 'Contraseña personal para el portal SUSALUD';



CREATE TABLE IF NOT EXISTS "public"."recien_nacidos_temporales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cod_temporal" "text" NOT NULL,
    "fecha_registro" "date" DEFAULT CURRENT_DATE NOT NULL,
    "nombre_rn" "text" NOT NULL,
    "fecha_nacimiento" "date",
    "tipo_doc_mama" "text",
    "num_doc_mama" bigint,
    "nombre_mama" "text",
    "establecimiento" "text",
    "tipo_doc_papa" "text",
    "num_doc_papa" bigint,
    "tipo_seguro_papa" "text",
    "estado_temporal" "text" DEFAULT 'ACTIVO'::"text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recien_nacidos_temporales" OWNER TO "postgres";


COMMENT ON TABLE "public"."recien_nacidos_temporales" IS 'Registros temporales de recién nacidos, importados desde Excel o ingresados manualmente';



COMMENT ON COLUMN "public"."recien_nacidos_temporales"."cod_temporal" IS 'Código temporal único del recién nacido';



COMMENT ON COLUMN "public"."recien_nacidos_temporales"."num_doc_mama" IS 'Número de documento de la madre (formato numérico)';



COMMENT ON COLUMN "public"."recien_nacidos_temporales"."num_doc_papa" IS 'Número de documento del padre (formato numérico)';



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id_rol" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_rol_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_rol_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_rol_seq" OWNED BY "public"."roles"."id_rol";



CREATE TABLE IF NOT EXISTS "public"."validaciones_rpa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid",
    "dni" character varying(15) NOT NULL,
    "seguro_declarado" character varying(100),
    "seguro_extraido" character varying(100),
    "estado_validacion" character varying(50) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    "fecha_validacion" timestamp with time zone DEFAULT "now"(),
    "creado_en" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."validaciones_rpa" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auditoria" ALTER COLUMN "id_auditoria" SET DEFAULT "nextval"('"public"."auditoria_id_auditoria_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id_rol" SET DEFAULT "nextval"('"public"."roles_id_rol_seq"'::"regclass");



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id_auditoria");



ALTER TABLE ONLY "public"."checks_diarios"
    ADD CONSTRAINT "checks_diarios_paciente_id_usuario_id_fecha_check_key" UNIQUE ("paciente_id", "usuario_id", "fecha_check");



ALTER TABLE ONLY "public"."checks_diarios"
    ADD CONSTRAINT "checks_diarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultas_datos"
    ADD CONSTRAINT "consultas_datos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_eventos"
    ADD CONSTRAINT "historial_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hospitalizaciones"
    ADD CONSTRAINT "hospitalizaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_dni_key" UNIQUE ("dni");



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id_usuario");



ALTER TABLE ONLY "public"."recien_nacidos_temporales"
    ADD CONSTRAINT "recien_nacidos_temporales_cod_temporal_key" UNIQUE ("cod_temporal");



ALTER TABLE ONLY "public"."recien_nacidos_temporales"
    ADD CONSTRAINT "recien_nacidos_temporales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id_rol");



ALTER TABLE ONLY "public"."hospitalizaciones"
    ADD CONSTRAINT "uq_paciente_numero_registro" UNIQUE ("paciente_id", "numero_registro");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "uq_perfiles_nombre_usuario" UNIQUE ("nombre_usuario");



ALTER TABLE ONLY "public"."validaciones_rpa"
    ADD CONSTRAINT "validaciones_rpa_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_checks_diarios_usuario_fecha" ON "public"."checks_diarios" USING "btree" ("usuario_id", "fecha_check");



CREATE INDEX "idx_historial_eventos_hospitalizacion" ON "public"."historial_eventos" USING "btree" ("hospitalizacion_id");



CREATE INDEX "idx_historial_fecha_evento" ON "public"."historial_eventos" USING "btree" ("fecha_evento");



CREATE INDEX "idx_historial_paciente_id" ON "public"."historial_eventos" USING "btree" ("paciente_id");



CREATE INDEX "idx_hospitalizaciones_paciente" ON "public"."hospitalizaciones" USING "btree" ("paciente_id");



CREATE INDEX "idx_pacientes_apellidos" ON "public"."pacientes" USING "btree" ("apellidos");



CREATE INDEX "idx_pacientes_condicion" ON "public"."pacientes" USING "btree" ("condicion");



CREATE INDEX "idx_pacientes_dni" ON "public"."pacientes" USING "btree" ("dni");



CREATE INDEX "idx_pacientes_estado_rpa" ON "public"."pacientes" USING "btree" ("estado_rpa");



CREATE INDEX "idx_pacientes_hc" ON "public"."pacientes" USING "btree" ("historia_clinica");



CREATE INDEX "idx_pacientes_historia" ON "public"."pacientes" USING "btree" ("historia_clinica");



CREATE INDEX "idx_pacientes_nombres" ON "public"."pacientes" USING "btree" ("nombres");



CREATE INDEX "idx_pacientes_servicio" ON "public"."pacientes" USING "btree" ("servicio");



CREATE INDEX "idx_perfiles_activo" ON "public"."perfiles" USING "btree" ("activo") WHERE ("activo" = true);



CREATE INDEX "idx_rn_cod_temporal" ON "public"."recien_nacidos_temporales" USING "btree" ("cod_temporal");



CREATE INDEX "idx_rn_estado" ON "public"."recien_nacidos_temporales" USING "btree" ("estado_temporal");



CREATE INDEX "idx_rn_fecha_registro" ON "public"."recien_nacidos_temporales" USING "btree" ("fecha_registro");



CREATE INDEX "idx_rn_num_doc_mama" ON "public"."recien_nacidos_temporales" USING "btree" ("num_doc_mama");



CREATE INDEX "idx_validaciones_rpa_dni" ON "public"."validaciones_rpa" USING "btree" ("dni");



CREATE INDEX "idx_validaciones_rpa_fecha" ON "public"."validaciones_rpa" USING "btree" ("fecha_validacion");



CREATE OR REPLACE TRIGGER "audit_historial_eventos" AFTER INSERT OR DELETE OR UPDATE ON "public"."historial_eventos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "audit_hospitalizaciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."hospitalizaciones" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "audit_pacientes" AFTER INSERT OR DELETE OR UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "audit_recien_nacidos_temporales" AFTER INSERT OR DELETE OR UPDATE ON "public"."recien_nacidos_temporales" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_changes"();



CREATE OR REPLACE TRIGGER "tr_update_fecha_actualizacion" BEFORE UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_fecha_actualizacion"();



CREATE OR REPLACE TRIGGER "trg_auto_evento_hospitalizacion" AFTER INSERT ON "public"."hospitalizaciones" FOR EACH ROW EXECUTE FUNCTION "public"."auto_evento_hospitalizacion"();



CREATE OR REPLACE TRIGGER "trg_sync_condicion" AFTER INSERT ON "public"."historial_eventos" FOR EACH ROW EXECUTE FUNCTION "public"."sync_condicion_paciente"();



CREATE OR REPLACE TRIGGER "trigger_uppercase_pacientes" BEFORE INSERT OR UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."uppercase_text_fields"();



CREATE OR REPLACE TRIGGER "trigger_uppercase_perfiles" BEFORE INSERT OR UPDATE ON "public"."perfiles" FOR EACH ROW EXECUTE FUNCTION "public"."uppercase_text_fields"();



CREATE OR REPLACE TRIGGER "trigger_uppercase_rn" BEFORE INSERT OR UPDATE ON "public"."recien_nacidos_temporales" FOR EACH ROW EXECUTE FUNCTION "public"."uppercase_rn_fields"();



ALTER TABLE ONLY "public"."auditoria"
    ADD CONSTRAINT "auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."checks_diarios"
    ADD CONSTRAINT "checks_diarios_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultas_datos"
    ADD CONSTRAINT "consultas_datos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."historial_eventos"
    ADD CONSTRAINT "historial_eventos_hospitalizacion_id_fkey" FOREIGN KEY ("hospitalizacion_id") REFERENCES "public"."hospitalizaciones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historial_eventos"
    ADD CONSTRAINT "historial_eventos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_eventos"
    ADD CONSTRAINT "historial_eventos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hospitalizaciones"
    ADD CONSTRAINT "hospitalizaciones_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hospitalizaciones"
    ADD CONSTRAINT "hospitalizaciones_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."roles"("id_rol");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recien_nacidos_temporales"
    ADD CONSTRAINT "recien_nacidos_temporales_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."validaciones_rpa"
    ADD CONSTRAINT "validaciones_rpa_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE SET NULL;



CREATE POLICY "Actualizacion por usuarios autenticados" ON "public"."recien_nacidos_temporales" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin puede insertar perfiles de usuarios" ON "public"."perfiles" FOR INSERT WITH CHECK ((("public"."get_auth_user_role"() = 'Administrador'::"text") AND ("id_rol" <> ( SELECT "roles"."id_rol"
   FROM "public"."roles"
  WHERE ("roles"."nombre" = 'Desarrollador'::"text")))));



CREATE POLICY "Admin y Desarrollador pueden actualizar cualquier perfil" ON "public"."perfiles" FOR UPDATE USING (("public"."get_auth_user_role"() = ANY (ARRAY['Administrador'::"text", 'Desarrollador'::"text"])));



CREATE POLICY "Admin y Desarrollador pueden leer todos los perfiles" ON "public"."perfiles" FOR SELECT USING (("public"."get_auth_user_role"() = ANY (ARRAY['Administrador'::"text", 'Desarrollador'::"text"])));



CREATE POLICY "Desarrollador puede insertar cualquier perfil" ON "public"."perfiles" FOR INSERT WITH CHECK (("public"."get_auth_user_role"() = 'Desarrollador'::"text"));



CREATE POLICY "Eliminacion por usuarios autenticados" ON "public"."recien_nacidos_temporales" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Insercion por usuarios autenticados" ON "public"."recien_nacidos_temporales" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Lectura publica de recien nacidos" ON "public"."recien_nacidos_temporales" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Los usuarios pueden actualizar su propio nombre" ON "public"."perfiles" FOR UPDATE USING (("auth"."uid"() = "id_usuario")) WITH CHECK (("auth"."uid"() = "id_usuario"));



CREATE POLICY "Los usuarios pueden leer su propio perfil" ON "public"."perfiles" FOR SELECT USING (("auth"."uid"() = "id_usuario"));



CREATE POLICY "Permitir inserción a usuarios autenticados" ON "public"."consultas_datos" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Permitir insert desde servicio" ON "public"."validaciones_rpa" FOR INSERT WITH CHECK (true);



CREATE POLICY "Permitir insert para usuarios autenticados" ON "public"."pacientes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "creado_por"));



CREATE POLICY "Permitir lectura a usuarios autenticados" ON "public"."consultas_datos" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Permitir lectura autenticada" ON "public"."validaciones_rpa" FOR SELECT USING (true);



CREATE POLICY "Permitir lectura de roles a usuarios autenticados" ON "public"."roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Permitir select para usuarios autenticados" ON "public"."pacientes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Personal puede registrar hospitalizaciones" ON "public"."hospitalizaciones" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Solo Desarrolladores pueden leer la auditoría" ON "public"."auditoria" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."perfiles" "p"
     JOIN "public"."roles" "r" ON (("p"."id_rol" = "r"."id_rol")))
  WHERE (("p"."id_usuario" = "auth"."uid"()) AND ("r"."nombre" = 'Desarrollador'::"text")))));



CREATE POLICY "Solo personal autenticado puede actualizar pacientes" ON "public"."pacientes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden crear eventos" ON "public"."historial_eventos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden leer eventos" ON "public"."historial_eventos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios pueden actualizar sus propios checks" ON "public"."checks_diarios" FOR UPDATE USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden actualizar sus propios eventos recientes" ON "public"."historial_eventos" FOR UPDATE TO "authenticated" USING ((("registrado_por" = "auth"."uid"()) AND ("creado_en" > ("now"() - '24:00:00'::interval))));



CREATE POLICY "Usuarios pueden eliminar sus propios checks" ON "public"."checks_diarios" FOR DELETE USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden eliminar sus propios eventos recientes" ON "public"."historial_eventos" FOR DELETE TO "authenticated" USING ((("registrado_por" = "auth"."uid"()) AND ("creado_en" > ("now"() - '24:00:00'::interval))));



CREATE POLICY "Usuarios pueden insertar sus propios checks" ON "public"."checks_diarios" FOR INSERT WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden ver sus propios checks" ON "public"."checks_diarios" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."auditoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checks_diarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultas_datos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historial_eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_eventos_insert_authenticated" ON "public"."historial_eventos" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."hospitalizaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hospitalizaciones_select_authenticated" ON "public"."hospitalizaciones" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "hospitalizaciones_update_authenticated" ON "public"."hospitalizaciones" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."pacientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recien_nacidos_temporales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."validaciones_rpa" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."audit_log_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_log_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_evento_hospitalizacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_evento_hospitalizacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_evento_hospitalizacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_exists"("email_in" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_in" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_auth_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_auth_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_login_info"("username_in" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_login_info"("username_in" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_login_info"("username_in" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_login_info"("username_in" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."handle_sync_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sync_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sync_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revertir_alta"("p_hospitalizacion_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revertir_alta"("p_hospitalizacion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revertir_alta"("p_hospitalizacion_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_condicion_paciente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_condicion_paciente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_condicion_paciente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uppercase_rn_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."uppercase_rn_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uppercase_rn_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uppercase_text_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."uppercase_text_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uppercase_text_fields"() TO "service_role";


















GRANT ALL ON TABLE "public"."auditoria" TO "anon";
GRANT ALL ON TABLE "public"."auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auditoria_id_auditoria_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auditoria_id_auditoria_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auditoria_id_auditoria_seq" TO "service_role";



GRANT ALL ON TABLE "public"."checks_diarios" TO "anon";
GRANT ALL ON TABLE "public"."checks_diarios" TO "authenticated";
GRANT ALL ON TABLE "public"."checks_diarios" TO "service_role";



GRANT ALL ON TABLE "public"."consultas_datos" TO "anon";
GRANT ALL ON TABLE "public"."consultas_datos" TO "authenticated";
GRANT ALL ON TABLE "public"."consultas_datos" TO "service_role";



GRANT ALL ON TABLE "public"."historial_eventos" TO "anon";
GRANT ALL ON TABLE "public"."historial_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."hospitalizaciones" TO "anon";
GRANT ALL ON TABLE "public"."hospitalizaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitalizaciones" TO "service_role";



GRANT ALL ON TABLE "public"."pacientes" TO "anon";
GRANT ALL ON TABLE "public"."pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."recien_nacidos_temporales" TO "anon";
GRANT ALL ON TABLE "public"."recien_nacidos_temporales" TO "authenticated";
GRANT ALL ON TABLE "public"."recien_nacidos_temporales" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_rol_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_rol_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_rol_seq" TO "service_role";



GRANT ALL ON TABLE "public"."validaciones_rpa" TO "anon";
GRANT ALL ON TABLE "public"."validaciones_rpa" TO "authenticated";
GRANT ALL ON TABLE "public"."validaciones_rpa" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































