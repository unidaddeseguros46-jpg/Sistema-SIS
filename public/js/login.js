document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const roleSelect = document.getElementById('role');
    const usernameInput = document.getElementById('username');
    const password = document.getElementById('password');
    const toggle = document.getElementById('toggle-password');
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('login-btn');
    const spinner = btn.querySelector('.spinner');
    const btnText = btn.querySelector('.btn-text');
    const remember = document.getElementById('remember');
    const icon = toggle.querySelector('i');

    const ANIM_DURATION = 450;
    let hideTimer = null;

    const setError = (msg) => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        errorMsg.textContent = msg;
        errorMsg.style.color = '';
        errorMsg.classList.add('visible');
    };

    const clearError = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        errorMsg.classList.remove('visible');
        hideTimer = setTimeout(() => {
            errorMsg.textContent = '';
            errorMsg.style.color = '';
            hideTimer = null;
        }, ANIM_DURATION);
    };

    sessionStorage.removeItem('userRole');

    toggle.addEventListener('click', () => {
        const isHidden = password.type === 'password';
        password.type = isHidden ? 'text' : 'password';
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    const setLoading = (state) => {
        btn.disabled = state;
        spinner.classList.toggle('hidden', !state);
        if (state) {
            btnText.style.visibility = 'hidden';
        } else {
            btnText.textContent = 'Ingresar';
            btnText.style.visibility = 'visible';
        }
    };

    const setProgress = (msg) => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        errorMsg.textContent = msg;
        errorMsg.style.color = '#3b82f6';
        errorMsg.classList.add('visible');
    };

    const retryOnNetworkError = async (fn, maxRetries = 2) => {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                const isNetworkError = !!(err.name === 'AbortError'
                    || err.name === 'TypeError'
                    || (err.message && (
                        err.message.toLowerCase().includes('fetch')
                        || err.message.toLowerCase().includes('network')
                        || err.message.includes('ECONNREFUSED')
                    )));
                if (!isNetworkError || attempt === maxRetries) throw err;
                const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw lastError;
    };

    // Restaurar credenciales guardadas (usuario y rol, sin contraseña)
    const savedUsername = localStorage.getItem('rememberUsername');
    const savedRole = localStorage.getItem('rememberRole');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        remember.checked = true;
    }
    if (savedRole) {
        roleSelect.value = savedRole;
        roleSelect.customDropdownUpdate?.();
    }

    // Mostrar mensaje de éxito si viene de recuperación de contraseña
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'ok') {
        errorMsg.style.color = '#059669';
        errorMsg.textContent = 'Contraseña actualizada exitosamente. Inicia sesión con tus nuevas credenciales.';
        errorMsg.classList.add('visible');
        // Limpiar la URL
        window.history.replaceState({}, '', window.location.pathname);
    }

    const showAuthError = (code, status) => {
        if (code === 'invalid_credentials') {
            setError('Credenciales inválidas.');
        } else if (code === 'email_not_confirmed') {
            setError('Debes confirmar tu correo antes de iniciar sesión.');
        } else if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
            setError('Demasiados intentos. Espera un momento e intenta de nuevo.');
        } else {
            setError('Credenciales inválidas.');
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roleVal = roleSelect.value;
        const rawUsername = usernameInput.value.trim();
        const usernameVal = rawUsername.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const passVal = password.value.trim();

        if (!roleVal || !usernameVal || !passVal) {
            if (!roleVal && usernameVal && passVal) {
                setError('Seleccione su rol');
            } else {
                setError('Completa todos los campos y selecciona tu rol.');
            }
            return;
        }

        if (usernameVal.length > 50) {
            setError('El nombre de usuario es demasiado largo.');
            return;
        }
        if (passVal.length > 100) {
            setError('La contraseña es demasiado larga.');
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
        if (!usernameRegex.test(usernameVal)) {
            setError('El nombre de usuario contiene caracteres no permitidos.');
            return;
        }

        clearError();
        setLoading(true);

        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            setLoading(false);
            setError('La solicitud tardó demasiado. Verifica tu conexión o intenta más tarde.');
        }, 15000);

        try {
            // 1. Obtener email y rol asociado al nombre de usuario
            setProgress('Verificando usuario...');
            const { data: userInfo, error: rpcError } = await supabaseClient.rpc('get_login_info', {
                username_in: usernameVal
            });

            if (timedOut) return;

            if (rpcError) {
                console.error('[Login] RPC error', { code: rpcError.code, message: rpcError.message });
                const isNetErr = !!(rpcError.message && (
                    rpcError.message.toLowerCase().includes('fetch')
                    || rpcError.message.toLowerCase().includes('network')
                    || rpcError.message.includes('ECONNREFUSED')
                ));
                setError(isNetErr
                    ? 'Error de conexión. Verifica tu red e intenta de nuevo.'
                    : 'Credenciales inválidas.');
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            if (!userInfo || userInfo.length === 0) {
                setError('Credenciales inválidas.');
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            const { auth_email, rol_nombre } = userInfo[0];

            // 2. Validar rol
            if (roleVal.toUpperCase() !== rol_nombre.toUpperCase()) {
                setError('Advertencia: El rol seleccionado no corresponde a este usuario.');
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            // 3. Iniciar sesión con retry solo para errores de red
            setProgress('Autenticando...');
            const { data: authData, error: authError } = await retryOnNetworkError(async () => {
                return supabaseClient.auth.signInWithPassword({
                    email: auth_email,
                    password: passVal
                });
            });

            if (timedOut) return;

            if (authError) {
                console.error('[Login] Auth error', { code: authError.code, status: authError.status, message: authError.message });
                showAuthError(authError.code, authError.status);
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            // 4. Obtener perfil
            setProgress('Cargando perfil...');
            const { data: profile } = await supabaseClient
                .from('perfiles')
                .select('nombre_completo, apellidos, nombre_usuario, roles(nombre)')
                .eq('id_usuario', authData.user.id)
                .single();

            if (timedOut) return;

            if (profile) {
                sessionStorage.setItem('userRole', profile.roles ? profile.roles.nombre : 'Usuario');
                sessionStorage.setItem('userName', profile.nombre_completo || profile.nombre_usuario || authData.user.email);
                sessionStorage.setItem('userApellidos', profile.apellidos || '');
            } else {
                sessionStorage.setItem('userRole', 'Usuario');
                sessionStorage.setItem('userName', usernameVal);
            }

            if (remember.checked) {
                localStorage.setItem('rememberUsername', usernameVal);
                localStorage.setItem('rememberRole', roleVal);
            } else {
                localStorage.removeItem('rememberUsername');
                localStorage.removeItem('rememberRole');
            }

            clearTimeout(timeoutId);
            if (!timedOut) {
                window.location.href = 'menu.html';
            }

        } catch (err) {
            if (!timedOut) {
                const isNetworkError = !!(err.name === 'AbortError'
                    || err.name === 'TypeError'
                    || (err.message && (
                        err.message.toLowerCase().includes('fetch')
                        || err.message.toLowerCase().includes('network')
                        || err.message.includes('ECONNREFUSED')
                    )));
                console.error('[Login] Error inesperado', { name: err.name, message: err.message });
                setError(isNetworkError
                    ? 'Error de conexión. Verifica tu red e intenta de nuevo.'
                    : 'Error inesperado.');
                setLoading(false);
            }
            clearTimeout(timeoutId);
        }
    });

    // ==========================================
    // OVERLAY CONSULTA RN
    // ==========================================
    const consultaLink = document.querySelector('.consulta-link');
    const consultaOverlay = document.getElementById('consulta-overlay');

    if (consultaLink && consultaOverlay) {
        consultaLink.addEventListener('click', (e) => {
            e.preventDefault();
            consultaOverlay.classList.add('visible');
        });

        consultaOverlay.addEventListener('click', (e) => {
            if (e.target === consultaOverlay) {
                consultaOverlay.classList.remove('visible');
            }
        });

        const volverBtn = document.getElementById('consulta-volver-btn');
        if (volverBtn) {
            volverBtn.addEventListener('click', () => {
                consultaOverlay.classList.remove('visible');
            });
        }
    }

    // ==========================================
    // FILTROS CONSULTA RN + CALENDARIO POPOVER
    // ==========================================
    const consultaFilterBtns = document.querySelectorAll('.consulta-filter-btn');
    const consultaInputGroups = document.querySelectorAll('.consulta-input-group');
    const fechaInput = document.getElementById('consulta-fecha-input');

    let openFechaPopover, closeFechaPopover;

    if (window.crearCalendario) {
        const fechaCal = window.crearCalendario({
            mode: 'single',
            grid: document.getElementById('consulta-cal-grid'),
            title: document.getElementById('consulta-cal-title'),
            month: document.getElementById('consulta-cal-month'),
            year: document.getElementById('consulta-cal-year'),
            prev: document.getElementById('consulta-cal-prev'),
            next: document.getElementById('consulta-cal-next'),
            today: document.getElementById('consulta-cal-today'),
            onDayClick: (dateObj) => {
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yyyy = dateObj.getFullYear();
                fechaInput.value = `${dd}/${mm}/${yyyy}`;
                closeFechaPopover();
                buscarRecienNacidos();
            }
        });

        openFechaPopover = () => {
            const popover = document.getElementById('consulta-date-popover');
            const rect = fechaInput.getBoundingClientRect();
            popover.style.top = (rect.bottom + 6) + 'px';
            popover.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 330)) + 'px';
            popover.classList.add('show');
            fechaCal.render();
        };

        closeFechaPopover = () => {
            document.getElementById('consulta-date-popover').classList.remove('show');
        };

        const toggleFechaPopover = (e) => {
            e.stopPropagation();
            const popover = document.getElementById('consulta-date-popover');
            if (popover.classList.contains('show')) {
                closeFechaPopover();
            } else {
                openFechaPopover();
            }
        };

        document.getElementById('consulta-cal-month-search').addEventListener('click', () => {
            const monthSel = document.getElementById('consulta-cal-month');
            const yearSel = document.getElementById('consulta-cal-year');
            const mm = String(Number(monthSel.value) + 1).padStart(2, '0');
            const yyyy = yearSel.value;
            fechaInput.value = `${mm}/${yyyy}`;
            closeFechaPopover();
            buscarRecienNacidos();
        });

        document.getElementById('consulta-date-icon').addEventListener('click', toggleFechaPopover);
        fechaInput.addEventListener('click', (e) => {
            e.stopPropagation();
            const popover = document.getElementById('consulta-date-popover');
            if (!popover.classList.contains('show')) {
                openFechaPopover();
            }
        });

        document.addEventListener('click', (e) => {
            const popover = document.getElementById('consulta-date-popover');
            if (popover.classList.contains('show') &&
                !popover.contains(e.target) &&
                !e.target.closest('.consulta-input-row')) {
                closeFechaPopover();
            }
        }, true);
    }

    consultaFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            const isActive = btn.classList.contains('active');

            if (isActive && filter === 'bebe') return;

            btn.classList.toggle('active');

            const group = document.querySelector(`.consulta-input-group[data-filter="${filter}"]`);
            if (group) {
                if (btn.classList.contains('active')) {
                    group.style.display = 'inline-flex';
                    const input = group.querySelector('input');
                    input.focus();
                    if (filter === 'fecha' && openFechaPopover) {
                        setTimeout(openFechaPopover, 200);
                    }
                } else {
                    group.style.display = 'none';
                    group.querySelector('input').value = '';
                }
            }
        });
    });

    // ── Autoformato fecha: solo números, inserta / automático ──
    if (fechaInput) {
        fechaInput.addEventListener('input', () => {
            let val = fechaInput.value.replace(/\D/g, '').slice(0, 8);
            let formatted = '';
            for (let i = 0; i < val.length; i++) {
                if (i === 2 || i === 4) formatted += '/';
                formatted += val[i];
            }
            fechaInput.value = formatted;
        });
    }

    // ── Botones Buscar / Limpiar ──
    const buscarBtn = document.querySelector('.consulta-action-btn.buscar');
    const limpiarBtn = document.querySelector('.consulta-action-btn.limpiar');

    if (buscarBtn) {
        buscarBtn.addEventListener('click', buscarRecienNacidos);
    }
    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', () => {
            consultaFilterBtns.forEach(btn => {
                const filter = btn.dataset.filter;
                if (filter === 'bebe') {
                    if (!btn.classList.contains('active')) btn.classList.add('active');
                    const group = document.querySelector(`.consulta-input-group[data-filter="bebe"]`);
                    group.style.display = 'inline-flex';
                    group.querySelector('input').value = '';
                } else {
                    btn.classList.remove('active');
                    const group = document.querySelector(`.consulta-input-group[data-filter="${filter}"]`);
                    if (group) {
                        group.style.display = 'none';
                        group.querySelector('input').value = '';
                    }
                }
            });
            resultsPlaceholder.style.display = 'flex';
            resultsPlaceholder.innerHTML = 'Ingresa apellidos del bebé o de la mamá';
            resultsTable.style.display = 'none';
            if (typeof closeFechaPopover === 'function') closeFechaPopover();
        });
    }

    const resultsContainer = document.getElementById('consulta-results');
    const resultsTable = document.getElementById('consulta-results-table');
    const resultsBody = document.getElementById('consulta-results-body');
    const resultsPlaceholder = document.getElementById('consulta-results-placeholder');

    function parseFechaInput(val) {
        if (!val) return null;
        const parts = val.split('/');
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts.map(Number);
            if (dd && mm && yyyy) return { type: 'day', yyyy, mm, dd };
        }
        if (parts.length === 2) {
            const [mm, yyyy] = parts.map(Number);
            if (mm && yyyy) return { type: 'month', yyyy, mm };
        }
        if (parts.length === 1 && val.length === 4) {
            const yyyy = Number(val);
            if (yyyy) return { type: 'year', yyyy };
        }
        return null;
    }

    function mostrarResultados(data, count) {
        resultsPlaceholder.style.display = 'none';
            if (data.length === 0) {
                resultsTable.style.display = 'none';
                resultsPlaceholder.style.display = 'flex';
                resultsPlaceholder.innerHTML = 'No se encontraron resultados';
                return;
            }
        resultsTable.style.display = '';
        resultsBody.innerHTML = '';
        data.forEach((row, i) => {
            const tr = document.createElement('tr');
            const fecha = row.fecha_nacimiento ? new Date(row.fecha_nacimiento + 'T00:00:00') : null;
            const fechaStr = fecha
                ? `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}/${fecha.getFullYear()}`
                : '—';
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${row.nombre_rn || '—'}</td>
                <td>${row.nombre_mama || '—'}</td>
                <td>${fechaStr}</td>
                <td>${row.estado_temporal || '—'}</td>
                <td>${row.establecimiento || '—'}</td>
            `;
            resultsBody.appendChild(tr);
        });
    }

    function mostrarLoading() {
        resultsPlaceholder.style.display = 'flex';
        resultsPlaceholder.innerHTML = 'Buscando...';
        resultsTable.style.display = 'none';
    }

    function mostrarError(msg) {
        resultsPlaceholder.style.display = 'flex';
        resultsPlaceholder.innerHTML = msg;
        resultsTable.style.display = 'none';
    }

    async function buscarRecienNacidos() {
        const bebeGroup = document.querySelector('.consulta-input-group[data-filter="bebe"]');
        const mamaGroup = document.querySelector('.consulta-input-group[data-filter="mama"]');
        const fechaGroup = document.querySelector('.consulta-input-group[data-filter="fecha"]');

        const bebeVal = bebeGroup && bebeGroup.style.display !== 'none'
            ? (bebeGroup.querySelector('input').value.trim()) : '';
        const mamaVal = mamaGroup && mamaGroup.style.display !== 'none'
            ? (mamaGroup.querySelector('input').value.trim()) : '';
        const fechaVal = fechaGroup && fechaGroup.style.display !== 'none'
            ? (fechaInput.value.trim()) : '';

        if (!bebeVal && !mamaVal && !fechaVal) {
            const mamaVisible = mamaGroup && mamaGroup.style.display !== 'none';
            const fechaVisible = fechaGroup && fechaGroup.style.display !== 'none';
            const msg = (!mamaVisible && !fechaVisible)
                ? 'Ingresa apellidos del bebé'
                : 'Ingresa apellidos del bebé o de la mamá';
            mostrarError(msg);
            return;
        }

        mostrarLoading();
        if (typeof closeFechaPopover === 'function') closeFechaPopover();

        let query = supabaseClient.from('recien_nacidos_temporales').select('*', { count: 'exact' });

        if (bebeVal) {
            query = query.ilike('nombre_rn', `%${bebeVal}%`);
        }
        if (mamaVal) {
            query = query.ilike('nombre_mama', `%${mamaVal}%`);
        }

        if (fechaVal) {
            const parsed = parseFechaInput(fechaVal);
            if (!parsed) {
                mostrarError('Formato de fecha inválido. Usa dd/mm/aaaa, mm/aaaa o aaaa');
                return;
            }
            if (parsed.type === 'day') {
                const iso = `${parsed.yyyy}-${String(parsed.mm).padStart(2,'0')}-${String(parsed.dd).padStart(2,'0')}`;
                query = query.eq('fecha_nacimiento', iso);
            } else if (parsed.type === 'month') {
                const start = `${parsed.yyyy}-${String(parsed.mm).padStart(2,'0')}-01`;
                const endDate = new Date(parsed.yyyy, parsed.mm, 0);
                const end = `${parsed.yyyy}-${String(parsed.mm).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`;
                query = query.gte('fecha_nacimiento', start).lte('fecha_nacimiento', end);
            } else {
                const start = `${parsed.yyyy}-01-01`;
                const end = `${parsed.yyyy}-12-31`;
                query = query.gte('fecha_nacimiento', start).lte('fecha_nacimiento', end);
            }
        }

        query = query.order('fecha_nacimiento', { ascending: false }).limit(500);

        try {
            const { data, error, count } = await query;
            if (error) {
                console.error('[Consulta RN] Error:', error);
                mostrarError('Error al buscar. Intenta de nuevo.');
                return;
            }
            mostrarResultados(data || [], count || 0);
        } catch (err) {
            console.error('[Consulta RN] Error inesperado:', err);
            mostrarError('Error de conexión. Verifica tu red.');
        }
    }

    document.querySelectorAll('.consulta-input-group input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') buscarRecienNacidos();
        });
    });
});