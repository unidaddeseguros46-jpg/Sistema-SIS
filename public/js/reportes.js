document.addEventListener('DOMContentLoaded', async () => {
    const client = typeof supabaseClient !== 'undefined' ? supabaseClient : supabase;
    const { data: { session } } = await client.auth.getSession();
    if (!session) { window.location.href = '../../index.html'; return; }

    // ── State ──
    const charts = {};
    let crRangeStart = null;
    let crRangeEnd = null;
    let crViewMonth = new Date().getMonth();
    let crViewYear = new Date().getFullYear();
    const crToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    let hastaHoyActive = false;

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
    const BAR_COLORS = ['#2563eb','#7c3aed','#db2777','#dc2626','#ea580c','#ca8a04','#16a34a','#0891b2','#4f46e5','#9333ea','#e11d48','#d97706'];
    const SERVICE_ICONS = {
        'MEDICINA': 'fa-stethoscope',
        'CIRUGÍA': 'fa-scalpel',
        'CIRUGIA': 'fa-scalpel',
        'UVI': 'fa-heart-pulse',
        'PEDIATRÍA': 'fa-child',
        'GINECOLOGÍA': 'fa-venus',
        'NEONATOLOGÍA': 'fa-baby',
        'PUERPERIO': 'fa-heart',
        'SALUD MENTAL': 'fa-brain',
        'SHOCK TRAUMA': 'fa-truck-medical',
        'EMERGENCIA': 'fa-truck-medical',
        'SIN SERVICIO': 'fa-circle-exclamation',
    };

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
    };

    const resetNoData = () => {
        document.querySelectorAll('.chart-card .no-data-msg').forEach(el => el.remove());
        document.querySelectorAll('.chart-card canvas').forEach(c => c.style.display = 'block');
    };

    // ── Calendar ──
    function populateCalFilters() {
        MONTHS.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = name;
            DOM.calMonth.appendChild(opt);
        });
        const now = getPeruDate();
        for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            DOM.calYear.appendChild(opt);
        }
        syncCalFilters();
    }

    function syncCalFilters() {
        DOM.calMonth.value = crViewMonth;
        DOM.calYear.value = crViewYear;
    }

    let calGridEl = DOM.calGrid;

    function renderCalendar(direction) {
        const firstDay = new Date(crViewYear, crViewMonth, 1);
        const lastDay = new Date(crViewYear, crViewMonth + 1, 0);
        const startDow = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrev = new Date(crViewYear, crViewMonth, 0).getDate();

        DOM.calTitle.textContent = `${MONTHS[crViewMonth]}, ${crViewYear}`;
        syncCalFilters();

        const grid = document.createElement('div');
        grid.className = 'cal-days-grid';
        if (direction === 'prev') grid.classList.add('cal-slide-left');
        else if (direction === 'next') grid.classList.add('cal-slide-right');

        const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
        let dayIdx = 0;

        for (let i = 0; i < totalCells; i++) {
            const el = document.createElement('div');
            el.className = 'cal-day';
            let dayNum, isCurrent = true;

            if (i < startDow) {
                dayNum = daysInPrev - startDow + i + 1;
                isCurrent = false;
                el.classList.add('cal-day-other');
            } else if (dayIdx >= daysInMonth) {
                dayNum = i - startDow - daysInMonth + 1;
                isCurrent = false;
                el.classList.add('cal-day-other');
            } else {
                dayNum = dayIdx + 1;
            }

            if (!isCurrent) {
                el.textContent = dayNum;
                grid.appendChild(el);
                if (i >= startDow) dayIdx++;
                continue;
            }

            el.textContent = dayNum;
            const thisDate = new Date(crViewYear, crViewMonth, dayNum);
            const dateStr = toISODate(thisDate);
            el.dataset.date = dateStr;

            if (thisDate.getTime() === crToday.getTime()) el.classList.add('cal-day-today');

            if (crRangeStart && crRangeEnd) {
                const sStr = toISODate(crRangeStart);
                const eStr = toISODate(crRangeEnd);
                if (dateStr === sStr) el.classList.add('cal-day-range-start');
                if (dateStr === eStr) el.classList.add('cal-day-range-end');
                if (dateStr > sStr && dateStr < eStr) el.classList.add('cal-day-range-between');
                if (sStr === eStr && dateStr === sStr) el.classList.add('cal-day-range-end');
            } else if (crRangeStart) {
                if (dateStr === toISODate(crRangeStart)) el.classList.add('cal-day-range-start', 'cal-day-range-end');
            }

            if (thisDate.getTime() > crToday.getTime()) el.classList.add('cal-day-disabled');

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (el.classList.contains('cal-day-disabled') || el.classList.contains('cal-day-other')) return;

                if (hastaHoyActive) {
                    hastaHoyActive = false;
                    DOM.hastaHoy.classList.remove('active');
                }

                if (!crRangeStart || (crRangeStart && crRangeEnd)) {
                    crRangeStart = thisDate;
                    crRangeEnd = null;
                } else {
                    if (thisDate < crRangeStart) {
                        crRangeStart = thisDate;
                    } else {
                        crRangeEnd = thisDate;
                        updateDateDisplay();
                        closeDatePopover();
                        renderCalendar();
                        return;
                    }
                }
                updateDateDisplay();
                renderCalendar();
            });

            grid.appendChild(el);
            dayIdx++;
        }

        grid.querySelectorAll('.cal-day:not(.cal-day-empty)').forEach((el, idx) => {
            el.style.animationDelay = `${idx * 20}ms`;
            el.classList.add('cal-day-animate');
        });

        calGridEl.replaceWith(grid);
        calGridEl = grid;
    }

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
        DOM.popover.style.display = 'block';
        DOM.trigger.classList.add('is-open');
        renderCalendar();
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
            closeDatePopover();
        }
        updateDateDisplay();
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
        let q = client.from('pacientes').select('condicion, servicio, tipo_seguro', { count: 'exact' });
        if (filters.servicio) q = q.eq('servicio', filters.servicio);
        if (filters.fecha_desde) q = q.gte('creado_en', `${filters.fecha_desde}T00:00:00-05:00`);
        if (filters.fecha_hasta) q = q.lte('creado_en', `${filters.fecha_hasta}T23:59:59-05:00`);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
    }

    async function fetchHospitalizaciones(filters) {
        let q = client.from('hospitalizaciones').select('fecha_ingreso, servicio');
        if (filters.servicio) q = q.eq('servicio', filters.servicio);
        if (filters.fecha_desde) q = q.gte('fecha_ingreso', filters.fecha_desde);
        if (filters.fecha_hasta) q = q.lte('fecha_ingreso', filters.fecha_hasta);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    }

    async function fetchAltas(filters) {
        let q = client.from('hospitalizaciones').select('fecha_alta, servicio', { count: 'exact' });
        if (filters.servicio) q = q.eq('servicio', filters.servicio);
        if (filters.fecha_desde) q = q.gte('fecha_alta', filters.fecha_desde);
        if (filters.fecha_hasta) q = q.lte('fecha_alta', filters.fecha_hasta);
        q = q.not('fecha_alta', 'is', null);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0 };
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
            const [pacResult, altasResult, hospData] = await Promise.all([
                fetchPacientes(filters),
                fetchAltas(filters),
                fetchHospitalizaciones(filters)
            ]);

            const pac = pacResult.data;
            const totalCount = pacResult.count;

            // ── Score Chart ──
            const ctxScore = document.getElementById('chart-score')?.getContext('2d');
            if (ctxScore) {
                charts.score = new Chart(ctxScore, {
                    type: 'doughnut',
                    data: {
                        labels: ['Total'],
                        datasets: [{
                            data: [totalCount],
                            backgroundColor: ['#2563eb'],
                            borderWidth: 0,
                        }]
                    },
                    options: {
                        cutout: '78%',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: totalCount > 0 }
                        }
                    },
                    plugins: [{
                        id: 'scoreCenter',
                        beforeDraw(chart) {
                            const { width, height, ctx: c } = chart;
                            c.save();
                            c.font = '700 36px system-ui, sans-serif';
                            c.fillStyle = '#0f172a';
                            c.textAlign = 'center';
                            c.textBaseline = 'middle';
                            c.fillText(fmt(totalCount), width / 2, height / 2 - 14);
                            c.font = '500 13px system-ui, sans-serif';
                            c.fillStyle = '#475569';
                            c.fillText('Total Pacientes', width / 2, height / 2 + 24);
                            c.restore();
                        }
                    }]
                });
            }

            // ── Service cards ──
            renderServiceCards(pac);

            // ── Seguro list ──
            renderSeguroList(pac);

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
    function renderServiceCards(pacientes) {
        const groups = {};
        pacientes.forEach(p => {
            const s = p.servicio || 'SIN SERVICIO';
            groups[s] = (groups[s] || 0) + 1;
        });
        const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
        const total = pacientes.length || 1;

        const container = document.getElementById('service-list');
        container.innerHTML = '';

        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-list">Sin datos de servicio</div>';
            return;
        }

        sorted.forEach(([name, count], i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const pct = ((count / total) * 100).toFixed(1);
            const icon = SERVICE_ICONS[name] || 'fa-circle';
            const card = document.createElement('div');
            card.className = 'service-card';
            card.style.setProperty('--scolor', color);
            card.innerHTML = `
                <span class="sc-title">${name}</span>
                <i class="fa-solid ${icon} sc-icon"></i>
                <span class="sc-value">${fmt(count)}</span>
                <span class="sc-pct">${pct}% del total</span>
                <div class="sc-bar"><div class="sc-bar-fill" style="width:${pct}%;"></div></div>
            `;
            container.appendChild(card);
        });
    }

    // ── Seguro list ──
    function renderSeguroList(pacientes) {
        const groups = {};
        pacientes.forEach(p => {
            const s = p.tipo_seguro || 'SIN SEGURO';
            groups[s] = (groups[s] || 0) + 1;
        });
        const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
        const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

        const container = document.getElementById('seguro-cards');
        container.innerHTML = '';

        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-list">Sin datos de seguro</div>';
            return;
        }

        sorted.forEach(([name, count], i) => {
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const pct = (count / maxVal) * 100;
            const item = document.createElement('div');
            item.className = 'seguro-list-item';
            item.innerHTML = `
                <span class="sl-dot" style="background:${color};"></span>
                <span class="sl-name">${name}</span>
                <div class="sl-bar"><div class="sl-bar-fill" style="width:${pct}%;background:${color};"></div></div>
                <span class="sl-count">${fmt(count)}</span>
            `;
            container.appendChild(item);
        });
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

            // Sheet 1: raw data
            const dataRows = [['DNI', 'HC', 'Apellidos', 'Nombres', 'Fecha Nac.', 'Tipo Doc.', 'Seguro', 'Servicio', 'Condición', 'Creado']];
            patients.forEach(p => {
                dataRows.push([
                    p.dni || '',
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

            // Sheet 2: service summary
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

            // Sheet 3: seguro distribution
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

    // ── Init ──
    setTimeout(() => {
        document.addEventListener('click', (e) => {
            if (DOM.dateWrapper && !DOM.dateWrapper.contains(e.target)) closeDatePopover();
        });
    }, 0);

    // Calendar nav
    DOM.calPrev.addEventListener('click', () => {
        crViewMonth--;
        if (crViewMonth < 0) { crViewMonth = 11; crViewYear--; }
        renderCalendar('prev');
    });
    DOM.calNext.addEventListener('click', () => {
        crViewMonth++;
        if (crViewMonth > 11) { crViewMonth = 0; crViewYear++; }
        renderCalendar('next');
    });
    DOM.calMonth.addEventListener('change', () => {
        crViewMonth = parseInt(DOM.calMonth.value, 10);
        renderCalendar();
    });
    DOM.calYear.addEventListener('change', () => {
        crViewYear = parseInt(DOM.calYear.value, 10);
        renderCalendar();
    });
    DOM.calToday.addEventListener('click', () => {
        crViewMonth = crToday.getMonth();
        crViewYear = crToday.getFullYear();
        renderCalendar();
    });

    DOM.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (DOM.popover.style.display === 'block') closeDatePopover();
        else openDatePopover();
    });

    DOM.hastaHoy.addEventListener('click', toggleHastaHoy);
    DOM.btnGenerate.addEventListener('click', generateReport);
    DOM.btnExcel.addEventListener('click', exportExcel);
    DOM.btnPrint.addEventListener('click', printReport);

    populateCalFilters();
    updateDateDisplay();
    await generateReport();
});
