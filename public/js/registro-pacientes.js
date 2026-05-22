document.addEventListener('DOMContentLoaded', async () => {
    // Inicialización y Auth
    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();

    if (!session) {
        window.location.href = '../../index.html';
        return;
    }
    const userId = session.user.id;

    // Referencias del DOM
    const viewLista = document.getElementById('view-lista');
    const viewForm = document.getElementById('view-form');
    const btnNew = document.getElementById('local-new-patient-btn');
    const moduleCommands = document.querySelector('.module-commands');

    const form = document.getElementById('registro-form');
    const btnCancelar = document.getElementById('btn-cancelar');
    const btnGuardar = document.getElementById('btn-guardar');
    const textGuardar = document.getElementById('guardar-text');
    const spinnerGuardar = document.getElementById('guardar-spinner');

    const toast = document.getElementById('toast');
    const selectSeguro = document.getElementById('paciente-seguro');
    const grupoOtros = document.getElementById('grupo-otros');
    const inputOtros = document.getElementById('paciente-seguro-otros');
    const tbody = document.getElementById('tabla-pacientes');
    const btnSearchDni = document.getElementById('btn-search-dni');
    const btnExecSearch = document.getElementById('execute-search');
    const loadingIndicator = document.getElementById('loading-indicator');
    const tableElement = document.getElementById('table-element');

    // Referencias para el filtro de Servicio
    const filterServicio = document.getElementById('filter-servicio');
    const btnClearFilterServicio = document.getElementById('clear-filter-servicio');
    const inputDni = document.getElementById('paciente-dni');
    const tipoDocumento = document.getElementById('tipo-documento');
    const dniPrefix = document.getElementById('dni-prefix');
    const dvGroup = document.getElementById('dv-group');
    const fieldHc = document.getElementById('field-hc');
    const fieldCondicion = document.getElementById('field-condicion');

    // Referencias para el modal de Fecha de Ingreso
    const modalOverlay = document.getElementById('modal-ingreso-overlay');
    const modalClose = document.getElementById('modal-ingreso-close');
    const modalGuardar = document.getElementById('modal-ingreso-guardar');
    const modalGuardarText = document.getElementById('modal-ingreso-guardar-text');
    const modalSpinner = document.getElementById('modal-ingreso-spinner');
    const modalHora = document.getElementById('modal-ingreso-hora');
    const modalNombre = document.getElementById('modal-ingreso-nombre');
    const modalInfo = document.getElementById('modal-ingreso-info');
    const fechaIngresoData = document.getElementById('fecha-ingreso-data');
    const horaIngresoData = document.getElementById('hora-ingreso-data');
    const btnReintentarHosp = document.getElementById('btn-reintentar-hosp');
    // Calendar popovers
    const rpFiTrigger = document.getElementById('rp-fi-trigger');
    const rpFiDisplay = document.getElementById('rp-fi-display');
    const mFiTrigger = document.getElementById('modal-fi-trigger');
    const mFiPopover = document.getElementById('modal-fi-popover');
    const mFiDisplay = document.getElementById('modal-fi-display');
    const mFiGrid = document.getElementById('modal-fi-days-grid');
    const mFiTitle = document.getElementById('modal-fi-title');
    const mFiMonth = document.getElementById('modal-fi-month');
    const mFiYear = document.getElementById('modal-fi-year');
    const mFiPrev = document.getElementById('modal-fi-prev');
    const mFiNext = document.getElementById('modal-fi-next');
    const mFiToday = document.getElementById('modal-fi-today');

    // Referencias para el popover de Fecha de Nacimiento
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
    const PLACEHOLDER_MAP = { DNI: '12345678', DNI_TEMPORAL: '12345678', CARNET_EXT: '12345678' };

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
        inputDni.placeholder = PLACEHOLDER_MAP[tipo];
        inputDni.style.borderRadius = prefix ? '0 8px 8px 0' : '8px';

        dvGroup.style.display = tipo === 'DNI' ? 'block' : 'none';

        inputDni.focus();
    };

    const highlightError = (el) => {
        const target = el.closest('.global-search-box') || el;
        if (target.dataset.errorActive === '1') return;
        target.dataset.errorActive = '1';
        const origBorder = target.style.borderColor;
        const origShadow = target.style.boxShadow;
        target.style.borderColor = '#ef4444';
        target.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
        const clearError = () => {
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
        // Para ediciones, permitir guardar aunque falten campos opcionales
        if (document.getElementById('paciente-id').value) return true;

        const missing = [];
        const isDni = (tipoDocumento?.value || 'DNI') === 'DNI';

        if (getRawDni().length !== 8) {
            missing.push({ el: inputDni, msg: 'El DNI debe tener exactamente 8 dígitos' });
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
        const digits = this.value.replace(/[^0-9]/g, '').slice(0, 8);
        if (digits !== this.value) this.value = digits;
    });

    tipoDocumento.addEventListener('change', handleTipoDocumentoChange);

    // Utility to strip accents and convert to uppercase
    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    // Auxiliar para seleccionar valor en un select ignorando mayúsculas/minúsculas
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

    // ============================================
    // AUTOCOMPLETADO Y MODO MODAL
    // ============================================
    const isModal = new URLSearchParams(window.location.search).get('view') === 'modal';

    const checkAutoFill = () => {
        const dataStr = sessionStorage.getItem('cd_auto_fill');
        
        // 1. Mostrar formulario inmediatamente si es modal para evitar parpadeo
        if (isModal) {
            viewLista.style.display = 'none';
            viewForm.style.display = 'block';
            const tempStyle = document.getElementById('temp-modal-hide');
            if (tempStyle) tempStyle.remove();
            document.body.style.display = 'block';

            // Ocultar Condición en modo modal
            if (fieldCondicion) fieldCondicion.style.display = 'none';
        }

        // Sincronizar display del tipo de documento (prefijo, DV, custom dropdown)
        if (tipoDocumento) {
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

        if (dataStr) {
            const data = JSON.parse(dataStr);
            sessionStorage.removeItem('cd_auto_fill');

            // 2. Rellenar campos de texto (Inmediato)
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

            // 3. Rellenar Fecha
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

    // checkAutoFill() se ejecutará al final de la inicialización


    // ── Máscara automática dd/mm/yyyy ──
    fnacInput.addEventListener('input', function (e) {
        if (e.inputType && e.inputType.startsWith('delete')) return;
        let digits = this.value.replace(/\D/g, '').slice(0, 8);
        let masked = digits;
        if (digits.length > 2) masked = digits.slice(0, 2) + '/' + digits.slice(2);
        if (digits.length > 4) masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
        this.value = masked;
    });

    // ── Conversión DD/MM/YYYY → YYYY-MM-DD ──
    const parseDisplayToISO = (val) => {
        const p = val.split('/');
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : val;
    };

    // ── Calendario popover para Fecha de Nacimiento ──
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

    fnacInput.addEventListener('focus', openFnacPopover);

    // Variables de Paginación Inteligente y DB
    let currentPage = 1;
    let rowsPerPage = 20;
    let totalRecords = 0;
    let searchQuery = '';
    let filterQuery = ''; // Variable para almacenar el filtro de Servicio
    const pageCache = new Map();

    // ============================================
    // CARGA DE FILTRO PREVIO
    // ============================================
    const loadServicios = async () => {
        if (sessionStorage.getItem('rp_filter_servicio')) {
            filterServicio.value = sessionStorage.getItem('rp_filter_servicio');
            filterQuery = filterServicio.value;
            filterServicio.style.color = "#1e293b";
        } else {
            filterServicio.style.color = "#94a3b8";
        }
        if (filterServicio.customDropdownUpdate) {
            filterServicio.customDropdownUpdate();
        }
    };

    // ============================================
    // CARGA DE DATOS LOCALES VS SERVIDOR (PAGINACIÓN)
    // ============================================
    const loadPacientes = async () => {
        const cacheKey = `${currentPage}|${searchQuery}|${filterQuery}`;
        if (pageCache.has(cacheKey)) {
            const cached = pageCache.get(cacheKey);
            totalRecords = cached.count;
            renderTable(cached.data, (currentPage - 1) * rowsPerPage);
            renderPagination();
            return;
        }

        try {
            loadingIndicator.style.display = 'block';
            tableElement.style.display = 'none';

            const startRange = (currentPage - 1) * rowsPerPage;
            const endRange = startRange + rowsPerPage - 1;

            let queryObj = client
                .from('pacientes')
                .select('*', { count: 'exact' })
                .order('creado_en', { ascending: false })
                .range(startRange, endRange);

            if (searchQuery) {
                const normQuery = normalizeText(searchQuery);
                queryObj = queryObj.or('dni.ilike.%' + normQuery + '%,apellidos.ilike.%' + normQuery + '%,nombres.ilike.%' + normQuery + '%');
            }

            if (filterQuery) {
                // Usamos ilike y aseguramos mayúsculas para coincidir con el Trigger de la DB
                queryObj = queryObj.ilike('servicio', filterQuery.toUpperCase());
            }

            const { data, count, error } = await queryObj;

            if (error) throw error;
            totalRecords = count || 0;
            pageCache.set(cacheKey, { data, count: totalRecords });
            renderTable(data, startRange);
            renderPagination();
        } catch (error) {
        } finally {
            loadingIndicator.style.display = 'none';
            tableElement.style.display = 'table';
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

            // Peru Time for display
            let fechaNacDisplay = item.fecha_nacimiento;
            if (item.fecha_nacimiento && item.fecha_nacimiento.includes('-')) {
                // Si viene YYYY-MM-DD
                const parts = item.fecha_nacimiento.split('-');
                fechaNacDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            row.innerHTML = `
                <td>${item.dni}</td>
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

        // Add Edit Hooks
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

        // Bloquear todos los campos temporalmente
        document.getElementById('paciente-dni').disabled = true;

        // Asegurar que HC y Condición sean visibles al editar (podrían estar ocultos desde modal)
        if (fieldHc) fieldHc.style.display = '';
        if (fieldCondicion) fieldCondicion.style.display = '';

        // Volcar data
        // Setear tipo_documento antes que el DNI para que el prefix se aplique
        if (p.tipo_documento && tipoDocumento) {
            tipoDocumento.value = p.tipo_documento;
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }
        document.getElementById('paciente-dni').value = p.dni;
        document.getElementById('paciente-hc').value = p.historia_clinica;

        // Formatear fecha de nacimiento
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

        console.log('[openEditForm] HC from DB:', JSON.stringify(p.historia_clinica),
            '| HC input value:', document.getElementById('paciente-hc').value,
            '| HC disabled:', document.getElementById('paciente-hc').disabled,
            '| Seguro value:', selectSeguro.value, '| Seguro disabled:', selectSeguro.disabled,
            '| Servicio value:', servEl.value, '| Servicio disabled:', servEl.disabled,
            '| FechaNac value:', document.getElementById('paciente-fecha-nac').value,
            '| Apellidos value:', document.getElementById('paciente-apellidos').value,
            '| Nombres value:', document.getElementById('paciente-nombres').value);

        // ── Cargar hospitalización existente para Fecha de Ingreso ──
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

        // Si falleció, NO permitir editar nada (Comparación insensible)
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
        viewForm.style.display = 'block';
    };

    const renderPagination = () => {
        const totalPages = Math.ceil(totalRecords / rowsPerPage);
        DynamicTable.renderPagination({
            containerId: 'pagination-container',
            currentPage,
            totalPages,
            onPageChange: (page) => {
                currentPage = page;
                loadPacientes();
            }
        });
    };

    // ============================================
    // BÚSQUEDA Y MANEJO DE VISTAS (SPA)
    // ============================================
    const executeSearch = () => {
        const val = btnSearchDni.value.trim();
        if (val) {
            searchQuery = val;
            sessionStorage.setItem('rp_search_query', val);
            currentPage = 1;
            pageCache.clear();
            loadPacientes();
        }
    };

    btnExecSearch.addEventListener('click', executeSearch);
    btnSearchDni.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });



    // ============================================
    // FILTRO POR SERVICIO
    // ============================================
    const applyFilterServicio = (val) => {
        if (val) {
            filterQuery = val;
            sessionStorage.setItem('rp_filter_servicio', val);
            currentPage = 1;
            filterServicio.style.color = "#1e293b"; // Color activo
            pageCache.clear();
            loadPacientes();
        } else {
            filterQuery = '';
            sessionStorage.removeItem('rp_filter_servicio');
            filterServicio.style.color = "#94a3b8"; // Color placeholder
            currentPage = 1;
            pageCache.clear();
            loadPacientes();
        }
    };

    filterServicio.addEventListener('change', (e) => {
        applyFilterServicio(e.target.value.trim());
    });

    btnClearFilterServicio.addEventListener('click', () => {
        // Limpiar Filtro de Servicio
        filterQuery = '';
        filterServicio.value = '';
        filterServicio.style.color = "#94a3b8"; // Reset color
        sessionStorage.removeItem('rp_filter_servicio');
        if (filterServicio.customDropdownUpdate) {
            filterServicio.customDropdownUpdate();
        }

        // Limpiar Buscador DNI
        searchQuery = '';
        btnSearchDni.value = '';
        sessionStorage.removeItem('rp_search_query');

        currentPage = 1;
        pageCache.clear();
        loadPacientes();
    });

    // ============================================
    // VALIDACIÓN DE DNI (8 DÍGITOS OBLIGATORIOS)
    // ============================================
    inputDni.addEventListener('blur', () => {
        const dniValue = getRawDni();
        if (dniValue && dniValue.length !== 8) {
            inputDni.setCustomValidity('El DNI debe contener exactamente 8 dígitos numéricos');
        } else {
            inputDni.setCustomValidity('');
        }
    });

    inputDni.addEventListener('input', () => {
        const dniValue = getRawDni();
        if (dniValue.length === 8) {
            inputDni.setCustomValidity('');
        }
    });

    // ============================================
    // OBTENER FECHA DE NACIMIENTO (Cloudflare Worker)
    // ============================================
    const WORKER_URL = 'https://dni-lookup-api.seguimientohospitalario5.workers.dev/';
    const btnObtenerFnac = document.getElementById('btn-obtener-fnac');
    const btnFnacText = document.getElementById('btn-fnac-text');
    const fnacSpinner = document.getElementById('fnac-spinner');

    btnObtenerFnac.addEventListener('click', async () => {
        const dniValue = getRawDni();

        if (!dniValue || dniValue.length !== 8) {
            if(window.showSystemTooltip) window.showSystemTooltip('Ingrese un DNI válido de 8 dígitos primero', true);
            return;
        }

        // Estado visual: cargando
        btnObtenerFnac.disabled = true;
        btnFnacText.textContent = 'Consultando...';
        fnacSpinner.style.display = 'inline-block';

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni: dniValue })
            });

            const result = await response.json();

            if (result.success && result.fecha_nac) {
                fnacInput.value = result.fecha_nac;
                fnacSelectedDate = null;

                if(window.showSystemTooltip) window.showSystemTooltip(`Fecha obtenida: ${result.fecha_nac}`);
            } else {
                if(window.showSystemTooltip) window.showSystemTooltip(result.error || 'No se encontró fecha para este DNI', true);
            }
        } catch (err) {
            if(window.showSystemTooltip) window.showSystemTooltip('Error de conexión con el servicio', true);
        } finally {
            btnObtenerFnac.disabled = false;
            btnFnacText.textContent = 'Obtener Fecha de Nacimiento';
            fnacSpinner.style.display = 'none';
        }
    });

    btnNew.addEventListener('click', () => {
        viewLista.style.display = 'none';
        moduleCommands.style.display = 'none'; // Ocultar módulos operativos locales
        form.reset();
        form.dataset.originalCondicion = '';
        document.getElementById('paciente-id').value = '';
        document.getElementById('btn-obtener-fnac').style.display = 'flex';

        // Limpiar fecha de nacimiento
        fnacInput.value = '';
        fnacSelectedDate = null;

        // Reset disabled states uniformly
        document.querySelectorAll('.standard-input').forEach(el => el.disabled = false);

        // Reset tipo_documento a DNI y habilitar
        if (tipoDocumento) {
            tipoDocumento.value = 'DNI';
            tipoDocumento.disabled = false;
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

        // Resetear Fecha de Ingreso
        resetFiState();

        // Resetear y habilitar selects del formulario
        selectSeguro.disabled = false;
        if (selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
        const servEl = document.getElementById('paciente-servicio');
        servEl.value = '';
        servEl.disabled = false;
        if (servEl.customDropdownUpdate) servEl.customDropdownUpdate();

        // Mostrar HC y Condición (por si venía de modal)
        if (fieldHc) fieldHc.style.display = '';
        if (fieldCondicion) fieldCondicion.style.display = '';

        // Forzar Condición "Hospitalizado" al registrar nuevo y bloquear
        const condicionSelect = document.getElementById('paciente-condicion');
        condicionSelect.value = 'Hospitalizado';
        condicionSelect.disabled = true;
        if (condicionSelect.customDropdownUpdate) condicionSelect.customDropdownUpdate();

        grupoOtros.style.display = 'none';
        inputOtros.required = false;

        viewForm.style.display = 'block';
    });

    btnCancelar.addEventListener('click', () => {
        if (isModal) {
            // Si está dentro de un iframe (modal), enviamos un mensaje al padre para cerrar
            window.parent.postMessage({ action: 'closeModal' }, '*');
        } else {
            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            moduleCommands.style.display = 'flex';
        }
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

    // ============================================
    // CALENDAR POPOVER (mismo diseño que consulta-rapida)
    // ============================================
    let pendingRetryPacienteId = null;
    let pendingRetryFecha = null;
    let pendingRetryHora = null;

    const toIso = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const getPeruDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const getPeruTimeNow = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtDate = (d) => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';

    let fiSelectedDate = null; // shared selected date

    // ── Helpers para gestionar el estado de Fecha de Ingreso ──
    function resetFiState() {
        fiSelectedDate = null;
        fechaIngresoData.value = '';
        horaIngresoData.value = '';
        rpFiDisplay.textContent = 'Opcional';
        rpFiDisplay.style.color = '#94a3b8';
        delete rpFiTrigger.dataset.fiLocked;
        rpFiTrigger.style.pointerEvents = '';
        rpFiTrigger.style.cursor = '';
        rpFiTrigger.style.background = '#ffffff';
        rpFiTrigger.style.borderColor = '#e2e8f0';
        rpFiTrigger.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
        const icons = rpFiTrigger.querySelectorAll('i');
        icons.forEach(ic => ic.style.color = '');
    }

    function setFiStateFromDB(dateStr, timeStr) {
        if (!dateStr) { resetFiState(); return; }
        const parts = dateStr.split('-');
        fiSelectedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        fechaIngresoData.value = dateStr;
        horaIngresoData.value = timeStr || '08:00';
        rpFiDisplay.textContent = fmtDate(fiSelectedDate);
        rpFiDisplay.style.color = '#64748b';
        rpFiTrigger.dataset.fiLocked = 'true';
        rpFiTrigger.style.pointerEvents = 'none';
        rpFiTrigger.style.cursor = 'not-allowed';
        rpFiTrigger.style.background = '#f1f5f9';
        rpFiTrigger.style.borderColor = 'transparent';
        rpFiTrigger.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
        const icons = rpFiTrigger.querySelectorAll('i');
        icons.forEach(ic => ic.style.color = '#94a3b8');
    }

    // ── Form trigger: abre el modal directamente ──
    rpFiTrigger.addEventListener('click', (e) => {
        if (rpFiTrigger.dataset.fiLocked === 'true') {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        const nombres = document.getElementById('paciente-nombres').value.trim();
        const apellidos = document.getElementById('paciente-apellidos').value.trim();
        modalNombre.textContent = apellidos && nombres ? `${apellidos}, ${nombres}` : 'Datos del paciente';
        modalInfo.textContent = `DNI: ${inputDni.value || '—'} | HC: ${document.getElementById('paciente-hc').value || 'N/A'}`;
        const now = getPeruDate();
        fiSelectedDate = now;
        mFiDisplay.textContent = fmtDate(now);
        mFiDisplay.style.color = '#0f172a';
        modalHora.value = getPeruTimeNow();
        modalOverlay.style.display = 'flex';
    });

    // ── Modal popover (usando calendario compartido) ──
    let mFiOpen = false;

    const mFiCal = window.crearCalendario({
        mode: 'single',
        grid: mFiGrid,
        title: mFiTitle,
        month: mFiMonth,
        year: mFiYear,
        prev: mFiPrev,
        next: mFiNext,
        today: mFiToday,
        selectedDate: fiSelectedDate,
        onDayClick: (d) => {
            fiSelectedDate = d;
            mFiDisplay.textContent = fmtDate(d);
            mFiDisplay.style.color = '#0f172a';
            mFiTrigger.classList.remove('is-open');
            mFiPopover.style.display = 'none';
            mFiOpen = false;
        }
    });

    function openMFiPopover() {
        mFiOpen = true;
        if (fiSelectedDate) mFiCal.setView(fiSelectedDate.getFullYear(), fiSelectedDate.getMonth());
        mFiCal.render();
        const r = mFiTrigger.getBoundingClientRect();
        const popH = 350;
        const spaceBelow = window.innerHeight - r.bottom - 8;
        if (spaceBelow >= popH) {
            mFiPopover.style.top = (r.bottom + 6) + 'px';
            mFiPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        } else {
            mFiPopover.style.top = Math.max(8, r.top - popH) + 'px';
            mFiPopover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
        }
        mFiPopover.style.display = 'block';
        mFiTrigger.classList.add('is-open');
    }

    function closeMFiPopover() {
        mFiPopover.style.display = 'none';
        mFiTrigger.classList.remove('is-open');
        mFiOpen = false;
    }

    mFiTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (mFiOpen) closeMFiPopover(); else openMFiPopover(); });

    // ── Modal overlay ──
    const closeModalIngreso = () => {
        closeMFiPopover();
        modalOverlay.style.display = 'none';
    };

    modalClose.addEventListener('click', closeModalIngreso);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModalIngreso(); });

    const openModalIngreso = () => {
        const nombres = document.getElementById('paciente-nombres').value.trim();
        const apellidos = document.getElementById('paciente-apellidos').value.trim();
        modalNombre.textContent = apellidos && nombres ? `${apellidos}, ${nombres}` : 'Datos del paciente';
        modalInfo.textContent = `DNI: ${inputDni.value || '—'} | HC: ${document.getElementById('paciente-hc').value || 'N/A'}`;
        const now = getPeruDate();
        fiSelectedDate = now;
        mFiDisplay.textContent = fmtDate(now);
        mFiDisplay.style.color = '#0f172a';
        modalHora.value = getPeruTimeNow();
        modalOverlay.style.display = 'flex';
    };

    modalGuardar.addEventListener('click', () => {
        if (!fiSelectedDate) {
            if (window.showSystemTooltip) window.showSystemTooltip('Seleccione una fecha de ingreso en el calendario', true);
            return;
        }
        const hora = modalHora.value || '08:00';
        fechaIngresoData.value = toIso(fiSelectedDate.getFullYear(), fiSelectedDate.getMonth(), fiSelectedDate.getDate());
        horaIngresoData.value = hora;
        if (window.showSystemTooltip) window.showSystemTooltip('Fecha de ingreso registrada. Guarde el paciente para completar.');

        // Sincronizar display del form trigger
        rpFiDisplay.textContent = fmtDate(fiSelectedDate);
        rpFiDisplay.style.color = '#0f172a';

        closeModalIngreso();
    });

    // Click fuera de los popovers para cerrarlos
    document.addEventListener('click', (e) => {
        if (mFiOpen && !e.target.closest('#modal-fi-trigger') && !e.target.closest('#modal-fi-popover')) closeMFiPopover();
        if (fnacPopoverOpen && !e.target.closest('#fnac-trigger') && !e.target.closest('#paciente-fecha-nac') && !e.target.closest('#fnac-popover')) closeFnacPopover();
    });

    // ============================================
    // INSERCIÓN DE DATOS (SUPABASE)
    // ============================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalCondicion = form.dataset.originalCondicion || '';
        if (originalCondicion.toUpperCase() === 'FALLECIDO') {
            if(window.showSystemTooltip) window.showSystemTooltip('Acción denegada: No se puede editar un paciente fallecido', true);
            return;
        }

        // Validar todos los campos obligatorios
        if (!validateForm()) return;

        // Estado visual: Bloquear botón y mostrar spinner
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

        // If newly inserted
        if (!objectId) {
            payload.dni = getRawDni();

            // Obtener fecha en formato ISO (Y-m-d) para Supabase
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

            // Crear hospitalización si hay fecha de ingreso registrada
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

            // Si estamos en modo modal (iframe desde consulta-datos), notificar al padre y salir
            if (isModal && window.parent !== window) {
                window.parent.postMessage({
                    type: 'paciente-registrado',
                    dni: payload.dni || '',
                    pacienteId: finalPacienteId
                }, '*');
                return; // El padre se encarga de cerrar el modal y mostrar el tooltip
            }

            // Éxito (flujo normal, no modal):
            currentPage = 1;
            await loadPacientes();

            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            moduleCommands.style.display = 'flex';

            const msgSuccess = objectId ? 'Paciente Actualizado Exitosamente' : 'Paciente Guardado Exitosamente';
            if(window.showSystemTooltip) window.showSystemTooltip(msgSuccess);

        } catch (err) {
            if(window.showSystemTooltip) window.showSystemTooltip(err.message || 'Error al guardar paciente', true);
        } finally {
            // Restaurar botón
            btnGuardar.disabled = false;
            textGuardar.textContent = 'Guardar Registro';
            spinnerGuardar.style.display = 'none';
        }
    });

    // ── Botón de reintento de hospitalización ──
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

    // Carga inicial
    if (sessionStorage.getItem('rp_search_query')) {
        btnSearchDni.value = sessionStorage.getItem('rp_search_query');
        searchQuery = btnSearchDni.value;
    }

    loadServicios().then(() => {
        loadPacientes();
    });

    // Cambiar color del select dinámicamente
    filterServicio.addEventListener('change', (e) => {
        if (e.target.value === "") {
            e.target.style.color = "#94a3b8";
        } else {
            e.target.style.color = "#1e293b";
        }
    });
    // ============================================
    // MANEJO DE PARÁMETROS URL (CONSULTA RÁPIDA)
    // ============================================
    const params = new URLSearchParams(window.location.search);
    const dniParam = params.get('dni');

    if (dniParam && dniParam.length === 8) {
        // 1. Simular clic en "Nuevo" para abrir el formulario
        if (btnNew) btnNew.click();
        
        // 2. Llenar el DNI
        if (inputDni) inputDni.value = dniParam;
        
        // 3. Ejecutar automáticamente la obtención de fecha de nacimiento (Consulta Rápida)
        setTimeout(() => {
            if (btnObtenerFnac) btnObtenerFnac.click();
        }, 500);
    }

    // ============================================
    // EJECUCIÓN FINAL DE AUTOCOMPLETADO
    // ============================================
    // checkAutoFill se ejecuta al final para asegurar que todo el DOM y componentes estén listos
    checkAutoFill();
});
