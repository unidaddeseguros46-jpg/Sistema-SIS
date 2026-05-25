CREATE TABLE IF NOT EXISTS checks_diarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE NOT NULL,
    usuario_id UUID NOT NULL,
    fecha_check DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paciente_id, usuario_id, fecha_check)
);

CREATE INDEX IF NOT EXISTS idx_checks_diarios_usuario_fecha ON checks_diarios(usuario_id, fecha_check);

ALTER TABLE checks_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus propios checks" ON checks_diarios;
CREATE POLICY "Usuarios pueden ver sus propios checks" ON checks_diarios
    FOR SELECT USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios checks" ON checks_diarios;
CREATE POLICY "Usuarios pueden insertar sus propios checks" ON checks_diarios
    FOR INSERT WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios checks" ON checks_diarios;
CREATE POLICY "Usuarios pueden eliminar sus propios checks" ON checks_diarios
    FOR DELETE USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propios checks" ON checks_diarios;
CREATE POLICY "Usuarios pueden actualizar sus propios checks" ON checks_diarios
    FOR UPDATE USING (usuario_id = auth.uid());
