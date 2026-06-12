// ============================================
// Módulo: Recién Nacidos Temporales
// CRUD + Importación Excel + Paginación
// ============================================
document.addEventListener('DOMContentLoaded', () => {

    // ── Referencias DOM ──
    const viewLista = document.getElementById('rn-view-lista');
    const viewForm = document.getElementById('rn-view-form');
    const tbody = document.getElementById('rn-tbody');
    const searchInput = document.getElementById('rn-search-input');
    const filterEstado = document.getElementById('rn-filter-estado');
    const btnNew = document.getElementById('rn-new-btn');
    const btnImport = document.getElementById('rn-import-btn');
    const btnCancelar = document.getElementById('rn-btn-cancelar');
    const form = document.getElementById('rn-registro-form');
    const editIdField = document.getElementById('rn-edit-id');
    const loadingDiv = document.getElementById('rn-loading');
    const paginationDiv = document.getElementById('rn-pagination');
    const guardarText = document.getElementById('rn-guardar-text');
    const guardarSpinner = document.getElementById('rn-guardar-spinner');

    // ── Estado ──
    let allRecords = [];
    let currentPage = 1;
    const pageSize = 15;
    let searchDebounce = null;

    // ── Utilidades de formato ──
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // ── Conversión de fechas calendario ──
    const isoToDisplay = (isoStr) => {
        if (!isoStr) return '';
        const parts = isoStr.split('T')[0].split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const displayToIso = (displayStr) => {
        if (!displayStr) return '';
        const parts = displayStr.split('/');
        if (parts.length !== 3) return displayStr;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    };

    const estadoBadge = (estado) => {
        const e = (estado || 'ACTIVO').toUpperCase();
        let cls = 'estado-activo';
        if (e === 'INACTIVO') cls = 'estado-inactivo';
        else if (e === 'TRANSFERIDO') cls = 'estado-transferido';
        else if (e === 'FALLECIDO') cls = 'estado-fallecido';
        return `<span class="estado-badge ${cls}">${e}</span>`;
    };

    // ── CRUD: Cargar registros ──
    const loadRecords = async () => {
        loadingDiv.style.display = 'block';
        document.getElementById('rn-table').style.display = 'none';

        const { data, error } = await supabaseClient
            .from('recien_nacidos_temporales')
            .select('*')
            .order('creado_en', { ascending: false });

        loadingDiv.style.display = 'none';
        document.getElementById('rn-table').style.display = '';

        if (error) {
            console.error('[RN] Error al cargar:', error.message);
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#ef4444;">Error al cargar registros</td></tr>`;
            return;
        }

        allRecords = data || [];
        currentPage = 1;
        renderTable();
    };

    // ── Filtrar ──
    const getFiltered = () => {
        const search = (searchInput.value || '').trim().toUpperCase();
        const estado = filterEstado.value;

        return allRecords.filter(r => {
            if (estado && (r.estado_temporal || '').toUpperCase() !== estado.toUpperCase()) return false;
            if (search) {
                const fields = [
                    r.cod_temporal, r.nombre_rn, r.nombre_mama,
                    r.num_doc_mama ? String(r.num_doc_mama) : '',
                    r.num_doc_papa ? String(r.num_doc_papa) : '',
                    r.establecimiento
                ].map(f => (f || '').toUpperCase());
                return fields.some(f => f.includes(search));
            }
            return true;
        });
    };

    // ── Renderizar tabla ──
    const renderTable = () => {
        const filtered = getFiltered();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8;">
                <i class="fa-solid fa-inbox" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
                No se encontraron registros</td></tr>`;
        } else {
            tbody.innerHTML = pageData.map(r => `
                <tr data-id="${r.id}">
                    <td style="font-weight:600; color:#0f172a;">${r.cod_temporal || '—'}</td>
                    <td>${formatDate(r.fecha_registro)}</td>
                    <td>${r.nombre_rn || '—'}</td>
                    <td>${formatDate(r.fecha_nacimiento)}</td>
                    <td>${r.num_doc_mama ? `<span style="font-size:11px; color:#64748b;">${r.tipo_doc_mama || 'DOC'}</span> ${r.num_doc_mama}` : '—'}</td>
                    <td>${r.nombre_mama || '—'}</td>
                    <td>${r.establecimiento || '—'}</td>
                    <td>${estadoBadge(r.estado_temporal)}</td>
                    <td style="text-align:center;">
                        <button class="action-btn-edit rn-edit-btn" data-id="${r.id}" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        // Paginación
        if (typeof window.renderPaginationControls === 'function') {
            window.renderPaginationControls(paginationDiv, currentPage, totalPages, (p) => {
                currentPage = p;
                renderTable();
            });
        } else {
            renderSimplePagination(paginationDiv, currentPage, totalPages);
        }
    };

    // Paginación simple de respaldo
    const renderSimplePagination = (container, page, total) => {
        if (total <= 1) { container.innerHTML = ''; return; }
        let html = '<div class="pagination-wrapper">';
        html += `<button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;
        for (let i = 1; i <= total; i++) {
            if (total > 7 && i > 3 && i < total - 1 && Math.abs(i - page) > 1) {
                if (i === 4 || i === total - 2) html += '<span class="pagination-ellipsis">...</span>';
                continue;
            }
            html += `<button class="pagination-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="pagination-btn" ${page >= total ? 'disabled' : ''} data-page="${page + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
        html += '</div>';
        container.innerHTML = html;
        container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page);
                if (p >= 1 && p <= total) { currentPage = p; renderTable(); }
            });
        });
    };

    // ── Eventos de búsqueda y filtro ──
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => { currentPage = 1; renderTable(); }, 250);
    });

    filterEstado.addEventListener('change', () => { currentPage = 1; renderTable(); });

    // ── Toggle Lista / Formulario ──
    const showList = () => {
        viewLista.style.display = '';
        viewForm.style.display = 'none';
        document.querySelector('.rn-commands').style.display = '';
        if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
    };

    const showForm = (editData = null) => {
        viewLista.style.display = 'none';
        viewForm.style.display = '';
        document.querySelector('.rn-commands').style.display = 'none';
        form.reset();
        editIdField.value = '';
        guardarText.textContent = 'Guardar';

        // Fecha de registro: hoy por defecto
        const hoy = new Date();
        const dd = String(hoy.getDate()).padStart(2, '0');
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const yyyy = hoy.getFullYear();
        const fechaRegInput = document.getElementById('rn-fecha-registro');
        fechaRegInput.value = `${dd}/${mm}/${yyyy}`;
        fechaRegInput.dataset.calDateValue = `${yyyy}-${mm}-${dd}`;

        if (editData) {
            editIdField.value = editData.id;
            guardarText.textContent = 'Actualizar';
            document.getElementById('rn-cod-temporal').value = editData.cod_temporal || '';
            const fechaReg = editData.fecha_registro || '';
            const rnFechaRegInput = document.getElementById('rn-fecha-registro');
            rnFechaRegInput.value = isoToDisplay(fechaReg);
            rnFechaRegInput.dataset.calDateValue = fechaReg;

            document.getElementById('rn-nombre-rn').value = editData.nombre_rn || '';

            const fechaNac = editData.fecha_nacimiento || '';
            const rnFechaNacInput = document.getElementById('rn-fecha-nacimiento');
            rnFechaNacInput.value = isoToDisplay(fechaNac);
            rnFechaNacInput.dataset.calDateValue = fechaNac;
            document.getElementById('rn-tipo-doc-mama').value = editData.tipo_doc_mama || 'DNI';
            document.getElementById('rn-num-doc-mama').value = editData.num_doc_mama ? String(editData.num_doc_mama) : '';
            document.getElementById('rn-nombre-mama').value = editData.nombre_mama || '';
            document.getElementById('rn-establecimiento').value = editData.establecimiento || '';
            document.getElementById('rn-tipo-doc-papa').value = editData.tipo_doc_papa || '';
            document.getElementById('rn-num-doc-papa').value = editData.num_doc_papa ? String(editData.num_doc_papa) : '';
            document.getElementById('rn-tipo-seguro-papa').value = editData.tipo_seguro_papa || '';
            document.getElementById('rn-estado-temporal').value = editData.estado_temporal || 'ACTIVO';

            // Sincronizar selects customizados
            ['rn-tipo-doc-mama','rn-tipo-doc-papa','rn-tipo-seguro-papa','rn-estado-temporal'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.customDropdownUpdate) el.customDropdownUpdate();
            });
        }

        if (window.adjustWelcomeTextVisibility) window.adjustWelcomeTextVisibility();
    };

    btnNew.addEventListener('click', () => showForm());
    btnCancelar.addEventListener('click', showList);

    // Editar desde tabla
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.rn-edit-btn');
        if (!btn) return;
        const id = btn.dataset.id;
        const record = allRecords.find(r => r.id === id);
        if (record) showForm(record);
    });

    // ── Guardar / Actualizar ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const codTemporal = document.getElementById('rn-cod-temporal').value.trim();
        const nombreRn = document.getElementById('rn-nombre-rn').value.trim();

        if (!codTemporal || !nombreRn) {
            if (window.showSystemTooltip) window.showSystemTooltip('Código temporal y nombre del RN son obligatorios.', true);
            return;
        }

        guardarSpinner.style.display = '';
        guardarText.style.visibility = 'hidden';

        const leerFecha = (id) => {
            const el = document.getElementById(id);
            return el.dataset.calDateValue || displayToIso(el.value) || null;
        };

        const payload = {
            cod_temporal: codTemporal.toUpperCase(),
            fecha_registro: leerFecha('rn-fecha-registro') || new Date().toISOString().split('T')[0],
            nombre_rn: nombreRn,
            fecha_nacimiento: leerFecha('rn-fecha-nacimiento'),
            tipo_doc_mama: document.getElementById('rn-tipo-doc-mama').value || null,
            num_doc_mama: document.getElementById('rn-num-doc-mama').value ? parseInt(document.getElementById('rn-num-doc-mama').value) : null,
            nombre_mama: document.getElementById('rn-nombre-mama').value.trim() || null,
            establecimiento: document.getElementById('rn-establecimiento').value.trim() || null,
            tipo_doc_papa: document.getElementById('rn-tipo-doc-papa').value || null,
            num_doc_papa: document.getElementById('rn-num-doc-papa').value ? parseInt(document.getElementById('rn-num-doc-papa').value) : null,
            tipo_seguro_papa: document.getElementById('rn-tipo-seguro-papa').value || null,
            estado_temporal: document.getElementById('rn-estado-temporal').value || 'ACTIVO',
        };

        const editId = editIdField.value;
        let result;

        if (editId) {
            // Actualizar
            result = await supabaseClient
                .from('recien_nacidos_temporales')
                .update(payload)
                .eq('id', editId);
        } else {
            // Insertar — agregar creado_por
            const { data: { session } } = await supabaseClient.auth.getSession();
            payload.creado_por = session?.user?.id || null;
            result = await supabaseClient
                .from('recien_nacidos_temporales')
                .insert(payload);
        }

        guardarSpinner.style.display = 'none';
        guardarText.style.visibility = '';

        if (result.error) {
            const msg = result.error.message.includes('duplicate')
                ? `El código temporal "${codTemporal}" ya existe.`
                : `Error: ${result.error.message}`;
            if (window.showSystemTooltip) window.showSystemTooltip(msg, true);
            return;
        }

        if (window.showSystemTooltip) window.showSystemTooltip(editId ? 'Registro actualizado correctamente.' : 'Registro creado correctamente.');
        showList();
        loadRecords();
    });

    // ── IMPORTACIÓN EXCEL ──
    btnImport.addEventListener('click', () => openImportModal());

    const openImportModal = () => {
        // Crear overlay + modal
        const overlay = document.createElement('div');
        overlay.className = 'import-overlay';
        overlay.innerHTML = `
            <div class="import-modal">
                <div class="import-modal-header">
                    <h3><i class="fa-solid fa-file-excel" style="color:#15803d; margin-right:8px;"></i>Importar desde Excel</h3>
                    <button class="import-modal-close" id="import-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="import-modal-body" id="import-body">
                    <div class="drop-zone" id="import-dropzone">
                        <div class="drop-zone-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                        <div class="drop-zone-text">Arrastra tu archivo Excel aquí</div>
                        <div class="drop-zone-hint">o haz clic para seleccionar (.xlsx, .xls)</div>
                        <input type="file" id="import-file-input" accept=".xlsx,.xls" style="display:none;">
                    </div>
                </div>
                <div class="import-modal-footer" id="import-footer" style="display:none;">
                    <div id="import-stats-container"></div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-module" id="import-cancel-btn" style="padding:10px 20px;">Cancelar</button>
                        <button class="btn-module primary" id="import-confirm-btn" style="padding:10px 20px;" disabled>
                            <span id="import-confirm-text">Importar</span>
                            <i id="import-confirm-spinner" class="fa-solid fa-circle-notch fa-spin" style="display:none; margin-left:6px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const dropzone = document.getElementById('import-dropzone');
        const fileInput = document.getElementById('import-file-input');
        const closeBtn = document.getElementById('import-close');

        // Cerrar modal
        const closeModal = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        // Click para abrir file picker
        dropzone.addEventListener('click', () => fileInput.click());

        // Drag & Drop
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) processFile(e.target.files[0]);
        });

        // Cancelar importación
        document.getElementById('import-cancel-btn')?.addEventListener('click', closeModal);

        let parsedRows = [];

        const processFile = async (file) => {
            dropzone.innerHTML = `<div class="drop-zone-icon"><i class="fa-solid fa-circle-notch fa-spin" style="color:#3b82f6;"></i></div>
                <div class="drop-zone-text">Procesando ${file.name}...</div>`;

            try {
                const data = await file.arrayBuffer();
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (json.length === 0) {
                    dropzone.innerHTML = `<div class="drop-zone-icon"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i></div>
                        <div class="drop-zone-text" style="color:#d97706;">El archivo no contiene datos</div>`;
                    return;
                }

                // Mapear columnas (insensible a espacios y tildes extras)
                const colMap = {
                    'COD.TEMPORAL': 'cod_temporal',
                    'COD. TEMPORAL': 'cod_temporal',
                    'CODTEMPORAL': 'cod_temporal',
                    'FECHA DE REGISTRO': 'fecha_registro',
                    'APELLIDOS Y NOMBRES RN': 'nombre_rn',
                    'FECHA DE NACIMIENTO': 'fecha_nacimiento',
                    'TIPO DE DOCUMENTO MAMA': 'tipo_doc_mama',
                    'NÚMERO DE DOCUMENTO MAMA': 'num_doc_mama',
                    'NUMERO DE DOCUMENTO MAMA': 'num_doc_mama',
                    'APELLIDOS Y NOMBRES MAMA': 'nombre_mama',
                    'ESTABLECIMIENTO DE SALUD': 'establecimiento',
                    'TIPO DE DOCUMENTO PAPA': 'tipo_doc_papa',
                    'NÚMERO DE DOCUMENTO PAPA': 'num_doc_papa',
                    'NUMERO DE DOCUMENTO PAPA': 'num_doc_papa',
                    'TIPO SEGURO DEL PAPA': 'tipo_seguro_papa',
                    'ESTADO TEMPORAL': 'estado_temporal',
                };

                const normalize = (s) => (s || '').toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const headerMap = {};
                const rawHeaders = Object.keys(json[0]);
                rawHeaders.forEach(h => {
                    const norm = normalize(h);
                    for (const [key, val] of Object.entries(colMap)) {
                        if (norm === normalize(key)) {
                            headerMap[h] = val;
                            break;
                        }
                    }
                });

                // Parsear filas
                const existingCodes = new Set(allRecords.map(r => (r.cod_temporal || '').toUpperCase()));

                parsedRows = json.map((row, idx) => {
                    const mapped = { _rowNum: idx + 2, _status: 'ok' };

                    for (const [rawHeader, dbField] of Object.entries(headerMap)) {
                        let val = row[rawHeader];

                        // Convertir fechas
                        if (dbField === 'fecha_registro' || dbField === 'fecha_nacimiento') {
                            if (val instanceof Date && !isNaN(val)) {
                                val = val.toISOString().split('T')[0];
                            } else if (typeof val === 'string' && val.includes('/')) {
                                const parts = val.split('/');
                                if (parts.length === 3) {
                                    val = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                }
                            } else if (typeof val === 'number') {
                                // Número serial de Excel
                                const d = new Date((val - 25569) * 86400 * 1000);
                                if (!isNaN(d)) val = d.toISOString().split('T')[0];
                            }
                        }

                        // Convertir documentos a número
                        if (dbField === 'num_doc_mama' || dbField === 'num_doc_papa') {
                            val = val ? parseInt(String(val).replace(/\D/g, '')) || null : null;
                        }

                        if (typeof val === 'string') val = val.trim();
                        mapped[dbField] = val || null;
                    }

                    // Validaciones
                    if (!mapped.cod_temporal) {
                        mapped._status = 'error';
                        mapped._msg = 'Sin código temporal';
                    } else if (existingCodes.has((mapped.cod_temporal || '').toUpperCase())) {
                        mapped._status = 'dup';
                        mapped._msg = 'Ya existe';
                    }

                    if (!mapped.nombre_rn) {
                        mapped._status = 'error';
                        mapped._msg = 'Sin nombre RN';
                    }

                    return mapped;
                });

                showPreview(parsedRows, file.name);

            } catch (err) {
                console.error('[RN Import]', err);
                dropzone.innerHTML = `<div class="drop-zone-icon"><i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i></div>
                    <div class="drop-zone-text" style="color:#ef4444;">Error al leer el archivo</div>
                    <div class="drop-zone-hint">${err.message}</div>`;
            }
        };

        const showPreview = (rows, filename) => {
            const body = document.getElementById('import-body');
            const footer = document.getElementById('import-footer');
            const confirmBtn = document.getElementById('import-confirm-btn');

            const totales = rows.length;
            const nuevos = rows.filter(r => r._status === 'ok').length;
            const duplicados = rows.filter(r => r._status === 'dup').length;
            const errores = rows.filter(r => r._status === 'error').length;

            body.innerHTML = `
                <div style="margin-bottom:15px;">
                    <span style="font-size:14px; font-weight:600; color:#0f172a;">
                        <i class="fa-solid fa-file-excel" style="color:#15803d; margin-right:6px;"></i>${filename}
                    </span>
                </div>
                <div class="import-stats">
                    <div class="import-stat total"><i class="fa-solid fa-list"></i> ${totales} filas</div>
                    <div class="import-stat nuevos"><i class="fa-solid fa-circle-plus"></i> ${nuevos} nuevos</div>
                    ${duplicados ? `<div class="import-stat duplicados"><i class="fa-solid fa-copy"></i> ${duplicados} duplicados</div>` : ''}
                    ${errores ? `<div class="import-stat errores"><i class="fa-solid fa-triangle-exclamation"></i> ${errores} con errores</div>` : ''}
                </div>
                <div class="import-preview-wrapper">
                    <table class="import-preview-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Cód. Temporal</th>
                                <th>Nombre RN</th>
                                <th>F. Nacimiento</th>
                                <th>Doc. Mamá</th>
                                <th>Nombre Mamá</th>
                                <th>Establecimiento</th>
                                <th>Estado</th>
                                <th>Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.slice(0, 100).map(r => `
                                <tr class="${r._status === 'error' ? 'row-error' : r._status === 'dup' ? 'row-dup' : ''}">
                                    <td>${r._rowNum}</td>
                                    <td style="font-weight:600;">${r.cod_temporal || '—'}</td>
                                    <td>${r.nombre_rn || '—'}</td>
                                    <td>${formatDate(r.fecha_nacimiento)}</td>
                                    <td>${r.num_doc_mama || '—'}</td>
                                    <td>${r.nombre_mama || '—'}</td>
                                    <td>${r.establecimiento || '—'}</td>
                                    <td>${r.estado_temporal || '—'}</td>
                                    <td>${r._status === 'ok' ? '<span style="color:#15803d;">✓ Listo</span>' : r._status === 'dup' ? '<span style="color:#d97706;">⚠ Duplicado</span>' : '<span style="color:#dc2626;">✕ ' + (r._msg || 'Error') + '</span>'}</td>
                                </tr>
                            `).join('')}
                            ${rows.length > 100 ? `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:10px;">... y ${rows.length - 100} filas más</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            `;

            footer.style.display = 'flex';
            confirmBtn.disabled = nuevos === 0;

            // Confirmar importación
            confirmBtn.onclick = () => executeImport(rows.filter(r => r._status === 'ok'), overlay);
        };

        const executeImport = async (rows, overlayEl) => {
            const confirmBtn = document.getElementById('import-confirm-btn');
            const confirmText = document.getElementById('import-confirm-text');
            const confirmSpinner = document.getElementById('import-confirm-spinner');

            confirmBtn.disabled = true;
            confirmSpinner.style.display = '';
            confirmText.textContent = 'Importando...';

            const { data: { session } } = await supabaseClient.auth.getSession();
            const userId = session?.user?.id || null;

            const batchSize = 50;
            let insertados = 0;
            let erroresInsert = 0;

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize).map(r => ({
                    cod_temporal: r.cod_temporal,
                    fecha_registro: r.fecha_registro || new Date().toISOString().split('T')[0],
                    nombre_rn: r.nombre_rn,
                    fecha_nacimiento: r.fecha_nacimiento || null,
                    tipo_doc_mama: r.tipo_doc_mama || null,
                    num_doc_mama: r.num_doc_mama || null,
                    nombre_mama: r.nombre_mama || null,
                    establecimiento: r.establecimiento || null,
                    tipo_doc_papa: r.tipo_doc_papa || null,
                    num_doc_papa: r.num_doc_papa || null,
                    tipo_seguro_papa: r.tipo_seguro_papa || null,
                    estado_temporal: r.estado_temporal || 'ACTIVO',
                    creado_por: userId,
                }));

                const { error } = await supabaseClient
                    .from('recien_nacidos_temporales')
                    .insert(batch);

                if (error) {
                    console.error('[RN Import batch]', error.message);
                    erroresInsert += batch.length;
                } else {
                    insertados += batch.length;
                }

                confirmText.textContent = `Importando... ${insertados + erroresInsert}/${rows.length}`;
            }

            confirmSpinner.style.display = 'none';

            if (erroresInsert > 0) {
                if (window.showSystemTooltip) window.showSystemTooltip(`Importación parcial: ${insertados} insertados, ${erroresInsert} con error.`, true);
            } else {
                if (window.showSystemTooltip) window.showSystemTooltip(`✓ ${insertados} registros importados correctamente.`);
            }

            // Cerrar modal y recargar
            overlayEl.style.opacity = '0';
            setTimeout(() => overlayEl.remove(), 300);
            loadRecords();
        };
    };

    // ── Calendarios Popover ──
    const initCalendario = (config) => {
        const { inputId, triggerId, popoverId, monthId, yearId, prevId, nextId, titleId, todayId, daysGridId } = config;

        const input = document.getElementById(inputId);
        const trigger = document.getElementById(triggerId);
        const popover = document.getElementById(popoverId);
        let isOpen = false;

        const openPopover = () => {
            if (isOpen) { closePopover(); return; }
            const r = input.getBoundingClientRect();
            const popH = 350;
            const spaceBelow = window.innerHeight - r.bottom - 8;
            if (spaceBelow >= popH) {
                popover.style.top = (r.bottom + 6) + 'px';
            } else {
                popover.style.top = Math.max(8, r.top - popH) + 'px';
            }
            popover.style.left = Math.min(r.left, window.innerWidth - 330) + 'px';
            popover.style.display = '';
            isOpen = true;
        };

        const closePopover = () => {
            popover.style.display = 'none';
            isOpen = false;
        };

        const onDayClick = (dateObj) => {
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            input.value = `${dd}/${mm}/${yyyy}`;
            input.dataset.calDateValue = `${yyyy}-${mm}-${dd}`;
            closePopover();
        };

        const cal = window.crearCalendario({
            mode: 'single',
            grid: document.getElementById(daysGridId),
            title: document.getElementById(titleId),
            month: document.getElementById(monthId),
            year: document.getElementById(yearId),
            prev: document.getElementById(prevId),
            next: document.getElementById(nextId),
            today: document.getElementById(todayId),
            onDayClick,
        });

        trigger.addEventListener('click', (e) => { e.stopPropagation(); openPopover(); });
        input.addEventListener('focus', () => { if (!isOpen) openPopover(); });
        input.addEventListener('click', () => { if (!isOpen) openPopover(); });

        document.addEventListener('click', (e) => {
            if (!input.parentElement.contains(e.target) && !e.target.closest(`#${popoverId}`)) {
                if (isOpen) closePopover();
            }
        });

        return { cal, openPopover, closePopover };
    };

    initCalendario({
        inputId: 'rn-fecha-registro', triggerId: 'rn-fregistro-trigger',
        popoverId: 'rn-fregistro-popover', monthId: 'rn-fregistro-month',
        yearId: 'rn-fregistro-year', prevId: 'rn-fregistro-prev',
        nextId: 'rn-fregistro-next', titleId: 'rn-fregistro-title',
        todayId: 'rn-fregistro-today', daysGridId: 'rn-fregistro-days-grid',
    });

    initCalendario({
        inputId: 'rn-fecha-nacimiento', triggerId: 'rn-fnac-trigger',
        popoverId: 'rn-fnac-popover', monthId: 'rn-fnac-month',
        yearId: 'rn-fnac-year', prevId: 'rn-fnac-prev',
        nextId: 'rn-fnac-next', titleId: 'rn-fnac-title',
        todayId: 'rn-fnac-today', daysGridId: 'rn-fnac-days-grid',
    });

    // ── Inicio ──
    loadRecords();
});
