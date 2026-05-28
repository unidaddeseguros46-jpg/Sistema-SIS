/**
 * GestiÃ³n de Usuarios â€” Hospital San JosÃ©
 * CRUD de usuarios con rol = Usuario (id_rol=3).
 * Acceso: Administrador y Desarrollador.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // â”€â”€ Auth Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = '../../index.html'; return; }

    const rolNombre = sessionStorage.getItem('userRole') || '';
    if (rolNombre !== 'Administrador' && rolNombre !== 'Desarrollador') {
        alert('No tiene permisos para acceder a este mÃ³dulo.');
        window.location.href = '../../menu.html';
        return;
    }

    // â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tbody = document.getElementById('tbody-users');
    const loadingEl = document.getElementById('loading-users');
    const emptyEl = document.getElementById('empty-users');
    const tableContainer = document.getElementById('users-table-container');
    const statTotal = document.getElementById('stat-total');
    const statActivos = document.getElementById('stat-activos');
    const btnNuevo = document.getElementById('btn-nuevo-usuario');
    const modalOverlay = document.getElementById('modal-usuario');
    const modalTitle = document.getElementById('modal-title');
    const modalError = document.getElementById('modal-error');
    const form = document.getElementById('form-usuario');
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
    const inputSusaludUsuario = document.getElementById('input-susalud-usuario');
    const inputSusaludClave = document.getElementById('input-susalud-clave');
    const toggleSusaludPass = document.getElementById('toggle-susalud-pass');

    let currentPageUsers = [];
    let totalUsers = 0;
    let totalActivos = 0;
    let currentPage = 1;
    let rowsPerPage = 20;
    let editingUserId = null; // null = creating, uuid = editing

    // â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const showToast = (msg, type = 'success') => {
        if(window.showSystemTooltip) {
            window.showSystemTooltip(msg, type === 'error');
        }
    };

    // â”€â”€ Password toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Modal logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openModal = (mode = 'create', user = null) => {
        form.reset();
        modalError.classList.remove('show');
        editingUserId = null;

        if (mode === 'create') {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Nuevo Usuario';
            btnSubmitText.textContent = 'Guardar';
            groupEmail.style.display = 'block';
            groupPassword.style.display = 'block';
            inputEmail.required = true;
            inputPassword.required = true;
            inputUsername.value = '';
            inputSusaludUsuario.value = '';
            inputSusaludClave.value = '';
        } else {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-pen"></i> Editar Usuario';
            btnSubmitText.textContent = 'Guardar';
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

    const closeModal = () => {
        modalOverlay.classList.remove('show');
        editingUserId = null;
    };

    btnNuevo.addEventListener('click', () => openModal('create'));
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // â”€â”€ Fetch users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchUsers = async () => {
        loadingEl.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyEl.style.display = 'none';

        try {
            const startRange = (currentPage - 1) * rowsPerPage;
            const endRange = startRange + rowsPerPage - 1;

            const { data, error, count } = await supabaseClient
                .from('perfiles')
                .select('id_usuario, nombre_completo, apellidos, nombre_usuario, email, id_rol, fecha_creacion, activo, susalud_usuario, susalud_clave, roles(nombre)', { count: 'exact' })
                .in('id_rol', [3]) // Solo usuarios con rol=Usuario
                .order('fecha_creacion', { ascending: false })
                .range(startRange, endRange);

            if (error) throw error;

            currentPageUsers = data || [];
            totalUsers = count || 0;

            const { count: activosCount, error: countError } = await supabaseClient
                .from('perfiles')
                .select('id_usuario', { count: 'exact', head: true })
                .in('id_rol', [3])
                .eq('activo', true);

            if (!countError) totalActivos = activosCount || 0;

            // Update stats
            statTotal.textContent = totalUsers;
            statActivos.textContent = totalActivos;

            loadingEl.style.display = 'none';

            if (totalUsers === 0) {
                emptyEl.style.display = 'block';
                return;
            }

            tableContainer.style.display = 'block';
            renderTable();
        } catch (err) {

            loadingEl.style.display = 'none';
            showToast('Error al cargar usuarios', 'error');
        }
    };

    // â”€â”€ Render table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const renderTable = () => {
        const start = (currentPage - 1) * rowsPerPage;

        tbody.innerHTML = '';

        currentPageUsers.forEach((user, idx) => {
            const tr = document.createElement('tr');
            const roleName = user.roles?.nombre || 'Usuario';
            const roleBadgeClass = roleName === 'Desarrollador' ? 'badge-role-dev' : roleName === 'Administrador' ? 'badge-role-admin' : 'badge-role-user';
            const statusBadge = user.activo ? '<span class="badge-activo">ACTIVO</span>' : '<span class="badge-inactivo">INACTIVO</span>';

            // Format date
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

            const toggleBtn = user.activo
                ? `<button class="btn-table-action toggle" title="Desactivar" data-action="deactivate" data-id="${user.id_usuario}"><i class="fa-solid fa-user-slash"></i></button>`
                : `<button class="btn-table-action activate" title="Activar" data-action="activate" data-id="${user.id_usuario}"><i class="fa-solid fa-user-check"></i></button>`;

            tr.innerHTML = `
                <td style="font-weight:700; color:#1e293b;">${start + idx + 1}</td>
                <td>${user.nombre_completo || '—'}</td>
                <td>${user.apellidos || '—'}</td>
                <td style="color:#64748b; font-size:13px;">${user.email || '—'}</td>
                <td><span class="${roleBadgeClass}">${roleName.toUpperCase()}</span></td>
                <td>${statusBadge}</td>
                <td style="color:#64748b; font-size:13px;">${fechaStr}</td>
                <td style="text-align:center;">
                    <button class="btn-table-action edit" title="Editar" data-action="edit" data-id="${user.id_usuario}"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${toggleBtn}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind action buttons
        tbody.querySelectorAll('.btn-table-action').forEach(btn => {
            btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
        });

        // Pagination
        const totalPages = Math.ceil(totalUsers / rowsPerPage) || 1;
        DynamicTable.renderPagination({
            containerId: 'pagination-users',
            currentPage,
            totalPages,
            onPageChange: (page) => { currentPage = page; renderTable(); }
        });
    };

    // â”€â”€ Handle actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleAction = async (action, userId) => {
        if (action === 'edit') {
            const user = currentPageUsers.find(u => u.id_usuario === userId);
            if (user) openModal('edit', user);
        } else if (action === 'deactivate' || action === 'activate') {
            const newStatus = action === 'activate';
            const label = newStatus ? 'activar' : 'desactivar';
            if (!confirm(`Â¿EstÃ¡ seguro de ${label} este usuario?`)) return;

            try {
                const { error } = await supabaseClient
                    .from('perfiles')
                    .update({ activo: newStatus })
                    .eq('id_usuario', userId);

                if (error) throw error;
                showToast(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`);
                await fetchUsers();
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
    // â”€â”€ Form submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors();
        
        let nombre = inputNombre.value.trim();
        let apellidos = inputApellidos.value.trim();
        const username = inputUsername.value.trim();

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
                    .update({ nombre_completo: nombre, apellidos: apellidos, nombre_usuario: username, susalud_usuario: susaludUsuario || null, susalud_clave: susaludClave || null })
                    .eq('id_usuario', editingUserId);
                if (error) throw error;
                showToast(`Usuario actualizado correctamente`);
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
                    body: JSON.stringify({ email, password, nombre_completo: nombre, apellidos: apellidos, id_rol: 3 })
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
                showToast(`Usuario creado exitosamente`);
            }
            closeModal();
            await fetchUsers();
        } catch (err) {
            showModalError('Error inesperado. Intente nuevamente.');
        }
        resetBtn();
    });

    const resetBtn = () => {
        btnSubmit.disabled = false;
        btnSubmitSpinner.style.display = 'none';
        btnSubmitText.style.visibility = 'visible';
    };

    const showModalError = (msg) => {
        modalError.textContent = msg;
        modalError.classList.add('show');
    };

    // Init
    await fetchUsers();
});
