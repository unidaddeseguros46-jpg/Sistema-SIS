document.addEventListener('DOMContentLoaded', async () => {
    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();

    if (!session) {
        window.location.href = '../../index.html';
        return;
    }

    const userId = session.user.id;

    // DOM - BÃºsqueda (Nuevos IDs de VerificaciÃ³n)
    const searchFilters = document.getElementById('search-filters');
    const filterDniHc = document.getElementById('filter-dni-hc');
    const filterApellidos = document.getElementById('filter-apellidos');
    const filterSeguro = document.getElementById('filter-seguro');
    const filterServicio = document.getElementById('filter-servicio');
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear');
    
    const viewResultados = document.getElementById('view-resultados');
    const tbodyPacientes = document.getElementById('tbody-pacientes');
    const loadingIndicator = document.getElementById('loading-indicator');
    const tablePacientes = document.getElementById('table-pacientes');
    const toast = document.getElementById('toast');
    
    // Tooltip logic (Est&#225;ndar del sistema)
    if (window.showGuideTooltip) {
        window.showGuideTooltip(
            'seguimiento_pacs', 
            'Haga click en la fila de un paciente para actualizar su informaci&#243;n', 
            5000, // 5 segundos de duraci&#243;n
            true, // Mostrar checkbox "No volver a mostrar"
            { oncePerSession: false } // Reaparece cada vez que se carga la p&#225;gina
        );
    }

    // State
    let currentPage = 1;
    let rowsPerPage = 20;
    let totalRecords = 0;
    const searchCache = new Map();

    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const showToast = (text, isError = false) => {
        if(window.showSystemTooltip) {
            window.showSystemTooltip(text, isError);
        }
    };

    const searchPacientes = async () => {
        const dniHcVal = filterDniHc.value.trim();
        const apeVal = filterApellidos.value.trim();
        const seguroVal = filterSeguro.value;
        const servicioVal = filterServicio.value;

        const cacheKey = `${currentPage}|${dniHcVal}|${apeVal}|${seguroVal}|${servicioVal}`;
        if (searchCache.has(cacheKey)) {
            const cached = searchCache.get(cacheKey);
            totalRecords = cached.count;
            renderTable(cached.data);
            renderPagination();
            return;
        }

        try {
            loadingIndicator.style.display = 'block';
            tablePacientes.style.display = 'none';

            const startRange = (currentPage - 1) * rowsPerPage;
            const endRange = startRange + rowsPerPage - 1;

            let queryObj = client
                .from('pacientes')
                .select('*', { count: 'exact' })
                .order('creado_en', { ascending: false })
                .range(startRange, endRange);

            if (dniHcVal) {
                queryObj = queryObj.or(`dni.ilike.%${dniHcVal}%,historia_clinica.ilike.%${dniHcVal}%`);
            }
            if (apeVal) {
                queryObj = queryObj.ilike('apellidos', `%${normalizeText(apeVal)}%`);
            }
            if (seguroVal) {
                queryObj = queryObj.eq('tipo_seguro', seguroVal.toUpperCase());
            }
            if (servicioVal) {
                queryObj = queryObj.eq('servicio', servicioVal.toUpperCase());
            }

            const { data: pacientes, count, error } = await queryObj;
            if (error) throw error;

            totalRecords = count || 0;
            searchCache.set(cacheKey, { data: pacientes || [], count: totalRecords });
            renderTable(pacientes || []);
            renderPagination();
        } catch (error) {

            showToast('Error al buscar pacientes', true);
        } finally {
            loadingIndicator.style.display = 'none';
            tablePacientes.style.display = 'table';
        }
    };

    const renderTable = (items) => {
        tbodyPacientes.innerHTML = '';
        if (items.length === 0) {
            tbodyPacientes.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color:#94a3b8;">No se encontraron pacientes.</td></tr>';
            return;
        }

        const formatDniDisplay = (dni, tipo) => {
            const PREFIX_MAP = { DNI: '', DNI_TEMPORAL: 'E- ', CARNET_EXT: 'C.E ' };
            const prefix = PREFIX_MAP[tipo] || '';
            return prefix ? prefix + dni : dni;
        };

        items.forEach(item => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            
            const condValue = (item.condicion || '').toLowerCase();
            const condClass = !condValue ? '' : (condValue === 'hospitalizado' ? 'cond-hospitalizado' : (condValue === 'fallecido' ? 'cond-fallecido' : 'cond-alta'));
            const isFallecido = condValue === 'fallecido';

            row.innerHTML = `
                <td>${formatDniDisplay(item.dni, item.tipo_documento)}</td>
                <td>${item.apellidos}, ${item.nombres}</td>
                <td>${item.historia_clinica || '—'}</td>
                <td><span class="seguro-badge">${item.tipo_seguro}</span></td>
                <td>${item.servicio || '-'}</td>
                <td><span class="condicion-badge ${condClass}">${item.condicion || '—'}</span></td>
                <td style="text-align: center;">
                    <button class="btn-table-action quick-query" title="${item.tipo_documento === 'DNI' ? 'Consulta R&#225;pida (DNI)' : 'No disponible para este tipo de documento'}" data-dni="${item.dni}" data-tipo-documento="${item.tipo_documento || 'DNI'}">
                        <i class="fa-solid fa-address-card"></i>
                    </button>
                </td>
            `;

            row.addEventListener('click', (e) => {
                // Si hizo clic en el botón de acción, no abrir el detalle
                if (e.target.closest('.quick-query')) return;
                window.location.href = `detalle-paciente.html?id=${item.id}`;
            });

            // Acción específica para el botón de Consulta Rápida
            row.querySelector('.quick-query').addEventListener('click', (e) => {
                e.stopPropagation();
                const tipoDoc = e.currentTarget.dataset.tipoDocumento || 'DNI';
                const dni = e.currentTarget.dataset.dni;
                if (tipoDoc !== 'DNI') {
                    if (window.showSystemTooltip) {
                        window.showSystemTooltip('Este paciente no cuenta con\nC\u00f3digo de Verificaci\u00f3n\npara realizar la consulta', true);
                    }
                    return;
                }
                window.location.href = `../consultas/consulta-rapida.html?dni=${dni}&auto=true`;
            });

            tbodyPacientes.appendChild(row);
        });
    };

    const renderPagination = () => {
        const totalPages = Math.ceil(totalRecords / rowsPerPage);
        DynamicTable.renderPagination({
            containerId: 'pagination-container',
            currentPage,
            totalPages,
            onPageChange: (page) => {
                currentPage = page;
                searchPacientes();
            }
        });
    };

    const inputs = [filterDniHc, filterApellidos, filterSeguro, filterServicio];
    inputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 1;
                searchPacientes();
            }
        });
    });

    filterSeguro.addEventListener('change', () => {
        currentPage = 1;
        searchPacientes();
    });

    filterServicio.addEventListener('change', () => {
        currentPage = 1;
        searchPacientes();
    });

    btnSearch.addEventListener('click', () => {
        currentPage = 1;
        searchPacientes();
    });

    btnClear.addEventListener('click', () => {
        filterDniHc.value = '';
        filterApellidos.value = '';
        filterSeguro.value = '';
        filterServicio.value = '';
        
        // Actualizar el texto del custom dropdown si existe
        if (filterServicio.customDropdownUpdate) filterServicio.customDropdownUpdate();
        if (filterSeguro.customDropdownUpdate) filterSeguro.customDropdownUpdate();
        
        currentPage = 1;
        searchPacientes();
    });

    searchPacientes();
});
