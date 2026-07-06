ALTER TABLE historial_eventos
  DROP CONSTRAINT historial_eventos_tipo_evento_check;

ALTER TABLE historial_eventos
  ADD CONSTRAINT historial_eventos_tipo_evento_check
  CHECK (tipo_evento = ANY (ARRAY[
    'Hospitalizado', 'Cambio Cobertura', 'Cambio de Servicio',
    'Alta', 'Fallecido', 'REFERIDO'
  ]));
