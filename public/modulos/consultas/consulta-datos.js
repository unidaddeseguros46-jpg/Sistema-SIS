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

    const resetView = () => {
        inputDNI.value = '';
        viewResultados.style.display = 'none';
        tbody.innerHTML = '';
    };

    btnConsultar.addEventListener('click', async () => {
        const dni = inputDNI.value.trim();
        if (dni.length !== 8) {
            showToast('Ingrese un DNI válido de 8 dígitos', true);
            return;
        }

        blockingOverlay.style.display = 'flex';
        tbody.innerHTML = '';
        viewResultados.style.display = 'none';

        let dataConsolidada = {
            dni: dni,
            nombres: '',
            apellidos: '',
            fecha_nacimiento: '',
            codigo_verificacion: '',
            seguro_validado: 'ERROR',
            cobertura: '',
            estado_consulta: 'PENDIENTE'
        };

        try {
            // 1. SCRIPT DNI (Cloudflare Worker)
            updateOverlay('Consultando datos de identidad...');
            const resDni = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni })
            });
            const dniResult = await resDni.json();

            if (dniResult.success) {
                dataConsolidada.nombres = dniResult.nombres || '';
                dataConsolidada.apellidos = `${dniResult.apellido_paterno || ''} ${dniResult.apellido_materno || ''}`.trim();
                dataConsolidada.fecha_nacimiento = dniResult.fecha_iso || ''; // yyyy-mm-dd
            }

            // 2. SCRIPT DV (Railway)
            updateOverlay('Obteniendo Dígito Verificador y Datos...');
            const resDV = await fetch(`${RAILWAY_URL}/get-dv`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni })
            });
            const dvData = await resDV.json();
            if (dvData.success) {
                dataConsolidada.codigo_verificacion = dvData.codigo_verificacion;
                // Si el Worker no trajo nombres, los tomamos de aquí
                if (!dataConsolidada.nombres) dataConsolidada.nombres = dvData.nombres || '';
                if (!dataConsolidada.apellidos) dataConsolidada.apellidos = `${dvData.apellido_paterno || ''} ${dvData.apellido_materno || ''}`.trim();
            }

            // 3. SCRIPT SEGURO (Railway)
            if (dataConsolidada.fecha_nacimiento && dataConsolidada.codigo_verificacion) {
                updateOverlay('Validando seguro en EsSalud...');
                const resSeguro = await fetch(`${RAILWAY_URL}/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dni: dni,
                        fecha_nacimiento: dataConsolidada.fecha_nacimiento,
                        codigo_verificacion: dataConsolidada.codigo_verificacion
                    })
                });
                const seguroData = await resSeguro.json();
                if (seguroData.success) {
                    dataConsolidada.seguro_validado = seguroData.result.seguro;
                    dataConsolidada.cobertura = seguroData.result.cobertura;
                    dataConsolidada.estado_consulta = 'ÉXITO';
                } else {
                    dataConsolidada.estado_consulta = 'ERROR EN SEGURO';
                }
            } else {
                dataConsolidada.estado_consulta = 'DATOS INCOMPLETOS';
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

    const renderResult = (data) => {
        const tr = document.createElement('tr');

        const fechaHora = new Date().toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

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
        `;
        tbody.appendChild(tr);
    };

    btnClear.addEventListener('click', resetView);
});
