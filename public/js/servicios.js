const SERVICIOS = [
    'Cirugía',
    'Emergencia',
    'Ginecología',
    'Medicina',
    'Neonatología',
    'Pediatría',
    'Puerperio',
    'Salud mental',
    'Shock trauma',
    'UVI'
];

function populateServicioSelects() {
    document.querySelectorAll('[data-servicio]').forEach(select => {
        const currentValue = select.value;
        const hasPlaceholder = !!select.querySelector('option[disabled]');
        const isUpper = select.dataset.servicio === 'upper';
        select.innerHTML = '';
        if (hasPlaceholder) {
            const opt = document.createElement('option');
            opt.value = ''; opt.disabled = true; opt.selected = true; opt.hidden = true;
            opt.textContent = 'Seleccione Servicio';
            select.appendChild(opt);
        } else {
            const opt = document.createElement('option');
            opt.value = ''; opt.textContent = 'TODOS';
            select.appendChild(opt);
        }
        SERVICIOS.forEach(s => {
            const opt = document.createElement('option');
            const val = isUpper ? s.toUpperCase() : s;
            opt.value = val; opt.textContent = val;
            select.appendChild(opt);
        });
        if (currentValue !== '' || !hasPlaceholder) {
            select.value = currentValue;
        }
    });
}

document.addEventListener('DOMContentLoaded', populateServicioSelects);
