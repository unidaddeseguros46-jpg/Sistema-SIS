document.addEventListener('DOMContentLoaded', async () => {
    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();

    if (!session) {
        window.location.href = '../../index.html';
        return;
    }

    const userId = session.user.id;

    // DOM
    const filterDniHc = document.getElementById('filter-dni-hc');
    const filterApellidos = document.getElementById('filter-apellidos');
    const filterSeguro = document.getElementById('filter-seguro');
    const filterServicio = document.getElementById('filter-servicio');
    const filterCondicion = document.getElementById('filter-condicion');
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear');
    const altaCountEl = document.getElementById('alta-count');

    const viewResultados = document.getElementById('view-resultados');
    const tbodyPacientes = document.getElementById('tbody-pacientes');
    const loadingIndicator = document.getElementById('loading-indicator');
    const tablePacientes = document.getElementById('table-pacientes');
    const toast = document.getElementById('toast');

    if (window.showGuideTooltip) {
        window.showGuideTooltip(
            'seguimiento_pacs',
            'Haga click en la fila de un paciente para actualizar su informaci&#243;n',
            5000,
            true,
            { oncePerSession: false }
        );
    }

    // State
    let currentPage = 1;
    let rowsPerPage = 20;
    let totalRecords = 0;
    const selectedPacientes = new Map(); // paciente_id -> { dni, apellidos, nombres, servicio }

    const getPeruDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));

    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const showToast = (text, isError = false) => {
        console.log('[Toast]', isError ? 'ERROR' : 'INFO', text);
        try {
            if (window.showSystemTooltip) {
                window.showSystemTooltip(text, isError);
                return;
            }
        } catch (e) {
            console.warn('[Toast] showSystemTooltip falló:', e);
        }
        const div = document.createElement('div');
        div.textContent = text;
        Object.assign(div.style, {
            position: 'fixed', bottom: '30px', right: '30px', zIndex: '99999',
            background: isError ? '#fef2f2' : '#f0fdf4',
            color: isError ? '#dc2626' : '#15803d',
            borderLeft: `4px solid ${isError ? '#ef4444' : '#22c55e'}`,
            padding: '12px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
        });
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3500);
    };
    console.log('[Debug] showToast definida, showSystemTooltip disponible:', !!window.showSystemTooltip);

    // ── Checks persistence (Supabase + in-memory) ──

    const loadChecks = async () => {
        try {
            const today = getPeruDate().toISOString().split('T')[0];
            const { data, error } = await client
                .from('checks_diarios')
                .select('paciente_id')
                .eq('usuario_id', userId)
                .eq('fecha_check', today);
            if (error) throw error;
            const ids = (data || []).map(c => c.paciente_id);
            if (ids.length === 0) return;
            const { data: pacientes, error: pErr } = await client
                .from('pacientes')
                .select('id, dni, apellidos, nombres, servicio')
                .in('id', ids);
            if (pErr) throw pErr;
            (pacientes || []).forEach(p => {
                selectedPacientes.set(p.id, {
                    dni: p.dni,
                    apellidos: p.apellidos,
                    nombres: p.nombres,
                    servicio: p.servicio || ''
                });
            });
        } catch (e) {
            console.warn('Error loading checks:', e);
        }
    };

    const updateAltaCount = () => {
        const size = selectedPacientes.size;
        altaCountEl.textContent = size > 0 ? `${size} seleccionados` : '';
    };

    const toggleCheck = async (tdEl, pacienteId, dni, apellidos, nombres, servicio) => {
        const cb = tdEl.querySelector('.patient-check');
        if (!cb || cb.disabled) return;

        if (selectedPacientes.has(pacienteId)) {
            selectedPacientes.delete(pacienteId);
            cb.checked = false;
            try {
                await client.from('checks_diarios')
                    .delete()
                    .eq('paciente_id', pacienteId)
                    .eq('usuario_id', userId)
                    .eq('fecha_check', getPeruDate().toISOString().split('T')[0]);
            } catch (e) { console.warn(e); }
        } else {
            selectedPacientes.set(pacienteId, { dni, apellidos, nombres, servicio });
            cb.checked = true;
            try {
                await client.from('checks_diarios')
                    .upsert({
                        paciente_id: pacienteId,
                        usuario_id: userId,
                        fecha_check: getPeruDate().toISOString().split('T')[0]
                    }, { onConflict: 'paciente_id,usuario_id,fecha_check' });
            } catch (e) { console.warn(e); }
        }
        updateAltaCount();
    };

    // ── Search ──

    const searchPacientes = async () => {
        const dniHcVal = filterDniHc.value.trim();
        const apeVal = filterApellidos.value.trim();
        const seguroVal = filterSeguro.value;
        const servicioVal = filterServicio.value;
        const condicionVal = filterCondicion.value;

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
            if (condicionVal) {
                queryObj = queryObj.ilike('condicion', condicionVal);
            }

            const { data: pacientes, count, error } = await queryObj;
            if (error) throw error;

            totalRecords = count || 0;
            renderTable(pacientes || []);
            renderPagination();
        } catch (error) {
            showToast('Error al buscar pacientes', true);
        } finally {
            loadingIndicator.style.display = 'none';
            tablePacientes.style.display = 'table';
        }
    };

    // ── Table rendering ──

    const renderTable = (items) => {
        const selectAllCb = document.getElementById('checkbox-select-all');
        if (selectAllCb) selectAllCb.checked = false;

        tbodyPacientes.innerHTML = '';
        if (items.length === 0) {
            tbodyPacientes.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 30px; color:#94a3b8;">No se encontraron pacientes.</td></tr>';
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

            const isChecked = selectedPacientes.has(item.id);

            row.innerHTML = `
                <td style="text-align:center; cursor: pointer;">
                    <input type="checkbox" class="patient-check" data-id="${item.id}"
                        data-dni="${item.dni}"
                        data-apellidos="${item.apellidos}"
                        data-nombres="${item.nombres}"
                        data-servicio="${item.servicio || ''}"
                        ${isChecked ? 'checked' : ''}
                        ${isFallecido ? 'disabled' : ''}>
                </td>
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

            // Checkbox column toggle
            const firstTd = row.querySelector('td:first-child');
            firstTd.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = item.id;
                const dni = item.dni;
                const apellidos = item.apellidos;
                const nombres = item.nombres;
                const servicio = item.servicio || '';
                toggleCheck(firstTd, id, dni, apellidos, nombres, servicio);
            });

            row.addEventListener('click', (e) => {
                if (e.target.closest('.quick-query')) return;
                if (e.target.closest('td:first-child')) return;
                window.location.href = `detalle-paciente.html?id=${item.id}`;
            });

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

    // ── Select All ──

    document.addEventListener('change', async (e) => {
        if (e.target.id === 'checkbox-select-all') {
            const today = getPeruDate().toISOString().split('T')[0];
            const checkboxes = [...document.querySelectorAll('.patient-check:not(:disabled)')];
            const ids = checkboxes.map(cb => cb.dataset.id);
            if (e.target.checked) {
                checkboxes.forEach(cb => {
                    selectedPacientes.set(cb.dataset.id, {
                        dni: cb.dataset.dni,
                        apellidos: cb.dataset.apellidos,
                        nombres: cb.dataset.nombres,
                        servicio: cb.dataset.servicio || ''
                    });
                    cb.checked = true;
                });
                try {
                    await client.from('checks_diarios')
                        .upsert(ids.map(id => ({
                            paciente_id: id,
                            usuario_id: userId,
                            fecha_check: today
                        })), { onConflict: 'paciente_id,usuario_id,fecha_check' });
                } catch (e) { console.warn(e); }
            } else {
                selectedPacientes.clear();
                document.querySelectorAll('.patient-check').forEach(cb => cb.checked = false);
                try {
                    await client.from('checks_diarios')
                        .delete()
                        .eq('usuario_id', userId)
                        .eq('fecha_check', today)
                        .in('paciente_id', ids);
                } catch (e) { console.warn(e); }
            }
            updateAltaCount();
        }
    });

    // ── Event listeners ──

    const filterInputs = [filterDniHc, filterApellidos, filterSeguro, filterServicio, filterCondicion];
    filterInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentPage = 1;
                searchPacientes();
            }
        });
    });

    [filterSeguro, filterServicio, filterCondicion].forEach(el => {
        el.addEventListener('change', () => {
            currentPage = 1;
            searchPacientes();
        });
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

        if (filterServicio.customDropdownUpdate) filterServicio.customDropdownUpdate();
        if (filterSeguro.customDropdownUpdate) filterSeguro.customDropdownUpdate();

        currentPage = 1;
        searchPacientes();
    });

    // ── Limpiar checks de pacientes dados de alta desde detalle ──
    const limpiarChecksPorAlta = async () => {
        try {
            const ids = JSON.parse(localStorage.getItem('alta_pacientes_ids') || '[]');
            if (ids.length === 0) return;
            const today = getPeruDate().toISOString().split('T')[0];
            await client.from('checks_diarios')
                .delete()
                .eq('usuario_id', userId)
                .eq('fecha_check', today)
                .in('paciente_id', ids);
            ids.forEach(id => selectedPacientes.delete(id));
            localStorage.removeItem('alta_pacientes_ids');
        } catch (e) {}
    };

    // ── Init ──

    await loadChecks();
    await limpiarChecksPorAlta();
    updateAltaCount();
    await searchPacientes();

    // bfcache: cuando el usuario vuelve con el botón Atrás
    window.addEventListener('pageshow', async (e) => {
        if (e.persisted) {
            await loadChecks();
            await limpiarChecksPorAlta();
            updateAltaCount();
            await searchPacientes();
        }
    });
});
