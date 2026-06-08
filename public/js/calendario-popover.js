/**
 * Calendario Popover Compartido
 * Uso: const cal = window.crearCalendario({ mode: 'range'|'single', ... });
 */
(function () {
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];

  function toIso(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function isSameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  window.crearCalendario = function (config) {
    const mode = config.mode || 'range';
    const grid = config.grid;
    const title = config.title;
    const monthSel = config.month;
    const yearSel = config.year;
    const prevBtn = config.prev;
    const nextBtn = config.next;
    const todayBtn = config.today;
    const onDayClick = config.onDayClick || function () {};
    const onRangeComplete = config.onRangeComplete || function () {};

    let viewMonth = new Date().getMonth();
    let viewYear = new Date().getFullYear();
    const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

    let rangeStart = config.rangeStart || null;
    let rangeEnd   = config.rangeEnd || null;
    let selectedDate = config.selectedDate || null;

    /* ── helpers ── */
    function populateFilters() {
      monthSel.innerHTML = '';
      MONTHS.forEach((n, i) => {
        const o = document.createElement('option'); o.value = i; o.textContent = n;
        monthSel.appendChild(o);
      });
      yearSel.innerHTML = '';
      const y = today.getFullYear();
      for (let i = y - 5; i <= y + 5; i++) {
        const o = document.createElement('option'); o.value = i; o.textContent = i;
        yearSel.appendChild(o);
      }
      syncFilters();
    }

    function syncFilters() {
      monthSel.value = viewMonth;
      yearSel.value = viewYear;
    }

    /* ── core render ── */
    function render(direction) {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay = new Date(viewYear, viewMonth + 1, 0);
      const startDow = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
      const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

      title.textContent = `${MONTHS[viewMonth]}, ${viewYear}`;
      syncFilters();

      grid.className = 'cal-days-grid' + (direction ? ' cal-slide-' + direction : '');
      grid.innerHTML = '';

      let dayIdx = 0;
      for (let i = 0; i < totalCells; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day';
        let num, isCur = true;

        if (i < startDow) {
          num = daysInPrev - startDow + i + 1; isCur = false;
          el.classList.add('cal-day-other');
        } else if (dayIdx >= daysInMonth) {
          num = i - startDow - daysInMonth + 1; isCur = false;
          el.classList.add('cal-day-other');
        } else {
          num = dayIdx + 1;
        }

        if (!isCur) {
          el.textContent = num;
          grid.appendChild(el);
          if (i >= startDow) dayIdx++;
          continue;
        }

        el.textContent = num;
        const dateObj = new Date(viewYear, viewMonth, num);
        const dateStr = toIso(viewYear, viewMonth, num);
        el.dataset.date = dateStr;

        if (isSameDay(dateObj, today)) el.classList.add('cal-day-today');
        if (dateObj > today) el.classList.add('cal-day-disabled');

        if (mode === 'range') {
          if (rangeStart && isSameDay(dateObj, rangeStart)) {
            el.classList.add('cal-day-range-start');
            if (!rangeEnd) el.classList.add('cal-day-range-end');
          }
          if (rangeEnd && isSameDay(dateObj, rangeEnd)) {
            el.classList.add('cal-day-range-end');
          }
          if (rangeStart && rangeEnd && dateObj > rangeStart && dateObj < rangeEnd) {
            el.classList.add('cal-day-range-between');
          }
        } else {
          if (selectedDate && isSameDay(dateObj, selectedDate)) {
            el.classList.add('cal-day-selected');
          }
        }

        el.addEventListener('click', function (e) {
          e.stopPropagation();
          if (el.classList.contains('cal-day-disabled') || el.classList.contains('cal-day-other')) return;

          if (mode === 'range') {
            if (!rangeStart || (rangeStart && rangeEnd)) {
              rangeStart = dateObj;
              rangeEnd = null;
              onDayClick({ start: rangeStart, end: null });
            } else {
              if (dateObj < rangeStart) {
                rangeStart = dateObj;
                onDayClick({ start: rangeStart, end: null });
              } else {
                rangeEnd = dateObj;
                onRangeComplete({ start: rangeStart, end: rangeEnd });
                render();
                return;
              }
            }
          } else {
            selectedDate = dateObj;
            onDayClick(dateObj);
          }
          render();
        });

        grid.appendChild(el);
        dayIdx++;
      }

      const days = grid.querySelectorAll('.cal-day:not(.cal-day-empty)');
      days.forEach((el, idx) => {
        el.style.animationDelay = `${idx * 15}ms`;
        el.classList.add('cal-day-animate');
      });
    }

    /* ── external state accessors ── */
    function setRange(s, e) { rangeStart = s; rangeEnd = e; }
    function getRange() { return { start: rangeStart, end: rangeEnd }; }
    function setSelected(d) { selectedDate = d; }
    function getSelected() { return selectedDate; }
    function setView(y, m) { viewYear = y; viewMonth = m; }
    function getView() { return { year: viewYear, month: viewMonth }; }

    /* ── init ── */
    populateFilters();

    prevBtn.addEventListener('click', function () {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render('left');
    });
    nextBtn.addEventListener('click', function () {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render('right');
    });
    monthSel.addEventListener('change', function () {
      viewMonth = parseInt(monthSel.value, 10);
      render();
    });
    yearSel.addEventListener('change', function () {
      viewYear = parseInt(yearSel.value, 10);
      render();
    });
    todayBtn.addEventListener('click', function () {
        viewMonth = today.getMonth();
        viewYear = today.getFullYear();
        selectedDate = today;
        render();
        onDayClick(today);
    });

    render();

    return {
      render,
      populateFilters,
      syncFilters,
      setRange, getRange,
      setSelected, getSelected,
      setView, getView,
      MONTHS,
      today,
    };
  };
})();
