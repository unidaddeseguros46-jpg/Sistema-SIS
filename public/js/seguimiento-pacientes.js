// =========================================================================
// UNIDAD DE SEGUROS - SEGUIMIENTO DE PACIENTES (public/js/seguimiento-pacientes.js)
// Con:
// 1. Botón "Consulta EsSalud" al lado de "Limpiar Filtros"
// 2. DNI con botón de copia
// 3. Código de Verificación (DV) con botón de copia
// 4. Fecha de Nacimiento con botón de copia
// 5. Ventana emergente con rango de hospitalización y días de estancia
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = "undefined" != typeof supabaseClient ? supabaseClient : window.supabase;
  if (!supabase) {
    console.error("Cliente Supabase no disponible");
    return;
  }

  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    window.location.href = "../../index.html";
    return;
  }

  // Elementos del DOM
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
  // INSERTAR BOTÓN ESSALUD AL LADO DE "LIMPIAR FILTROS"
  // =========================================================================
  const colocarBotonEsSaludSuperior = () => {
    if (document.getElementById("btn-essalud-top")) return;

    // Buscar el botón Limpiar Filtros
    const botones = Array.from(document.querySelectorAll("button, a"));
    const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));

    if (btnLimpiar && btnLimpiar.parentElement) {
      const aEssalud = document.createElement("a");
      aEssalud.id = "btn-essalud-top";
      aEssalud.href = "https://dondemeatiendo.essalud.gob.pe/#/consulta";
      aEssalud.target = "_blank";
      aEssalud.rel = "noopener noreferrer";
      aEssalud.className = "inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-2xs cursor-pointer";
      aEssalud.style.cssText = "display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#2563eb;color:#fff;border-radius:12px;font-size:12px;font-weight:700;text-decoration:none;margin-left:8px;margin-right:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);";
      aEssalud.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> <span>Consulta EsSalud</span>`;

      // Insertar justo al lado de Limpiar Filtros
      btnLimpiar.parentNode.insertBefore(aEssalud, btnLimpiar.nextSibling);
    }
  };
  colocarBotonEsSaludSuperior();

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
    }, 2500);
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
        setTimeout(() => { icon.className = prev; }, 1500);
      }
    });
  };

  // Modal / Ventana emergente con Rango de Fechas
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

  // =========================================================================
  // CARGAR PACIENTES Y FORZAR VISIBILIDAD DE LA TABLA
  // =========================================================================
  const loadPatients = async () => {
    colocarBotonEsSaludSuperior();

    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.classList.remove("hidden");
    }

    try {
      // 1. Consulta limpia a pacientes
      let query = supabase
        .from("pacientes")
        .select("id, dni, codigo_verificacion, fecha_nacimiento, apellidos, nombres, historia_clinica, tipo_seguro, servicio, condicion")
        .order("apellidos", { ascending: true })
        .limit(100);

      const valCond = selectCondicion ? selectCondicion.value : "HOSPITALIZADO";
      const valSeguro = selectSeguro ? selectSeguro.value : "TODOS";
      const valServicio = selectServicio ? selectServicio.value : "TODOS";
      const valDniHc = inputDniHc ? inputDniHc.value.trim() : "";
      const valApellidos = inputApellidos ? inputApellidos.value.trim() : "";

      if (valCond && valCond !== "TODOS") {
        query = query.eq("condicion", valCond);
      }
      if (valSeguro && valSeguro !== "TODOS") {
        query = query.eq("tipo_seguro", valSeguro);
      }
      if (valServicio && valServicio !== "TODOS") {
        query = query.eq("servicio", valServicio);
      }
      if (valDniHc) {
        query = query.or(`dni.ilike.%${valDniHc}%,historia_clinica.ilike.%${valDniHc}%`);
      }
      if (valApellidos) {
        query = query.or(`apellidos.ilike.%${valApellidos}%,nombres.ilike.%${valApellidos}%`);
      }

      const { data: pacientes, error } = await query;
      if (error) throw error;

      // ASEGURAR QUE LA TABLA SEA VISIBLE (remover cualquier clase 'hidden')
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

      // 2. Consulta segura de hospitalizaciones
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
        console.warn("Aviso no crítico al cargar hospitalizaciones:", eHosp);
      }

      // 3. Renderizar filas
      renderTable(pacientes, hospMap);
    } catch (err) {
      console.error("Error al cargar pacientes:", err);
      // Forzar visibilidad para mostrar el mensaje de error si existiera
      if (tablePacientes) {
        tablePacientes.classList.remove("hidden");
        tablePacientes.style.display = "table";
      }
      if (tbodyPacientes) {
        tbodyPacientes.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-semibold">Error al consultar datos: ${err.message}</td></tr>`;
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
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'DNI')"
              class="inline-flex items-center gap-1 font-mono font-bold text-slate-800 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
              title="Clic para copiar DNI">
              <span>${p.dni || "-"}</span>
              <i class="fa-regular fa-copy text-slate-400 text-[11px]"></i>
            </button>
            <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.codigo_verificacion || ""}', 'Dígito Verificador')"
              class="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              title="Dígito Verificador (DV) - Clic para copiar">
              <span>DV: ${p.codigo_verificacion || "-"}</span>
              <i class="fa-regular fa-copy text-slate-400 text-[9px]"></i>
            </button>
          </div>
        </td>

        <!-- 3. Paciente + Fecha de Nacimiento -->
        <td class="py-3.5 px-3">
          <div class="font-semibold text-slate-900 uppercase">
            ${p.apellidos || ""}, ${p.nombres || ""}
          </div>
          ${p.fecha_nacimiento ? `
            <div class="mt-0.5">
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.fecha_nacimiento}', 'Fecha Nacimiento')"
                class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-1 py-0.2 rounded transition-colors"
                title="Fecha de Nacimiento - Clic para copiar">
                <span>🎂 F. Nac: ${formatDateDisplay(p.fecha_nacimiento)}</span>
                <i class="fa-regular fa-copy text-slate-400 text-[9px]"></i>
              </button>
            </div>
          ` : ""}
        </td>

        <!-- 4. Nº Historia -->
        <td class="py-3.5 px-3 font-mono text-slate-600">
          ${p.historia_clinica || "-"}
        </td>

        <!-- 5. Tipo de Seguro -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span class="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
            ${p.tipo_seguro || "SIS"}
          </span>
        </td>

        <!-- 6. Servicio -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span class="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
            ${p.servicio || "-"}
          </span>
        </td>

        <!-- 7. Condición / Estancia (Con Popup de Rango) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded w-fit">
              ${p.condicion || "HOSPITALIZADO"}
            </span>
            ${fechaIngreso ? `
              <button type="button" onclick="mostrarModalRangoHospitalizacion(event, '${pJsonStr}')"
                class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors w-fit"
                title="Ver rango de hospitalización y días de estancia">
                <i class="fa-regular fa-calendar-days text-emerald-600 text-[10px]"></i>
                <span>Ingreso: ${formatDateDisplay(fechaIngreso)}</span>
                <span class="text-[10px] font-bold bg-emerald-200/70 px-1 rounded">${diasHospitalizado}d</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 8. Acción (Detalle) -->
        <td class="py-3.5 px-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <a href="detalle-paciente.html?id=${p.id}"
            class="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors inline-block"
            title="Ver actualización del paciente">
            <i class="fa-regular fa-id-badge text-sm"></i>
          </a>
        </td>
      `;

      tbodyPacientes.appendChild(tr);
    });
  };

  // Event Listeners
  if (btnSearch) btnSearch.addEventListener("click", loadPatients);

  // Vincular Limpiar Filtros
  const botones = Array.from(document.querySelectorAll("button"));
  const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputDniHc) inputDniHc.value = "";
      if (inputApellidos) inputApellidos.value = "";
      if (selectSeguro) selectSeguro.value = "TODOS";
      if (selectServicio) selectServicio.value = "TODOS";
      if (selectCondicion) selectCondicion.value = "HOSPITALIZADO";
      setTimeout(loadPatients, 100);
    });
  }

  // Carga inicial
  loadPatients();
});