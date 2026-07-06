const express = require('express');
const cors = require('cors');
const compression = require('compression');
const puppeteer = require('puppeteer');

const app = express();
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'] }));
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
        if (['image', 'font', 'media'].includes(type)) {
            req.abort().catch(() => {});
        } else {
            req.continue().catch(() => {});
        }
    });
    return { page, context };
}

async function scrapePaciente(paciente, browser) {
    const { dni, fecha_nacimiento, codigo_verificacion } = paciente;
    const { page, context } = await setupFastPage(browser);

    try {
        console.log(`[RPA] Iniciando consulta DNI: ${dni}`);

        await page.goto('https://dondemeatiendo.essalud.gob.pe/#/consulta', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        // Llenar el formulario usando inyección DOM nativa. Esto evita que Angular 
        // intercepte y borre el input durante su hidratación (Reactive Forms).
        await page.waitForSelector('input[formcontrolname="documento"]', { timeout: 10000 });
        await delay(1000);
        
        let fechaFormateada = fecha_nacimiento;
        if (fecha_nacimiento && fecha_nacimiento.includes('-')) {
            const parts = fecha_nacimiento.split('-');
            fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Forzar la inyección de los valores repetidamente hasta que Angular deje de
        // borrarlos por la hidratación inicial del formulario.
        await page.waitForFunction((valDni, valFecha, valDv) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const dniEl = inputs.find(i => (i.getAttribute('formcontrolname') || '').toLowerCase() === 'documento');
            const fechaEl = inputs.find(i => (i.getAttribute('formcontrolname') || '').toLowerCase() === 'fechanacimiento');
            const dvEl = inputs.find(i => (i.getAttribute('formcontrolname') || '').toLowerCase() === 'digito');

            function setNativeValue(el, value) {
                if (!el || !value) return;
                const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                valueSetter.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }

            if (dniEl && dniEl.value !== valDni) setNativeValue(dniEl, valDni);
            if (fechaEl && valFecha && fechaEl.value !== valFecha) setNativeValue(fechaEl, valFecha);
            if (dvEl && valDv && dvEl.value !== valDv) setNativeValue(dvEl, valDv);

            return (dniEl && dniEl.value === valDni) && 
                   (!valDv || (dvEl && dvEl.value === valDv));
        }, { timeout: 15000, polling: 500 }, dni, fechaFormateada, codigo_verificacion);

        const checkboxSelector = 'mat-checkbox, .mat-mdc-checkbox, input[type="checkbox"]';
        await page.waitForSelector(checkboxSelector, { timeout: 5000 });
        await page.click(checkboxSelector);

        await page.waitForSelector('mat-dialog-container button.mat-primary', { timeout: 5000 });
        await delay(500); // Esperar que la animación de apertura del modal termine
        await page.click('mat-dialog-container button.mat-primary');
        await delay(500); // Esperar que la animación de cierre del modal termine

        await page.waitForSelector('button.ess-btn-primary', { timeout: 5000 });
        await page.click('button.ess-btn-primary');

        // Esperar resultado de EsSalud dinámicamente, sin fallback prematuro
        try {
            await page.waitForFunction(() => {
                const txt = document.body.innerText;
                return txt.includes('Afiliado a:') ||
                       txt.includes('NO TIENE DERECHO DE COBERTURA') ||
                       txt.includes('No se encontraron resultados');
            }, { timeout: 20000 });
        } catch (waitErr) {
            console.warn(`[RPA] DNI ${dni}: EsSalud tardó más de 20s en responder. Tomando screenshot para depuración...`);
            await page.screenshot({ path: `essalud_timeout_${dni}_${Date.now()}.png` });
        }

        const data = await page.evaluate(() => {
            const body = document.body.innerText;

            if (body.includes('NO TIENE DERECHO DE COBERTURA') || body.includes('No se encontraron resultados')) {
                return { seguro: 'SIN COBERTURA' };
            }

            const matchAfiliado = body.match(/Afiliado a:\s*\n?\s*(.+)/i);
            const seguro = matchAfiliado ? matchAfiliado[1].trim().toUpperCase() : 'NO ENCONTRADO';

            return { seguro };
        });

        console.log(`[RPA] DNI ${dni} → Seguro: ${data.seguro}`);
        return { dni, success: true, seguro: data.seguro };

    } catch (error) {
        console.error(`[RPA] Error DNI ${dni}:`, error.message);
        return {
            dni,
            success: false,
            seguro: 'ERROR',
            errorType: 'INTERNAL_ERROR',
            error: error.message
        };
    } finally {
        await context.close();
    }
}

async function scrapeDV(dni, browser) {
    const { page, context } = await setupFastPage(browser);

    try {
        console.log(`[DV] Iniciando consulta DNI: ${dni}`);
        await page.goto('https://dniperu.com/digito-verificador-dni/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        await page.waitForSelector('input#cc_nombres_1dni', { timeout: 10000 });
        await page.evaluate(() => {
            const el = document.querySelector('input#cc_nombres_1dni');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await delay(500);
        await page.type('input#cc_nombres_1dni', dni, { delay: 20 });

        await page.evaluate(() => {
            const btn = document.querySelector('button.js-cc-submit');
            if (btn) btn.click();
        });

        await page.waitForFunction(() => {
            const textarea = document.querySelector('textarea.js-cc-copy-source');
            return textarea && textarea.value && textarea.value.length > 20;
        }, { timeout: 10000 });

        const resultText = await page.evaluate(() => document.querySelector('textarea.js-cc-copy-source').value);

        const matchNombres = resultText.match(/Nombres:\s*(.+)/i);
        const matchApPat = resultText.match(/Apellido Paterno:\s*(.+)/i);
        const matchApMat = resultText.match(/Apellido Materno:\s*(.+)/i);

        let nombres = matchNombres ? matchNombres[1].trim() : '';
        let apPaterno = matchApPat ? matchApPat[1].trim() : '';
        let apMaterno = matchApMat ? matchApMat[1].trim() : '';
        let nombresCompletos = nombres;
        if (apPaterno || apMaterno) {
            nombresCompletos += ' ' + apPaterno + ' ' + apMaterno;
        }

        const matchDV = resultText.match(/C[oó]digo de Verificaci[oó]n:\s*(\d)/i) || resultText.match(/D[ií]gito Verificador:\s*(\d)/i) || resultText.match(/CUI:\s*(\d)/i);
        const dv = matchDV ? matchDV[1] : '';

        console.log(`[DV] DNI ${dni} → Nombres: ${nombresCompletos}, DV: ${dv}`);

        return { success: true, nombres: nombresCompletos, apellido_paterno: apPaterno, apellido_materno: apMaterno, codigo_verificacion: dv };
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
        console.log(`[DOB] Iniciando consulta fecha nacimiento DNI: ${dni}`);
        await page.goto('https://dniperu.com/saber-edad-con-dni/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        await page.waitForSelector('input#cc_fecha_1dni', { timeout: 10000 });
        await page.evaluate(() => {
            const el = document.querySelector('input#cc_fecha_1dni');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await delay(500); // Dar tiempo a que el JS de la página se inicialice
        await page.type('input#cc_fecha_1dni', dni, { delay: 20 });

        await page.evaluate(() => {
            const btn = document.querySelector('button.js-cc-submit');
            if (btn) btn.click();
        });

        await page.waitForFunction(() => {
            const ta = document.querySelector('.js-cc-results textarea.result-textarea');
            return ta && ta.value && ta.value.length > 10;
        }, { timeout: 10000 });

        const resultText = await page.evaluate(() => document.querySelector('.js-cc-results textarea.result-textarea').value);

        const matchFecha = resultText.match(/Fecha de Nacimiento:\s*(\d{2}\/\d{2}\/\d{4})/i);
        const fecha_nac = matchFecha ? matchFecha[1] : '';

        const matchNombres = resultText.match(/Nombres:\s*(.+)/i);
        const nombres = matchNombres ? matchNombres[1].trim() : '';
        
        let fecha_iso = '';
        if (fecha_nac) {
            const parts = fecha_nac.split('/');
            fecha_iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        console.log(`[DOB] DNI ${dni} → Fecha: ${fecha_nac}`);

        return { success: !!fecha_nac, fecha_nac, fecha_iso, nombres };

    } catch (error) {
        console.error(`[DOB] Error DNI ${dni}:`, error.message);
        return { success: false, error: error.message };
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

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const browser = await initBrowser();
            const result = await scrapeDV(dni, browser);
            if (result.success) return res.json(result);
            if (attempt === 3) return res.json(result);
            await delay(1000);
        } catch (err) {
            if (attempt === 3) return res.status(500).json({ success: false, error: err.message });
            await delay(1000);
        }
    }
});

app.post('/get-dv-batch', async (req, res) => {
    const { pacientes } = req.body;
    if (!Array.isArray(pacientes) || pacientes.length === 0) return res.status(400).json({ error: 'Lista requerida' });

    try {
        const browser = await initBrowser();
        const limit = 5;
        const results = [];
        
        for (let i = 0; i < pacientes.length; i += limit) {
            const chunk = pacientes.slice(i, i + limit);
            const chunkPromises = chunk.map(dni => scrapeDV(dni, browser).then(res => ({ dni, ...res })));
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
            console.log(`[Batch] Procesado ${results.length}/${pacientes.length}`);
        }
        res.json({ success: true, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/get-dob', async (req, res) => {
    const { dni } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const browser = await initBrowser();
            const result = await scrapeDOB(dni, browser);
            if (result.success) return res.json({ success: true, ...result });
            if (attempt === 3) return res.json({ success: false, error: 'No se pudo obtener la fecha de nacimiento' });
            await delay(1000);
        } catch (err) {
            if (attempt === 3) return res.status(500).json({ success: false, error: err.message });
            await delay(1000);
        }
    }
});

app.post('/validate', async (req, res) => {
    const { dni, fecha_nacimiento, codigo_verificacion } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const browser = await initBrowser();
            const result = await scrapePaciente({ dni, fecha_nacimiento, codigo_verificacion }, browser);
            if (result.success) return res.json({ success: true, result });
            if (attempt === 3) return res.json({ success: true, result });
            await delay(2000);
        } catch (err) {
            if (attempt === 3) return res.status(500).json({ success: false, error: err.message });
            await delay(2000);
        }
    }
});

app.post('/validate-batch', async (req, res) => {
    const { pacientes } = req.body;
    if (!Array.isArray(pacientes) || pacientes.length === 0) return res.status(400).json({ error: 'Lista requerida' });

    try {
        const browser = await initBrowser();
        const results = [];
        
        const limit = 2;
        for (let i = 0; i < pacientes.length; i += limit) {
            const chunk = pacientes.slice(i, i + limit);
            const chunkPromises = chunk.map(pac => scrapePaciente(pac, browser));
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
            console.log(`[RPA Batch] Procesado ${results.length}/${pacientes.length}`);
            if (i + limit < pacientes.length) await delay(1000);
        }

        const exitosos = results.filter(r => r.success).length;
        res.json({ success: true, total: results.length, exitosos, results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint combinado: DOB + DV en paralelo, luego validate con los datos obtenidos
app.post('/consulta-completa', async (req, res) => {
    const { dni } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    console.log(`[COMPLETA] Iniciando consulta integral para DNI: ${dni}`);
    const startTime = Date.now();

    try {
        const browser = await initBrowser();

        // Fase 1: DOB y DV en paralelo (2 pestañas simultáneas)
        console.log(`[COMPLETA] Fase 1: DOB + DV en paralelo...`);
        const [dobResult, dvResult] = await Promise.all([
            scrapeDOB(dni, browser),
            scrapeDV(dni, browser)
        ]);

        const fase1Time = Date.now() - startTime;
        console.log(`[COMPLETA] Fase 1 completada en ${(fase1Time / 1000).toFixed(1)}s`);

        // Construir datos consolidados
        const data = {
            dni,
            nombres: dobResult.nombres || '',
            apellidos: '',
            apellido_paterno: dvResult.apellido_paterno || '',
            apellido_materno: dvResult.apellido_materno || '',
            fecha_nacimiento: dobResult.fecha_iso || '',
            fecha_nac: dobResult.fecha_nac || '',
            codigo_verificacion: dvResult.codigo_verificacion || '',
            seguro_validado: 'NO CONSULTADO',
            estado_consulta: 'PROCESANDO'
        };

        if (data.apellido_paterno || data.apellido_materno) {
            data.apellidos = `${data.apellido_paterno} ${data.apellido_materno}`.trim();
        }

        // Si DOB falló, usamos los nombres de DV
        if (!data.nombres && dvResult.nombres) {
            data.nombres = dvResult.nombres;
        }

        // Fase 2: Validar seguro en EsSalud
        let validateResult;
        if (!data.fecha_nacimiento || !data.codigo_verificacion) {
            console.log(`[COMPLETA] DNI ${dni}: Abortando EsSalud por falta de fecha de nacimiento o DV.`);
            validateResult = { success: false, seguro: 'DATOS INCOMPLETOS' };
        } else {
            console.log(`[COMPLETA] Fase 2: Validando seguro en EsSalud...`);
            validateResult = await scrapePaciente({
                dni,
                fecha_nacimiento: data.fecha_nacimiento,
                codigo_verificacion: data.codigo_verificacion
            }, browser);
        }

        if (validateResult.success) {
            data.seguro_validado = validateResult.seguro;
            data.estado_consulta = validateResult.seguro === 'SIN COBERTURA' ? 'SIN SEGURO' : 'ÉXITO';
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

