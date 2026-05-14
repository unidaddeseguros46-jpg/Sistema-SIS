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
    const fetchWithRetry = async (url, options, retries = 2, timeoutMs = 120000) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                
                // Si el servicio respondió pero el scraping falló, reintentar
                if (!data.success && attempt < retries) {
                    console.warn(`[Retry] Intento ${attempt + 1} falló, reintentando en 3s...`);
                    await new Promise(r => setTimeout(r, 3000));
                    continue;
                }
                
                return data;
            } catch (err) {
                console.error(`[Fetch] Intento ${attempt + 1} error: ${err.message}`);
                if (attempt === retries) throw err;
                // Espera progresiva: 3s, 5s
                await new Promise(r => setTimeout(r, 3000 + (attempt * 2000)));
            }
        }
    };

    const resetView = () => {
        inputDNI.value = '';
        viewResultados.style.display = 'none';
        tbody.innerHTML = '';
    };

    // Evento Enter en input DNI
    inputDNI.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnConsultar.click();
    });

    btnConsultar.addEventListener('click', async () => {
        const dni = inputDNI.value.trim();
        if (dni.length !== 8) {
            showToast('Ingrese un DNI válido de 8 dígitos', true);
            return;
        }

        blockingOverlay.style.display = 'flex';
        tbody.innerHTML = '';
        viewResultados.style.display = 'none';

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
                body: JSON.stringify({ dni })
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
                body: JSON.stringify({ dni })
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
                })
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
            console.error(err);
            showToast('Error en la consulta consolidada: ' + err.message, true);
        } finally {
            blockingOverlay.style.display = 'none';
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
                <button class="btn-agregar-paciente" title="Agregar a mis pacientes" 
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
});
