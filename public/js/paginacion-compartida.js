function renderPaginacion(opts) {
    const { contenedor, pagina, totalPaginas, habilitarAnterior, habilitarSiguiente, alAnterior, alSiguiente } = opts;
    if (!contenedor) return;
    if (totalPaginas <= 1) { contenedor.innerHTML = ''; return; }
    contenedor.innerHTML = `
        <div class="pagination-wrapper">
            <span class="pagination-info">Página ${pagina} de ${totalPaginas}</span>
            <button class="pagination-btn" id="pag-ant"${habilitarAnterior ? '' : ' disabled'}>
                <span class="btn-icon"><i class="fa-solid fa-chevron-left"></i></span>
                <span class="btn-label">Anterior</span>
            </button>
            <button class="pagination-btn" id="pag-sig"${habilitarSiguiente ? '' : ' disabled'}>
                <span class="btn-label">Siguiente</span>
                <span class="btn-icon"><i class="fa-solid fa-chevron-right"></i></span>
            </button>
        </div>`;
    document.getElementById('pag-ant')?.addEventListener('click', alAnterior);
    document.getElementById('pag-sig')?.addEventListener('click', alSiguiente);
}
