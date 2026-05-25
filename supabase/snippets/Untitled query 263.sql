ALTER TABLE checks_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver sus propios checks" ON checks_diarios
    FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "Usuarios pueden insertar sus propios checks" ON checks_diarios
    FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Usuarios pueden eliminar sus propios checks" ON checks_diarios
    FOR DELETE USING (usuario_id = auth.uid());
CREATE POLICY "Usuarios pueden actualizar sus propios checks" ON checks_diarios
    FOR UPDATE USING (usuario_id = auth.uid());