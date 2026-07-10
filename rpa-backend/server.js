const express = require('express');
const cors = require('cors');
const compression = require('compression');
const puppeteer = require('puppeteer');

const app = express();
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

let browserInstance = null;

app.get('/', (req, res) => {
    res.json({ status: 'active', service: 'RPA Backend - Hospital San José', timestamp: new Date().toISOString() });
});

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
];

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initBrowser() {
    if (!browserInstance) {
        console.log('[System] Iniciando navegador persistente en memoria...');
        browserInstance = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox'
            ],
            defaultViewport: { width: 1280, height: 900 },
            headless: 'new'
        });
        console.log('[System] Navegador persistente listo.');
    }
    return browserInstance;
}

async function setupFastPage(browser) {
    // Contexto incógnito: cookies y caché limpios por cada consulta
    // Evita rate-limiting de sitios que detectan sesiones repetidas
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    await page.setUserAgent(getRandomUA());

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.isInterceptResolutionHandled()) return;
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
            req.abort().catch(() => {});
        } else {
            req.continue().catch(() => {});
        }
    });
    return { page, context };
}

const ESSALUD_API_URL = 'https://apps.essalud.gob.pe/dondemeatiendo-service/api/consultarAcreditacion';
const RECAPTCHA_SITE_KEY = '6LdtWAIgAAAAALmCBcz7Ql4XxAaJee78gK0-nZUZ';

