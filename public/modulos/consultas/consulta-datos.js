document.addEventListener('DOMContentLoaded', async () => {
    const supabase = typeof supabaseClient !== 'undefined' ? supabaseClient : null;

    // Referencias DOM
    const inputDNI = document.getElementById('filter-dni');
    const btnConsultar = document.getElementById('btn-consultar');
    const btnClear = document.getElementById('btn-clear');
    const viewResultados = document.getElementById('view-resultados');
    const tbody = document.getElementById('tbody-pacientes');
    const blockingOverlay = document.getElementById('blocking-overlay');
    const overlayMsg = document.getElementById('overlay-msg');

    // URLs Servicios
    const WORKER_URL = 'https://dni-lookup-api.seguimientohospitalario5.workers.dev/';
    const RAILWAY_URL = 'https://sistema-sis-production-5b60.up.railway.app';

    // Función Toast (reutilizando de layout si existe)
    const showToast = (msg, isError = false) => {
        if (window.showSystemTooltip) {
            window.showSystemTooltip(msg, isError);
        } else {
            alert(msg);
        }
    };

    const updateOverlay = (msg) => {
        if (overlayMsg) overlayMsg.textContent = msg;
    };

    // Fetch con reintentos automáticos y timeout
    const fetchWithRetry = async (url, options = {}, retries = 2, timeoutMs = 120000) => {
        const externalSignal = options.signal;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            if (externalSignal && externalSignal.aborted) {
                throw new Error('AbortError');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            // Escuchar el abort externo para abortar el fetch actual
            const abortHandler = () => controller.abort();
            if (externalSignal) {
                externalSignal.addEventListener('abort', abortHandler);
            }
            
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (externalSignal) {
                    externalSignal.removeEventListener('abort', abortHandler);
                }

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                
                if (!data.success && attempt < retries) {
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                return data;
            } catch (err) {
                clearTimeout(timeoutId);
                if (externalSignal) {
                    externalSignal.removeEventListener('abort', abortHandler);
                }

                if (err.name === 'AbortError') {
                    if (externalSignal && externalSignal.aborted) throw err; // Cancelación manual
                    // Si fue por timeout interno, reintentar si quedan intentos
                }

                if (attempt === retries) throw err;
                await new Promise(r => setTimeout(r, 3000 + (attempt * 2000)));
            }
        }
    };

    const resetView = () => {
        inputDNI.value = '';
        viewResultados.style.display = 'none';
        tbody.innerHTML = '';
    };

    // Control de cancelación de consultas
    let currentSearchController = null;

    // Evento Enter en input DNI
    inputDNI.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnConsultar.click();
    });

    const btnCancelSearch = document.getElementById('btn-cancel-search');
    if (btnCancelSearch) {
        btnCancelSearch.addEventListener('click', () => {
            if (currentSearchController) {
                currentSearchController.abort();
            }
        });
    }

    btnConsultar.addEventListener('click', async () => {
        const dni = inputDNI.value.trim();
        if (dni.length !== 8) {
            showToast('Ingrese un DNI válido de 8 dígitos', true);
            return;
        }

        blockingOverlay.style.display = 'flex';
        tbody.innerHTML = '';
        viewResultados.style.display = 'none';
        updateOverlay('Consultando fuentes...');

        // Iniciar nuevo controlador de cancelación
        currentSearchController = new AbortController();
        const signal = currentSearchController.signal;

        try {
            let dataConsolidada = {
                dni: dni,
                nombres: '',
                apellidos: '',
                fecha_nacimiento: '',
                codigo_verificacion: '',
                seguro_validado: 'NO ENCONTRADO',
                cobertura: '',
                estado_consulta: 'PROCESANDO'
            };

            // 1. SCRIPT DNI (Cloudflare Worker)
            updateOverlay('Consultando datos de identidad...');
            const dniResult = await fetchWithRetry(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni }),
                signal: signal
            });

            if (dniResult.success) {
                dataConsolidada.nombres = dniResult.nombres || '';
                dataConsolidada.apellidos = `${dniResult.apellido_paterno || ''} ${dniResult.apellido_materno || ''}`.trim();
                dataConsolidada.fecha_nacimiento = dniResult.fecha_iso || '';
            } else {
                throw new Error('No se pudo obtener la fecha de nacimiento (Servicio DNI)');
            }

            // 2. SCRIPT DV (Railway)
            updateOverlay('Obteniendo Dígito Verificador...');
            const dvData = await fetchWithRetry(`${RAILWAY_URL}/get-dv`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni }),
                signal: signal
            });
            
            if (dvData.success) {
                dataConsolidada.codigo_verificacion = dvData.codigo_verificacion;
                if (!dataConsolidada.nombres) dataConsolidada.nombres = dvData.nombres || '';
                if (!dataConsolidada.apellidos) {
                    dataConsolidada.apellidos = `${dvData.apellido_paterno || ''} ${dvData.apellido_materno || ''}`.trim();
                }
            } else {
                throw new Error('No se pudo obtener el Código de Verificación (Servicio DV)');
            }

            // 3. SCRIPT SEGURO (Railway)
            updateOverlay('Validando seguro en EsSalud...');
            const seguroData = await fetchWithRetry(`${RAILWAY_URL}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dni: dni,
                    fecha_nacimiento: dataConsolidada.fecha_nacimiento,
                    codigo_verificacion: dataConsolidada.codigo_verificacion
                }),
                signal: signal
            });
            
            if (seguroData.success) {
                dataConsolidada.seguro_validado = seguroData.result.seguro;
                dataConsolidada.cobertura = seguroData.result.cobertura;
                dataConsolidada.estado_consulta = 'ÉXITO';
            } else {
                dataConsolidada.estado_consulta = 'SIN SEGURO';
                dataConsolidada.seguro_validado = 'NO ENCONTRADO';
            }

            // 4. GUARDAR EN SUPABASE (Tabla consultas_datos)
            updateOverlay('Almacenando resultados...');
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session ? session.user.id : null;

            await supabase.from('consultas_datos').insert([{
                dni: dataConsolidada.dni,
                nombres: dataConsolidada.nombres,
                apellidos: dataConsolidada.apellidos,
                fecha_nacimiento: dataConsolidada.fecha_nacimiento || null,
                codigo_verificacion: dataConsolidada.codigo_verificacion,
                seguro_validado: dataConsolidada.seguro_validado,
                cobertura: dataConsolidada.cobertura,
                estado_consulta: dataConsolidada.estado_consulta,
                creado_por: userId
            }]);

            // 5. RENDERIZAR EN TABLA
            renderResult(dataConsolidada);
            viewResultados.style.display = 'block';
            showToast('Consulta completada exitosamente');

        } catch (err) {
            if (err.name === 'AbortError' || err.message === 'AbortError') {
                showToast('Consulta cancelada por el usuario', false);
            } else {
                console.error(err);
                showToast('Error en la consulta consolidada: ' + err.message, true);
            }
        } finally {
            blockingOverlay.style.display = 'none';
            currentSearchController = null;
        }
    });

    const modalRegistro = document.getElementById('modal-registro');
    const iframeRegistro = document.getElementById('iframe-registro');
    const btnCloseModal = document.getElementById('close-modal');

    btnCloseModal.addEventListener('click', () => {
        modalRegistro.style.display = 'none';
        iframeRegistro.src = ''; // Limpiar iframe
    });

    const renderResult = (data) => {
        const tr = document.createElement('tr');

        // Obtener hora de Perú para mostrar en la tabla
        const options = { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        const fechaHora = new Intl.DateTimeFormat('es-PE', options).format(new Date());

        const fnacFormateada = data.fecha_nacimiento ? data.fecha_nacimiento.split('-').reverse().join('/') : '—';

        tr.innerHTML = `
            <td>${data.dni}</td>
            <td style="font-weight:600; color:#1e293b;">${data.apellidos}, ${data.nombres}</td>
            <td>${fnacFormateada}</td>
            <td style="font-weight:700; color:#3b82f6;">${data.codigo_verificacion || '—'}</td>
            <td><span class="seguro-badge" style="color: #0f172a;">${data.seguro_validado}</span></td>
            <td style="font-size:12px; color:#64748b;">${data.cobertura || '—'}</td>
            <td><span class="condicion-badge ${data.estado_consulta === 'ÉXITO' ? 'cond-alta' : 'cond-fallecido'}">${data.estado_consulta}</span></td>
            <td style="font-size:12px; color:#94a3b8;">${fechaHora}</td>
            <td style="text-align:center;">
                <button class="btn-agregar-paciente" data-dni="${data.dni}" title="Agregar a mis pacientes" 
                        style="background:#3b82f6; color:white; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:600; transition:all 0.2s;">
                    <i class="fa-solid fa-user-plus"></i> Agregar
                </button>
            </td>
        `;

        // Evento para el botón Agregar
        tr.querySelector('.btn-agregar-paciente').addEventListener('click', () => {
            const autoFillData = {
                dni: data.dni,
                nombres: data.nombres,
                apellidos: data.apellidos,
                fecha_nacimiento: data.fecha_nacimiento, // yyyy-mm-dd
                codigo_verificacion: data.codigo_verificacion,
                tipo_seguro: data.seguro_validado
            };
            
            sessionStorage.setItem('cd_auto_fill', JSON.stringify(autoFillData));
            
            // Abrir modal con el iframe apuntando al registro con un parámetro especial
            iframeRegistro.src = '../pacientes/registro-pacientes.html?view=modal';
            modalRegistro.style.display = 'flex';
        });

        tbody.appendChild(tr);
    };

    btnClear.addEventListener('click', resetView);

    // ========== LISTENER: PACIENTE REGISTRADO DESDE MODAL ==========
    window.addEventListener('message', (event) => {
        if (!event.data || event.data.type !== 'paciente-registrado') return;

        const { dni, pacienteId } = event.data;

        // 1. Cerrar el modal
        modalRegistro.style.display = 'none';
        iframeRegistro.src = '';

        // 2. Tooltip de éxito
        showToast('Paciente Guardado Exitosamente');

        // 3. Transformar botón "Agregar" → "Ver"
        if (dni) {
            const btn = document.querySelector(`.btn-agregar-paciente[data-dni="${dni}"]`);
            if (btn) {
                btn.outerHTML = `
                    <a href="../seguimiento/detalle-paciente.html?id=${pacienteId}" 
                       title="Ver detalle del paciente"
                       style="display:inline-flex; align-items:center; gap:5px; background:#10b981; color:white; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:600; text-decoration:none; font-size:14px; transition:all 0.2s;">
                        <i class="fa-solid fa-eye"></i> Ver
                    </a>`;
            }
        }
    });
});
