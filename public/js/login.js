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
    // LOGICA DE CONSULTA PÚBLICA RN TEMPORAL
    // ==========================================
    const linkConsultaRn = document.getElementById('link-consulta-rn');
    const consultaContainer = document.getElementById('consulta-container');
    const loginWrapper = document.getElementById('login-wrapper');
    const btnCloseConsulta = document.getElementById('btn-close-consulta');
    const consultaRnForm = document.getElementById('consulta-rn-form');
    const rnQueryInput = document.getElementById('rn-query-input');
    const consultaRnBtn = document.getElementById('consulta-rn-btn');
    const consultaRnSpinner = document.getElementById('consulta-rn-spinner');
    const consultaErrorMsg = document.getElementById('consulta-error-msg');
    const consultaRnResult = document.getElementById('consulta-rn-result');

    if (linkConsultaRn && consultaContainer) {
        linkConsultaRn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('⚙️ Módulo de Recién Nacidos en desarrollo.\nPróximamente disponible.');
        });

        btnCloseConsulta.addEventListener('click', (e) => {
            e.preventDefault();
            loginWrapper.classList.remove('showing-consulta');
            // Limpiar luego de la animación
            setTimeout(() => {
                consultaRnForm.reset();
                consultaRnResult.classList.remove('show');
                consultaErrorMsg.textContent = '';
            }, 500);
        });

        // Botón para limpiar input y resultado
        const btnClearRn = document.getElementById('btn-clear-rn');
        if (btnClearRn) {
            rnQueryInput.addEventListener('input', () => {
                btnClearRn.style.display = rnQueryInput.value ? 'block' : 'none';
            });

            btnClearRn.addEventListener('click', (e) => {
                e.preventDefault();
                rnQueryInput.value = '';
                btnClearRn.style.display = 'none';
                consultaRnResult.classList.remove('show');
                consultaErrorMsg.textContent = '';
                rnQueryInput.focus();
            });
        }

        consultaRnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            consultaErrorMsg.textContent = '';
            consultaRnResult.classList.remove('show');
            
            const queryVal = rnQueryInput.value.trim().toUpperCase();
            if (!queryVal) return;

            consultaRnBtn.disabled = true;
            consultaRnSpinner.classList.remove('hidden');
            consultaRnBtn.querySelector('.btn-text').style.visibility = 'hidden';

            try {
                // Buscar por código temporal (exacto) o número de documento de mamá (si es numérico)
                let query = supabaseClient.from('recien_nacidos_temporales').select('*');
                
                // Si parece un número, buscamos en num_doc_mama también
                if (/^\d+$/.test(queryVal)) {
                    query = query.or(`cod_temporal.eq.${queryVal},num_doc_mama.eq.${queryVal}`);
                } else {
                    query = query.eq('cod_temporal', queryVal);
                }

                const { data, error } = await query;

                if (error) throw error;

                if (!data || data.length === 0) {
                    consultaErrorMsg.textContent = 'No se encontraron registros con este código o documento';
                    consultaErrorMsg.style.color = '#ef4444';
                } else {
                    // Mostrar el primer resultado
                    const rn = data[0];
                    
                    document.getElementById('rn-res-nombre').textContent = rn.nombre_rn || 'NO REGISTRADO';
                    
                    const estadoEl = document.getElementById('rn-res-estado');
                    const estadoText = (rn.estado_temporal || 'ACTIVO').toUpperCase();
                    estadoEl.textContent = estadoText;
                    
                    // Colores según estado
                    estadoEl.style.background = '#f1f5f9'; estadoEl.style.color = '#64748b';
                    if (estadoText === 'ACTIVO') { estadoEl.style.background = '#e0f2fe'; estadoEl.style.color = '#0284c7'; }
                    else if (estadoText === 'TRANSFERIDO') { estadoEl.style.background = '#fef3c7'; estadoEl.style.color = '#d97706'; }
                    else if (estadoText === 'FALLECIDO') { estadoEl.style.background = '#fee2e2'; estadoEl.style.color = '#dc2626'; }

                    const formatDate = (dStr) => {
                        if (!dStr) return '—';
                        const d = new Date(dStr + 'T00:00:00');
                        return isNaN(d) ? dStr : d.toLocaleDateString('es-PE');
                    };

                    document.getElementById('rn-res-fnac').textContent = formatDate(rn.fecha_nacimiento);
                    document.getElementById('rn-res-estab').textContent = rn.establecimiento || '—';

                    consultaRnResult.classList.add('show');
                }
            } catch (err) {
                console.error(err);
                consultaErrorMsg.textContent = 'Error al consultar. Intente nuevamente.';
                consultaErrorMsg.style.color = '#ef4444';
            } finally {
                consultaRnBtn.disabled = false;
                consultaRnSpinner.classList.add('hidden');
                consultaRnBtn.querySelector('.btn-text').style.visibility = 'visible';
            }
        });
    }

});