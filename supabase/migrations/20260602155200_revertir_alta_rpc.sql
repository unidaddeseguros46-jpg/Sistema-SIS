-- Función RPC: revertir_alta
-- Revierte un alta dada por error, reabriendo la hospitalización
-- y restaurando la condición del paciente a 'Hospitalizado'.
-- Usa SECURITY DEFINER para ejecutar atómicamente saltando políticas RLS.

CREATE OR REPLACE FUNCTION revertir_alta(p_hospitalizacion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Permitir que usuarios autenticados puedan llamar esta función
GRANT EXECUTE ON FUNCTION revertir_alta(UUID) TO authenticated;
