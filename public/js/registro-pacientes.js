document.addEventListener('DOMContentLoaded', async () => {

    (function () {
        const tpl = document.getElementById('tpl-calendar-popover');
        if (tpl) {
            ['fnac', 'rp-fi'].forEach(function (prefix) {
                const target = document.getElementById(prefix + '-popover');
                if (target) target.innerHTML = tpl.innerHTML.replace(/\{prefix\}/g, prefix);
            });
        }
    }());

    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();

    if (!session) {
        window.location.href = '../../index.html';
        return;
    }
    const userId = session.user.id;

    const viewLista = document.getElementById('view-lista');
    const viewForm = document.getElementById('view-form');
    const btnNew = document.getElementById('local-new-patient-btn');
    const moduleCommands = document.querySelector('.module-commands');
    const dashboardLegends = document.querySelector('.dashboard-legends');

    const form = document.getElementById('registro-form');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnGuardar = document.getElementById('btn-guardar');
    const textGuardar = document.getElementById('guardar-text');
    const spinnerGuardar = document.getElementById('guardar-spinner');

    const selectSeguro = document.getElementById('paciente-seguro');
    const grupoOtros = document.getElementById('grupo-otros');
    const inputOtros = document.getElementById('paciente-seguro-otros');
    const tbody = document.getElementById('tabla-pacientes');
    const btnSearchDni = document.getElementById('btn-search-dni');
    const btnExecSearch = document.getElementById('execute-search');
    const loadingIndicator = document.getElementById('loading-indicator');
    const tableElement = document.getElementById('table-element');

    const filterServicio = document.getElementById('filter-servicio');
    const filterCondicion = document.getElementById('filter-condicion');
    const btnClearFilterServicio = document.getElementById('clear-filter-servicio');
    const inputDni = document.getElementById('paciente-dni');
    const tipoDocumento = document.getElementById('tipo-documento');
    const dniPrefix = document.getElementById('dni-prefix');
    const dvGroup = document.getElementById('dv-group');
    const fieldHc = document.getElementById('field-hc');
    const fieldCondicion = document.getElementById('field-condicion');

    const fechaIngresoData = document.getElementById('fecha-ingreso-data');
    const horaIngresoData = document.getElementById('hora-ingreso-data');
    const btnReintentarHosp = document.getElementById('btn-reintentar-hosp');

    const rpFiTrigger = document.getElementById('rp-fi-trigger');
    const rpFiInput = document.getElementById('rp-fi-input');
    const rpFiPopover = document.getElementById('rp-fi-popover');
    const rpFiGrid = document.getElementById('rp-fi-days-grid');
    const rpFiTitle = document.getElementById('rp-fi-title');
    const rpFiMonth = document.getElementById('rp-fi-month');
    const rpFiYear = document.getElementById('rp-fi-year');
    const rpFiPrev = document.getElementById('rp-fi-prev');
    const rpFiNext = document.getElementById('rp-fi-next');
    const rpFiToday = document.getElementById('rp-fi-today');
    const rpHoraInput = document.getElementById('rp-hora-ingreso');

    const fnacInput = document.getElementById('paciente-fecha-nac');
    const fnacTrigger = document.getElementById('fnac-trigger');
    const fnacPopover = document.getElementById('fnac-popover');
    const fnacGrid = document.getElementById('fnac-days-grid');
    const fnacTitle = document.getElementById('fnac-title');
    const fnacMonth = document.getElementById('fnac-month');
    const fnacYear = document.getElementById('fnac-year');
    const fnacPrev = document.getElementById('fnac-prev');
    const fnacNext = document.getElementById('fnac-next');
    const fnacToday = document.getElementById('fnac-today');

    const PREFIX_MAP = { DNI: '', DNI_TEMPORAL: 'E- ', CARNET_EXT: 'C.E ' };

    const SERVICIO_COLORES = {
        'Cirugía':       { text: '#dc2626', bg: '#fef2f2' },
        Emergencia:      { text: '#d97706', bg: '#fffbeb' },
        'Ginecología':   { text: '#db2777', bg: '#fdf2f8' },
        Medicina:        { text: '#2563eb', bg: '#eff6ff' },
        'Neonatología':  { text: '#0d9488', bg: '#f0fdfa' },
        'Pediatría':     { text: '#0891b2', bg: '#ecfeff' },
        Puerperio:       { text: '#9333ea', bg: '#faf5ff' },
        'Salud mental':  { text: '#4f46e5', bg: '#eef2ff' },
        'Shock trauma':  { text: '#ea580c', bg: '#fff7ed' },
        UVI:             { text: '#e11d48', bg: '#fff1f2' }
    };

    const getRawDni = () => inputDni.value.replace(/[^0-9]/g, '');

    const formatDniDisplay = (dni, tipo) => {
        const prefix = PREFIX_MAP[tipo] || '';
        return prefix ? prefix + dni : dni;
    };

    const handleTipoDocumentoChange = () => {
        const tipo = tipoDocumento.value;
        const prefix = PREFIX_MAP[tipo];

        dniPrefix.textContent = prefix;
        dniPrefix.style.display = prefix ? 'flex' : 'none';
        inputDni.placeholder = '';
        inputDni.style.borderRadius = prefix ? '0 8px 8px 0' : '8px';

        dvGroup.style.display = tipo === 'DNI' ? 'block' : 'none';

        inputDni.focus();

        const dniValue = getRawDni();
        if (tipo === 'DNI_TEMPORAL' && dniValue) {
            tryAutoFillTemporal(dniValue);
        }
    };

    const highlightError = (el) => {

        var target = el;
        if (el.tagName === 'SELECT' && el.style.display === 'none') {
            var wrapper = document.getElementById('custom-' + el.id);
            if (wrapper) target = wrapper;
        } else {
            var box = el.closest('.global-search-box');
            if (box) target = box;
        }

        if (target.dataset.errorActive === '1') return;
        target.dataset.errorActive = '1';
        var origBorder = target.style.borderColor;
        var origShadow = target.style.boxShadow;
        target.style.borderColor = '#ef4444';
        target.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';

        var clearError = function () {
            target.style.borderColor = origBorder || '';
            target.style.boxShadow = origShadow || '';
            target.dataset.errorActive = '0';
            el.removeEventListener('input', clearError);
            el.removeEventListener('change', clearError);
            if (target !== el) {
                target.removeEventListener('change', clearError);
            }
        };

        el.addEventListener('input', clearError);
        el.addEventListener('change', clearError);
        if (target !== el) {
            target.addEventListener('change', clearError);
        }
        setTimeout(clearError, 5000);
    };

    const validateForm = () => {

        if (document.getElementById('paciente-id').value) return true;

        const missing = [];
        const isDni = (tipoDocumento?.value || 'DNI') === 'DNI';

        if (isDni) {
            if (getRawDni().length !== 8) {
                missing.push({ el: inputDni, msg: 'El DNI debe tener exactamente 8 dígitos' });
            }
        } else {
            var rawDni = getRawDni();
            if (!rawDni) {
                missing.push({ el: inputDni, msg: 'El documento es obligatorio' });
            } else if (rawDni.length < 5) {
                missing.push({ el: inputDni, msg: 'El documento debe tener al menos 5 dígitos' });
            }
        }

        const apellidos = document.getElementById('paciente-apellidos');
        if (!apellidos.value.trim()) {
            missing.push({ el: apellidos, msg: 'El campo Apellidos es obligatorio' });
        }

        const nombres = document.getElementById('paciente-nombres');
        if (!nombres.value.trim()) {
            missing.push({ el: nombres, msg: 'El campo Nombres es obligatorio' });
        }

        const fechaNac = document.getElementById('paciente-fecha-nac');
        if (!fechaNac.value.trim()) {
            missing.push({ el: fechaNac, msg: 'La Fecha de Nacimiento es obligatoria' });
        }

        if (!isModal) {
            const hc = document.getElementById('paciente-hc');
            if (!hc.value.trim()) {
                missing.push({ el: hc, msg: 'El Nº Historia Clínica es obligatorio' });
            }
        }

        if (!selectSeguro.value) {
            missing.push({ el: selectSeguro, msg: 'El Tipo de Seguro es obligatorio' });
        }

        if (isDni) {
            const codVer = document.getElementById('paciente-codigo-ver');
            if (!codVer.value.trim()) {
                missing.push({ el: codVer, msg: 'El Código de Verificación es obligatorio' });
            }
        }

        const servicio = document.getElementById('paciente-servicio');
        if (!servicio.value || servicio.value === 'Seleccione Servicio') {
            missing.push({ el: servicio, msg: 'El Servicio es obligatorio' });
        }

        if (missing.length === 0) return true;

        const first = missing[0];
        if (window.showSystemTooltip) window.showSystemTooltip(first.msg, true);
        if (first.el && first.el.focus) {
            first.el.focus();
            first.el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
        highlightError(first.el);
        return false;
    };

    inputDni.addEventListener('input', function () {
        const isDni = (tipoDocumento?.value || 'DNI') === 'DNI';
        const limit = isDni ? 8 : 15;
        const digits = this.value.replace(/[^0-9]/g, '').slice(0, limit);
        if (digits !== this.value) this.value = digits;
    });

    tipoDocumento.addEventListener('change', handleTipoDocumentoChange);

    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const setSelectValueCaseInsensitive = (selectElement, value) => {
        if (!selectElement || !value) return;
        const normalizedValue = value.toString().trim().toUpperCase();
        for (let i = 0; i < selectElement.options.length; i++) {
            const optValue = selectElement.options[i].value.trim().toUpperCase();
            const optText = selectElement.options[i].text.trim().toUpperCase();
            if (optValue === normalizedValue || optText === normalizedValue) {
                selectElement.selectedIndex = i;
                return;
            }
        }
    };

    const isModal = new URLSearchParams(window.location.search).get('view') === 'modal';

    const checkAutoFill = () => {
        const dataStr = sessionStorage.getItem('cd_auto_fill');

        if (isModal) {
            viewLista.style.display = 'none';
            viewForm.style.display = 'block';
            if (dashboardLegends) dashboardLegends.style.display = 'none';
            moveBtnOnMobile();
            document.body.style.display = 'block';

            if (fieldCondicion) fieldCondicion.style.display = 'none';

            const hcInput = document.getElementById('paciente-hc');
            if (hcInput) hcInput.placeholder = 'Opcional';
        }

        if (tipoDocumento) {
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

        if (dataStr) {
            const data = JSON.parse(dataStr);
            sessionStorage.removeItem('cd_auto_fill');

            if (data.tipo_documento && tipoDocumento) {
                tipoDocumento.value = data.tipo_documento;
                handleTipoDocumentoChange();
            }
            document.getElementById('paciente-dni').value = data.dni || '';
            document.getElementById('paciente-nombres').value = data.nombres || '';
            document.getElementById('paciente-apellidos').value = data.apellidos || '';
            document.getElementById('paciente-codigo-ver').value = data.codigo_verificacion || '';

            if (data.tipo_seguro) {
                setSelectValueCaseInsensitive(selectSeguro, data.tipo_seguro);
                if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
            }

            if (data.fecha_nacimiento) {
                const parts = data.fecha_nacimiento.split('-');
                if (parts.length === 3) {
                    fnacInput.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            }

            if (window.showSystemTooltip) {
                window.showSystemTooltip('Datos importados desde Consulta de Datos');
            }
        }
    };

    fnacInput.addEventListener('input', function (e) {
        if (e.inputType && e.inputType.startsWith('delete')) return;
        let digits = this.value.replace(/\D/g, '').slice(0, 8);
        let masked = digits;
        if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2);
        if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
        this.value = masked;
    });

    const parseDisplayToISO = (val) => {
        const p = val.split('/');
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : val;
    };

    rpFiInput.addEventListener('input', function (e) {
        if (e.inputType && e.inputType.startsWith('delete')) return;
        let digits = this.value.replace(/\D/g, '').slice(0, 8);
        let masked = digits;
        if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2);
        if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
        this.value = masked;
    });

    let fnacPopoverOpen = false;
    let fnacSelectedDate = null;

    const fnacCal = window.crearCalendario({
        mode: 'single',
        grid: fnacGrid,
        title: fnacTitle,
        month: fnacMonth,
        year: fnacYear,
        prev: fnacPrev,
        next: fnacNext,
        today: fnacToday,
        selectedDate: null,
        onDayClick: (d) => {
            fnacSelectedDate = d;
            fnacInput.value = fmtDate(d);
            closeFnacPopover();
        }
    });

    function openFnacPopover() {
        if (fnacPopoverOpen) { closeFnacPopover(); return; }
        fnacPopoverOpen = true;
        if (fnacSelectedDate) fnacCal.setView(fnacSelectedDate.getFullYear(), fnacSelectedDate.getMonth());
        fnacCal.render();
        const r = fnacInput.getBoundingClientRect();
        const popH = 350;
        const spaceBelow = window.innerHeight - r.bottom - 8;
        if (spaceBelow >= popH) {
            fnacPopover.style.top = (r.bottom + 6) + 'px';
            fnacPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        } else {
            fnacPopover.style.top = Math.max(8, r.top - popH) + 'px';
            fnacPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        }
        fnacPopover.style.display = 'block';
    }

    function closeFnacPopover() {
        fnacPopover.style.display = 'none';
        fnacPopoverOpen = false;
    }

    fnacTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openFnacPopover();
    });

    fnacInput.addEventListener('focus', () => {
        if (!fnacPopoverOpen) openFnacPopover();
    });

    fnacInput.addEventListener('click', () => {
        if (!fnacPopoverOpen) openFnacPopover();
    });

    rpFiInput.addEventListener('focus', (e) => {
        if (rpFiTrigger.dataset.fiLocked === 'true') return;
        openRpFiPopover();
    });

    let currentPage = 1;
    let totalRecords = 0;
    let cursorFirst = null;
    let cursorLast = null;
    let hasPrev = false;
    let hasNext = false;
    let searchQuery = '';
    let filterQuery = '';
    let condicionFilter = '';

    const resetPagination = () => {
        cursorFirst = null;
        cursorLast = null;
        hasPrev = false;
        hasNext = false;
        currentPage = 1;
    };

    const loadServicios = async () => {
        filterServicio.style.color = "#94a3b8";
        if (filterServicio.customDropdownUpdate) {
            filterServicio.customDropdownUpdate();
        }
    };

    const loadPacientes = async (direction = 'first') => {
        try {
            loadingIndicator.style.display = 'block';
            tableElement.style.display = 'none';

            let query = client.from('pacientes').select('*').limit(21);

            if (direction === 'next' && cursorLast) {
                query = query.lt('creado_en', cursorLast).order('creado_en', { ascending: false });
                currentPage++;
            } else if (direction === 'prev' && cursorFirst) {
                query = query.gt('creado_en', cursorFirst).order('creado_en', { ascending: true });
                currentPage--;
            } else {
                query = query.order('creado_en', { ascending: false });
            }

            if (searchQuery) {
                const normQuery = normalizeText(searchQuery);
                query = query.or('dni.ilike.%' + normQuery + '%,apellidos.ilike.%' + normQuery + '%,nombres.ilike.%' + normQuery + '%');
            }

            if (filterQuery) {
                query = query.ilike('servicio', filterQuery.toUpperCase());
            }

            if (condicionFilter) {
                query = query.ilike('condicion', condicionFilter.toUpperCase());
            }

            const { data, error } = await query;
            if (error) throw error;

            let items = data || [];
            if (direction === 'prev') items.reverse();

            const displayItems = items.length > 20 ? items.slice(0, 20) : items;

            if (displayItems.length > 0) {
                cursorLast = displayItems[displayItems.length - 1].creado_en;
                cursorFirst = displayItems[0].creado_en;

                let normQ;
                if (searchQuery) normQ = 'dni.ilike.%' + normalizeText(searchQuery) + '%,apellidos.ilike.%' + normalizeText(searchQuery) + '%,nombres.ilike.%' + normalizeText(searchQuery) + '%';

                let newerQuery = client.from('pacientes').select('*', { count: 'exact', head: true }).gt('creado_en', cursorFirst);
                if (searchQuery) newerQuery = newerQuery.or(normQ);
                if (filterQuery) newerQuery = newerQuery.ilike('servicio', filterQuery.toUpperCase());
                if (condicionFilter) newerQuery = newerQuery.ilike('condicion', condicionFilter.toUpperCase());
                const { count: cntNewer } = await newerQuery;
                hasPrev = (cntNewer || 0) > 0;

                let olderQuery = client.from('pacientes').select('*', { count: 'exact', head: true }).lt('creado_en', cursorLast);
                if (searchQuery) olderQuery = olderQuery.or(normQ);
                if (filterQuery) olderQuery = olderQuery.ilike('servicio', filterQuery.toUpperCase());
                if (condicionFilter) olderQuery = olderQuery.ilike('condicion', condicionFilter.toUpperCase());
                const { count: cntOlder } = await olderQuery;
                hasNext = (cntOlder || 0) > 0;
            } else {
                hasPrev = false;
                hasNext = false;
            }

            (async function () {
                let countQuery = client.from('pacientes').select('*', { count: 'exact', head: true });
                if (searchQuery) countQuery = countQuery.or('dni.ilike.%' + normalizeText(searchQuery) + '%,apellidos.ilike.%' + normalizeText(searchQuery) + '%,nombres.ilike.%' + normalizeText(searchQuery) + '%');
                if (filterQuery) countQuery = countQuery.ilike('servicio', filterQuery.toUpperCase());
                if (condicionFilter) countQuery = countQuery.ilike('condicion', condicionFilter.toUpperCase());
                const { count } = await countQuery;
                totalRecords = count || 0;
            })();

            renderTable(displayItems, 0);
            renderPagination();
            renderLegends();
        } catch (error) {
        } finally {
            loadingIndicator.style.display = 'none';
            tableElement.style.display = 'table';
        }
    };

    const renderLegends = async () => {
        try {
            const container = document.getElementById('servicio-legends');
            if (!container) return;

            let query = client.from('pacientes').select('servicio');

            if (searchQuery) {
                const normQuery = normalizeText(searchQuery);
                query = query.or('dni.ilike.%' + normQuery + '%,apellidos.ilike.%' + normQuery + '%,nombres.ilike.%' + normQuery + '%');
            }

            if (filterQuery) {
                query = query.ilike('servicio', filterQuery.toUpperCase());
            }

            if (condicionFilter) {
                query = query.ilike('condicion', condicionFilter.toUpperCase());
            }

            const { data, error } = await query;
            if (error) return;

            const counts = {};
            (data || []).forEach(function (item) {
                const svc = (item.servicio || '').trim().toUpperCase();
                if (svc) counts[svc] = (counts[svc] || 0) + 1;
            });

            const services = typeof SERVICIOS !== 'undefined' ? SERVICIOS : [];
            const hasRecords = services.some(function (svc) {
                return (counts[svc.toUpperCase()] || 0) > 0;
            });

            if (hasRecords) {
                container.innerHTML = '';
                services.forEach(function (svc) {
                    const key = svc.toUpperCase();
                    const count = counts[key] || 0;
                    if (count === 0) return;

                    const colors = SERVICIO_COLORES[svc] || { text: '#475569', bg: '#f1f5f9' };
                    const el = document.createElement('span');
                    el.className = 'legend-item';
                    el.style.background = colors.bg;
                    el.innerHTML = '\n                        <span class="legend-dot" style="background:' + colors.text + ';"></span>\n                        <span class="legend-label">' + svc.toUpperCase() + '</span>\n                        <span class="legend-count" style="color:' + colors.text + ';">' + count + '</span>\n                    ';
                    container.appendChild(el);
                });
            } else {
                container.innerHTML = '<span style="font-size:13px; color:#94a3b8; font-weight:500;">Sin registros</span>';
            }
        } catch (e) {

        }
    };

    const getCondicionClass = (condicion) => {
        if (!condicion) return '';
        const c = condicion.trim().toUpperCase();
        if (c === 'HOSPITALIZADO') return 'cond-hospitalizado';
        if (c === 'ALTA') return 'cond-alta';
        if (c === 'FALLECIDO' || c === 'FALLECE') return 'cond-fallecido';
        return 'cond-cambio';
    };

    const renderTable = (items, startIndex = 0) => {
        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color:#94a3b8; font-size: 15px;">No se encontraron registros.</td></tr>`;
            return;
        }

        items.forEach((item, idx) => {
            const row = document.createElement('tr');
            const condClass = getCondicionClass(item.condicion);

            let fechaNacDisplay = item.fecha_nacimiento;
            if (item.fecha_nacimiento && item.fecha_nacimiento.includes('-')) {

                const parts = item.fecha_nacimiento.split('-');
                fechaNacDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            row.innerHTML = `
                <td>${formatDniDisplay(item.dni, item.tipo_documento)}</td>
                <td>${item.apellidos}, ${item.nombres}</td>
                <td>${item.historia_clinica || '—'}</td>
                <td><span class="seguro-badge">${item.tipo_seguro}</span></td>
                <td>${item.servicio || '-'}</td>
                <td><span class="condicion-badge ${condClass}">${(item.condicion || '').trim()}</span></td>
                <td style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 8px; align-items: center; min-height: 32px;">
                        <button class="action-btn-edit local-edit-btn" data-id="${item.id}" title="Editar Paciente">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.querySelectorAll('.local-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rowId = e.currentTarget.getAttribute('data-id');
                const p = items.find(x => x.id == rowId);
                if (p) openEditForm(p);
            });
        });

    };

    const openEditForm = async (p) => {
        form.reset();
        document.getElementById('paciente-id').value = p.id;
        document.getElementById('btn-obtener-fnac').style.display = 'none';

        document.getElementById('paciente-dni').disabled = true;

        if (fieldHc) fieldHc.style.display = '';
        if (fieldCondicion) fieldCondicion.style.display = '';

        if (p.tipo_documento && tipoDocumento) {
            tipoDocumento.value = p.tipo_documento;
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }
        document.getElementById('paciente-dni').value = p.dni;
        document.getElementById('paciente-hc').value = p.historia_clinica;

        if (p.fecha_nacimiento) {
            const parts = p.fecha_nacimiento.split('-');
            fnacInput.value = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : p.fecha_nacimiento;
        } else {
            fnacInput.value = '';
        }

        document.getElementById('paciente-apellidos').value = p.apellidos || '';
        document.getElementById('paciente-nombres').value = p.nombres || '';
        document.getElementById('paciente-codigo-ver').value = p.codigo_verificacion || '';

        setSelectValueCaseInsensitive(selectSeguro, p.tipo_seguro);
        if (selectSeguro) {
            selectSeguro.dispatchEvent(new Event('change'));
            if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
        }

        const servEl = document.getElementById('paciente-servicio');
        setSelectValueCaseInsensitive(servEl, p.servicio);
        if (servEl.customDropdownUpdate) servEl.customDropdownUpdate();

        const condEl = document.getElementById('paciente-condicion');
        setSelectValueCaseInsensitive(condEl, p.condicion);
        if (condEl.customDropdownUpdate) condEl.customDropdownUpdate();

        const isOtros = p.tipo_seguro && p.tipo_seguro.toUpperCase() === 'OTROS';
        if (isOtros) {
            inputOtros.value = p.seguro_otros || '';
            inputOtros.required = true;
        } else {
            grupoOtros.style.display = 'none';
            inputOtros.required = false;
        }

        try {
            const { data: hospData } = await client
                .from('hospitalizaciones')
                .select('fecha_ingreso, hora_ingreso')
                .eq('paciente_id', p.id)
                .order('numero_registro', { ascending: false })
                .limit(1);
            if (hospData && hospData.length > 0) {
                setFiStateFromDB(hospData[0].fecha_ingreso, hospData[0].hora_ingreso);
            } else {
                resetFiState();
            }
        } catch {
            resetFiState();
        }

        const isFallecido = p.condicion && p.condicion.toUpperCase() === 'FALLECIDO';
        form.dataset.originalCondicion = p.condicion || '';

        if (isFallecido) {
            btnGuardar.style.display = 'none';
            if(window.showSystemTooltip) window.showSystemTooltip('Edición bloqueada: Paciente fallecido', true);
        } else {
            btnGuardar.style.display = 'flex';
            document.getElementById('paciente-dni').disabled = true;
            if (tipoDocumento) tipoDocumento.disabled = true;

            const disableIfFilled = (el) => {
                if (!el) return;
                const isFilled = !!(el.value && el.value.toString().trim());
                el.disabled = isFilled;
            };

            disableIfFilled(document.getElementById('paciente-hc'));
            disableIfFilled(document.getElementById('paciente-fecha-nac'));
            disableIfFilled(document.getElementById('paciente-apellidos'));
            disableIfFilled(document.getElementById('paciente-nombres'));
            disableIfFilled(document.getElementById('paciente-codigo-ver'));

            selectSeguro.disabled = !!(selectSeguro.value && selectSeguro.value.toString().trim());
            servEl.disabled = !!(servEl.value && servEl.value.toString().trim() && servEl.value !== 'Seleccione Servicio');
            condEl.disabled = true;
            inputOtros.disabled = !!(inputOtros.value && inputOtros.value.toString().trim());

            if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
            if (servEl.customDropdownUpdate) servEl.customDropdownUpdate();
            if (condEl.customDropdownUpdate) condEl.customDropdownUpdate();
            if (tipoDocumento && tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

        viewLista.style.display = 'none';
        moduleCommands.style.display = 'none';
        if (dashboardLegends) dashboardLegends.style.display = 'none';
        viewForm.style.display = 'block';
        const headerBack = document.getElementById('btn-header-back');
        if (headerBack) headerBack.style.display = 'inline-flex';
        if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
        moveBtnOnMobile();
    };

    const renderPagination = () => {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const totalPages = Math.max(1, Math.ceil(totalRecords / 20));

        container.innerHTML = '\n' +
            '            <div class="pagination-wrapper">\n' +
            '                <span class="pagination-info">Página ' + currentPage + ' de ' + totalPages + '</span>\n' +
            '                <button class="pagination-btn" id="btn-prev-page"' + (hasPrev ? '' : ' disabled') + '>\n' +
            '                    <span class="btn-icon"><i class="fa-solid fa-chevron-left"></i></span>\n' +
            '                    <span class="btn-label">Anterior</span>\n' +
            '                </button>\n' +
            '                <button class="pagination-btn" id="btn-next-page"' + (hasNext ? '' : ' disabled') + '>\n' +
            '                    <span class="btn-label">Siguiente</span>\n' +
            '                    <span class="btn-icon"><i class="fa-solid fa-chevron-right"></i></span>\n' +
            '                </button>\n' +
            '            </div>\n' +
            '        ';

        document.getElementById('btn-prev-page') && document.getElementById('btn-prev-page').addEventListener('click', function () {
            loadPacientes('prev');
        });
        document.getElementById('btn-next-page') && document.getElementById('btn-next-page').addEventListener('click', function () {
            loadPacientes('next');
        });
    };

    const executeSearch = () => {
        const val = btnSearchDni.value.trim();
        if (val) {
            searchQuery = val;
            resetPagination();
            loadPacientes();
        }
    };

    btnExecSearch.addEventListener('click', executeSearch);
    btnSearchDni.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    const applyFilterServicio = (val) => {
        if (val) {
            filterQuery = val;
            resetPagination();
            filterServicio.style.color = "#1e293b";
            loadPacientes();
        } else {
            filterQuery = '';
            resetPagination();
            filterServicio.style.color = "#94a3b8";
            loadPacientes();
        }
    };

    filterServicio.addEventListener('change', (e) => {
        applyFilterServicio(e.target.value.trim());
    });

    filterCondicion.addEventListener('change', function (e) {
        condicionFilter = e.target.value || '';
        resetPagination();
        loadPacientes();
    });

    btnClearFilterServicio.addEventListener('click', () => {

        filterQuery = '';
        filterServicio.value = '';
        filterServicio.style.color = "#94a3b8";
        if (filterServicio.customDropdownUpdate) {
            filterServicio.customDropdownUpdate();
        }

        condicionFilter = '';
        filterCondicion.value = '';
        if (filterCondicion.customDropdownUpdate) {
            filterCondicion.customDropdownUpdate();
        }

        searchQuery = '';
        btnSearchDni.value = '';

        resetPagination();
        loadPacientes();
    });

    async function tryAutoFillTemporal(dniVal) {
        if (!dniVal) return;
        const { data, error } = await client
            .from('recien_nacidos_temporales')
            .select('*')
            .or(`cod_temporal.eq.${dniVal},cod_temporal.eq.E-${dniVal}`)
            .maybeSingle();

        if (data) {

            const fullName = (data.nombre_rn || '').trim();
            const parts = fullName.split(/\s+/);
            let apellidos = fullName;
            let nombres = '';
            if (parts.length >= 3) {
                apellidos = parts.slice(0, 2).join(' ');
                nombres = parts.slice(2).join(' ');
            } else if (parts.length === 2) {
                apellidos = parts[0];
                nombres = parts[1];
            }

            const elApellidos = document.getElementById('paciente-apellidos');
            const elNombres = document.getElementById('paciente-nombres');
            if (elApellidos) {
                elApellidos.value = apellidos;
                elApellidos.dispatchEvent(new Event('input'));
                elApellidos.dispatchEvent(new Event('change'));
            }
            if (elNombres) {
                elNombres.value = nombres;
                elNombres.dispatchEvent(new Event('input'));
                elNombres.dispatchEvent(new Event('change'));
            }

            if (data.fecha_nacimiento) {
                const p = data.fecha_nacimiento.split('-');
                if (p.length === 3) {
                    fnacInput.value = `${p[2]}/${p[1]}/${p[0]}`;
                    fnacInput.dispatchEvent(new Event('input'));
                    fnacInput.dispatchEvent(new Event('change'));
                }
            }

            setSelectValueCaseInsensitive(selectSeguro, 'SIS');
            selectSeguro.dispatchEvent(new Event('change'));
            if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();

            if (window.showSystemTooltip) {
                window.showSystemTooltip('Datos importados del registro temporal (SIS)', false);
            }
        }
    }

    inputDni.addEventListener('blur', () => {
        const dniValue = getRawDni();
        const isDni = (tipoDocumento?.value || 'DNI') === 'DNI';

        if (isDni) {
            if (dniValue && dniValue.length !== 8) {
                inputDni.setCustomValidity('El DNI debe contener exactamente 8 dígitos numéricos');
            } else {
                inputDni.setCustomValidity('');
            }
        } else {
            if (!dniValue) {
                inputDni.setCustomValidity('El documento es obligatorio');
            } else if (dniValue.length < 5) {
                inputDni.setCustomValidity('El documento debe tener al menos 5 dígitos');
            } else {
                inputDni.setCustomValidity('');
            }
        }
    });

    let temporalDebounceTimer;
    inputDni.addEventListener('input', () => {
        const dniValue = getRawDni();
        const tipo = tipoDocumento?.value || 'DNI';

        if (tipo === 'DNI') {
            if (dniValue.length === 8) {
                inputDni.setCustomValidity('');
                checkDniExists(dniValue);
            } else {
                removeDniExistsTooltip();
            }
        } else if (tipo === 'DNI_TEMPORAL') {
            removeDniExistsTooltip();
            if (dniValue) {
                clearTimeout(temporalDebounceTimer);
                temporalDebounceTimer = setTimeout(() => {
                    tryAutoFillTemporal(dniValue);
                }, 600);
            }
        } else {
            removeDniExistsTooltip();
        }
    });

    function removeDniExistsTooltip() {
        const existing = document.querySelector('.dni-exists-tooltip');
        if (existing) {
            existing.classList.add('guide-tooltip-exit');
            setTimeout(() => {
                if (existing.parentElement) existing.remove();
            }, 400);
        }
    }

    async function checkDniExists(dni) {
        removeDniExistsTooltip();

        const pacienteId = document.getElementById('paciente-id').value;

        const { data, error } = await client
            .from('pacientes')
            .select('id, apellidos, nombres')
            .eq('dni', dni)
            .maybeSingle();

        if (error) return;

        if (data && data.id != pacienteId) {
            showDniExistsTooltip(dni, data);
        }
    }

    function showDniExistsTooltip(dni, patient) {
        const tooltip = document.createElement('div');
        tooltip.className = 'guide-tooltip dni-exists-tooltip';
        tooltip.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:12px;">
                <i class="fa-solid fa-circle-exclamation" style="color:#ef4444; font-size:18px; flex-shrink:0; margin-top:2px;"></i>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; color:#1e293b; font-size:14px; margin-bottom:2px;">
                        El paciente con DNI <strong style="color:#0f172a;">${dni}</strong> ya existe
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-bottom:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${patient.apellidos}, ${patient.nombres}
                    </div>
                    <button type="button" style="background:transparent; color:#475569; border:1px solid #cbd5e1; border-radius:6px; padding:7px 18px; font-size:13px; font-weight:500; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.08); transition:all 0.2s;" onmouseover="this.style.background='#2563eb'; this.style.color='#ffffff'; this.style.borderColor='#2563eb'; this.style.boxShadow='0 4px 12px rgba(37,99,235,0.3)'" onmouseout="this.style.background='transparent'; this.style.color='#475569'; this.style.borderColor='#cbd5e1'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)'" onclick="window.location.href='../seguimiento/detalle-paciente.html?id=${patient.id}'">
                        Registrar evento
                    </button>
                </div>
                <button type="button" class="dni-exists-close" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:20px; padding:0; line-height:1; flex-shrink:0;">
                    &times;
                </button>
            </div>
        `;

        tooltip.style.position = 'fixed';
        tooltip.style.bottom = '30px';
        tooltip.style.right = '30px';
        tooltip.style.background = '#ffffff';
        tooltip.style.padding = '16px 20px';
        tooltip.style.borderRadius = '10px';
        tooltip.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
        tooltip.style.borderLeft = '4px solid #ef4444';
        tooltip.style.zIndex = '30001';
        tooltip.style.maxWidth = '380px';

        tooltip.querySelector('.dni-exists-close').addEventListener('click', () => {
            tooltip.classList.add('guide-tooltip-exit');
            setTimeout(() => tooltip.remove(), 400);
        });

        document.body.appendChild(tooltip);
    }

    const LOCAL_API_URL = '/api/rpa/get-dob';
    const btnObtenerFnac = document.getElementById('btn-obtener-fnac');
    const btnFnacText = document.getElementById('btn-fnac-text');
    const fnacSpinner = document.getElementById('fnac-spinner');
    const fnacHeaderParent = btnObtenerFnac.parentElement;
    const dnisGroup = document.querySelector('#registro-form > .input-stacked:nth-of-type(1)');

    function moveBtnOnMobile() {
        const container = fnacHeaderParent;
        if (!container || !btnObtenerFnac || !dnisGroup) return;

        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const isInHeader = btnObtenerFnac.parentElement === container;

        if (isMobile && isInHeader) {
            dnisGroup.insertAdjacentElement('afterend', btnObtenerFnac);
        } else if (!isMobile && !isInHeader) {
            container.appendChild(btnObtenerFnac);
        }

        const endedInHeader = btnObtenerFnac.parentElement === container;
        btnObtenerFnac.classList.toggle('col-span-2', !endedInHeader);
        btnObtenerFnac.style.marginBottom = endedInHeader ? '' : '14px';
    }
    window.addEventListener('resize', moveBtnOnMobile);
    moveBtnOnMobile();

    btnObtenerFnac.addEventListener('click', async () => {
        const dniValue = getRawDni();

        if (!dniValue || dniValue.length !== 8) {
            if(window.showSystemTooltip) window.showSystemTooltip('Ingrese un DNI válido de 8 dígitos primero', true);
            return;
        }

        btnObtenerFnac.disabled = true;
        btnFnacText.textContent = 'Consultando...';
        fnacSpinner.style.display = 'inline-block';

        try {
            const response = await fetch(LOCAL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni: dniValue })
            });

            const result = await response.json();

            if (result.success && result.fecha_iso) {
                fnacInput.value = result.fecha_iso;
                fnacSelectedDate = null;

                if(window.showSystemTooltip) window.showSystemTooltip(`Fecha obtenida: ${result.fecha_nac}`);
            } else {
                if(window.showSystemTooltip) window.showSystemTooltip(result.error || 'No se encontró fecha para este DNI', true);
            }
        } catch (err) {
            console.error('[RPA] Error de conexión:', err);
            const errMsg = err.name + ': ' + (err.message || err);
            if(window.showSystemTooltip) window.showSystemTooltip(errMsg, true);
            try { navigator.clipboard.writeText('[RPA Error] ' + errMsg + '\nStack:\n' + (err.stack || '(no stack)')); } catch (_) {}
        } finally {
            btnObtenerFnac.disabled = false;
            btnFnacText.textContent = 'Obtener Fecha de Nacimiento';
            fnacSpinner.style.display = 'none';
        }
    });

    btnNew.addEventListener('click', () => {
        viewLista.style.display = 'none';
        moduleCommands.style.display = 'none';
        if (dashboardLegends) dashboardLegends.style.display = 'none';
        form.reset();
        form.dataset.originalCondicion = '';
        document.getElementById('paciente-id').value = '';
        document.getElementById('btn-obtener-fnac').style.display = 'flex';

        fnacInput.value = '';
        fnacSelectedDate = null;
        fnacCal.setSelected(null);
        fnacCal.setView(new Date().getFullYear(), new Date().getMonth());

        document.querySelectorAll('.standard-input').forEach(el => el.disabled = false);

        if (tipoDocumento) {
            tipoDocumento.value = 'DNI';
            tipoDocumento.disabled = false;
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

        resetFiState();

        selectSeguro.disabled = false;
        if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
        const servEl = document.getElementById('paciente-servicio');
        servEl.value = '';
        servEl.disabled = false;
        if (servEl.customDropdownUpdate) servEl.customDropdownUpdate();

        if (fieldHc) fieldHc.style.display = '';
        if (fieldCondicion) fieldCondicion.style.display = '';

        const condicionSelect = document.getElementById('paciente-condicion');
        condicionSelect.value = 'Hospitalizado';
        condicionSelect.disabled = true;
        if (condicionSelect.customDropdownUpdate) condicionSelect.customDropdownUpdate();

        grupoOtros.style.display = 'none';
        inputOtros.required = false;

        viewForm.style.display = 'block';
        const headerBack = document.getElementById('btn-header-back');
        if (headerBack) headerBack.style.display = 'inline-flex';
        if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
        moveBtnOnMobile();
    });

    btnCancelar.addEventListener('click', () => {
        removeDniExistsTooltip();
        if (isModal) {
            window.parent.postMessage({ action: 'closeModal' }, '*');
        } else {
            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            moduleCommands.style.display = 'flex';
            if (dashboardLegends) dashboardLegends.style.display = 'block';
        }
        const headerBack = document.getElementById('btn-header-back');
        if (headerBack) headerBack.style.display = 'none';
        if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
    });

    selectSeguro.addEventListener('change', (e) => {
        if (e.target.value === 'Otros') {
            grupoOtros.style.display = 'flex';
            inputOtros.required = true;
        } else {
            grupoOtros.style.display = 'none';
            inputOtros.required = false;
            inputOtros.value = "";
        }
    });

    let pendingRetryPacienteId = null;
    let pendingRetryFecha = null;
    let pendingRetryHora = null;

    const toIso = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const getPeruDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const getPeruTimeNow = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtDate = (d) => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';

    let fiSelectedDate = null;

    function resetFiState() {
        fiSelectedDate = null;
        fechaIngresoData.value = '';
        horaIngresoData.value = '';
        rpFiInput.value = '';
        rpFiInput.disabled = false;
        rpFiTrigger.removeAttribute('data-fi-locked');
        rpFiCal.setSelected(null);
        rpFiCal.setView(new Date().getFullYear(), new Date().getMonth());
        rpFiTrigger.style.pointerEvents = '';
        rpFiTrigger.style.cursor = '';
        const icons = rpFiTrigger.querySelectorAll('i');
        icons.forEach(ic => ic.style.color = '');
        rpHoraInput.value = getPeruTimeNow();
        rpHoraInput.disabled = false;
    }

    function setFiStateFromDB(dateStr, timeStr) {
        if (!dateStr) { resetFiState(); return; }
        const parts = dateStr.split('-');
        fiSelectedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        fechaIngresoData.value = dateStr;
        horaIngresoData.value = timeStr || '08:00';
        rpFiInput.value = fmtDate(fiSelectedDate);
        rpFiInput.disabled = true;
        rpFiTrigger.dataset.fiLocked = 'true';
        rpFiTrigger.style.pointerEvents = 'none';
        rpFiTrigger.style.cursor = 'default';
        const icons = rpFiTrigger.querySelectorAll('i');
        icons.forEach(ic => ic.style.color = '#94a3b8');
        rpHoraInput.value = timeStr || '08:00';
        rpHoraInput.disabled = true;
    }

    let rpFiOpen = false;

    const rpFiCal = window.crearCalendario({
        mode: 'single',
        grid: rpFiGrid,
        title: rpFiTitle,
        month: rpFiMonth,
        year: rpFiYear,
        prev: rpFiPrev,
        next: rpFiNext,
        today: rpFiToday,
        selectedDate: null,
        onDayClick: (d) => {
            fiSelectedDate = d;
            rpFiInput.value = fmtDate(d);
            fechaIngresoData.value = toIso(d.getFullYear(), d.getMonth(), d.getDate());
            if (!rpHoraInput.value) rpHoraInput.value = getPeruTimeNow();
            if (rpHoraInput.value) horaIngresoData.value = rpHoraInput.value;
            closeRpFiPopover();
        }
    });

    function openRpFiPopover() {
        if (rpFiOpen) { closeRpFiPopover(); return; }
        rpFiOpen = true;
        if (fiSelectedDate) rpFiCal.setView(fiSelectedDate.getFullYear(), fiSelectedDate.getMonth());
        rpFiCal.render();
        const r = rpFiInput.getBoundingClientRect();
        const popH = 350;
        const spaceBelow = window.innerHeight - r.bottom - 8;
        if (spaceBelow >= popH) {
            rpFiPopover.style.top = (r.bottom + 6) + 'px';
            rpFiPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        } else {
            rpFiPopover.style.top = Math.max(8, r.top - popH) + 'px';
            rpFiPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        }
        rpFiPopover.style.display = 'block';
    }

    function closeRpFiPopover() {
        rpFiPopover.style.display = 'none';
        rpFiOpen = false;
    }

    rpFiTrigger.addEventListener('click', (e) => {
        if (rpFiTrigger.dataset.fiLocked === 'true') {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        openRpFiPopover();
    });

    rpFiInput.addEventListener('focus', (e) => {
        if (rpFiTrigger.dataset.fiLocked === 'true') return;
        if (!rpFiOpen) openRpFiPopover();
    });

    rpFiInput.addEventListener('click', (e) => {
        if (rpFiTrigger.dataset.fiLocked === 'true') return;
        if (!rpFiOpen) openRpFiPopover();
    });

    rpHoraInput.addEventListener('change', () => {
        horaIngresoData.value = rpHoraInput.value;
    });
    rpHoraInput.addEventListener('input', function(e) {
        if (e.inputType && e.inputType.startsWith('delete')) return;
        let digits = this.value.replace(/\D/g, '').slice(0, 4);
        let masked = digits;
        if (digits.length > 2) masked = digits.slice(0, 2) + ':' + digits.slice(2);
        this.value = masked;
        horaIngresoData.value = masked;
    });

    document.addEventListener('click', (e) => {
        if (rpFiOpen && !rpFiInput.parentElement.contains(e.target) && !e.target.closest('#rp-fi-popover')) {
            closeRpFiPopover();
        }
        if (fnacPopoverOpen && !fnacInput.parentElement.contains(e.target) && !e.target.closest('#fnac-popover')) {
            closeFnacPopover();
        }
    });

    function validateFiInputs() {
        const fiRaw = rpFiInput.value.trim();
        if (fiRaw && fiRaw.length === 10) {
            const p = fiRaw.split('/');
            const d = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, y = parseInt(p[2], 10);
            const dateObj = new Date(y, m, d);
            if (dateObj.getDate() !== d || dateObj.getMonth() !== m || isNaN(dateObj.getTime())) {
                if (window.showSystemTooltip) window.showSystemTooltip('Fecha de ingreso inválida', true);
                highlightError(rpFiInput); return false;
            }
            const today = getPeruDate(); today.setHours(0,0,0,0);
            if (dateObj > today) {
                if (window.showSystemTooltip) window.showSystemTooltip('La fecha de ingreso no puede ser posterior a hoy', true);
                highlightError(rpFiInput); return false;
            }
            if (!fiSelectedDate || fmtDate(fiSelectedDate) !== fiRaw) {
                fiSelectedDate = dateObj;
                fechaIngresoData.value = toIso(y, m, d);
                if (!rpHoraInput.value) rpHoraInput.value = getPeruTimeNow();
                if (rpHoraInput.value) horaIngresoData.value = rpHoraInput.value;
            }
        } else if (fiRaw && fiRaw.length < 10) {
            fiSelectedDate = null;
            fechaIngresoData.value = '';
        }
        const horaVal = rpHoraInput.value;
        if (horaVal) {
            const hp = horaVal.split(':');
            if (hp.length !== 2 || isNaN(parseInt(hp[0],10)) || isNaN(parseInt(hp[1],10)) ||
                parseInt(hp[0],10) > 23 || parseInt(hp[1],10) > 59) {
                if (window.showSystemTooltip) window.showSystemTooltip('Hora de ingreso inválida. Debe estar entre 00:00 y 23:59', true);
                highlightError(rpHoraInput); return false;
            }
        }
        return true;
    }

    var getFieldError = function (el) {

        if (document.getElementById('paciente-id').value) return null;

        var id = el.id || '';

        if (id.indexOf('custom-') === 0 && el.classList && el.classList.contains('filter-dropdown-wrapper')) {
            id = id.replace('custom-', '');
        }

        var field = document.getElementById(id);
        var isDni = (tipoDocumento && tipoDocumento.value || 'DNI') === 'DNI';
        var val = field ? (field.value || '').trim() : '';

        switch (id) {
            case 'paciente-dni':
                if (isDni) {
                    if (getRawDni().length !== 8) return 'El DNI debe tener exactamente 8 dígitos';
                } else {
                    var rawDni = getRawDni();
                    if (!rawDni) return 'El documento es obligatorio';
                    if (rawDni.length < 5) return 'El documento debe tener al menos 5 dígitos';
                }
                break;
            case 'paciente-apellidos':
                if (!val) return 'El campo Apellidos es obligatorio';
                break;
            case 'paciente-nombres':
                if (!val) return 'El campo Nombres es obligatorio';
                break;
            case 'paciente-fecha-nac':
                if (!val) return 'La Fecha de Nacimiento es obligatoria';
                break;
            case 'paciente-hc':
                if (!isModal && !val) return 'El Nº Historia Clínica es obligatorio';
                break;
            case 'paciente-seguro':
                if (!val) return 'El Tipo de Seguro es obligatorio';
                break;
            case 'paciente-codigo-ver':
                if (isDni && !val) return 'El Código de Verificación es obligatorio';
                break;
            case 'paciente-servicio':
                if (!val || val === 'Seleccione Servicio') return 'El Servicio es obligatorio';
                break;
        }
        return null;
    };

    form.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;

        if (e.target.tagName === 'TEXTAREA') return;

        if (e.target.closest('.filter-dropdown-wrapper.open')) return;

        if (e.target === btnGuardar || e.target.closest('.btn-module')) return;

        var error = getFieldError(e.target);
        if (error) {
            e.preventDefault();
            if (window.showSystemTooltip) window.showSystemTooltip(error, true);
            highlightError(e.target);
            return;
        }

        e.preventDefault();

        var focusable = form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex="0"]:not(.is-disabled), textarea:not([disabled]), button:not([disabled])');
        var current = Array.prototype.indexOf.call(focusable, document.activeElement);

        if (current >= 0 && current < focusable.length - 1) {
            focusable[current + 1].focus();
        } else if (!btnGuardar.disabled) {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        if (viewForm.style.display === 'none') return;
        if (e.target.tagName === 'TEXTAREA') return;
        if (e.target.closest('.filter-dropdown-wrapper')) return;
        if (e.target.closest('#' + form.id + ' input, #' + form.id + ' select')) return;
        if (e.target === btnGuardar || e.target.closest('.btn-module')) return;
        if (btnGuardar.disabled) return;

        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalCondicion = form.dataset.originalCondicion || '';
        if (originalCondicion.toUpperCase() === 'FALLECIDO') {
            if(window.showSystemTooltip) window.showSystemTooltip('Acción denegada: No se puede editar un paciente fallecido', true);
            return;
        }

        if (!validateForm()) return;

        if (!validateFiInputs()) return;

        btnGuardar.disabled = true;
        textGuardar.textContent = 'Guardando...';
        spinnerGuardar.style.display = 'inline-block';

        const objectId = document.getElementById('paciente-id').value;

        const payload = {
            tipo_seguro: selectSeguro.value,
            seguro_otros: selectSeguro.value === 'Otros' ? inputOtros.value.trim() : null,
            servicio: document.getElementById('paciente-servicio').value.trim() || null,
            condicion: isModal ? 'Hospitalizado' : document.getElementById('paciente-condicion').value,
            creado_por: userId,
            tipo_documento: tipoDocumento?.value || 'DNI'
        };

        const hcVal = document.getElementById('paciente-hc').value.trim();
        if (hcVal) payload.historia_clinica = hcVal;

        if (!objectId) {
            payload.dni = getRawDni();

            const fnacVal = fnacInput.value.trim();
            if (fnacVal && fnacVal.length === 10) {
                payload.fecha_nacimiento = parseDisplayToISO(fnacVal);
            } else {
                payload.fecha_nacimiento = fnacVal;
            }

            payload.apellidos = normalizeText(document.getElementById('paciente-apellidos').value.trim());
            payload.nombres = normalizeText(document.getElementById('paciente-nombres').value.trim());
            payload.codigo_verificacion = document.getElementById('paciente-codigo-ver').value.trim() || null;
        }

        try {
            let errorResp;
            let newPacienteId = null;
            if (objectId) {
                const { error } = await client.from('pacientes').update(payload).eq('id', objectId);
                errorResp = error;
            } else {
                const { data: insertedData, error } = await client.from('pacientes').insert([payload]).select().single();
                errorResp = error;
                if (insertedData) newPacienteId = insertedData.id;
            }

            if (errorResp) {
                if (errorResp.code === '23505') throw new Error("El DNI ingresado ya existe en el sistema.");
                throw errorResp;
            }

            const finalPacienteId = newPacienteId || objectId;
            const fechaIng = fechaIngresoData.value;
            const horaIng = horaIngresoData.value;
            if (finalPacienteId && fechaIng) {
                try {
                    const { data: hospExistentes } = await client
                        .from('hospitalizaciones')
                        .select('numero_registro')
                        .eq('paciente_id', finalPacienteId)
                        .order('numero_registro', { ascending: false })
                        .limit(1);
                    const nextNum = (hospExistentes && hospExistentes.length > 0) ? hospExistentes[0].numero_registro + 1 : 1;

                    const { error: hospErr } = await client
                        .from('hospitalizaciones')
                        .insert([{
                            paciente_id: finalPacienteId,
                            fecha_ingreso: fechaIng,
                            hora_ingreso: horaIng || '08:00',
                            servicio: document.getElementById('paciente-servicio').value || 'No especificado',
                            activa: true,
                            creado_por: userId,
                            numero_registro: nextNum
                        }]);

                    if (hospErr) throw hospErr;

                    fechaIngresoData.value = '';
                    horaIngresoData.value = '';
                } catch (hospErr) {
                    pendingRetryPacienteId = finalPacienteId;
                    pendingRetryFecha = fechaIng;
                    pendingRetryHora = horaIng;
                    btnReintentarHosp.style.display = 'flex';
                    if (window.showSystemTooltip) window.showSystemTooltip('Paciente guardado, pero error al registrar hospitalización. Use "Reintentar".', true);
                }
            }

            if (isModal && window.parent !== window) {
                window.parent.postMessage({
                    type: 'paciente-registrado',
                    dni: payload.dni || '',
                    pacienteId: finalPacienteId
                }, '*');
                return;
            }

            resetPagination();
            await loadPacientes();

            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            moduleCommands.style.display = 'flex';
            if (dashboardLegends) dashboardLegends.style.display = 'block';

            const msgSuccess = objectId ? 'Paciente Actualizado Exitosamente' : 'Paciente Guardado Exitosamente';
            if(window.showSystemTooltip) window.showSystemTooltip(msgSuccess);

        } catch (err) {
            if(window.showSystemTooltip) window.showSystemTooltip(err.message || 'Error al guardar paciente', true);
        } finally {

            btnGuardar.disabled = false;
            textGuardar.textContent = 'Guardar';
            spinnerGuardar.style.display = 'none';
        }
    });

    btnReintentarHosp.addEventListener('click', async () => {
        if (!pendingRetryPacienteId || !pendingRetryFecha) return;
        btnReintentarHosp.disabled = true;
        btnReintentarHosp.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Reintentando...';
        try {
            const { data: existentes } = await client
                .from('hospitalizaciones')
                .select('numero_registro')
                .eq('paciente_id', pendingRetryPacienteId)
                .order('numero_registro', { ascending: false })
                .limit(1);
            const nextNum = (existentes && existentes.length > 0) ? existentes[0].numero_registro + 1 : 1;
            const { error } = await client
                .from('hospitalizaciones')
                .insert([{
                    paciente_id: pendingRetryPacienteId,
                    fecha_ingreso: pendingRetryFecha,
                    hora_ingreso: pendingRetryHora || '08:00',
                    servicio: document.getElementById('paciente-servicio').value || 'No especificado',
                    activa: true,
                    creado_por: userId,
                    numero_registro: nextNum
                }]);
            if (error) throw error;
            if (window.showSystemTooltip) window.showSystemTooltip('Hospitalización registrada exitosamente');
            btnReintentarHosp.style.display = 'none';
            pendingRetryPacienteId = null;
            pendingRetryFecha = null;
            pendingRetryHora = null;
        } catch (err) {
            if (window.showSystemTooltip) window.showSystemTooltip('Error al reintentar: ' + (err.message || err), true);
        } finally {
            btnReintentarHosp.disabled = false;
            btnReintentarHosp.innerHTML = '<i class="fa-solid fa-rotate"></i> Reintentar Fecha de Ingreso';
        }
    });

    loadServicios().then(() => {
        loadPacientes();
    });

    const params = new URLSearchParams(window.location.search);
    const dniParam = params.get('dni');

    if (dniParam && dniParam.length === 8) {

        if (btnNew) btnNew.click();

        if (inputDni) inputDni.value = dniParam;

        setTimeout(() => {
            if (btnObtenerFnac) btnObtenerFnac.click();
        }, 500);
    }

    const headerLeft = document.querySelector('.top-header .header-left');
    if (headerLeft && !document.getElementById('btn-header-back')) {
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.id = 'btn-header-back';
        backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver';
        backBtn.style.cssText = 'background:transparent; border:1px solid #e2e8f0; color:#475569; border-radius:6px; padding:6px 14px; font-size:13px; font-weight:500; cursor:pointer; display:none; align-items:center; gap:6px; transition:all 0.2s; box-shadow:0 2px 6px rgba(0,0,0,0.08); margin-right:12px;';
        backBtn.onmouseover = () => { backBtn.style.background = '#2563eb'; backBtn.style.color = '#ffffff'; backBtn.style.borderColor = '#2563eb'; backBtn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; };
        backBtn.onmouseout = () => { backBtn.style.background = 'transparent'; backBtn.style.color = '#475569'; backBtn.style.borderColor = '#e2e8f0'; backBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; };
        backBtn.addEventListener('click', () => {
            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            moduleCommands.style.display = 'flex';
            if (dashboardLegends) dashboardLegends.style.display = 'block';
            backBtn.style.display = 'none';
            removeDniExistsTooltip();
            if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
        });

        const welcomeText = headerLeft.querySelector('.welcome-text');
        if (welcomeText) {
            headerLeft.insertBefore(backBtn, welcomeText);
        } else {
            headerLeft.appendChild(backBtn);
        }
    }

    checkAutoFill();
});
