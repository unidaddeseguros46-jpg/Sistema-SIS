async function consultarPaginado(opts) {
    const {
        cliente,
        tabla,
        select: selectCols = '*',
        columnaOrden = 'creado_en',
        direccion = 'first',
        cursorAnterior,
        cursorSiguiente,
        pageSize = 20,
        filtros,
    } = opts;

    let query = cliente.from(tabla).select(selectCols);
    if (filtros) query = filtros(query);

    if (direccion === 'next' && cursorSiguiente) {
        query = query.lt(columnaOrden, cursorSiguiente).order(columnaOrden, { ascending: false });
    } else if (direccion === 'prev' && cursorAnterior) {
        query = query.gt(columnaOrden, cursorAnterior).order(columnaOrden, { ascending: true });
    } else {
        query = query.order(columnaOrden, { ascending: false });
    }

    query = query.limit(pageSize + 1);

    const { data, error } = await query;
    if (error) return { items: [], error, cursorAnterior: null, cursorSiguiente: null };

    let items = data || [];
    if (direccion === 'prev') items.reverse();

    const elementos = items.length > pageSize ? items.slice(0, pageSize) : items;

    let nuevoCursorAnt = null;
    let nuevoCursorSig = null;
    if (elementos.length > 0) {
        nuevoCursorAnt = elementos[0][columnaOrden];
        nuevoCursorSig = elementos[elementos.length - 1][columnaOrden];
    }

    return { items: elementos, error: null, cursorAnterior: nuevoCursorAnt, cursorSiguiente: nuevoCursorSig };
}

async function contarRegistros(opts) {
    const { cliente, tabla, filtros } = opts;
    let query = cliente.from(tabla).select('*', { count: 'exact', head: true });
    if (filtros) query = filtros(query);
    const { count, error } = await query;
    return error ? 0 : (count || 0);
}

async function verificarAnterior(opts) {
    const { cliente, tabla, columnaOrden = 'creado_en', cursor, filtros } = opts;
    if (!cursor) return false;
    let query = cliente.from(tabla).select('*', { count: 'exact', head: true }).gt(columnaOrden, cursor);
    if (filtros) query = filtros(query);
    const { count, error } = await query;
    return !error && (count || 0) > 0;
}

async function verificarSiguiente(opts) {
    const { cliente, tabla, columnaOrden = 'creado_en', cursor, filtros } = opts;
    if (!cursor) return false;
    let query = cliente.from(tabla).select('*', { count: 'exact', head: true }).lt(columnaOrden, cursor);
    if (filtros) query = filtros(query);
    const { count, error } = await query;
    return !error && (count || 0) > 0;
}
