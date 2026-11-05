// =========================================================================
// UNIDAD DE SEGUROS - SISTEMA HOSPITALARIO
// Archivo: public/js/seguimiento-pacientes.js (Versión Estilizada y Alineada)
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = "undefined" != typeof supabaseClient ? supabaseClient : window.supabase;
  if (!supabase) {
    console.error("Cliente de Supabase no disponible.");
    return;
  }

  // 1. Validar sesión
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    window.location.href = "../../index.html";
    return;
  }

  // 2. Elementos del DOM
  const inputDniHc = document.getElementById("filter-dni-hc");
  const inputApellidos = document.getElementById("filter-apellidos");
  const selectSeguro = document.getElementById("filter-seguro");
  const selectServicio = document.getElementById("filter-servicio");
  const selectCondicion = document.getElementById("filter-condicion");
  const btnSearch = document.getElementById("btn-search");
  const tbodyPacientes = document.getElementById("tbody-pacientes");
  const loadingIndicator = document.getElementById("loading-indicator");
  const tablePacientes = document.getElementById("table-pacientes");

  // =========================================================================
  // ALINEAR BOTÓN ESSALUD EN LA MISMA FILA DE "LIMPIAR FILTROS" Y "BUSCAR"
  // =========================================================================
  const insertarBotonEsSalud = () => {
    if (document.getElementById("btn-essalud-top")) return;

    const botones = Array.from(document.querySelectorAll("button, a"));
    const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));

    if (btnLimpiar && btnLimpiar.parentElement) {
      const parent = btnLimpiar.parentElement;
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.gap = "8px";

      const aEssalud = document.createElement("a");
      aEssalud.id = "btn-essalud-top";
      aEssalud.href = "https://dondemeatiendo.essalud.gob.pe/#/consulta";
      aEssalud.target = "_blank";
      aEssalud.rel = "noopener noreferrer";
      aEssalud.style.cssText = "display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:#2563eb;color:#ffffff;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.08);transition:background 0.2s;white-space:nowrap;";
      aEssalud.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> <span>Consulta EsSalud</span>`;
      aEssalud.onmouseenter = () => { aEssalud.style.background = "#1d4ed8"; };
      aEssalud.onmouseleave = () => { aEssalud.style.background = "#2563eb"; };

      // Insertar a la izquierda de Limpiar Filtros
      parent.insertBefore(aEssalud, btnLimpiar);
    }
  };
  insertarBotonEsSalud();

  // Fecha actual en hora Perú
  const getLocalDateLima = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  };

  // Formato dd/mm/aaaa
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "-";
    const clean = String(dateStr).split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  };

  // Cálculo de días hospitalizado
  const calculateDaysHospitalized = (fechaIngreso, fechaAlta) => {
    if (!fechaIngreso) return 0;
    const start = new Date(String(fechaIngreso).split("T")[0] + "T00:00:00");
    const end = fechaAlta ? new Date(String(fechaAlta).split("T")[0] + "T00:00:00") : getLocalDateLima();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  // Estilos de colores originales para cada servicio
  const getEstiloServicio = (servicio) => {
    const s = String(servicio || "").toUpperCase();
    if (s.includes("SHOCK")) return "background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;"; // Naranja
    if (s.includes("NEONAT")) return "background:#ecfdf5;color:#047857;border:1px solid #d1fae5;"; // Verde
    if (s.includes("PEDIAT")) return "background:#f0f9ff;color:#0369a1;border:1px solid #e0f2fe;"; // Celeste
    if (s.includes("PUERP")) return "background:#faf5ff;color:#7e22ce;border:1px solid #f3e8ff;"; // Morado
    if (s.includes("GINECO")) return "background:#fdf2f8;color:#be185d;border:1px solid #fce7f3;"; // Rosado
    if (s.includes("CIRUG")) return "background:#fff1f2;color:#be123c;border:1px solid #ffe4e6;"; // Rojo
    if (s.includes("MEDICINA")) return "background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;"; // Azul
    if (s.includes("SALUD MENTAL")) return "background:#eef2ff;color:#4338ca;border:1px solid #e0e7ff;"; // Índigo
    if (s.includes("UVI")) return "background:#fef2f2;color:#b91c1c;border:1px solid #fee2e2;"; // Rojo suave
    return "background:#f8fafc;color:#475569;border:1px solid #e2e8f0;";
  };

  // Toast flotante de copiado
  const showToast = (message) => {
    let toast = document.getElementById("toast-seguimiento");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-seguimiento";
      toast.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;font-size:12px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;transition:all 0.3s ease;opacity:0;transform:translateY(-10px);pointer-events:none;";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-check" style="color:#34d399;"></i> <span>${message}</span>`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
    }, 2000);
  };

  // Copiar al portapapeles
  window.copiarDatoAlPortapapeles = (e, valor, label) => {
    e.stopPropagation();
    if (!valor || valor === "-") return;
    navigator.clipboard.writeText(String(valor).trim()).then(() => {
      showToast(`${label} copiado: ${valor}`);
      const btn = e.currentTarget;
      const icon = btn.querySelector("i");
      if (icon) {
        const prev = icon.className;
        icon.className = "fa-solid fa-check text-emerald-600";
        setTimeout(() => { icon.className = prev; }, 1200);
      }
    });
  };

  // Modal de Rango de Hospitalización
  window.mostrarModalRangoHospitalizacion = (e, pJsonStr) => {
    e.stopPropagation();
    const p = JSON.parse(decodeURIComponent(pJsonStr));

    const fechaIngresoFmt = formatDateDisplay(p.fechaIngreso);
    const fechaAltaFmt = p.fechaAlta ? formatDateDisplay(p.fechaAlta) : "En Curso (Hospitalizado)";
    const esAlta = Boolean(p.fechaAlta && p.fechaAlta !== "null");

    let modal = document.getElementById("modal-rango-estancia");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-rango-estancia";
      modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);backdrop-filter:blur(3px);padding:16px;";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #e2e8f0;overflow:hidden;font-family:inherit;" onclick="event.stopPropagation()">
        <div style="padding:14px 20px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fa-regular fa-calendar-days" style="color:#60a5fa;"></i>
            <span style="font-size:13px;font-weight:700;">Rango de Hospitalización y Estancia</span>
          </div>
          <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div style="padding:14px 20px;background:#f0f7ff;border-bottom:1px solid #dbeafe;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <span style="font-size:10px;font-weight:700;color:#1d4ed8;text-transform:uppercase;">PACIENTE</span>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${p.apellidos}, ${p.nombres}</div>
            <div style="font-size:11px;color:#64748b;font-family:monospace;">DNI: <strong>${p.dni}</strong> (DV: ${p.codigoVerificacion || "-"}) · HC: ${p.historiaClinica || "-"}</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:9999px;background:${p.condicion === 'HOSPITALIZADO' ? '#dbeafe;color:#1e40af' : '#d1fae5;color:#065f46'};">
            ${p.condicion}
          </span>
        </div>

        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;font-size:12px;color:#334155;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#047857;display:block;margin-bottom:4px;">● Fecha de Ingreso</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaIngresoFmt}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Servicio: <strong>${p.servicioIngreso || p.servicio}</strong></div>
            </div>

            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1d4ed8;display:block;margin-bottom:4px;">● ${esAlta ? 'Fecha de Alta' : 'Estado Actual'}</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaAltaFmt}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Servicio: <strong>${p.servicio}</strong></div>
            </div>
          </div>

          <div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;color:#475569;">Tiempo de Estancia Hospitalaria:</span>
            <span style="font-size:12px;font-weight:800;color:#1e40af;background:#dbeafe;padding:4px 12px;border-radius:8px;">
              ${p.diasHospitalizado} ${p.diasHospitalizado === 1 ? 'día' : 'días'}
            </span>
          </div>

          <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:6px;">Datos para Consulta EsSalud:</span>
            <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:6px;text-align:center;">
              <div style="background:#fff;padding:4px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${p.dni}</div>
              <div style="background:#fff;padding:4px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">DV: ${p.codigoVerificacion || "-"}</div>
              <div style="background:#fff;padding:4px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;">${formatDateDisplay(p.fechaNacimiento)}</div>
            </div>
          </div>
        </div>

        <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
          <a href="https://dondemeatiendo.essalud.gob.pe/#/consulta" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:600;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir EsSalud
          </a>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" style="padding:6px 14px;font-size:12px;color:#475569;background:#fff;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">Cerrar</button>
            <a href="detalle-paciente.html?id=${p.id}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12px;font-weight:700;color:#fff;background:#2563eb;border-radius:8px;text-decoration:none;">Ver Detalle</a>
          </div>
        </div>
      </div>
    `;
    modal.onclick = () => modal.remove();
  };

  const esFiltroTodos = (val) => {
    if (!val) return true;
    const str = String(val).trim().toUpperCase();
    return str === "" || str === "TODOS" || str === "ALL" || str === "SELECCIONAR";
  };

  // =========================================================================
  // CARGAR PACIENTES
  // =========================================================================
  const loadPatients = async () => {
    insertarBotonEsSalud();

    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.classList.remove("hidden");
    }

    try {
      let query = supabase
        .from("pacientes")
        .select("id, dni, codigo_verificacion, fecha_nacimiento, apellidos, nombres, historia_clinica, tipo_seguro, servicio, condicion")
        .order("apellidos", { ascending: true })
        .limit(100);

      const valCond = selectCondicion ? selectCondicion.value : "";
      const valSeguro = selectSeguro ? selectSeguro.value : "";
      const valServicio = selectServicio ? selectServicio.value : "";
      const valDniHc = inputDniHc ? inputDniHc.value.trim() : "";
      const valApellidos = inputApellidos ? inputApellidos.value.trim() : "";

      if (!esFiltroTodos(valCond)) {
        query = query.ilike("condicion", `%${valCond.trim()}%`);
      }
      if (!esFiltroTodos(valSeguro)) {
        query = query.ilike("tipo_seguro", `%${valSeguro.trim()}%`);
      }
      if (!esFiltroTodos(valServicio)) {
        query = query.ilike("servicio", `%${valServicio.trim()}%`);
      }
      if (valDniHc) {
        query = query.or(`dni.ilike.%${valDniHc}%,historia_clinica.ilike.%${valDniHc}%`);
      }
      if (valApellidos) {
        query = query.or(`apellidos.ilike.%${valApellidos}%,nombres.ilike.%${valApellidos}%`);
      }

      const { data: pacientes, error } = await query;
      if (error) throw error;

      if (tablePacientes) {
        tablePacientes.classList.remove("hidden");
        tablePacientes.style.display = "table";
        if (tablePacientes.parentElement) {
          tablePacientes.parentElement.classList.remove("hidden");
          tablePacientes.parentElement.style.display = "block";
        }
      }

      if (!pacientes || pacientes.length === 0) {
        if (tbodyPacientes) {
          tbodyPacientes.innerHTML = `
            <tr>
              <td colspan="8" class="text-center py-10 text-slate-500">
                <i class="fa-solid fa-filter-circle-xmark text-3xl text-slate-300 block mb-2"></i>
                <div class="font-bold text-slate-700">No se encontraron pacientes con los filtros seleccionados</div>
                <div class="text-xs text-slate-400 mt-1">Seleccione Tipo de Seguro: <strong>TODOS</strong> o presione "Limpiar Filtros".</div>
              </td>
            </tr>`;
        }
        return;
      }

      // Hospitalizaciones
      let hospMap = new Map();
      try {
        const pIds = pacientes.map(p => p.id);
        const { data: hosps } = await supabase
          .from("hospitalizaciones")
          .select("id, paciente_id, fecha_ingreso, fecha_alta, servicio, activa")
          .in("paciente_id", pIds);

        (hosps || []).forEach(h => {
          if (!hospMap.has(h.paciente_id) || h.activa) {
            hospMap.set(h.paciente_id, h);
          }
        });
      } catch (eHosp) {
        console.warn("Aviso al consultar hospitalizaciones:", eHosp);
      }

      renderTable(pacientes, hospMap);
    } catch (err) {
      console.error("Error al cargar pacientes:", err);
      if (tablePacientes) {
        tablePacientes.classList.remove("hidden");
        tablePacientes.style.display = "table";
      }
      if (tbodyPacientes) {
        tbodyPacientes.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-semibold">Error al cargar pacientes: ${err.message}</td></tr>`;
      }
    } finally {
      if (loadingIndicator) {
        loadingIndicator.style.display = "none";
        loadingIndicator.classList.add("hidden");
      }
    }
  };

  const renderTable = (list, hospMap) => {
    if (!tbodyPacientes) return;
    tbodyPacientes.innerHTML = "";

    list.forEach(p => {
      const hosp = hospMap.get(p.id) || null;
      const fechaIngreso = hosp ? hosp.fecha_ingreso : null;
      const fechaAlta = hosp ? hosp.fecha_alta : null;
      const diasHospitalizado = calculateDaysHospitalized(fechaIngreso, fechaAlta);

      const pacienteData = {
        id: p.id,
        dni: p.dni || "-",
        codigoVerificacion: p.codigo_verificacion || "",
        fechaNacimiento: p.fecha_nacimiento || "",
        apellidos: p.apellidos || "",
        nombres: p.nombres || "",
        historiaClinica: p.historia_clinica || "-",
        tipoSeguro: p.tipo_seguro || "SIS",
        servicio: p.servicio || "EMERGENCIA",
        servicioIngreso: hosp ? hosp.servicio : p.servicio,
        condicion: p.condicion || "HOSPITALIZADO",
        fechaIngreso: fechaIngreso,
        fechaAlta: fechaAlta,
        diasHospitalizado: diasHospitalizado
      };

      const pJsonStr = encodeURIComponent(JSON.stringify(pacienteData));
      const tr = document.createElement("tr");
      tr.className = "hover:bg-blue-50/40 transition-colors group cursor-pointer border-b border-slate-100 text-xs";

      tr.addEventListener("click", () => {
        window.location.href = `detalle-paciente.html?id=${p.id}`;
      });

      tr.innerHTML = `
        <!-- 1. Checkbox -->
        <td class="py-3.5 px-4 text-center" onclick="event.stopPropagation()">
          <input type="checkbox" class="pac-checkbox rounded text-blue-600 cursor-pointer" data-id="${p.id}" />
        </td>

        <!-- 2. DNI & Dígito Verificador (DV) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'DNI')"
              style="display:inline-flex;align-items:center;gap:4px;font-family:monospace;font-weight:700;color:#1e293b;padding:2px 6px;border-radius:6px;border:none;background:transparent;cursor:pointer;"
              title="Clic para copiar DNI">
              <span>${p.dni || "-"}</span>
              <i class="fa-regular fa-copy text-slate-400" style="font-size:11px;"></i>
            </button>

            <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.codigo_verificacion || ""}', 'Dígito Verificador')"
              style="display:inline-flex;align-items:center;gap:3px;font-family:monospace;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;cursor:pointer;"
              title="Dígito Verificador (DV) - Clic para copiar">
              <span>DV: ${p.codigo_verificacion || "-"}</span>
              <i class="fa-regular fa-copy text-slate-400" style="font-size:9px;"></i>
            </button>
          </div>
        </td>

        <!-- 3. Paciente + Fecha de Nacimiento -->
        <td class="py-3.5 px-3">
          <div style="font-weight:600;color:#0f172a;text-transform:uppercase;">
            ${p.apellidos || ""}, ${p.nombres || ""}
          </div>
          ${p.fecha_nacimiento ? `
            <div style="margin-top:3px;">
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.fecha_nacimiento}', 'Fecha Nacimiento')"
                style="display:inline-flex;align-items:center;gap:4px;font-family:monospace;font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:1px 6px;border-radius:6px;cursor:pointer;"
                title="Fecha de Nacimiento - Clic para copiar">
                <span>🎂 F. Nac: ${formatDateDisplay(p.fecha_nacimiento)}</span>
                <i class="fa-regular fa-copy text-slate-400" style="font-size:9px;"></i>
              </button>
            </div>
          ` : ""}
        </td>

        <!-- 4. Nº Historia -->
        <td class="py-3.5 px-3 font-mono text-slate-600">
          ${p.historia_clinica || "-"}
        </td>

        <!-- 5. Tipo de Seguro (Badge Azul) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span style="font-size:11px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:6px;">
            ${p.tipo_seguro || "SIS"}
          </span>
        </td>

        <!-- 6. Servicio (Badges de Colores Oficiales) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase;${getEstiloServicio(p.servicio)}">
            ${p.servicio || "-"}
          </span>
        </td>

        <!-- 7. Condición & Estancia (En 2 líneas limpias) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
            <span style="font-size:10px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:6px;">
              ${p.condicion || "HOSPITALIZADO"}
            </span>
            ${fechaIngreso ? `
              <button type="button" onclick="mostrarModalRangoHospitalizacion(event, '${pJsonStr}')"
                style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 6px;border-radius:6px;cursor:pointer;"
                title="Ver rango de hospitalización y días de estancia">
                <i class="fa-regular fa-calendar-days" style="color:#059669;font-size:10px;"></i>
                <span>Ingreso: ${formatDateDisplay(fechaIngreso)}</span>
                <span style="font-size:10px;font-weight:800;background:#a7f3d0;padding:0 4px;border-radius:4px;">${diasHospitalizado}d</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 8. Acción (Detalle) -->
        <td class="py-3.5 px-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <a href="detalle-paciente.html?id=${p.id}"
            style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;"
            title="Ver actualización del paciente">
            <i class="fa-regular fa-id-badge" style="font-size:14px;"></i>
          </a>
        </td>
      `;

      tbodyPacientes.appendChild(tr);
    });
  };

  // Event Listeners
  if (btnSearch) btnSearch.addEventListener("click", loadPatients);

  const botones = Array.from(document.querySelectorAll("button, a"));
  const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputDniHc) inputDniHc.value = "";
      if (inputApellidos) inputApellidos.value = "";
      if (selectSeguro) selectSeguro.selectedIndex = 0;
      if (selectServicio) selectServicio.selectedIndex = 0;
      if (selectCondicion) selectCondicion.selectedIndex = 0;
      setTimeout(loadPatients, 100);
    });
  }

  // Carga inicial
  loadPatients();
});