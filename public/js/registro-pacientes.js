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

            // 3. Rellenar Fecha (Con pequeño retardo para asegurar que Flatpickr cargue)
            setTimeout(() => {
                if (data.fecha_nacimiento) {
                    const fp = document.getElementById('paciente-fecha-nac')._flatpickr;
                    if (fp) {
                        const parts = data.fecha_nacimiento.split('-');
                        if (parts.length === 3) {
                            const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                            fp.setDate(formatted, true, "d/m/Y");
                        }
                    }
                }
            }, 300);

            if (window.showSystemTooltip) {
                window.showSystemTooltip('Datos importados desde Consulta de Datos');
            }
        }
    };

    // checkAutoFill() se ejecutará al final de la inicialización


    // Inicializar Flatpickr con m\u00e1scara autom\u00e1tica dd/mm/yyyy
    const fpInstance = flatpickr("#paciente-fecha-nac", {
        locale: "es",
        dateFormat: "d/m/Y",
        allowInput: true,
        maxDate: "today",
        // Parsear siempre en formato d/m/Y sin depender de la locale del OS
        parseDate: (dateStr, format) => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // meses 0-indexed
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }
            return null;
        },
        onReady(_, __, instance) {
            // M\u00e1scara: inserta '/' autom\u00e1ticamente al escribir d\u00edgitos
            instance.input.addEventListener('input', function (e) {
                // Si el usuario est\u00e1 borrando, no interferir
                if (e.inputType && e.inputType.startsWith('delete')) return;

                let digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                let masked = digits;

                if (digits.length > 2) {
                    masked = digits.slice(0, 2) + '/' + digits.slice(2);
                }
                if (digits.length > 4) {
                    masked = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                }

                e.target.value = masked;

                // Si ya tiene 10 caracteres (dd/mm/yyyy), forzar parseo en Flatpickr
                if (masked.length === 10 && e.isTrusted) {
                    instance.setDate(masked, true, 'd/m/Y');
                }
            });
        }
    });

    // Variables de Paginación Inteligente y DB
    let currentPage = 1;
    let rowsPerPage = 5;
    let totalRecords = 0;
    let searchQuery = '';
    let filterQuery = ''; // Variable para almacenar el filtro de Servicio

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
        try {
            loadingIndicator.style.display = 'block';
            tableElement.style.display = 'none';

            // Cálculo Matemático (altura adaptativa) usando utilidad global
            if (typeof DynamicTable !== 'undefined') {
                rowsPerPage = DynamicTable.calcRowsPerPage({
                    excludeSelectors: ['.top-header', '.module-commands', '.pagination-controls']
                });
            } else {
                const availableHeight = window.innerHeight - 350;
                let calculatedRows = Math.floor(availableHeight / 60);
                rowsPerPage = calculatedRows > 2 ? calculatedRows : 3;
            }

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

    const openEditForm = (p) => {
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

        // Formatear fecha para Flatpickr
        if (fpInstance && p.fecha_nacimiento) {
            const dateParts = p.fecha_nacimiento.split('-');
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            fpInstance.setDate(dateObj, true);
        } else {
            document.getElementById('paciente-fecha-nac').value = p.fecha_nacimiento || '';
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
        const container = document.getElementById('pagination-container');
        container.innerHTML = '';

        if (totalPages <= 1) return;

        if (typeof DynamicTable !== 'undefined') {
            DynamicTable.renderPagination({
                containerId: 'pagination-container',
                currentPage,
                totalPages,
                onPageChange: (page) => {
                    currentPage = page;
                    loadPacientes();
                }
            });
        } else {
            const btnPrev = document.createElement('button');
            btnPrev.className = 'pagination-btn';
            btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            btnPrev.disabled = currentPage === 1;
            btnPrev.onclick = () => { currentPage--; loadPacientes(); };
            container.appendChild(btnPrev);

            const info = document.createElement('span');
            info.className = 'pagination-info';
            info.innerHTML = `Página <span class="seguro-badge">${currentPage}</span> de ${totalPages}`;
            container.appendChild(info);

            const btnNext = document.createElement('button');
            btnNext.className = 'pagination-btn';
            btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            btnNext.disabled = currentPage === totalPages;
            btnNext.onclick = () => { currentPage++; loadPacientes(); };
            container.appendChild(btnNext);
        }
    };

    if (typeof DynamicTable !== 'undefined') {
        DynamicTable.onResize(() => {
            const oldRows = rowsPerPage;
            const newRows = DynamicTable.calcRowsPerPage({
                excludeSelectors: ['.top-header', '.module-commands', '.pagination-controls']
            });

            if (newRows !== oldRows) {
                currentPage = 1;
                loadPacientes();
            }
        });
    } else {
        window.addEventListener('resize', () => {
            const oldRows = rowsPerPage;
            const availableHeight = window.innerHeight - 350;
            let calculatedRows = Math.floor(availableHeight / 60);
            calculatedRows = calculatedRows > 2 ? calculatedRows : 3;

            if (calculatedRows !== oldRows) {
                currentPage = 1;
                loadPacientes();
            }
        });
    }

    // ============================================
    // BÚSQUEDA Y MANEJO DE VISTAS (SPA)
    // ============================================
    const executeSearch = () => {
        const val = btnSearchDni.value.trim();
        if (val) {
            searchQuery = val;
            sessionStorage.setItem('rp_search_query', val);
            currentPage = 1;
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
            loadPacientes();
        } else {
            filterQuery = '';
            sessionStorage.removeItem('rp_filter_servicio');
            filterServicio.style.color = "#94a3b8"; // Color placeholder
            currentPage = 1;
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
                // Rellenar el campo visual con dd/mm/yyyy usando Flatpickr
                const fechaInput = document.getElementById('paciente-fecha-nac');
                fechaInput.value = result.fecha_nac;

                // Parsear y setear en Flatpickr para que lo reconozca internamente
                if (fpInstance) {
                    fpInstance.setDate(result.fecha_nac, true, 'd/m/Y');
                }

                // Toast de éxito
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

        // Limpiar flatpickr
        const fp = document.getElementById('paciente-fecha-nac')._flatpickr;
        if (fp) fp.clear();

        // Reset disabled states uniformly
        document.querySelectorAll('.standard-input').forEach(el => el.disabled = false);

        // Reset tipo_documento a DNI
        if (tipoDocumento) {
            tipoDocumento.value = 'DNI';
            handleTipoDocumentoChange();
            if (tipoDocumento.customDropdownUpdate) tipoDocumento.customDropdownUpdate();
        }

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

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
    let fiViewMonth = new Date().getMonth();
    let fiViewYear = new Date().getFullYear();
    const fiToday = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

    const toIso = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const getPeruDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const getPeruTimeNow = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtDate = (d) => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : '';

    // ── Shared calendar helpers ──
    function populateFiMonths(sel) {
        MONTHS.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; sel.appendChild(o); });
    }
    function populateFiYears(sel) {
        const y = fiToday.getFullYear();
        for (let i = y - 5; i <= y + 5; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i; sel.appendChild(o); }
    }
    function syncFiFilters(monthSel, yearSel) { monthSel.value = fiViewMonth; yearSel.value = fiViewYear; }

    let fiSelectedDate = null; // shared selected date

    function renderFiCalendar(grid, titleEl, monthSel, yearSel, direction, onSelect) {
        const firstDay = new Date(fiViewYear, fiViewMonth, 1);
        const lastDay = new Date(fiViewYear, fiViewMonth + 1, 0);
        const startDow = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrev = new Date(fiViewYear, fiViewMonth, 0).getDate();
        const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

        titleEl.textContent = `${MONTHS[fiViewMonth]}, ${fiViewYear}`;
        syncFiFilters(monthSel, yearSel);

        grid.className = 'cal-days-grid' + (direction ? ' cal-slide-' + direction : '');
        grid.innerHTML = '';

        let dayIdx = 0;
        for (let i = 0; i < totalCells; i++) {
            const el = document.createElement('div');
            el.className = 'cal-day';
            let num, isCur = true;
            if (i < startDow) { num = daysInPrev - startDow + i + 1; isCur = false; el.classList.add('cal-day-other'); }
            else if (dayIdx >= daysInMonth) { num = i - startDow - daysInMonth + 1; isCur = false; el.classList.add('cal-day-other'); }
            else { num = dayIdx + 1; }

            if (!isCur) { el.textContent = num; grid.appendChild(el); if (i >= startDow) dayIdx++; continue; }

            el.textContent = num;
            const dateObj = new Date(fiViewYear, fiViewMonth, num);
            const dateStr = toIso(fiViewYear, fiViewMonth, num);
            el.dataset.date = dateStr;

            if (isSameDay(dateObj, fiToday)) el.classList.add('cal-day-today');
            if (dateObj > fiToday) el.classList.add('cal-day-disabled');
            if (fiSelectedDate && isSameDay(dateObj, fiSelectedDate)) el.classList.add('cal-day-selected');

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (el.classList.contains('cal-day-disabled') || el.classList.contains('cal-day-other')) return;
                fiSelectedDate = dateObj;
                if (onSelect) onSelect(dateObj);
                renderFiCalendar(grid, titleEl, monthSel, yearSel, null, onSelect);
            });

            grid.appendChild(el);
            dayIdx++;
        }

        const days = grid.querySelectorAll('.cal-day:not(.cal-day-empty)');
        days.forEach((el2, idx) => { el2.style.animationDelay = `${idx * 15}ms`; el2.classList.add('cal-day-animate'); });
    }

    // ── Form trigger: abre el modal directamente ──
    rpFiTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const nombres = document.getElementById('paciente-nombres').value.trim();
        const apellidos = document.getElementById('paciente-apellidos').value.trim();
        modalNombre.textContent = apellidos && nombres ? `${apellidos}, ${nombres}` : 'Datos del paciente';
        modalInfo.textContent = `DNI: ${inputDni.value || '—'} | HC: ${document.getElementById('paciente-hc').value || 'N/A'}`;
        const now = getPeruDate();
        fiSelectedDate = now;
        mFiDisplay.textContent = fmtDate(now);
        mFiDisplay.style.color = '#1e293b';
        modalHora.value = getPeruTimeNow();
        modalOverlay.style.display = 'flex';
    });

    // ── Modal popover ──
    let mFiOpen = false;
    populateFiMonths(mFiMonth);
    populateFiYears(mFiYear);

    const onMfiSelect = (d) => {
        mFiDisplay.textContent = fmtDate(d);
        mFiDisplay.style.color = '#1e293b';
        mFiTrigger.classList.remove('is-open');
        mFiPopover.style.display = 'none';
        mFiOpen = false;
    };

    function openMFiPopover() {
        mFiOpen = true;
        if (fiSelectedDate) { fiViewMonth = fiSelectedDate.getMonth(); fiViewYear = fiSelectedDate.getFullYear(); }
        renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, null, onMfiSelect);
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
    mFiPrev.addEventListener('click', () => { fiViewMonth--; if (fiViewMonth < 0) { fiViewMonth = 11; fiViewYear--; } renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, 'left', onMfiSelect); });
    mFiNext.addEventListener('click', () => { fiViewMonth++; if (fiViewMonth > 11) { fiViewMonth = 0; fiViewYear++; } renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, 'right', onMfiSelect); });
    mFiMonth.addEventListener('change', () => { fiViewMonth = parseInt(mFiMonth.value, 10); renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, null, onMfiSelect); });
    mFiYear.addEventListener('change', () => { fiViewYear = parseInt(mFiYear.value, 10); renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, null, onMfiSelect); });
    mFiToday.addEventListener('click', () => { fiViewMonth = fiToday.getMonth(); fiViewYear = fiToday.getFullYear(); renderFiCalendar(mFiGrid, mFiTitle, mFiMonth, mFiYear, null, onMfiSelect); });

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
        mFiDisplay.style.color = '#1e293b';
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
        rpFiDisplay.style.color = '#1e293b';

        closeModalIngreso();
    });

    // Click fuera de los popovers para cerrarlos
    document.addEventListener('click', (e) => {
        if (mFiOpen && !e.target.closest('#modal-fi-trigger') && !e.target.closest('#modal-fi-popover')) closeMFiPopover();
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

            // Obtener fecha en formato ISO (Y-m-d) para Supabase desde Flatpickr
            const fp = document.getElementById('paciente-fecha-nac')._flatpickr;
            if (fp && fp.selectedDates.length > 0) {
                payload.fecha_nacimiento = fp.formatDate(fp.selectedDates[0], "Y-m-d");
            } else {
                payload.fecha_nacimiento = document.getElementById('paciente-fecha-nac').value; // fallback
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
