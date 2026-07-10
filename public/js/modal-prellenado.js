if (new URLSearchParams(window.location.search).get('view') === 'modal') {
    (function() {
        function doAutoFill() {
            var data;
            try {
                var raw = sessionStorage.getItem('cd_auto_fill');
                if (raw) data = JSON.parse(raw);
            } catch(e) {}
            if (!data) return;
            sessionStorage.removeItem('cd_auto_fill');

            var setVal = function(id, val) {
                var el = document.getElementById(id);
                if (el) el.value = val || '';
            };
            setVal('paciente-dni', data.dni);
            setVal('paciente-nombres', data.nombres);
            setVal('paciente-apellidos', data.apellidos);
            setVal('paciente-codigo-ver', data.codigo_verificacion);

            if (data.tipo_documento) {
                var td = document.getElementById('tipo-documento');
                if (td) td.value = data.tipo_documento;
            }
            if (data.tipo_seguro) {
                var seg = document.getElementById('paciente-seguro');
                if (seg) {
                    for (var i = 0; i < seg.options.length; i++) {
                        if (seg.options[i].value.toUpperCase() === data.tipo_seguro.toUpperCase()) {
                            seg.value = seg.options[i].value;
                            break;
                        }
                    }
                }
            }
            if (data.fecha_nacimiento) {
                var parts = data.fecha_nacimiento.split('-');
                if (parts.length === 3) {
                    setVal('paciente-fecha-nac', parts[2] + '/' + parts[1] + '/' + parts[0]);
                }
            }
        }

        var vl = document.getElementById('view-lista');
        if (vl) vl.style.display = 'none';
        var vf = document.getElementById('view-form');
        if (vf) vf.style.display = 'block';
        document.body.classList.add('is-modal', 'no-layout');
        var ml = document.getElementById('modal-loading');
        if (ml) ml.style.display = 'none';

        doAutoFill();

        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'check-auto-fill') {
                doAutoFill();
            }
        });
    })();
}
