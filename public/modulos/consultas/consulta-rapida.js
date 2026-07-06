document.addEventListener('DOMContentLoaded', async () => {
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear');
    const inputDniHc = document.getElementById('filter-dni-hc');
    const inputApellidos = document.getElementById('filter-apellidos');
    const crClearDni = document.getElementById('cr-clear-dni');
    const crClearAp = document.getElementById('cr-clear-ap');

    function updateCrClear(input, btn) {
        if (btn) btn.style.display = input.value.trim() ? '' : 'none';
    }
    inputDniHc.addEventListener('input', function () { updateCrClear(inputDniHc, crClearDni); });
    inputApellidos.addEventListener('input', function () { updateCrClear(inputApellidos, crClearAp); });

    var clearDniListener = function () {
        var hasFilters = (filterCondicion && filterCondicion.value !== '') ||
                         (filterServicio && filterServicio.value !== '');
        if (hasFilters) {
            inputDniHc.value = '';
            if (crClearDni) crClearDni.style.display = 'none';
            inputDniHc.focus();
        } else {
            btnClear.click();
            if (crClearDni) crClearDni.style.display = 'none';
            if (crClearAp) crClearAp.style.display = 'none';
        }
    };
    var clearApListener = function () {
        var hasFilters = (filterCondicion && filterCondicion.value !== '') ||
                         (filterServicio && filterServicio.value !== '');
        if (hasFilters) {
            inputApellidos.value = '';
            if (crClearAp) crClearAp.style.display = 'none';
            inputApellidos.focus();
        } else {
            btnClear.click();
            if (crClearDni) crClearDni.style.display = 'none';
            if (crClearAp) crClearAp.style.display = 'none';
        }
    };
    if (crClearDni) crClearDni.addEventListener('click', clearDniListener);
    if (crClearAp) crClearAp.addEventListener('click', clearApListener);

    const tablePacientes = document.getElementById('table-pacientes');
    const tbodyPacientes = document.getElementById('tbody-pacientes');
    const loadingIndicator = document.getElementById('loading-indicator');
    const paginationContainer = document.getElementById('pagination-consulta');
    const blockingOverlay = document.getElementById('blocking-overlay');
    const templateAlerta = document.getElementById('template-alerta');
    const filterCondicion = document.getElementById('filter-condicion');
    const filterServicio = document.getElementById('filter-servicio');
    const btnHastaHoy = document.getElementById('btn-hasta-hoy');
    const patientCountEl = document.getElementById('cr-patient-count');

    const crDateTrigger = document.getElementById('cr-date-trigger');
    const crDateDisplay = document.getElementById('cr-date-display');
    const crDatePopover = document.getElementById('cr-date-popover');
    const crCalGrid = document.getElementById('cr-cal-days-grid');
    const crCalTitle = document.getElementById('cr-cal-title');
    const crFilterMonth = document.getElementById('cr-filter-month');
    const crFilterYear = document.getElementById('cr-filter-year');
    const crCalPrev = document.getElementById('cr-cal-prev');
    const crCalNext = document.getElementById('cr-cal-next');
    const crCalToday = document.getElementById('cr-cal-today');
    let crRangeStart = null;
    let crRangeEnd = null;

    let isValidating = false;
    let currentSearchController = null;

    let currentPagePatients = [];
    let totalPatients = 0;
    let selectedDNIs = [];
    let hastaHoyActive = true;
    let crCurrentPage = 1;
    let crRowsPerPage = 20;
    let modalPacienteActual = null;
    let susaludCreds = null;

    const loadSusaludCreds = async (retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) return;
                const { data, error } = await supabaseClient
                    .from('perfiles')
                    .select('susalud_usuario, susalud_clave')
                    .eq('id_usuario', session.user.id)
                    .maybeSingle();
                if (error) throw error;
                if (data && (data.susalud_usuario || data.susalud_clave)) {
                    susaludCreds = data;
                    const bar = document.querySelector('.susalud-creds-bar');
                    if (bar) bar.style.display = 'flex';
                    return;
                }
            } catch (e) {
                console.error('[SUSALUD] Error cargando credenciales:', e);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    };

    const initSusaludCopy = () => {
        document.querySelectorAll('.susalud-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const field = btn.dataset.creds;
                const text = field === 'usuario' ? susaludCreds?.susalud_usuario : susaludCreds?.susalud_clave;
                if (!text) return;
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    showToast(field === 'usuario' ? 'Usuario SUSALUD copiado' : 'Clave SUSALUD copiada');
                } catch {
                    showToast('No se pudo copiar. Seleccione manualmente.', true);
                }
                document.body.removeChild(ta);
            });
        });
    };

    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const showToast = (message, isError = false) => {
        if (window.showSystemTooltip) {
            window.showSystemTooltip(message, isError);
        }
    };

    const updateActionsBar = () => {
        document.getElementById('btn-validar').disabled = selectedDNIs.length === 0;
        updatePatientCount();
    };

    const updatePatientCount = () => {
        const total = totalPatients;
        const selected = selectedDNIs.length;
        let text = '';
        if (total > 0) {
            text = `${total} pacientes`;
            if (selected > 0) text += ` | ${selected} seleccionados`;
        }
        patientCountEl.textContent = text;
    };

    const getDateRangeValues = () => {
        if (!crRangeStart) return { start: null, end: null };
        const pad = n => String(n).padStart(2, '0');
        const start = `${crRangeStart.getFullYear()}-${pad(crRangeStart.getMonth()+1)}-${pad(crRangeStart.getDate())}`;
        const end = crRangeEnd ? `${crRangeEnd.getFullYear()}-${pad(crRangeEnd.getMonth()+1)}-${pad(crRangeEnd.getDate())}` : start;
        return { start, end };
    };

    const updateDateDisplay = () => {
        const fmt = d => {
            if (!d) return '';
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
        };
        if (crRangeStart && crRangeEnd) {
            crDateDisplay.textContent = `${fmt(crRangeStart)} — ${fmt(crRangeEnd)}`;
            crDateDisplay.style.color = '#1e293b';
        } else if (crRangeStart) {
            crDateDisplay.textContent = `Desde: ${fmt(crRangeStart)}`;
            crDateDisplay.style.color = '#1e293b';
        } else {
            crDateDisplay.textContent = 'Seleccionar rango de fechas';
            crDateDisplay.style.color = '#94a3b8';
        }
    };

    const crCal = window.crearCalendario({
        mode: 'range',
        grid: crCalGrid,
        title: crCalTitle,
        month: crFilterMonth,
        year: crFilterYear,
        prev: crCalPrev,
        next: crCalNext,
        today: crCalToday,
        rangeStart: crRangeStart,
        rangeEnd: crRangeEnd,
        onDayClick: ({ start, end }) => {
            crRangeStart = start;
            crRangeEnd = end;
            updateDateDisplay();
        },
        onRangeComplete: ({ start, end }) => {
            crRangeStart = start;
            crRangeEnd = end;
            updateDateDisplay();
            closeDatePopover();
            triggerActionsSearch();
        }
    });

    function closeDatePopover() {
        crDatePopover.style.display = 'none';
        crDateTrigger.classList.remove('is-open');
    }

    function toggleDatePopover() {
        const isOpen = crDatePopover.style.display !== 'none';
        if (isOpen) {
            closeDatePopover();
        } else {
            if (crRangeStart) {
                crCal.setView(crRangeStart.getFullYear(), crRangeStart.getMonth());
            }
            crCal.render();
            crDatePopover.style.display = 'block';
            crDateTrigger.classList.add('is-open');
        }
    }

    const triggerActionsSearch = () => {
        if (!crRangeStart && !hastaHoyActive) {
            showToast('Seleccione un rango de fechas o active "Hasta hoy" para buscar.', true);
            return;
        }
        crCurrentPage = 1;
        loadPacientes();
    };

    filterCondicion.addEventListener('change', () => {
        if (crRangeStart || hastaHoyActive) triggerActionsSearch();
    });

    filterServicio.addEventListener('change', () => {
        if (crRangeStart || hastaHoyActive) triggerActionsSearch();
    });

    btnHastaHoy.addEventListener('click', () => {
        hastaHoyActive = !hastaHoyActive;
        btnHastaHoy.classList.toggle('active', hastaHoyActive);
        if (hastaHoyActive) {
            crRangeStart = null;
            crRangeEnd = null;
            if (crCal) crCal.setRange(null, null);
            updateDateDisplay();
            triggerActionsSearch();
        }
    });

    crDateTrigger.addEventListener('click', (e) => {
        if (hastaHoyActive) {
            e.stopPropagation();
            showToast('Limpie los filtros para usar el rango de fechas.');
            btnClear.classList.add('btn-pulse');
            setTimeout(() => btnClear.classList.remove('btn-pulse'), 2000);
            return;
        }
        toggleDatePopover();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.cr-datepicker-wrapper')) closeDatePopover();
    });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'checkbox-select-all') {
            if (e.target.checked) {
                const checkboxes = [...document.querySelectorAll('.patient-checkbox:not(:disabled)')];
                for (const cb of checkboxes) {
                    if (selectedDNIs.length >= 20) break;
                    const dni = cb.dataset.dni;
                    if (!selectedDNIs.includes(dni)) {
                        selectedDNIs.push(dni);
                        cb.checked = true;
                    }
                }
            } else {
                selectedDNIs = [];
                document.querySelectorAll('.patient-checkbox').forEach(cb => cb.checked = false);
            }
            updateActionsBar();
        }
    });

    const updateAlertaBanner = () => {
        if (isValidating) return;
        if (!templateAlerta || !templateAlerta.content || !templateAlerta.content.children.length) return;

        const tryInject = () => {
            const header = document.querySelector('.top-header');
            if (!header) {
                setTimeout(tryInject, 100);
                return;
            }

            let banner = document.getElementById('alerta-banner');
            const hayAlerta = currentPagePatients.some(p => {
                const estado = p.estado_rpa || p._estado_rpa;
                return estado === 'ALERTA';
            });

            if (hayAlerta) {
                if (!banner) {
                    if (!templateAlerta.content || !templateAlerta.content.children.length) return;
                    const clone = templateAlerta.content.cloneNode(true);
                    banner = clone.querySelector('#alerta-banner');
                    if (!banner) return;
                    banner.style.position = 'fixed';
                    banner.style.left = '50%';
                    banner.style.top = '35px';
                    banner.style.transform = 'translate(-50%, -50%)';
                    banner.style.zIndex = '10001';
                    document.body.appendChild(banner);
                }
            } else {
                if (banner) {
                    banner.style.animation = 'fluidSlideDown 0.4s reverse cubic-bezier(0.16, 1, 0.3, 1) forwards';
                    setTimeout(() => banner.remove(), 400);
                }
            }
        };

        tryInject();
    };

    const updateOverlay = (msg) => {
        const el = document.getElementById('overlay-msg');
        if (el) el.textContent = msg;
    };

    const showLoadingOverlay = (msg) => {
        isValidating = true;
        const alertaRoja = document.getElementById('alerta-banner');
        if (alertaRoja) alertaRoja.remove();
        updateOverlay(msg);
        blockingOverlay.style.display = 'flex';
    };

    const hideLoadingOverlay = () => {
        isValidating = false;
        blockingOverlay.style.display = 'none';
        updateAlertaBanner();
    };

    const getEstadoEfectivo = (p) => p._estado_rpa || p.estado_rpa || null;
    const getSeguroExtraido = (p) => p._seguro_extraido || p.seguro_extraido || null;
    const getUltimaValidacion = (p) => p._ultima_validacion_rpa || p.ultima_validacion_rpa || null;

    const renderTable = () => {
        tbodyPacientes.innerHTML = '';
        if (currentPagePatients.length === 0) {
            tablePacientes.style.display = 'none';
            paginationContainer.innerHTML = '';
            updateAlertaBanner();
            updatePatientCount();
            return;
        }

        const start = (crCurrentPage - 1) * crRowsPerPage;

        const formatDniDisplay = (dni, tipo) => {
            const PREFIX_MAP = { DNI: '', DNI_TEMPORAL: 'E- ', CARNET_EXT: 'C.E ' };
            const prefix = PREFIX_MAP[tipo] || '';
            return prefix ? prefix + dni : dni;
        };

        currentPagePatients.forEach(p => {
            const tr = document.createElement('tr');

            let nacFormateada = p.fecha_nacimiento || '';
            if (nacFormateada && nacFormateada.includes('-')) {
                const dateParts = nacFormateada.split('-');
                nacFormateada = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            }

            const seguroExtraido = getSeguroExtraido(p);
            const estadoRPA = getEstadoEfectivo(p);
            const ultimaValidacion = getUltimaValidacion(p);
            const isFallecido = p.condicion && p.condicion.toUpperCase() === 'FALLECIDO';

            const seguroDeclarado = p.tipo_seguro || 'NO DECLARADO';
            const seguroDeclaradoHTML = `<span class="seguro-badge">${seguroDeclarado}</span>`;

            let seguroExtraidoHTML;
            if (seguroExtraido) {
                seguroExtraidoHTML = `<span class="seguro-badge" style="color: #0f172a;">${seguroExtraido}</span>`;
            } else {
                seguroExtraidoHTML = `<span class="condicion-badge" style="background:#f1f5f9; color:#94a3b8; border-left:3px solid #cbd5e1;">N/A</span>`;
            }

            let estadoHTML;
            if (estadoRPA === 'ÉXITO' || estadoRPA === 'EXITO') {
                estadoHTML = `<span class="condicion-badge cond-alta">ÉXITO</span>`;
            } else if (estadoRPA === 'ALERTA') {
                estadoHTML = `<span class="condicion-badge cond-fallecido">ALERTA</span>`;
                tr.classList.add('row-alerta');
            } else if (estadoRPA === 'ERROR') {
                estadoHTML = `<span class="condicion-badge" style="background:#fef3c7; color:#d97706; border-left:3px solid #f59e0b;">ERROR</span>`;
            } else {
                estadoHTML = `<span class="condicion-badge" style="background:#f1f5f9; color:#94a3b8; border-left:3px solid #cbd5e1;">N/A</span>`;
            }

            const condicionStyles = {
                'HOSPITALIZADO': 'background:#e0f2fe; color:#0284c7; border-left:3px solid #0ea5e9;',
                'ALTA': 'background:#dcfce7; color:#16a34a; border-left:3px solid #22c55e;',
                'FALLECIDO': 'background:#fee2e2; color:#dc2626; border-left:3px solid #ef4444;',
            };
            const condicionVal = p.condicion || '';
            const condicionStyle = condicionStyles[condicionVal.toUpperCase()] || 'background:#f1f5f9; color:#94a3b8; border-left:3px solid #cbd5e1;';
            const condicionHTML = `<span class="condicion-badge" style="${condicionStyle}">${condicionVal || 'N/A'}</span>`;

            let ultValidacionHTML = '<span style="color:#94a3b8; font-size:12px;">—</span>';
            if (ultimaValidacion) {
                const fecha = new Date(ultimaValidacion);
                ultValidacionHTML = `<span style="font-size:12px; color:#475569;">${fecha.toLocaleDateString('es-PE')} ${fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>`;
            }

            let accionHTML = `<span style="color:#cbd5e1; font-size:14px;">—</span>`;
            if (isFallecido) {
                accionHTML = `<span style="color:#ef4444; font-size:12px; font-weight:bold;"><i class="fa-solid fa-lock"></i> Bloqueado</span>`;
            } else if (seguroExtraido && estadoRPA !== 'ÉXITO' && estadoRPA !== 'EXITO') {
                accionHTML = `<button class="btn-revalidar" data-dni="${p.dni}" title="${estadoRPA === 'ALERTA' ? 'Corregir cobertura' : 'Re-validar'}" style="background:none; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; cursor:pointer; color:${estadoRPA === 'ALERTA' ? '#ef4444' : '#3b82f6'}; transition:all 0.2s;">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>`;
            }
            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="patient-checkbox" data-dni="${p.dni}" ${selectedDNIs.includes(p.dni) ? 'checked' : ''} ${isFallecido ? 'disabled' : ''}>
                </td>
                <td>${formatDniDisplay(p.dni, p.tipo_documento)}</td>
                <td>
                    <div style="color:#0f172a;">${p.apellidos}, ${p.nombres}</div>
                    ${nacFormateada ? `<div style="font-size:11px; color:#94a3b8; margin-top:2px;"><i class="fa-regular fa-calendar" style="margin-right:3px;"></i>${nacFormateada}</div>` : ''}
                </td>
                <td>${p.historia_clinica || 'N/A'}</td>
                <td>${seguroDeclaradoHTML}</td>
                <td>${seguroExtraidoHTML}</td>
                <td>${estadoHTML}</td>
                <td>${condicionHTML}</td>
                <td>${p.servicio || 'N/A'}</td>
                <td>${ultValidacionHTML}</td>
                <td style="text-align:center;">${accionHTML}</td>
            `;

            const checkbox = tr.querySelector('.patient-checkbox');
            checkbox.addEventListener('change', (e) => {
                const dni = e.target.getAttribute('data-dni');
                if (e.target.checked) {
                    if (selectedDNIs.length >= 20) {
                        e.target.checked = false;
                        showToast('Solo se pueden seleccionar como máximo 20 pacientes.', true);
                        return;
                    }
                    selectedDNIs.push(dni);
                } else {
                    selectedDNIs = selectedDNIs.filter(d => d !== dni);
                }
                updateActionsBar();
            });

            const btnRevalidar = tr.querySelector('.btn-revalidar');
            if (btnRevalidar) {
                btnRevalidar.addEventListener('click', () => {
                    const dni = btnRevalidar.getAttribute('data-dni');
                    const paciente = currentPagePatients.find(p => p.dni === dni);
                    const estado = getEstadoEfectivo(paciente);

                    if (estado === 'ALERTA') {

                        openModalCambioCobertura(paciente);
                    } else {

                        if (!selectedDNIs.includes(dni)) {
                            if (selectedDNIs.length >= 20) {
                                showToast('Desmarque un paciente para re-validar este.', true);
                                return;
                            }
                            selectedDNIs.push(dni);
                            updateActionsBar();
                        }
                        document.getElementById('btn-validar').click();
                    }
                });
            }

            tbodyPacientes.appendChild(tr);
        });

        tablePacientes.style.display = 'table';
        updateAlertaBanner();
        updatePatientCount();
    };

    const renderPagination = () => {
        const totalPages = Math.ceil(totalPatients / crRowsPerPage) || 1;
        DynamicTable.renderPagination({
            containerId: 'pagination-consulta',
            currentPage: crCurrentPage,
            totalPages,
            onPageChange: (page) => {
                crCurrentPage = page;
                loadPacientes();
            }
        });
    };

    const loadPacientes = async () => {
        const dniHc = inputDniHc.value.trim();
        const apellidos = inputApellidos.value.trim();
        const condicionVal = filterCondicion.value;
        const servicioVal = filterServicio.value;
        let { start: fechaDesde, end: fechaHasta } = getDateRangeValues();

        selectedDNIs = [];
        updateActionsBar();

        ({ start: fechaDesde, end: fechaHasta } = getDateRangeValues());

        if (!dniHc && !apellidos && !fechaDesde && !fechaHasta && !condicionVal && !servicioVal && !hastaHoyActive) {
            showToast('Use los filtros para buscar pacientes.', true);
            return;
        }

        loadingIndicator.style.display = 'block';
        tablePacientes.style.display = 'none';
        paginationContainer.innerHTML = '';

        try {
            const startRange = (crCurrentPage - 1) * crRowsPerPage;
            const endRange = startRange + crRowsPerPage - 1;

            let query = supabaseClient.from('pacientes').select('*', { count: 'exact' }).order('creado_en', { ascending: false }).range(startRange, endRange);

            if (dniHc) query = query.or(`dni.ilike.%${dniHc}%,historia_clinica.ilike.%${dniHc}%`);
            if (apellidos) query = query.ilike('apellidos', `%${normalizeText(apellidos)}%`);
            if (fechaDesde) query = query.gte('creado_en', `${fechaDesde}T00:00:00`);
            if (fechaHasta) query = query.lte('creado_en', `${fechaHasta}T23:59:59`);
            if (condicionVal) query = query.eq('condicion', condicionVal);
            if (servicioVal) query = query.eq('servicio', servicioVal);
            if (hastaHoyActive) {
                const ahora = new Date();
                const pad = n => String(n).padStart(2, '0');
                const hoyStr = `${ahora.getFullYear()}-${pad(ahora.getMonth()+1)}-${pad(ahora.getDate())}`;
                query = query.lte('creado_en', `${hoyStr}T23:59:59`);
            }

            const { data, error, count } = await query;

            if (error) throw error;

            currentPagePatients = data || [];
            totalPatients = count || 0;

            if (data.length === 0) {
                showToast('No se encontraron pacientes.');
            }

            renderTable();
            renderPagination();
        } catch (err) {
            showToast('Error al buscar pacientes', true);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    };

    btnSearch.addEventListener('click', () => {
        crCurrentPage = 1;
        loadPacientes();
    });

    [inputDniHc, inputApellidos].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                crCurrentPage = 1;
                loadPacientes();
            }
        });
    });

    btnClear.addEventListener('click', () => {
        inputDniHc.value = '';
        inputApellidos.value = '';
        if (crClearDni) crClearDni.style.display = 'none';
        if (crClearAp) crClearAp.style.display = 'none';
        crRangeStart = null;
        crRangeEnd = null;
        updateDateDisplay();
        hastaHoyActive = false;
        btnHastaHoy.classList.remove('active');
        filterCondicion.value = '';
        if (filterCondicion.customDropdownUpdate) filterCondicion.customDropdownUpdate();
        filterServicio.value = '';
        if (filterServicio.customDropdownUpdate) filterServicio.customDropdownUpdate();
        currentPagePatients = [];
        totalPatients = 0;
        selectedDNIs = [];
        updateActionsBar();
        crCurrentPage = 1;
        renderTable();
    });

    const btnCancelValidacion = document.getElementById('btn-cancel-validacion');
    if (btnCancelValidacion) {
        btnCancelValidacion.addEventListener('click', () => {
            if (currentSearchController) {
                currentSearchController.abort();
            }
        });
    }

    const btnValidar = document.getElementById('btn-validar');
    btnValidar.addEventListener('click', async () => {
        if (selectedDNIs.length === 0) return;

        const nonDniSelected = selectedDNIs.some(dni => {
            const p = currentPagePatients.find(pac => pac.dni === dni);
            return p && p.tipo_documento && p.tipo_documento !== 'DNI';
        });

        if (nonDniSelected) {
            if (window.showSystemTooltip) {
                window.showSystemTooltip('Este paciente no cuenta con\nCódigo de Verificación\npara realizar la consulta', true);
            }
            return;
        }

        currentSearchController = new AbortController();
        const signal = currentSearchController.signal;

        btnValidar.disabled = true;
        showLoadingOverlay('Validando seguro en EsSalud...');

        try {
            const pacientesParaValidar = selectedDNIs.map(dni => {
                return currentPagePatients.find(p => p.dni === dni);
            }).filter(p => p && (!p.condicion || p.condicion.toUpperCase() !== 'FALLECIDO'))
                .map(paciente => ({
                    dni: paciente.dni,
                    fecha_nacimiento: paciente.fecha_nacimiento || '',
                    codigo_verificacion: paciente.codigo_verificacion || ''
                }));

            if (pacientesParaValidar.length === 0) {
                showToast('Ningún paciente válido seleccionado.', true);
                btnValidar.disabled = false;
                hideLoadingOverlay();
                return;
            }

            const isLocal = !window.location.hostname || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const RPA_URL = isLocal ? 'https://lens-answers-accidents-emerald.trycloudflare.com/validate-batch' : '/api/rpa';
            const body = isLocal ? { pacientes: pacientesParaValidar } : { endpoint: 'validate-batch', pacientes: pacientesParaValidar };
            const response = await fetch(RPA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: signal
            });

            if (!response.ok) throw new Error('Error en la respuesta del servidor RPA');

            const result = await response.json();

            if (result.success) {
                const ahora = new Date().toISOString();

                for (const res of result.results) {
                    const paciente = currentPagePatients.find(p => p.dni === res.dni);
                    if (!paciente) continue;

                    const seguroDeclarado = (paciente.tipo_seguro || '').toUpperCase();
                    const seguroExtraido = (res.seguro || '').toUpperCase();

                    let estado;
                    if (seguroExtraido.includes('SIN COBERTURA') || seguroExtraido.includes('NO TIENE')) {
                        estado = 'ÉXITO';
                    } else if (seguroDeclarado === seguroExtraido || seguroExtraido.includes(seguroDeclarado) || seguroDeclarado.includes(seguroExtraido)) {
                        estado = 'ÉXITO';
                    } else if (!res.success) {
                        estado = 'ERROR';
                    } else {
                        estado = 'ALERTA';
                    }

                    paciente._seguro_extraido = res.seguro;
                    paciente._estado_rpa = estado;
                    paciente._ultima_validacion_rpa = ahora;

                    try {
                        await supabaseClient.from('pacientes').update({
                            seguro_extraido: res.seguro,
                            estado_rpa: estado,
                            ultima_validacion_rpa: ahora
                        }).eq('id', paciente.id);

                        await supabaseClient.from('validaciones_rpa').insert({
                            paciente_id: paciente.id,
                            dni: res.dni,
                            seguro_declarado: paciente.tipo_seguro,
                            seguro_extraido: res.seguro,
                            estado_validacion: estado,
                            fecha_validacion: ahora
                        });
                    } catch (dbErr) {
                    }

                    if (estado === 'ALERTA') {
                        showToast(`⚠️ Alerta en DNI: ${res.dni} — Seguro no coincide`, true);
                    }
                }

                showToast('Validación completada');

                selectedDNIs = [];
                updateActionsBar();
                renderTable();
            }

        } catch (err) {
            console.error('[RPA] Error:', err);
            if (err.name === 'AbortError' || err.message === 'AbortError') {
                showToast('Validación cancelada');
            } else {
                const errMsg = err.name + ': ' + (err.message || err);
                showToast('Error al conectar con el servicio RPA: ' + errMsg, true);
                try { navigator.clipboard.writeText('[RPA Error] ' + errMsg + '\nStack:\n' + (err.stack || '(no stack)')); } catch (_) {}
            }
        } finally {
            btnValidar.disabled = false;
            hideLoadingOverlay();
            currentSearchController = null;
        }
    });

    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalGuardar = document.getElementById('modal-guardar');
    const modalNuevoSeguro = document.getElementById('modal-nuevo-seguro');

    let hospActiva = null;

    const showModalCobertura = (paciente) => {
        modalPacienteActual = paciente;

        document.getElementById('modal-paciente-nombre').textContent = `${paciente.apellidos}, ${paciente.nombres}`;
        document.getElementById('modal-paciente-info').textContent = `DNI: ${paciente.dni} | HC: ${paciente.historia_clinica || 'N/A'}`;

        const seguroActual = paciente.tipo_seguro || '';
        document.getElementById('modal-seguro-actual').value = seguroActual;
        document.getElementById('modal-seguro-extraido').value = getSeguroExtraido(paciente) || '';

        const opciones = modalNuevoSeguro.querySelectorAll('option');
        opciones.forEach(opt => {
            opt.disabled = opt.value && opt.value.toUpperCase() === seguroActual.toUpperCase();
        });
        modalNuevoSeguro.value = '';
        document.getElementById('modal-observacion').value = '';

        modalOverlay.style.display = 'flex';
    };

    const openModalCambioCobertura = async (paciente) => {

        const { data: hospData, error: hospError } = await supabaseClient
            .from('hospitalizaciones')
            .select('*')
            .eq('paciente_id', paciente.id)
            .eq('activa', true)
            .limit(1);

        if (hospError) {
            showToast('Error al verificar hospitalización: ' + hospError.message, true);
            return;
        }

        if (hospData && hospData.length > 0) {

            hospActiva = hospData[0];
            showModalCobertura(paciente);
        } else {

            hospActiva = null;
            openModalIngresoRapido(paciente);
        }
    };

    const closeModal = () => {
        modalOverlay.style.display = 'none';
        modalPacienteActual = null;
    };

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    const modalIngresoOverlay = document.getElementById('modal-ingreso-overlay');
    const modalIngresoClose = document.getElementById('modal-ingreso-close');
    const modalIngresoGuardar = document.getElementById('modal-ingreso-guardar');
    let pendingIngresoPaciente = null;

    const openModalIngresoRapido = (paciente) => {
        pendingIngresoPaciente = paciente;

        document.getElementById('modal-ingreso-nombre').textContent = `${paciente.apellidos}, ${paciente.nombres}`;
        document.getElementById('modal-ingreso-info').textContent = `DNI: ${paciente.dni} | HC: ${paciente.historia_clinica || 'N/A'}`;

        const peruNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const isoDate = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}-${String(peruNow.getDate()).padStart(2, '0')}`;
        const horaActual = peruNow.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

        document.getElementById('modal-ingreso-fecha').value = isoDate;
        document.getElementById('modal-ingreso-hora').value = horaActual;

        modalIngresoOverlay.style.display = 'flex';
    };

    const closeModalIngreso = () => {
        modalIngresoOverlay.style.display = 'none';
        pendingIngresoPaciente = null;
    };

    modalIngresoClose.addEventListener('click', closeModalIngreso);
    modalIngresoOverlay.addEventListener('click', (e) => {
        if (e.target === modalIngresoOverlay) closeModalIngreso();
    });

    modalIngresoGuardar.addEventListener('click', async () => {
        if (!pendingIngresoPaciente) return;

        const fechaIngreso = document.getElementById('modal-ingreso-fecha').value;
        const horaIngreso = document.getElementById('modal-ingreso-hora').value || '08:00';

        if (!fechaIngreso) {
            showToast('Seleccione una fecha de ingreso', true);
            return;
        }

        const spinner = document.getElementById('modal-ingreso-spinner');
        const guardarText = document.getElementById('modal-ingreso-guardar-text');
        modalIngresoGuardar.disabled = true;
        spinner.style.display = 'inline-block';
        guardarText.textContent = 'Registrando...';

        try {
            const paciente = pendingIngresoPaciente;

            const { data: hospExistentes } = await supabaseClient
                .from('hospitalizaciones')
                .select('numero_registro')
                .eq('paciente_id', paciente.id)
                .order('numero_registro', { ascending: false })
                .limit(1);

            const nextNum = (hospExistentes && hospExistentes.length > 0) ? hospExistentes[0].numero_registro + 1 : 1;

            const { data: { session } } = await supabaseClient.auth.getSession();
            const userId = session ? session.user.id : null;

            const { data: newHosp, error: hospError } = await supabaseClient.from('hospitalizaciones').insert([{
                paciente_id: paciente.id,
                fecha_ingreso: fechaIngreso,
                hora_ingreso: horaIngreso,
                servicio: paciente.servicio || 'No especificado',
                activa: true,
                creado_por: userId,
                numero_registro: nextNum
            }]).select().single();

            if (hospError) throw hospError;

            if (!paciente.condicion || paciente.condicion.toUpperCase() !== 'HOSPITALIZADO') {
                await supabaseClient.from('pacientes').update({ condicion: 'Hospitalizado' }).eq('id', paciente.id);
                paciente.condicion = 'Hospitalizado';
            }

            hospActiva = newHosp;

            showToast('Registro de hospitalización creado');

            closeModalIngreso();

            showModalCobertura(paciente);

        } catch (err) {
            showToast('Error al registrar ingreso: ' + (err.message || err), true);
        } finally {
            modalIngresoGuardar.disabled = false;
            spinner.style.display = 'none';
            guardarText.textContent = 'Registrar Ingreso';
        }
    });

    modalGuardar.addEventListener('click', async () => {
        if (!modalPacienteActual) return;
        const nuevoSeguro = modalNuevoSeguro.value;
        if (!nuevoSeguro) {
            showToast('Seleccione un nuevo tipo de seguro', true);
            return;
        }

        const spinner = document.getElementById('modal-spinner');
        const guardarText = document.getElementById('modal-guardar-text');
        modalGuardar.disabled = true;
        spinner.style.display = 'inline-block';
        guardarText.textContent = 'Guardando...';

        try {
            const paciente = modalPacienteActual;
            const ahora = new Date().toISOString();
            const seguroExtraido = getSeguroExtraido(paciente) || '';

            const eventoPayload = {
                paciente_id: paciente.id,
                tipo_evento: 'Cambio Cobertura',
                detalle: document.getElementById('modal-observacion').value || `Cambio por validación RPA: ${paciente.tipo_seguro} → ${nuevoSeguro}`,
                nuevo_seguro: nuevoSeguro,
                fecha_evento: ahora
            };

            if (hospActiva && hospActiva.id) {
                eventoPayload.hospitalizacion_id = hospActiva.id;
            }

            await supabaseClient.from('historial_eventos').insert(eventoPayload);

            const nuevoUpper = nuevoSeguro.toUpperCase();
            const extraidoUpper = seguroExtraido.toUpperCase();
            const nuevoEstado = (nuevoUpper === extraidoUpper || extraidoUpper.includes(nuevoUpper) || nuevoUpper.includes(extraidoUpper)) ? 'ÉXITO' : 'ALERTA';

            await supabaseClient.from('pacientes').update({
                tipo_seguro: nuevoSeguro.toUpperCase(),
                estado_rpa: nuevoEstado,
                ultima_validacion_rpa: ahora
            }).eq('id', paciente.id);

            await supabaseClient.from('validaciones_rpa').insert({
                paciente_id: paciente.id,
                dni: paciente.dni,
                seguro_declarado: nuevoSeguro.toUpperCase(),
                seguro_extraido: seguroExtraido,
                estado_validacion: nuevoEstado,
                fecha_validacion: ahora
            });

            paciente.tipo_seguro = nuevoSeguro.toUpperCase();
            paciente._estado_rpa = nuevoEstado;
            paciente.estado_rpa = nuevoEstado;
            paciente._ultima_validacion_rpa = ahora;

            renderTable();

            if (nuevoEstado === 'ÉXITO') {
                showToast('Cobertura actualizada correctamente');
            } else {
                showToast('Cobertura actualizada — aún hay discrepancia', true);
            }

            closeModal();

        } catch (err) {
            showToast('Error al guardar el cambio de cobertura', true);
        } finally {
            modalGuardar.disabled = false;
            spinner.style.display = 'none';
            guardarText.textContent = 'Actualizar Cobertura';
        }
    });

    const handleAutoExecute = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const autoDNI = urlParams.get('dni');
        const autoTrigger = urlParams.get('auto') === 'true';

        if (autoDNI) {
            inputDniHc.value = autoDNI;
            if (autoTrigger) {

                await loadPacientes();

                const pac = currentPagePatients.find(p => p.dni === autoDNI);
                if (pac && (!pac.tipo_documento || pac.tipo_documento === 'DNI') && (!pac.condicion || pac.condicion.toUpperCase() !== 'FALLECIDO')) {
                    if (!selectedDNIs.includes(autoDNI)) {
                        selectedDNIs.push(autoDNI);
                        updateActionsBar();
                        renderTable();
                    }

                    setTimeout(() => {
                        btnValidar.click();
                    }, 500);
                }
            }
        }
    };

    await loadSusaludCreds();
    initSusaludCopy();
    btnHastaHoy.classList.add('active');
    triggerActionsSearch();
    await handleAutoExecute();

    updateCrClear(inputDniHc, crClearDni);
    updateCrClear(inputApellidos, crClearAp);
});
