document.addEventListener('DOMContentLoaded', async () => {
    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();
    if (!session) { window.location.href = '../../index.html'; return; }

    // ── State ──
    const charts = {};
    let crRangeStart = null;
    let crRangeEnd = null;
    let hastaHoyActive = false;
    let generateTimer = null;
    const CHART_COLORS = [
        '#1976D2', '#1E88E5', '#42A5F5', '#64B5F6', '#4FC3F7',
        '#26C6DA', '#4DD0E1', '#0097A7', '#26A69A', '#4DB6AC',
        '#5C6BC0', '#7986CB',
    ];
    const LINE_BLUE = CHART_COLORS[1];
    const LINE_GREEN = CHART_COLORS[8];
    const COLOR_HOSP = CHART_COLORS[0];
    const COLOR_ALTA = CHART_COLORS[8];
    const COLOR_FALL = '#78909C';
    const COLOR_OTROS = '#B0BEC5';
    const SEGURO_PALETTE = ['#1e40af','#3b82f6','#059669','#8b5cf6','#0d9488','#dc2626','#1e293b','#64748b'];

    // ── DOM refs ──
    const DOM = {
        trigger: document.getElementById('rp-date-trigger'),
        popover: document.getElementById('rp-date-popover'),
        display: document.getElementById('rp-date-display'),
        calMonth: document.getElementById('rp-filter-month'),
        calYear: document.getElementById('rp-filter-year'),
        calTitle: document.getElementById('rp-cal-title'),
        calGrid: document.getElementById('rp-cal-days-grid'),
        calPrev: document.getElementById('rp-cal-prev'),
        calNext: document.getElementById('rp-cal-next'),
        calToday: document.getElementById('rp-cal-today'),
        hastaHoy: document.getElementById('rp-hasta-hoy'),
        dateWrapper: document.querySelector('.rp-date-wrapper'),
        filterServicio: document.getElementById('filter-servicio'),
        btnGenerate: document.getElementById('btn-generate'),
        btnClear: document.getElementById('btn-clear-reportes'),
        loadingEl: document.getElementById('loading-reports'),
        btnExcel: document.getElementById('btn-export-excel'),
        btnPrint: document.getElementById('btn-export-print'),
    };

    // ── Helpers ──
    const getPeruDate = (offset = 0) => {
        const d = new Date();
        const p = new Date(d.toLocaleString('en-US', { timeZone: 'America/Lima' }));
        if (offset) p.setDate(p.getDate() + offset);
        return p;
    };

    const toISODate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const fmt = (n) => (n || 0).toLocaleString('es-PE');
    const pad = (n) => String(n).padStart(2, '0');

    const destroyCharts = () => {
        Object.values(charts).forEach(c => { if (c) c.destroy(); });
        Object.keys(charts).forEach(k => delete charts[k]);
        document.querySelectorAll('.chart-card canvas').forEach(c => {
            c.removeAttribute('width');
            c.removeAttribute('height');
            c.style.removeProperty('width');
            c.style.removeProperty('height');
        });
    };

    const resetNoData = () => {
        document.querySelectorAll('.chart-card .no-data-msg').forEach(el => el.remove());
        document.querySelectorAll('.chart-card canvas').forEach(c => c.style.display = 'block');
    };

    // ── Debounced auto-generate ──
    const scheduleGenerate = () => {
        clearTimeout(generateTimer);
        generateTimer = setTimeout(generateReport, 300);
    };

    // ── Calendar (shared) ──
    const rpCal = window.crearCalendario({
        mode: 'range',
        grid: DOM.calGrid,
        title: DOM.calTitle,
        month: DOM.calMonth,
        year: DOM.calYear,
        prev: DOM.calPrev,
        next: DOM.calNext,
        today: DOM.calToday,
        rangeStart: crRangeStart,
        rangeEnd: crRangeEnd,
        onDayClick: ({ start }) => {
            if (hastaHoyActive) {
                hastaHoyActive = false;
                DOM.hastaHoy.classList.remove('active');
            }
            crRangeStart = start;
            crRangeEnd = null;
            updateDateDisplay();
        },
        onRangeComplete: ({ start, end }) => {
            if (hastaHoyActive) {
                hastaHoyActive = false;
                DOM.hastaHoy.classList.remove('active');
            }
            crRangeStart = start;
            crRangeEnd = end;
            updateDateDisplay();
            closeDatePopover();
            scheduleGenerate();
        }
    });

    function updateDateDisplay() {
        const fmtDate = (d) => {
            if (!d) return '';
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        };
        if (hastaHoyActive) {
            DOM.display.textContent = 'Hasta hoy';
            DOM.trigger.classList.add('rp-date-hastahoy');
        } else if (crRangeStart && crRangeEnd) {
            DOM.display.textContent = `${fmtDate(crRangeStart)} — ${fmtDate(crRangeEnd)}`;
            DOM.trigger.classList.remove('rp-date-hastahoy');
        } else if (crRangeStart) {
            DOM.display.textContent = `Desde: ${fmtDate(crRangeStart)}`;
            DOM.trigger.classList.remove('rp-date-hastahoy');
        } else {
            DOM.display.textContent = 'Seleccionar rango de fechas';
            DOM.trigger.classList.remove('rp-date-hastahoy');
        }
    }

    function getDateRangeValues() {
        if (hastaHoyActive) {
            const hoy = getPeruDate();
            return { start: null, end: toISODate(hoy) };
        }
        if (!crRangeStart) return { start: null, end: null };
        const start = toISODate(crRangeStart);
        const end = crRangeEnd ? toISODate(crRangeEnd) : start;
        return { start, end };
    }

    function openDatePopover() {
        if (hastaHoyActive) {
            DOM.hastaHoy.classList.add('btn-pulse');
            setTimeout(() => DOM.hastaHoy.classList.remove('btn-pulse'), 2000);
            if (window.showSystemTooltip) window.showSystemTooltip('Desactive «Hasta hoy» para usar el rango de fechas', true);
            return;
        }
        if (crRangeStart) rpCal.setView(crRangeStart.getFullYear(), crRangeStart.getMonth());
        rpCal.render();
        DOM.popover.style.display = 'block';
        DOM.trigger.classList.add('is-open');
    }

    function closeDatePopover() {
        DOM.popover.style.display = 'none';
        DOM.trigger.classList.remove('is-open');
    }

    function toggleHastaHoy() {
        hastaHoyActive = !hastaHoyActive;
        DOM.hastaHoy.classList.toggle('active', hastaHoyActive);
        if (hastaHoyActive) {
            crRangeStart = null;
            crRangeEnd = null;
            rpCal.setRange(null, null);
            closeDatePopover();
        }
        updateDateDisplay();
        scheduleGenerate();
    }

    // ── Filters ──
    const getFilters = () => {
        const { start, end } = getDateRangeValues();
        return {
            fecha_desde: start,
            fecha_hasta: end,
            servicio: DOM.filterServicio.value || null
        };
    };

    // ── Data fetching ──
    async function fetchPacientes(filters) {
        let q = client.from('pacientes').select('condicion, servicio, tipo_seguro, fecha_nacimiento', { count: 'exact' });
        if (filters.servicio) q = q.eq('servicio', filters.servicio);
        if (filters.fecha_desde) q = q.gte('creado_en', `${filters.fecha_desde}T00:00:00-05:00`);
        if (filters.fecha_hasta) q = q.lte('creado_en', `${filters.fecha_hasta}T23:59:59-05:00`);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
    }

    async function fetchHospitalizaciones(filters) {
        let q = client.from('hospitalizaciones').select('fecha_ingreso, fecha_alta, servicio');
        if (filters.servicio) q = q.eq('servicio', filters.servicio);
        if (filters.fecha_desde) q = q.gte('fecha_ingreso', filters.fecha_desde);
        if (filters.fecha_hasta) q = q.lte('fecha_ingreso', filters.fecha_hasta);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }

    // ── Helpers to build month-grouped data ──
    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
    function fmtMonth(ym) {
        const [y, m] = ym.split('-');
        return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
    }
    function countByMonth(dates, desde, hasta) {
        const map = {};
        dates.forEach(d => {
            const key = (d.split('T')[0] || d).substring(0, 7);
            map[key] = (map[key] || 0) + 1;
        });
        // Build ordered month range
        const start = desde || Object.keys(map).sort()[0] || toISODate(getPeruDate()).substring(0, 7);
        const end = hasta || toISODate(getPeruDate()).substring(0, 7);
        const result = [];
        const cur = new Date(start + '-01T00:00:00');
        const endD = new Date(end + '-01T00:00:00');
        while (cur <= endD) {
            const key = toISODate(cur).substring(0, 7);
            result.push({ month: fmtMonth(key), value: map[key] || 0 });
            cur.setMonth(cur.getMonth() + 1);
        }
        return result;
    }

    // ── Generate ──
    async function generateReport() {
        DOM.loadingEl.classList.add('active');
        DOM.btnGenerate.disabled = true;
        DOM.btnGenerate.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...';
        destroyCharts();
        resetNoData();
        closeDatePopover();

        try {
            const filters = getFilters();
            const [pacResult, hospData] = await Promise.all([
                fetchPacientes(filters),
                fetchHospitalizaciones(filters)
            ]);

            const pac = pacResult.data;
            const totalCount = pacResult.count;

            // ── 1. Score General ──
            const scoreNumber = document.getElementById('score-number');
            const scorePeriod = document.getElementById('score-period');
            if (scoreNumber) scoreNumber.textContent = fmt(totalCount);
            if (scorePeriod) {
                const { start, end } = getDateRangeValues();
                scorePeriod.textContent = (start && end) ? `${start} — ${end}` : '';
            }

            // ── 2. Condition ──
            const condGroups = { HOSPITALIZADO: 0, ALTA: 0, FALLECIDO: 0 };
            pac.forEach(p => {
                const c = (p.condicion || '').toUpperCase();
                if (condGroups[c] !== undefined) condGroups[c]++;
            });
            const condColors = [COLOR_HOSP, COLOR_ALTA, COLOR_FALL];
            renderCondicionStats(condGroups, condColors, totalCount);

            // ── 3. Seguro ──
            const segGroups = {};
            pac.forEach(p => {
                const s = p.tipo_seguro || 'SIN SEGURO';
                segGroups[s] = (segGroups[s] || 0) + 1;
            });
            const segSorted = Object.entries(segGroups).sort((a, b) => b[1] - a[1]);
            const segColors = segSorted.map((_, i) => SEGURO_PALETTE[i % SEGURO_PALETTE.length]);

            renderSeguroStats(segSorted, segColors, totalCount);

            // ── 4. Admissions Line (by month) ──
            const admDates = hospData.map(h => h.fecha_ingreso).filter(Boolean);
            const admMonthly = countByMonth(admDates, filters.fecha_desde, filters.fecha_hasta);

            const ctxAdm = document.getElementById('chart-admisiones')?.getContext('2d');
            if (ctxAdm) {
                const hasData = admMonthly.some(d => d.value > 0);
                charts.admisiones = new Chart(ctxAdm, {
                    type: 'line',
                    data: {
                        labels: hasData ? admMonthly.map(d => d.month) : [],
                        datasets: [{
                            label: 'Admisiones',
                            data: hasData ? admMonthly.map(d => d.value) : [],
                                borderColor: LINE_BLUE,
                                backgroundColor: 'rgba(30,136,229,0.08)',
                                fill: true,
                                tension: 0.3,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                pointBackgroundColor: LINE_BLUE,
                            borderWidth: 2,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                        },
                        scales: {
                            x: {
                                ticks: {
                                    font: { size: 10 },
                                    maxRotation: 45,
                                },
                                grid: { display: false }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    display: false,
                                },
                                grid: { color: '#f1f5f9' }
                            }
                        }
                    }
                });
            }

            // ── 5. Grupo Etario ──
            const ageGroups = { 'Niños': 0, 'Adolescentes': 0, 'Adultos': 0, 'Adultos Mayores': 0 };
            const ageOrder = ['Niños', 'Adolescentes', 'Adultos', 'Adultos Mayores'];
            pac.forEach(p => {
                if (!p.fecha_nacimiento) return;
                const parts = p.fecha_nacimiento.split('-');
                if (parts.length < 3) return;
                const nac = new Date(+parts[0], +parts[1] - 1, +parts[2]);
                const hoy = getPeruDate();
                let edad = hoy.getFullYear() - nac.getFullYear();
                const m = hoy.getMonth() - nac.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
                if (edad < 0) edad = 0;
                if (edad <= 12) ageGroups['Niños']++;
                else if (edad <= 17) ageGroups['Adolescentes']++;
                else if (edad <= 59) ageGroups['Adultos']++;
                else ageGroups['Adultos Mayores']++;
            });
            const edadLabels = ageOrder;
            const edadData = ageOrder.map(k => ageGroups[k]);
            const edadColors = ageOrder.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

            const ctxEdad = document.getElementById('chart-edad')?.getContext('2d');
            if (ctxEdad) {
                const hasData = edadData.some(v => v > 0);
                charts.edad = new Chart(ctxEdad, {
                    type: 'bar',
                    data: {
                        labels: hasData ? edadLabels : [],
                        datasets: [{
                            label: 'Pacientes',
                            data: hasData ? edadData : [],
                            backgroundColor: hasData ? edadColors : ['#e2e8f0'],
                            borderWidth: 0,
                            borderRadius: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {
                                ticks: { font: { size: 10 } },
                                grid: { display: false }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: { display: false },
                                grid: { color: '#f1f5f9' }
                            }
                        }
                    }
                });
            }

            // ── 6. Service Horizontal Bar ──
            const svcGroups = {};
            pac.forEach(p => {
                const s = p.servicio || 'SIN SERVICIO';
                svcGroups[s] = (svcGroups[s] || 0) + 1;
            });
            const svcSorted = Object.entries(svcGroups).sort((a, b) => b[1] - a[1]);
            const svcLabels = svcSorted.map(([k]) => k);
            const svcData = svcSorted.map(([, v]) => v);
            const svcColors = svcSorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

            const ctxSvc = document.getElementById('chart-servicios')?.getContext('2d');
            if (ctxSvc) {
                const hasData = svcData.some(v => v > 0);
                charts.servicios = new Chart(ctxSvc, {
                    type: 'bar',
                    data: {
                        labels: hasData ? svcLabels : [],
                        datasets: [{
                            label: 'Pacientes',
                            data: hasData ? svcData : [],
                            backgroundColor: hasData ? svcColors : ['#e2e8f0'],
                            borderWidth: 0,
                            borderRadius: 4,
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.parsed.x} pacientes`
                                }
                            }
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                ticks: {
                                    display: false,
                                },
                                grid: { color: '#f1f5f9' }
                            },
                            y: {
                                ticks: { font: { size: 12 } },
                                grid: { display: false }
                            }
                        }
                    },
                    plugins: [{
                        id: 'barLabels',
                        afterDatasetsDraw(chart) {
                            const { ctx, chartArea: { top, bottom, left, right } } = chart;
                            chart.data.datasets.forEach((ds, i) => {
                                const meta = chart.getDatasetMeta(i);
                                meta.data.forEach((bar, j) => {
                                    const val = ds.data[j];
                                    if (val === 0 || val === undefined || val === null) return;
                                    ctx.save();
                                    ctx.font = '600 12px system-ui, sans-serif';
                                    ctx.fillStyle = '#475569';
                                    ctx.textAlign = 'left';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText(fmt(val), bar.x + 6, bar.y);
                                    ctx.restore();
                                });
                            });
                        }
                    }]
                });
            }

        } catch (err) {
            console.error(err);
            if (window.showSystemTooltip) window.showSystemTooltip('Error al generar reporte', true);
        } finally {
            DOM.loadingEl.classList.remove('active');
            DOM.btnGenerate.disabled = false;
            DOM.btnGenerate.innerHTML = '<i class="fa-solid fa-rotate"></i> Generar Reporte';
        }
    }

    // ── Service cards ──
    // ── Clear filters ──
    function clearFilters() {
        crRangeStart = null;
        crRangeEnd = null;
        hastaHoyActive = false;
        DOM.hastaHoy.classList.remove('active');
        rpCal.setRange(null, null);
        updateDateDisplay();

        DOM.filterServicio.value = '';
        if (DOM.filterServicio.customDropdownUpdate) DOM.filterServicio.customDropdownUpdate();

        scheduleGenerate();
    }

    // ── Export: Excel ──
    async function exportExcel() {
        if (typeof XLSX === 'undefined') {
            if (window.showSystemTooltip) window.showSystemTooltip('Error: Librería XLSX no disponible. Recargue la página.', true);
            return;
        }

        const btn = DOM.btnExcel;
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Exportando...';

        try {
            const filters = getFilters();
            let q = client.from('pacientes').select('*');
            if (filters.servicio) q = q.eq('servicio', filters.servicio);
            if (filters.fecha_desde) q = q.gte('creado_en', `${filters.fecha_desde}T00:00:00-05:00`);
            if (filters.fecha_hasta) q = q.lte('creado_en', `${filters.fecha_hasta}T23:59:59-05:00`);

            const { data, error } = await q;
            if (error) throw error;

            const patients = data || [];

            const dataRows = [['DNI', 'HC', 'Apellidos', 'Nombres', 'Fecha Nac.', 'Tipo Doc.', 'Seguro', 'Servicio', 'Condición', 'Creado']];
            patients.forEach(p => {
                dataRows.push([
                    (p.tipo_documento === 'DNI_TEMPORAL' ? 'E- ' : (p.tipo_documento === 'CARNET_EXT' ? 'C.E ' : '')) + (p.dni || ''),
                    p.historia_clinica || '',
                    p.apellidos || '',
                    p.nombres || '',
                    p.fecha_nacimiento || '',
                    p.tipo_documento || '',
                    p.tipo_seguro || '',
                    p.servicio || '',
                    p.condicion || '',
                    p.creado_en || ''
                ]);
            });

            const svcGroups = {};
            patients.forEach(p => {
                const s = p.servicio || 'SIN SERVICIO';
                if (!svcGroups[s]) svcGroups[s] = { h: 0, a: 0, f: 0, t: 0 };
                svcGroups[s].t++;
                const c = (p.condicion || '').toUpperCase();
                if (c === 'HOSPITALIZADO') svcGroups[s].h++;
                else if (c === 'ALTA') svcGroups[s].a++;
                else if (c === 'FALLECIDO') svcGroups[s].f++;
            });
            const sRows = [['Servicio', 'Hospitalizados', 'Altas', 'Fallecidos', 'Total']];
            Object.entries(svcGroups).sort((a, b) => b[1].t - a[1].t).forEach(([s, c]) => {
                sRows.push([s, c.h, c.a, c.f, c.t]);
            });

            const segGroups = {};
            patients.forEach(p => {
                const s = p.tipo_seguro || 'SIN SEGURO';
                segGroups[s] = (segGroups[s] || 0) + 1;
            });
            const segRows = [['Seguro', 'Cantidad', 'Porcentaje']];
            const tot = patients.length || 1;
            Object.entries(segGroups).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
                segRows.push([s, c, ((c / tot) * 100).toFixed(1) + '%']);
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), 'Datos');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sRows), 'Resumen Servicio');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(segRows), 'Distribución Seguro');
            XLSX.writeFile(wb, `Reporte_HospitalSanJose_${toISODate(getPeruDate())}.xlsx`);

            if (window.showSystemTooltip) window.showSystemTooltip('Reporte exportado a Excel');
        } catch (err) {
            console.error(err);
            if (window.showSystemTooltip) window.showSystemTooltip('Error al exportar', true);
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }

    function printReport() {
        window.print();
    }

    // ── Stats helpers ──
    function renderCondicionStats(groups, colors, total) {
        const container = document.getElementById('cond-stats');
        if (!container) return;
        container.innerHTML = '';
        const labels = ['Hospitalizados', 'Altas', 'Fallecidos'];
        const keys = ['HOSPITALIZADO', 'ALTA', 'FALLECIDO'];
        const sum = total || 1;
        labels.forEach((label, i) => {
            const val = groups[keys[i]] || 0;
            const pct = ((val / sum) * 100).toFixed(1);
            const el = document.createElement('div');
            el.className = 'cond-item';
            el.innerHTML = `
                <span class="cond-dot" style="background:${colors[i]};"></span>
                <div class="cond-item-body">
                    <div class="cond-item-header">
                        <span class="cond-item-label">${label}</span>
                        <span class="cond-item-value">${fmt(val)} (${pct}%)</span>
                    </div>
                    <div class="cond-item-track">
                        <div class="cond-item-fill" style="width:${pct}%;background:${colors[i]};"></div>
                    </div>
                </div>
            `;
            container.appendChild(el);
        });
    }

    function renderSeguroStats(sorted, colors, total) {
        const container = document.getElementById('seg-stats');
        if (!container) return;
        container.innerHTML = '';
        const sum = total || 1;
        sorted.forEach(([name, count], i) => {
            const pct = ((count / sum) * 100).toFixed(1);
            const color = colors[i];
            const el = document.createElement('div');
            el.className = 'cond-item';
            el.innerHTML = `
                <span class="cond-dot" style="background:${color};"></span>
                <div class="cond-item-body">
                    <div class="cond-item-header">
                        <span class="cond-item-label">${name}</span>
                        <span class="cond-item-value">${fmt(count)} (${pct}%)</span>
                    </div>
                    <div class="cond-item-track">
                        <div class="cond-item-fill" style="width:${pct}%;background:${color};"></div>
                    </div>
                </div>
            `;
            container.appendChild(el);
        });
    }

    // ── Init ──
    setTimeout(() => {
        document.addEventListener('click', (e) => {
            if (DOM.dateWrapper && !DOM.dateWrapper.contains(e.target)) closeDatePopover();
        });
    }, 0);

    DOM.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DOM.popover.style.display === 'block') closeDatePopover();
        else openDatePopover();
    });

    DOM.hastaHoy.addEventListener('click', toggleHastaHoy);
    DOM.btnGenerate.addEventListener('click', generateReport);
    DOM.btnClear.addEventListener('click', clearFilters);
    DOM.btnExcel.addEventListener('click', exportExcel);
    DOM.btnPrint.addEventListener('click', printReport);

    // Auto-trigger on filter change
    DOM.filterServicio.addEventListener('change', scheduleGenerate);

    updateDateDisplay();
    await generateReport();
});