async function scrapePaciente(paciente, browser) {
    const { dni, fecha_nacimiento, codigo_verificacion } = paciente;

    try {
        console.log(`[RPA] Consultando DNI ${dni} vía API EsSalud`);

        const fechaFormateada = formatearFecha(fecha_nacimiento);

        // Navegar a la página para establecer sesión y obtener captcha
        const { page, context } = await setupFastPage(browser);
        await page.goto('https://dondemeatiendo.essalud.gob.pe/#/consulta', {
            waitUntil: 'networkidle2',
            timeout: 30000
        }).catch(() => {});
        await delay(5000);

        // Llamar a la API directamente desde el navegador (cookies, headers correctos)
        const resultado = await page.evaluate(async ({ dni, fecha, dv, apiUrl, siteKey }) => {
            async function obtenerToken(intentos = 0) {
                try {
                    if (typeof grecaptcha !== 'undefined' && grecaptcha.ready) {
                        return await new Promise(resolve => {
                            grecaptcha.ready(() => {
                                grecaptcha.execute(siteKey, { action: 'submit' })
                                    .then(resolve).catch(() => resolve(''));
                            });
                        });
                    }
                    if (intentos < 5) {
                        await new Promise(r => setTimeout(r, 1000));
                        return obtenerToken(intentos + 1);
                    }
                } catch {}
                return '';
            }

            const token = await obtenerToken();
            const url = token ? `${apiUrl}?captchaToken=${encodeURIComponent(token)}` : apiUrl;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    codOpcion: '1', codTipDoc: '1', numDoc: dni,
                    digitoVerif: dv, fecNacimiento: fecha
                })
            });
            if (!resp.ok) return { error: `HTTP_${resp.status}` };
            const text = await resp.text();
            return text ? JSON.parse(text) : { error: 'EMPTY_BODY' };
        }, { dni, fecha: fechaFormateada, dv: codigo_verificacion, apiUrl: ESSALUD_API_URL, siteKey: RECAPTCHA_SITE_KEY });

        await context.close();

        console.log(`[RPA] DNI ${dni}: API →`, JSON.stringify(resultado).substring(0, 600));

        if (resultado.error) {
            console.warn(`[RPA] DNI ${dni}: ${resultado.error}`);
            return { dni, success: true, seguro: resultado.desError || 'NO TIENE DERECHO DE COBERTURA' };
        }

        const vItem = (resultado.vDataItem && resultado.vDataItem[0]) || {};
        let seguro = resultado.desError || vItem.tipoAfiliacion || 'NO TIENE DERECHO DE COBERTURA';

        // Validar si la cobertura ha expirado basándose en finVigenciaAcreditacion (DD/MM/YYYY)
        if (vItem.finVigenciaAcreditacion) {
            const parts = vItem.finVigenciaAcreditacion.split('/');
            if (parts.length === 3) {
                const fin = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T23:59:59`);
                if (new Date() > fin) {
                    seguro = 'NO TIENE DERECHO DE COBERTURA';
                }
            }
        } else if (!vItem.tipoAfiliacion && (!resultado.codError || resultado.codError !== "0")) {
            seguro = 'NO TIENE DERECHO DE COBERTURA';
        }

        console.log(`[RPA] DNI ${dni} → ${seguro} | Centro: ${vItem.desCentro || ''}`);
        return {
            dni, success: true, seguro,
            centro_asistencial: vItem.desCentro || '',
            direccion: vItem.dirCentro || '',
            red_asistencial: vItem.red || '',
            tipo_seguro: vItem.tipoSeguro || '',
            tipo_afiliacion: vItem.tipoAfiliacion || '',
            fin_vigencia: vItem.finVigencia || ''
        };

    } catch (error) {
        console.error(`[RPA] Error DNI ${dni}:`, error.message);
        return { dni, success: false, seguro: 'ERROR', errorType: 'INTERNAL_ERROR', error: error.message };
    }
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    if (!fecha.includes('-')) return fecha;
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
}

async function scrapeDV(dni, browser) {
    const { page, context } = await setupFastPage(browser);
    try {
        console.log(`[DV] Consultando DV para DNI: ${dni}`);
        await page.goto('https://dniperu.com/digito-verificador-dni/', {
            waitUntil: 'domcontentloaded', timeout: 15000
        });
        await page.waitForSelector('input#cc_nombres_1dni', { timeout: 8000 });

        const dv = await page.evaluate(async (dni) => {
            async function postForm(data) {
                const fd = new FormData();
                for (const [k, v] of Object.entries(data)) fd.append(k, v);
                const r = await fetch('https://dniperu.com/wp-admin/admin-ajax.php', {
                    method: 'POST', body: fd, credentials: 'same-origin'
                });
                return r.json();
            }
            async function fetchToken(ctx) {
                const r = await postForm({ action: 'cc_get_tokens', context: ctx, company: '', count: '1' });
                return r.success && r.data ? r.data : null;
            }
            async function query(action, params, ctx) {
                let r = await postForm({ ...params, action });
                if (r.data && r.data.code === 'token_required') {
                    const t = await fetchToken(ctx);
                    if (t) r = await postForm({ ...params, action, cc_token: t.cc_token, cc_sig: t.cc_sig });
                }
                return r;
            }
            const nResp = await query('buscar_nombres', { dni4: dni, company: '', buscar_dni: 'Buscar' }, 'buscar_nombres');
            if (nResp.success && nResp.data) {
                const m = nResp.data.message || '';
                const md = m.match(/Codigo de Verificacion:\s*(\d)/i);
                if (md) return md[1];
            }
            return '';
        }, dni);

        if (dv) {
            console.log(`[DV] DNI ${dni} → DV: ${dv}`);
            return { success: true, nombres: '', apellido_paterno: '', apellido_materno: '', codigo_verificacion: dv };
        }
        throw new Error('No se pudo obtener el DV');
    } catch (error) {
        console.error(`[DV] Error DNI ${dni}:`, error.message);
        return { success: false, error: error.message };
    } finally {
        await context.close();
    }
}

async function scrapeDOB(dni, browser) {
    const { page, context } = await setupFastPage(browser);

    try {
        console.log(`[DOB] Consultando fecha nacimiento DNI: ${dni}`);
        await page.goto('https://dniperu.com/saber-edad-con-dni/', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        await page.waitForSelector('input#cc_fecha_1dni', { timeout: 8000 });

        const result = await page.evaluate(async (dni) => {
            async function postForm(data) {
                const fd = new FormData();
                for (const [k, v] of Object.entries(data)) fd.append(k, v);
                const r = await fetch('https://dniperu.com/wp-admin/admin-ajax.php', {
                    method: 'POST', body: fd, credentials: 'same-origin'
                });
                return r.json();
            }

            async function fetchToken(ctx) {
                const r = await postForm({ action: 'cc_get_tokens', context: ctx, company: '', count: '1' });
                return r.success && r.data ? r.data : null;
            }

            async function query(action, params, ctx) {
                let r = await postForm({ ...params, action });
                if (r.data && r.data.code === 'token_required') {
                    const t = await fetchToken(ctx);
                    if (t) r = await postForm({ ...params, action, cc_token: t.cc_token, cc_sig: t.cc_sig });
                }
                return r;
            }

            const fResp = await query('buscar_fecha', { dni, company: '' }, 'buscar_fecha');
            let fecha = '', nombres = '';
            if (fResp.success && fResp.data) {
                fecha = fResp.data.fechaNacimiento || '';
                nombres = fResp.data.nombres || '';
            }

            const nResp = await query('buscar_nombres', { dni4: dni, company: '', buscar_dni: 'Buscar' }, 'buscar_nombres');
            let apPaterno = '', apMaterno = '', codigoVerificacion = '';
            if (nResp.success && nResp.data) {
                const m = nResp.data.message || '';
                const mp = m.match(/Apellido Paterno:\s*(.+)/i);
                const mm = m.match(/Apellido Materno:\s*(.+)/i);
                const mDv = m.match(/Codigo de Verificacion:\s*(\d)/i);
                apPaterno = mp ? mp[1].trim() : '';
                apMaterno = mm ? mm[1].trim() : '';
                codigoVerificacion = mDv ? mDv[1] : '';
            }

            return { fecha, nombres, apPaterno, apMaterno, codigo_verificacion: codigoVerificacion };
        }, dni);

        const fecha_nac = result.fecha;
        const nombres = result.nombres || '';
        const apellido_paterno = result.apPaterno || '';
        const apellido_materno = result.apMaterno || '';
        const codigo_verificacion = result.codigo_verificacion || '';

        let fecha_iso = '';
        let final_fecha_nac = fecha_nac;
        
        if (fecha_nac) {
            if (fecha_nac.includes('-')) {
                const parts = fecha_nac.split('-');
                if (parts[0].length === 4) {
                    fecha_iso = fecha_nac;
                    final_fecha_nac = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    fecha_iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    final_fecha_nac = `${parts[0]}/${parts[1]}/${parts[2]}`;
                }
            } else {
                const parts = fecha_nac.split('/');
                if (parts[0].length === 4) {
                    fecha_iso = `${parts[0]}-${parts[1]}-${parts[2]}`;
                    final_fecha_nac = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    fecha_iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }
        }

        if (final_fecha_nac) {
            console.log(`[DOB] DNI ${dni} → Fecha: ${final_fecha_nac}, ${apellido_paterno} ${apellido_materno}, ${nombres}, DV: ${codigo_verificacion}`);
        }

        return {
            success: !!final_fecha_nac,
            fecha_nac: final_fecha_nac,
            fecha_iso,
            nombres,
            apellido_paterno,
            apellido_materno,
            codigo_verificacion
        };
    } catch (error) {
        console.error(`[DOB] Error DNI ${dni}:`, error.message);
        return { success: false, error: error.message, nombres: '', apellido_paterno: '', apellido_materno: '' };
    } finally {
        await context.close();
    }
}

// ==========================================
// ENDPOINTS
// ==========================================

app.post('/get-dv', async (req, res) => {
    const { dni } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    try {
        const browser = await initBrowser();
        const result = await scrapeDV(dni, browser);
        if (result.success) return res.json(result);
        return res.status(400).json(result);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/get-dv-batch', async (req, res) => {
    const { pacientes } = req.body;
    if (!Array.isArray(pacientes) || pacientes.length === 0) return res.status(400).json({ error: 'Lista requerida' });

    try {
        const browser = await initBrowser();
        const results = [];
        for (const dni of pacientes) {
            const r = await scrapeDV(dni, browser);
            results.push({ dni, ...r });
        }
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/get-dob', async (req, res) => {
    const { dni } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const browser = await initBrowser();
            const result = await scrapeDOB(dni, browser);
            if (result.success) return res.json({ success: true, ...result });
            if (attempt === 2) return res.json({ success: false, error: 'No se pudo obtener la fecha de nacimiento' });
            await delay(500);
        } catch (err) {
            if (attempt === 2) return res.status(500).json({ success: false, error: err.message });
            await delay(500);
        }
    }
});

app.post('/validate', async (req, res) => {
    const { dni, fecha_nacimiento, codigo_verificacion } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    const browser = await initBrowser();
    const result = await scrapePaciente({ dni, fecha_nacimiento, codigo_verificacion }, browser);
    if (result.success) return res.json({ success: true, result });
    return res.status(500).json({ success: false, error: result.error });
});

app.post('/validate-batch', async (req, res) => {
    const { pacientes } = req.body;
    if (!Array.isArray(pacientes) || pacientes.length === 0) return res.status(400).json({ error: 'Lista requerida' });

    try {
        const browser = await initBrowser();
        const results = await Promise.all(pacientes.map(pac => scrapePaciente(pac, browser)));
        const exitosos = results.filter(r => r.success).length;
        res.json({ success: true, total: results.length, exitosos, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint combinado: DOB (Puppeteer) + DV (matemático) en paralelo, luego validate con los datos obtenidos
app.post('/consulta-completa', async (req, res) => {
    const { dni } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    console.log(`[COMPLETA] Iniciando consulta integral para DNI: ${dni}`);
    const startTime = Date.now();

    try {
        const browser = await initBrowser();

        console.log(`[COMPLETA] Consultando DOB...`);
        const dobResult = await scrapeDOB(dni, browser);
        const dv = dobResult.codigo_verificacion || '';

        const apPaterno = dobResult.apellido_paterno || '';
        const apMaterno = dobResult.apellido_materno || '';
        const apellidos = (apPaterno || apMaterno) ? `${apPaterno} ${apMaterno}`.trim() : '';

        const data = {
            dni,
            nombres: dobResult.nombres || '',
            apellidos,
            apellido_paterno: apPaterno,
            apellido_materno: apMaterno,
            fecha_nacimiento: dobResult.fecha_iso || '',
            fecha_nac: dobResult.fecha_nac || '',
            codigo_verificacion: dv,
            seguro_validado: 'NO CONSULTADO',
            estado_consulta: 'PROCESANDO'
        };

        let validateResult;
        if (!data.fecha_nacimiento || !data.codigo_verificacion) {
            console.log(`[COMPLETA] DNI ${dni}: Abortando EsSalud por falta de fecha de nacimiento o DV.`);
            validateResult = { success: false, seguro: 'DATOS INCOMPLETOS' };
        } else {
            console.log(`[COMPLETA] Validando seguro en EsSalud...`);
            validateResult = await scrapePaciente({
                dni,
                fecha_nacimiento: data.fecha_nacimiento,
                codigo_verificacion: data.codigo_verificacion
            }, browser);
        }

        if (validateResult.success) {
            data.seguro_validado = validateResult.seguro;
            data.centro_asistencial = validateResult.centro_asistencial || '';
            data.direccion = validateResult.direccion || '';
            data.red_asistencial = validateResult.red_asistencial || '';
            data.tipo_seguro = validateResult.tipo_seguro || '';
            data.tipo_afiliacion = validateResult.tipo_afiliacion || '';
            data.fin_vigencia = validateResult.fin_vigencia || '';
            data.estado_consulta = 'ÉXITO';
        } else {
            data.seguro_validado = validateResult.seguro || 'ERROR';
            data.estado_consulta = 'ERROR';
        }

        const totalTime = Date.now() - startTime;
        console.log(`[COMPLETA] DNI ${dni} completado en ${(totalTime / 1000).toFixed(1)}s → Seguro: ${data.seguro_validado}`);

        res.json({ success: true, ...data });
    } catch (err) {
        console.error(`[COMPLETA] Error DNI ${dni}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

initBrowser().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] RPA Backend escuchando en puerto ${PORT}`);
        console.log(`[Server] Motor Chromium está inicializado y caliente en memoria.`);
        console.log(`[Server] Endpoints: /get-dob | /get-dv | /validate | /validate-batch | /consulta-completa`);
    });
}).catch(err => {
    console.error("[System] Error crítico al iniciar Chromium:", err);
});

