alter table "public"."perfiles" add column "apellidos" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.uppercase_text_fields()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;


