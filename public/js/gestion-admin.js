/**
 * GestiÃ³n de Administradores â€” Hospital San JosÃ©
 * CRUD de usuarios con rol = Administrador (id_rol=2).
 * Acceso: Solo Desarrollador.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../../index.html'; return; }

    const rolNombre = sessionStorage.getItem('userRole') || '';
    if (rolNombre !== 'Desarrollador') {
        alert('Solo el rol Desarrollador puede acceder a este mÃ³dulo.');
        window.location.href = '../../menu.html';
        return;
    }

    const tbody = document.getElementById('tbody-admins');
    const loadingEl = document.getElementById('loading-admins');
    const emptyEl = document.getElementById('empty-admins');
    const tableContainer = document.getElementById('admins-table-container');
    const statTotal = document.getElementById('stat-total');
    const statActivos = document.getElementById('stat-activos');
    const btnNuevo = document.getElementById('btn-nuevo-admin');
    const modalOverlay = document.getElementById('modal-admin');
    const modalTitle = document.getElementById('modal-title');
    const modalError = document.getElementById('modal-error');
    const form = document.getElementById('form-admin');
    const inputNombre = document.getElementById('input-nombre');
    const inputApellidos = document.getElementById('input-apellidos');
    const inputUsername = document.getElementById('input-username');
    const inputEmail = document.getElementById('input-email');
    const inputPassword = document.getElementById('input-password');
    const groupEmail = document.getElementById('group-email');
    const groupPassword = document.getElementById('group-password');
    const btnSubmitText = document.getElementById('btn-submit-text');
    const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
    const btnSubmit = document.getElementById('btn-modal-submit');
    const togglePass = document.getElementById('toggle-pass');
    const inputRol = document.getElementById('input-rol');
    const inputSusaludUsuario = document.getElementById('input-susalud-usuario');
    const inputSusaludClave = document.getElementById('input-susalud-clave');
    const toggleSusaludPass = document.getElementById('toggle-susalud-pass');

    let currentPageAdmins = [];
    let totalAdmins = 0;
    let totalActivos = 0;
    let currentPage = 1;
    let rowsPerPage = 20;
    let editingUserId = null;

    const showToast = (msg, type = 'success') => {
        if(window.showSystemTooltip) {
            window.showSystemTooltip(msg, type === 'error');
        }
    };

    togglePass.addEventListener('click', () => {
        const isHidden = inputPassword.type === 'password';
        inputPassword.type = isHidden ? 'text' : 'password';
        togglePass.querySelector('i').className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    toggleSusaludPass.addEventListener('click', () => {
        const isHidden = inputSusaludClave.type === 'password';
        inputSusaludClave.type = isHidden ? 'text' : 'password';
        toggleSusaludPass.querySelector('i').className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });

    const openModal = (mode = 'create', user = null) => {
        form.reset();
        modalError.classList.remove('show');
        editingUserId = null;

        if (mode === 'create') {
            inputRol.value = "2";
            updateModalLabels("2");
            groupEmail.style.display = 'block';
            groupPassword.style.display = 'block';
            inputEmail.required = true;
            inputPassword.required = true;
            inputUsername.value = '';
            inputSusaludUsuario.value = '';
            inputSusaludClave.value = '';
        } else {
            inputRol.value = user.id_rol;
            updateModalLabels(user.id_rol);
            groupEmail.style.display = 'none';
            groupPassword.style.display = 'none';
            inputEmail.required = false;
            inputPassword.required = false;
            editingUserId = user.id_usuario;
            inputNombre.value = user.nombre_completo || '';
            inputApellidos.value = user.apellidos || '';
            inputUsername.value = user.nombre_usuario || '';
            inputSusaludUsuario.value = user.susalud_usuario || '';
            inputSusaludClave.value = user.susalud_clave || '';
        }
        modalOverlay.classList.add('show');
    };

    const updateModalLabels = (rolId) => {
        const isAdmin = rolId == "2";
        modalTitle.innerHTML = isAdmin 
            ? '<i class="fa-solid fa-user-shield"></i> Nuevo Administrador' 
            : '<i class="fa-solid fa-user-plus"></i> Nuevo Usuario';
        btnSubmitText.textContent = 'Guardar';
    };

    inputRol.addEventListener('change', () => {
        if (!editingUserId) updateModalLabels(inputRol.value);
    });

    const closeModal = () => { modalOverlay.classList.remove('show'); editingUserId = null; };

    btnNuevo.addEventListener('click', () => openModal('create'));
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    const fetchAdmins = async () => {
        loadingEl.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyEl.style.display = 'none';

        try {
            const startRange = (currentPage - 1) * rowsPerPage;
            const endRange = startRange + rowsPerPage - 1;

            const { data, error, count } = await supabaseClient
                .from('perfiles')
                .select('id_usuario, nombre_completo, apellidos, nombre_usuario, email, id_rol, fecha_creacion, activo, susalud_usuario, susalud_clave, roles(nombre)', { count: 'exact' })
                .eq('id_rol', 2)
                .order('fecha_creacion', { ascending: false })
                .range(startRange, endRange);

            if (error) throw error;
            currentPageAdmins = data || [];
            totalAdmins = count || 0;

            const { count: activosCount, error: countError } = await supabaseClient
                .from('perfiles')
                .select('id_usuario', { count: 'exact', head: true })
                .eq('id_rol', 2)
                .eq('activo', true);

            if (!countError) totalActivos = activosCount || 0;

            statTotal.textContent = totalAdmins;
            statActivos.textContent = totalActivos;

            loadingEl.style.display = 'none';

            if (totalAdmins === 0) {
                emptyEl.style.display = 'block';
                return;
            }

            tableContainer.style.display = 'block';
            renderTable();
        } catch (err) {

            loadingEl.style.display = 'none';
            showToast('Error al cargar administradores', 'error');
        }
    };

    const renderTable = () => {
        const start = (currentPage - 1) * rowsPerPage;
        tbody.innerHTML = '';

        currentPageAdmins.forEach((user, idx) => {
            const tr = document.createElement('tr');
            const roleName = user.roles?.nombre || 'Administrador';
            const roleBadgeClass = roleName === 'Desarrollador' ? 'badge-role-dev' : 'badge-role-admin';
            const statusBadge = user.activo ? '<span class="badge-activo">ACTIVO</span>' : '<span class="badge-inactivo">INACTIVO</span>';
            const isDev = user.id_rol === 1;

            let fechaStr = '-';
            if (user.fecha_creacion) {
                const d = new Date(user.fecha_creacion);
                fechaStr = d.toLocaleDateString('es-PE', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    timeZone: 'America/Lima'
                });
            }

            let actionsHTML = '';
            if (!isDev) {
                const toggleBtn = user.activo
                    ? `<button class="btn-table-action toggle" title="Desactivar" data-action="deactivate" data-id="${user.id_usuario}"><i class="fa-solid fa-user-slash"></i></button>`
                    : `<button class="btn-table-action activate" title="Activar" data-action="activate" data-id="${user.id_usuario}"><i class="fa-solid fa-user-check"></i></button>`;
                actionsHTML = `
                    <button class="btn-table-action edit" title="Editar" data-action="edit" data-id="${user.id_usuario}"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${toggleBtn}
                `;
            } else {
                actionsHTML = '<span style="color:#cbd5e1; font-size:12px;">—</span>';
            }

            tr.innerHTML = `
                <td style="font-weight:700; color:#1e293b;">${start + idx + 1}</td>
                <td>${user.nombre_completo || '—'}</td>
                <td>${user.apellidos || '—'}</td>
                <td style="color:#64748b; font-size:13px;">${user.email || '—'}</td>
                <td><span class="${roleBadgeClass}">${roleName.toUpperCase()}</span></td>
                <td>${statusBadge}</td>
                <td style="color:#64748b; font-size:13px;">${fechaStr}</td>
                <td style="text-align:center;">${actionsHTML}</td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-table-action').forEach(btn => {
            btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
        });

        const totalPages = Math.ceil(totalAdmins / rowsPerPage) || 1;
        DynamicTable.renderPagination({
            containerId: 'pagination-admins',
            currentPage, totalPages,
            onPageChange: (page) => { currentPage = page; renderTable(); }
        });
    };

    

    const handleAction = async (action, userId) => {
        if (action === 'edit') {
            const user = currentPageAdmins.find(u => u.id_usuario === userId);
            if (user) openModal('edit', user);
        } else if (action === 'deactivate' || action === 'activate') {
            const newStatus = action === 'activate';
            const label = newStatus ? 'activar' : 'desactivar';
            if (!confirm(`¿Está seguro de ${label} este administrador?`)) return;

            try {
                const { error } = await supabaseClient
                    .from('perfiles')
                    .update({ activo: newStatus })
                    .eq('id_usuario', userId);
                if (error) throw error;
                showToast(`Administrador ${newStatus ? 'activado' : 'desactivado'} correctamente`);
                await fetchAdmins();
            } catch (err) {
                showToast('Error al actualizar estado', 'error');
            }
        }
    };

    const showFieldError = (field, msg) => {
        const input = document.getElementById(`input-${field}`);
        const errorSpan = document.getElementById(`error-${field}`);
        if (input) input.classList.add('input-error');
        if (errorSpan) {
            errorSpan.textContent = msg;
            errorSpan.classList.add('show');
        }
    };

    const clearFieldErrors = () => {
        modalError.classList.remove('show');
        modalError.textContent = '';
        document.querySelectorAll('.field-error').forEach(s => {
            s.classList.remove('show');
            s.textContent = '';
        });
        document.querySelectorAll('.modal-form-group input').forEach(i => {
            i.classList.remove('input-error');
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors();
        
        let nombre = inputNombre.value.trim();
        let apellidos = inputApellidos.value.trim();
        const username = inputUsername.value.trim();
        const rolVal = parseInt(inputRol.value);

        // Validaciones Locales
        let hasError = false;

        // Nombre (3-100)
        if (!nombre) {
            showFieldError('nombre', 'El nombre completo es obligatorio.');
            hasError = true;
        } else if (nombre.length < 3 || nombre.length > 100) {
            showFieldError('nombre', 'El nombre debe tener entre 3 y 100 caracteres.');
            hasError = true;
        }
        
        // Apellidos (3-100)
        if (!apellidos) {
            showFieldError('apellidos', 'Los apellidos son obligatorios.');
            hasError = true;
        } else if (apellidos.length < 3 || apellidos.length > 100) {
            showFieldError('apellidos', 'Los apellidos deben tener entre 3 y 100 caracteres.');
            hasError = true;
        }

        // Usuario (5-50)
        const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
        if (!username) {
            showFieldError('username', 'El nombre de usuario es obligatorio.');
            hasError = true;
        } else if (username.length < 5 || username.length > 50) {
            showFieldError('username', 'El usuario debe tener entre 5 y 50 caracteres.');
            hasError = true;
        } else if (!usernameRegex.test(username)) {
            showFieldError('username', 'Solo se permiten letras, números, puntos y guiones.');
            hasError = true;
        }

        const email = inputEmail.value.trim();
        const password = inputPassword.value;

        if (!editingUserId) {
            // Email
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!email) {
                showFieldError('email', 'El correo es obligatorio.');
                hasError = true;
            } else if (!emailRegex.test(email)) {
                showFieldError('email', 'Ingrese un correo válido (ejemplo@gmail.com).');
                hasError = true;
            }

            // Password
            if (!password) {
                showFieldError('password', 'La contraseña es obligatoria.');
                hasError = true;
            } else if (password.length < 6 || password.length > 50) {
                showFieldError('password', 'La contraseña debe tener entre 6 y 50 caracteres.');
                hasError = true;
            }
        }

        if (hasError) {
            btnSubmit.disabled = false;
            return;
        }

        // Sanitización
        const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag]));
        nombre = escapeHTML(nombre);
        apellidos = escapeHTML(apellidos);

        btnSubmit.disabled = true;
        btnSubmitSpinner.style.display = 'inline-block';
        btnSubmitText.style.visibility = 'hidden';

        const susaludUsuario = inputSusaludUsuario.value.trim();
        const susaludClave = inputSusaludClave.value.trim();

        try {
            const { data: existingUser } = await supabaseClient
                .from('perfiles')
                .select('id_usuario')
                .eq('nombre_usuario', username)
                .maybeSingle();

            if (existingUser && (!editingUserId || existingUser.id_usuario !== editingUserId)) {
                showFieldError('username', 'Este nombre de usuario ya est en uso.');
                resetBtn();
                return;
            }

            if (editingUserId) {
                const { error } = await supabaseClient
                    .from('perfiles')
                    .update({ nombre_completo: nombre, apellidos: apellidos, id_rol: rolVal, nombre_usuario: username, susalud_usuario: susaludUsuario || null, susalud_clave: susaludClave || null })
                    .eq('id_usuario', editingUserId);
                if (error) throw error;
                showToast(`${rolVal === 2 ? 'Administrador' : 'Usuario'} actualizado correctamente`);
            } else {
                // AUTO-SINCRONIZACIN
                const { data: { user: authUser }, error: authErr } = await supabaseClient.auth.getUser();
                const { data: { session: s } } = await supabaseClient.auth.getSession();

                if (authErr || !s) {
                    showModalError('Tu sesin ha expirado. Reingresa al sistema.');
                    resetBtn();
                    return;
                }

                const response = await fetch(`${edgeFunctionUrl}/functions/v1/create-user`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${s.access_token}`,
                    },
                    body: JSON.stringify({ email, password, nombre_completo: nombre, apellidos: apellidos, id_rol: rolVal })
                });

                const contentType = response.headers.get("content-type");
                let result;
                if (contentType && contentType.includes("application/json")) {
                    result = await response.json();
                } else {
                    const textError = await response.text();
                    showModalError(`Error del servidor (${response.status}): ${textError}`);
                    resetBtn();
                    return;
                }

                if (!response.ok) {
                    const errMsg = result.error || 'Error al crear';
                    if (errMsg.includes('already exists')) showFieldError('email', 'Este correo ya est registrado.');
                    else showModalError(errMsg);
                    resetBtn();
                    return;
                }

                const { data: newUser } = await supabaseClient.from('perfiles').select('id_usuario').eq('email', email).single();
                if (newUser) {
                    await supabaseClient.from('perfiles').update({ nombre_usuario: username, susalud_usuario: susaludUsuario || null, susalud_clave: susaludClave || null }).eq('id_usuario', newUser.id_usuario);
                }
                showToast(`${rolVal === 2 ? 'Administrador' : 'Usuario'} creado exitosamente`);
            }
            closeModal();
            await fetchAdmins();
        } catch (err) {
            showModalError('Error inesperado. Intente nuevamente.');
        }
        resetBtn();
    });

    const showModalError = (msg) => { modalError.textContent = msg; modalError.classList.add('show'); };
    const resetBtn = () => { btnSubmit.disabled = false; btnSubmitSpinner.style.display = 'none'; btnSubmitText.style.visibility = 'visible'; };

    await fetchAdmins();
});
