/**
 * Dynamic Table Utility — Hospital San José
 * Calcula automáticamente cuántas filas caben en la pantalla sin scroll vertical.
 * Provee paginación integrada reutilizable en todos los módulos.
 */
const DynamicTable = (() => {
    const DEFAULT_ROW_HEIGHT = 52;
    const MIN_ROWS = 3;
    const PADDING_BUFFER = 40; // margen extra de seguridad

    /**
     * Calcula cuántas filas caben en la pantalla sin generar scroll.
     * @param {Object} opts
     * @param {string} opts.tableContainerId - ID del contenedor de la tabla
     * @param {string[]} opts.excludeSelectors - Selectores de elementos a excluir del cálculo (header, filtros, paginación, etc.)
     * @param {number} [opts.rowHeight] - Altura promedio por fila (px)
     * @returns {number}
     */
    const calcRowsPerPage = (opts = {}) => {
        const rowHeight = opts.rowHeight || DEFAULT_ROW_HEIGHT;
        const viewportHeight = window.innerHeight;

        // Calcular espacio ocupado por elementos fijos
        let occupiedHeight = PADDING_BUFFER;
        const defaultExcludes = [
            '.top-header',
            '.page-header',
            '.search-filters-container',
            '#actions-bar',
            '.pagination-controls',
            '#rpa-alerta-banner'
        ];
        const selectors = opts.excludeSelectors || defaultExcludes;

        selectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
                const rect = el.getBoundingClientRect();
                occupiedHeight += rect.height + parseFloat(getComputedStyle(el).marginTop || 0) + parseFloat(getComputedStyle(el).marginBottom || 0);
            }
        });

        // Sumar padding del page-content
        const pageContent = document.querySelector('.page-content');
        if (pageContent) {
            const cs = getComputedStyle(pageContent);
            occupiedHeight += parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        }

        // Sumar header de la tabla (th)
        const tableContainer = opts.tableContainerId ? document.getElementById(opts.tableContainerId) : document.querySelector('.data-table-container');
        if (tableContainer) {
            const thead = tableContainer.querySelector('thead');
            if (thead) occupiedHeight += thead.getBoundingClientRect().height;
        }

        const available = viewportHeight - occupiedHeight;
        return Math.max(MIN_ROWS, Math.floor(available / rowHeight));
    };

    /**
     * Renderiza los controles de paginación.
     * @param {Object} opts
     * @param {string} opts.containerId - ID del contenedor donde insertar la paginación
     * @param {number} opts.currentPage - Página actual (1-indexed)
     * @param {number} opts.totalPages - Total de páginas
     * @param {Function} opts.onPageChange - Callback al cambiar de página
     */
    const renderPagination = (opts) => {
        const container = document.getElementById(opts.containerId);
        if (!container) return;

        if (opts.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const N = opts.totalPages;
        const cur = opts.currentPage;

        const btn = (page) => {
            const cls = `pagination-btn${page === cur ? ' active' : ''}`;
            return `<button class="${cls}" data-page="${page}">${page}</button>`;
        };
        const ellipsis = () => `<span class="pagination-ellipsis">•••</span>`;

        let html = `<div class="pagination-wrapper">
            <button class="pagination-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}" title="Anterior">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            ${btn(1)}
        `;

        const WINDOW = 3;
        const HALF = Math.floor(WINDOW / 2);
        let start = Math.max(1, cur - HALF);
        let end   = Math.min(N, start + WINDOW - 1);
        if (end - start < WINDOW - 1) {
            start = Math.max(1, end - WINDOW + 1);
        }

        const showLeft  = start > 2;
        const showRight = end < N - 1;

        if (showLeft) {
            html += ellipsis();
        }

        for (let i = Math.max(2, start); i <= Math.min(N - 1, end); i++) {
            html += btn(i);
        }

        if (showRight) {
            html += ellipsis();
        }

        if (N > 1) {
            html += btn(N);
        }

        html += `
            <button class="pagination-btn" ${cur === N ? 'disabled' : ''} data-page="${cur + 1}" title="Siguiente">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;

        container.innerHTML = html;

        container.querySelectorAll('.pagination-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page >= 1 && page <= opts.totalPages) {
                    opts.onPageChange(page);
                }
            });
        });
    };

    /**
     * Configura recálculo automático al redimensionar ventana.
     * @param {Function} callback - Función a ejecutar al redimensionar
     * @param {number} [debounceMs=250] - Debounce en ms
     * @returns {Function} cleanup function
     */
    const onResize = (callback, debounceMs = 250) => {
        let timer;
        const handler = () => {
            clearTimeout(timer);
            timer = setTimeout(callback, debounceMs);
        };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    };

    return { calcRowsPerPage, renderPagination, onResize };
})();
