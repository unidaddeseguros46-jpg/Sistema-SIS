// =========================================================================
// UNIDAD DE SEGUROS - BÚSQUEDA / VERIFICACIÓN (seguimiento-pacientes.js)
// Con DNI, Código de Verificación (DV), F. Nacimiento, Enlace EsSalud
// y Ventana Emergente con Rango de Fechas de Hospitalización
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = "undefined" != typeof supabaseClient ? supabaseClient : window.supabase;
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    window.location.href = "../../index.html";
    return;
  }

  const currentUserId = currentSession.user.id;
  const inputDniHc = document.getElementById("filter-dni-hc");
  const inputApellidos = document.getElementById("filter-apellidos");
  const selectSeguro = document.getElementById("filter-seguro");
  const selectServicio = document.getElementById("filter-servicio");
  const selectCondicion = document.getElementById("filter-condicion");
  const btnSearch = document.getElementById("btn-search");
  const btnClear = document.getElementById("btn-clear");
  const tbodyPacientes = document.getElementById("tbody-pacientes");
  const loadingIndicator = document.getElementById("loading-indicator");
  const tablePacientes = document.getElementById("table-pacientes");
  const altaCount = document.getElementById("alta-count");

  // Ajustar cabecera de la tabla dinámicamente si falta la columna de F. Nacimiento
  const thead = tablePacientes ? tablePacientes.querySelector("thead tr") : null;
  if (thead && !document.getElementById("th-fnac")) {
    const ths = Array.from(thead.children);
    if (ths.length >= 4) {
      const thFnac = document.createElement("th");
      thFnac.id = "th-fnac";
      thFnac.className = "py-3 px-3 text-[11px] font-bold text-slate-500 uppercase";
      thFnac.textContent = "F. NACIMIENTO";
      thead.insertBefore(thFnac, ths[3]); // Después de Paciente
    }
  }

  // Mapa de checks diarios
  const checksMap = new Map();

  const getLocalDateLima = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  };

  const normalizeText = (text) => {
    return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "-";
    if (dateStr.includes("-")) {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const calculateDaysHospitalized = (fechaIngreso, fechaAlta) => {
    if (!fechaIngreso) return 0;
    const start = new Date(fechaIngreso.split("T")[0] + "T00:00:00");
    const end = fechaAlta ? new Date(fechaAlta.split("T")[0] + "T00:00:00") : getLocalDateLima();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  // Toast flotante de confirmación de copia
  const showToast = (message) => {
    let toast = document.getElementById("toast-seguimiento");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-seguimiento";
      toast.className = "fixed top-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 transition-all duration-300 opacity-0 pointer-events-none";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> <span>${message}</span>`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
    }, 2500);
  };

  // Copiar texto genérico al portapapeles
  window.copiarDatoAlPortapapeles = (e, valor, label) => {
    e.stopPropagation();
    if (!valor || valor === "-") return;
    navigator.clipboard.writeText(valor).then(() => {
      showToast(`${label} copiado: ${valor}`);
      const btn = e.currentTarget;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i>`;
      setTimeout(() => {
        btn.innerHTML = originalHtml;
      }, 1500);
    }).catch(err => {
      console.error("Error al copiar:", err);
    });
  };

  // Abrir EsSalud con copiado de DNI previo
  window.abrirConsultaEsSalud = (e, dni) => {
    e.stopPropagation();
    navigator.clipboard.writeText(dni).then(() => {
      showToast(`DNI ${dni} copiado. Abriendo Consulta EsSalud...`);
    });
    window.open("https://dondemeatiendo.essalud.gob.pe/#/consulta", "_blank");
  };

  // Modal / Ventana emergente de Rango de Hospitalización
  window.mostrarModalRangoHospitalizacion = (e, pacienteJson) => {
    e.stopPropagation();
    const p = typeof pacienteJson === "string" ? JSON.parse(decodeURIComponent(pacienteJson)) : pacienteJson;

    const fechaIngresoFmt = formatDateDisplay(p.fechaIngreso);
    const fechaAltaFmt = p.fechaAlta ? formatDateDisplay(p.fechaAlta) : "En Curso (Hospitalizado)";
    const esAlta = Boolean(p.fechaAlta && p.fechaAlta !== "null");

    let modal = document.getElementById("modal-rango-estancia");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-rango-estancia";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="fa-regular fa-calendar-days text-blue-400"></i>
            <h4 class="text-sm font-bold">Rango de Hospitalización y Estancia</h4>
          </div>
          <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" class="text-slate-400 hover:text-white p-1 rounded-lg">
            <i class="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        <!-- Paciente -->
        <div class="p-4 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-3">
          <div>
            <span class="text-[10px] font-bold text-blue-700 uppercase">PACIENTE</span>
            <div class="text-xs font-bold text-slate-900">${p.apellidos}, ${p.nombres}</div>
            <div class="text-[11px] text-slate-500 font-mono">DNI: <strong>${p.dni}</strong> (DV: ${p.codigoVerificacion || "-"}) · HC: ${p.historiaClinica || "-"}</div>
          </div>
          <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${p.condicion === 'HOSPITALIZADO' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">
            ${p.condicion}
          </span>
        </div>

        <!-- Fechas e Intervalo -->
        <div class="p-5 space-y-4 text-xs text-slate-800">
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span class="text-[10px] font-bold uppercase text-emerald-700 block mb-1">
                <i class="fa-solid fa-circle text-[7px] text-emerald-500 mr-1"></i>Fecha de Ingreso
              </span>
              <div class="text-sm font-bold font-mono text-slate-900">${fechaIngresoFmt}</div>
              <div class="text-[10px] text-slate-400 mt-1">Servicio: <strong>${p.servicioIngreso || p.servicio}</strong></div>
            </div>

            <div class="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span class="text-[10px] font-bold uppercase text-blue-700 block mb-1">
                <i class="fa-solid fa-circle text-[7px] ${esAlta ? 'text-amber-500' : 'text-blue-500'} mr-1"></i>${esAlta ? 'Fecha de Alta' : 'Estado Actual'}
              </span>
              <div class="text-sm font-bold font-mono text-slate-900">${fechaAltaFmt}</div>
              <div class="text-[10px] text-slate-400 mt-1">Servicio: <strong>${p.servicio}</strong></div>
            </div>
          </div>

          <!-- Días de Estancia -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span class="font-semibold text-slate-700">Tiempo de Estancia Hospitalaria:</span>
            <span class="text-xs font-extrabold text-blue-800 bg-blue-100 px-3 py-1 rounded-lg">
              ${p.diasHospitalizado} ${p.diasHospitalizado === 1 ? 'día' : 'días'}
            </span>
          </div>

          <!-- Datos EsSalud -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Datos para verificación en EsSalud:</span>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-white p-1.5 rounded border border-slate-200 font-mono font-bold text-slate-800">${p.dni}</div>
              <div class="bg-white p-1.5 rounded border border-slate-200 font-mono font-bold text-slate-800">DV: ${p.codigoVerificacion || "-"}</div>
              <div class="bg-white p-1.5 rounded border border-slate-200 font-mono font-bold text-slate-800">${formatDateDisplay(p.fechaNacimiento)}</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a href="https://dondemeatiendo.essalud.gob.pe/#/consulta" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg">
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> EsSalud
          </a>
          <div class="flex items-center gap-2">
            <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg">
              Cerrar
            </button>
            <a href="detalle-paciente.html?id=${p.id}" class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              Ver Detalle
            </a>
          </div>
        </div>
      </div>
    `;
    modal.onclick = () => modal.remove();
  };

  // Cargar pacientes desde Supabase con hospitalizaciones
  const loadPatients = async () => {
    if (loadingIndicator) loadingIndicator.style.display = "block";
    if (tbodyPacientes) tbodyPacientes.innerHTML = "";

    try {
      let query = supabase
        .from("pacientes")
        .select(`
          id,
          dni,
          codigo_verificacion,
          fecha_nacimiento,
          apellidos,
          nombres,
          historia_clinica,
          tipo_seguro,
          servicio,
          condicion,
          hospitalizaciones (
            id,
            fecha_ingreso,
            fecha_alta,
            servicio,
            activa
          )
        `)
        .order("apellidos", { ascending: true })
        .limit(100);

      if (selectCondicion && selectCondicion.value !== "TODOS") {
        query = query.eq("condicion", selectCondicion.value);
      }
      if (selectSeguro && selectSeguro.value !== "TODOS") {
        query = query.eq("tipo_seguro", selectSeguro.value);
      }
      if (selectServicio && selectServicio.value !== "TODOS") {
        query = query.eq("servicio", selectServicio.value);
      }

      const { data: pacientes, error } = await query;
      if (error) throw error;

      renderTable(pacientes || []);
    } catch (err) {
      console.error("Error al cargar pacientes:", err);
      if (tbodyPacientes) {
        tbodyPacientes.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-red-500 font-semibold">Error al cargar datos de pacientes: ${err.message}</td></tr>`;
      }
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = "none";
    }
  };

  // Renderizar filas de la tabla
  const renderTable = (list) => {
    if (!tbodyPacientes) return;
    tbodyPacientes.innerHTML = "";

    if (list.length === 0) {
      tbodyPacientes.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500 font-semibold">No se encontraron pacientes con los filtros seleccionados</td></tr>`;
      return;
    }

    list.forEach((p) => {
      // Obtener hospitalización activa o la más reciente
      const hospList = p.hospitalizaciones || [];
      const activeHosp = hospList.find(h => h.activa === true) || hospList[0] || null;

      const fechaIngreso = activeHosp ? activeHosp.fecha_ingreso : null;
      const fechaAlta = activeHosp ? activeHosp.fecha_alta : null;
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
        servicioIngreso: activeHosp ? activeHosp.servicio : p.servicio,
        condicion: p.condicion || "HOSPITALIZADO",
        fechaIngreso: fechaIngreso,
        fechaAlta: fechaAlta,
        diasHospitalizado: diasHospitalizado
      };

      const pacienteDataJson = encodeURIComponent(JSON.stringify(pacienteData));
      const tr = document.createElement("tr");
      tr.className = "hover:bg-blue-50/50 transition-colors group cursor-pointer border-b border-slate-100";

      // Redirigir a detalle al hacer clic en la fila
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
              class="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
              title="Dígito Verificador (DV) - Clic para copiar">
              <span>DV: ${p.codigo_verificacion || "-"}</span>
              <i class="fa-regular fa-copy text-slate-400 text-[9px]"></i>
            </button>
          </div>
        </td>

        <!-- 3. Paciente -->
        <td class="py-3.5 px-3 font-semibold text-slate-900 uppercase">
          ${p.apellidos || ""}, ${p.nombres || ""}
        </td>

        <!-- 4. Fecha de Nacimiento -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.fecha_nacimiento || ""}', 'Fecha Nacimiento')"
            class="inline-flex items-center gap-1 font-mono text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
            title="Clic para copiar Fecha de Nacimiento">
            <span>${formatDateDisplay(p.fecha_nacimiento)}</span>
            <i class="fa-regular fa-copy text-slate-400 text-[10px]"></i>
          </button>
        </td>

        <!-- 5. Nº Historia -->
        <td class="py-3.5 px-3 font-mono text-slate-600">
          ${p.historia_clinica || "-"}
        </td>

        <!-- 6. Tipo de Seguro -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span class="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
            ${p.tipo_seguro || "SIS"}
          </span>
        </td>

        <!-- 7. Servicio -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <span class="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
            ${p.servicio || "-"}
          </span>
        </td>

        <!-- 8. Condición / Estancia (Con Popup de fechas) -->
        <td class="py-3.5 px-3 whitespace-nowrap">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded w-fit">
              ${p.condicion || "HOSPITALIZADO"}
            </span>
            ${fechaIngreso ? `
              <button type="button" onclick="mostrarModalRangoHospitalizacion(event, '${pacienteDataJson}')"
                class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors w-fit"
                title="Ver rango de hospitalización y días de estancia">
                <i class="fa-regular fa-calendar-days text-emerald-600 text-[10px]"></i>
                <span>Ingreso: ${formatDateDisplay(fechaIngreso)}</span>
                <span class="text-[10px] font-bold bg-emerald-200/70 px-1 rounded">${diasHospitalizado}d</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 9. Acciones (EsSalud & Detalle) -->
        <td class="py-3.5 px-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="abrirConsultaEsSalud(event, '${p.dni || ""}')"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
              title="Abrir 'Dónde me atiendo' EsSalud (Copia el DNI automáticamente)">
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              <span>EsSalud</span>
            </button>

            <a href="detalle-paciente.html?id=${p.id}"
              class="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
              title="Ver actualización del paciente">
              <i class="fa-regular fa-id-badge text-sm"></i>
            </a>
          </div>
        </td>
      `;

      tbodyPacientes.appendChild(tr);
    });
  };

  // Event Listeners para Filtros
  if (btnSearch) btnSearch.addEventListener("click", loadPatients);
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      if (inputDniHc) inputDniHc.value = "";
      if (inputApellidos) inputApellidos.value = "";
      if (selectSeguro) selectSeguro.value = "TODOS";
      if (selectServicio) selectServicio.value = "TODOS";
      if (selectCondicion) selectCondicion.value = "HOSPITALIZADO";
      loadPatients();
    });
  }

  // Carga inicial
  loadPatients();
});