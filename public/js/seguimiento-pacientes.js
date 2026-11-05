// =========================================================================
// UNIDAD DE SEGUROS - SISTEMA HOSPITALARIO
// Archivo: public/js/seguimiento-pacientes.js (Versión Profesional + Paginación)
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = typeof supabaseClient !== "undefined" ? supabaseClient : window.supabase;
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

  // 2. Elementos del DOM (con respaldo por si algún selector varía en el HTML)
  const inputDniHc = document.getElementById("filter-dni-hc") || document.querySelector('input[placeholder*="DNI"]');
  const inputApellidos = document.getElementById("filter-apellidos") || document.querySelector('input[placeholder*="apellidos"]');
  const selectCondicion = document.getElementById("filter-condicion");
  const selectSeguro = document.getElementById("filter-seguro");
  const selectServicio = document.getElementById("filter-servicio");
  const btnSearch = document.getElementById("btn-search");
  const tbodyPacientes = document.getElementById("tbody-pacientes");
  const loadingIndicator = document.getElementById("loading-indicator");
  const tablePacientes = document.getElementById("table-pacientes");

  // Variables de estado para Paginación (30 en 30)
  const ITEMS_PER_PAGE = 30;
  let currentPage = 1;
  let allPacientesFiltered = [];
  let globalHospMap = new Map();

  // =========================================================================
  // ESTILOS CSS INYECTADOS PARA ACABADO PROFESIONAL
  // =========================================================================
  const inyectarEstilosProfesionales = () => {
    if (document.getElementById("estilos-seguimiento-pro")) return;
    const style = document.createElement("style");
    style.id = "estilos-seguimiento-pro";
    style.innerHTML = `
      #table-pacientes tbody tr {
        transition: background-color 0.15s ease;
      }
      #table-pacientes tbody tr:hover {
        background-color: #f8fafc !important;
      }
      .copy-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border-radius: 5px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .copy-chip:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }
      .copy-chip .copy-icon {
        opacity: 0.45;
        transition: opacity 0.15s ease;
      }
      .copy-chip:hover .copy-icon {
        opacity: 1;
        color: #2563eb;
      }
      .badge-seguro-pro {
        display: inline-flex;
        align-items: center;
        font-size: 11px;
        font-weight: 700;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #dbeafe;
        border-left: 3.5px solid #2563eb;
        padding: 3px 10px;
        border-radius: 5px;
        letter-spacing: 0.02em;
      }
      .btn-accion-pro {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        color: #2563eb;
        background: transparent;
        border-radius: 8px;
        text-decoration: none;
        transition: all 0.15s ease;
      }
      .btn-accion-pro:hover {
        background: #eff6ff;
        color: #1d4ed8;
        transform: translateY(-1px);
      }
      .page-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        padding: 0 8px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .page-btn:hover:not(:disabled) {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #cbd5e1;
      }
      .page-btn.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
      }
      .page-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  };
  inyectarEstilosProfesionales();

  // =========================================================================
  // ALINEAR BOTÓN ESSALUD JUNTO A "LIMPIAR FILTROS" Y "BUSCAR"
  // =========================================================================
  const insertarBotonEsSalud = () => {
    if (document.getElementById("btn-essalud-top")) return;

    const botones = Array.from(document.querySelectorAll("button, a"));
    const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));

    if (btnLimpiar && btnLimpiar.parentElement) {
      const parent = btnLimpiar.parentElement;
      parent.style.display = "flex";
      parent.style.alignItems = "center";
      parent.style.justifyContent = "flex-end";
      parent.style.gap = "8px";

      const aEssalud = document.createElement("a");
      aEssalud.id = "btn-essalud-top";
      aEssalud.href = "https://dondemeatiendo.essalud.gob.pe/#/consulta";
      aEssalud.target = "_blank";
      aEssalud.rel = "noopener noreferrer";
      aEssalud.style.cssText = "display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none;transition:all 0.2s;white-space:nowrap;margin-left:auto;";
      aEssalud.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> <span>Consulta EsSalud</span>`;
      aEssalud.onmouseenter = () => {
        aEssalud.style.background = "#2563eb";
        aEssalud.style.color = "#ffffff";
        aEssalud.style.borderColor = "#2563eb";
      };
      aEssalud.onmouseleave = () => {
        aEssalud.style.background = "#eff6ff";
        aEssalud.style.color = "#1d4ed8";
        aEssalud.style.borderColor = "#bfdbfe";
      };

      parent.insertBefore(aEssalud, btnLimpiar);
    }
  };
  insertarBotonEsSalud();

  // Utilidades de Fechas
  const getLocalDateLima = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "-";
    const clean = String(dateStr).split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  };

  const calculateDaysHospitalized = (fechaIngreso, fechaAlta) => {
    if (!fechaIngreso) return 0;
    const start = new Date(String(fechaIngreso).split("T")[0] + "T00:00:00");
    const end = fechaAlta ? new Date(String(fechaAlta).split("T")[0] + "T00:00:00") : getLocalDateLima();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  // Colores armónicos por Servicio (Fiel a la segunda imagen)
  const getEstiloServicio = (servicio) => {
    const s = String(servicio || "").toUpperCase();
    if (s.includes("EMERGENCIA") || s.includes("SHOCK")) return "background:#fffbeb;color:#d97706;border:1px solid #fde68a;"; // Ámbar/Naranja
    if (s.includes("NEONAT")) return "background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;"; // Verde
    if (s.includes("PEDIAT")) return "background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;"; // Celeste
    if (s.includes("PUERP")) return "background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;"; // Violeta
    if (s.includes("GINECO")) return "background:#fdf2f8;color:#db2777;border:1px solid #fbcfe8;"; // Rosa
    if (s.includes("CIRUG")) return "background:#fef2f2;color:#dc2626;border:1px solid #fecaca;"; // Rojo suave
    if (s.includes("MEDICINA")) return "background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;"; // Azul
    if (s.includes("SALUD MENTAL")) return "background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe;"; // Índigo
    if (s.includes("UVI") || s.includes("UCI")) return "background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;";
    return "background:#f8fafc;color:#475569;border:1px solid #e2e8f0;";
  };

  // Estilo de Condición (Verde para ALTA como en imagen 2, Azul para HOSPITALIZADO)
  const getEstiloCondicion = (condicion) => {
    const c = String(condicion || "").toUpperCase();
    if (c.includes("ALTA")) {
      return "background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;";
    }
    if (c.includes("REFERID") || c.includes("TRANSFER")) {
      return "background:#fef3c7;color:#b45309;border:1px solid #fde68a;";
    }
    if (c.includes("FALLEC")) {
      return "background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;";
    }
    return "background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;";
  };

  // Toast flotante de copiado
  const showToast = (message) => {
    let toast = document.getElementById("toast-seguimiento");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-seguimiento";
      toast.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;font-size:12px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.18);display:flex;align-items:center;gap:8px;transition:all 0.25s ease;opacity:0;transform:translateY(-10px);pointer-events:none;";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#34d399;"></i> <span>${message}</span>`;
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
    }, 1800);
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
        icon.className = "fa-solid fa-check text-emerald-600 copy-icon";
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
      modal.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);padding:16px;";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:480px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #e2e8f0;overflow:hidden;font-family:inherit;" onclick="event.stopPropagation()">
        <div style="padding:14px 20px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fa-regular fa-calendar-days" style="color:#60a5fa;"></i>
            <span style="font-size:13px;font-weight:700;">Detalle de Estancia Hospitalaria</span>
          </div>
          <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <span style="font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em;">PACIENTE</span>
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:1px;">${p.apellidos}, ${p.nombres}</div>
            <div style="font-size:11px;color:#64748b;font-family:monospace;margin-top:2px;">
              DNI: <strong>${p.dni}</strong> ${p.codigoVerificacion ? `(DV: ${p.codigoVerificacion})` : ""} · HC: ${p.historiaClinica || "-"}
            </div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;${getEstiloCondicion(p.condicion)}">
            ${p.condicion}
          </span>
        </div>

        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;font-size:12px;color:#334155;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#059669;display:block;margin-bottom:4px;">● Fecha de Ingreso</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaIngresoFmt}</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">Servicio: <strong>${p.servicioIngreso || p.servicio}</strong></div>
            </div>

            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#2563eb;display:block;margin-bottom:4px;">● ${esAlta ? 'Fecha de Alta' : 'Estado Actual'}</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaAltaFmt}</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">Servicio: <strong>${p.servicio}</strong></div>
            </div>
          </div>

          <div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;color:#475569;">Tiempo Total de Estancia:</span>
            <span style="font-size:12px;font-weight:800;color:#1e40af;background:#dbeafe;padding:4px 12px;border-radius:8px;">
              ${p.diasHospitalizado} ${p.diasHospitalizado === 1 ? 'día' : 'días'}
            </span>
          </div>

          <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:6px;">Datos Rápidos (Clic para copiar):</span>
            <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:6px;text-align:center;">
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'DNI')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;font-size:11px;">DNI: ${p.dni}</button>
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.codigoVerificacion || ""}', 'DV')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;font-size:11px;">DV: ${p.codigoVerificacion || "-"}</button>
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${formatDateDisplay(p.fechaNacimiento)}', 'Fecha Nacimiento')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;font-size:11px;">Nac: ${formatDateDisplay(p.fechaNacimiento)}</button>
            </div>
          </div>
        </div>

        <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
          <a href="https://dondemeatiendo.essalud.gob.pe/#/consulta" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:600;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;text-decoration:none;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Consultar EsSalud
          </a>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" onclick="document.getElementById('modal-rango-estancia').remove()" style="padding:6px 14px;font-size:12px;color:#475569;background:#fff;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;">Cerrar</button>
            <a href="detalle-paciente.html?id=${p.id}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12px;font-weight:700;color:#fff;background:#2563eb;border-radius:8px;text-decoration:none;">Ver Ficha</a>
          </div>
        </div>
      </div>
    `;
    modal.onclick = () => modal.remove();
  };

  const esFiltroTodos = (val) => {
    if (!val) return true;
    const str = String(val).trim().toUpperCase();
    return str === "" || str === "TODOS" || str === "ALL" || str === "SELECCIONAR" || str.includes("TODOS");
  };

  // Obtener valor real de un select (incluso si no tiene ID directo)
  const obtenerValorSelect = (el, labelKeyword) => {
    if (el) return el.value;
    const labels = Array.from(document.querySelectorAll("label"));
    const targetLabel = labels.find(l => l.textContent && l.textContent.toLowerCase().includes(labelKeyword));
    if (targetLabel && targetLabel.parentElement) {
      const sel = targetLabel.parentElement.querySelector("select");
      if (sel) return sel.value;
    }
    return "";
  };

  // =========================================================================
  // CARGAR PACIENTES DESDE SUPABASE
  // =========================================================================
  const loadPatients = async () => {
    insertarBotonEsSalud();
    currentPage = 1; // Reiniciar siempre a la página 1 al filtrar

    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.classList.remove("hidden");
    }

    try {
      let query = supabase
        .from("pacientes")
        .select("id, dni, codigo_verificacion, fecha_nacimiento, apellidos, nombres, historia_clinica, tipo_seguro, servicio, condicion")
        .order("apellidos", { ascending: true })
        .limit(1000); // Permite paginar amplios resultados de 30 en 30

      const valCond = obtenerValorSelect(selectCondicion, "condici");
      const valSeguro = obtenerValorSelect(selectSeguro, "seguro");
      const valServicio = obtenerValorSelect(selectServicio, "servicio");
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

      allPacientesFiltered = pacientes || [];

      if (allPacientesFiltered.length === 0) {
        if (tbodyPacientes) {
          tbodyPacientes.innerHTML = `
            <tr>
              <td colspan="8" class="text-center py-12 text-slate-500">
                <i class="fa-solid fa-filter-circle-xmark text-3xl text-slate-300 block mb-2"></i>
                <div class="font-bold text-slate-700 text-sm">No se encontraron pacientes con los filtros seleccionados</div>
                <div class="text-xs text-slate-400 mt-1">Verifique los filtros activos o presione <strong>"Limpiar Filtros"</strong>.</div>
              </td>
            </tr>`;
        }
        renderPaginationControls(0);
        return;
      }

      // Consultar hospitalizaciones asociadas
      globalHospMap = new Map();
      try {
        const pIds = allPacientesFiltered.map(p => p.id);
        // Dividir en lotes si supera 200 IDs para evitar URLs largas
        for (let i = 0; i < pIds.length; i += 200) {
          const chunk = pIds.slice(i, i + 200);
          const { data: hosps } = await supabase
            .from("hospitalizaciones")
            .select("id, paciente_id, fecha_ingreso, fecha_alta, servicio, activa")
            .in("paciente_id", chunk);

          (hosps || []).forEach(h => {
            if (!globalHospMap.has(h.paciente_id) || h.activa) {
              globalHospMap.set(h.paciente_id, h);
            }
          });
        }
      } catch (eHosp) {
        console.warn("Aviso al consultar hospitalizaciones:", eHosp);
      }

      renderCurrentPage();
    } catch (err) {
      console.error("Error al cargar pacientes:", err);
      if (tbodyPacientes) {
        tbodyPacientes.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500 font-semibold">Error al cargar pacientes: ${err.message}</td></tr>`;
      }
      renderPaginationControls(0);
    } finally {
      if (loadingIndicator) {
        loadingIndicator.style.display = "none";
        loadingIndicator.classList.add("hidden");
      }
    }
  };

  // =========================================================================
  // RENDERIZADO DE PÁGINA ACTUAL Y CONTROLES DE PAGINACIÓN (30 EN 30)
  // =========================================================================
  const renderCurrentPage = () => {
    const totalRecords = allPacientesFiltered.length;
    const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageSlice = allPacientesFiltered.slice(startIndex, endIndex);

    renderTable(pageSlice, globalHospMap);
    renderPaginationControls(totalRecords);
  };

  const renderPaginationControls = (totalRecords) => {
    let paginationContainer = document.getElementById("pagination-pacientes-container");

    // Si hay 30 datos o menos, ocultamos la barra de paginación
    if (totalRecords <= ITEMS_PER_PAGE) {
      if (paginationContainer) paginationContainer.remove();
      return;
    }

    if (!paginationContainer && tablePacientes && tablePacientes.parentElement) {
      paginationContainer = document.createElement("div");
      paginationContainer.id = "pagination-pacientes-container";
      paginationContainer.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#ffffff;border-top:1px solid #f1f5f9;border-radius:0 0 12px 12px;flex-wrap:wrap;gap:10px;";
      tablePacientes.parentElement.appendChild(paginationContainer);
    }

    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalRecords);

    // Generar números de página con elipsis inteligente
    let pagesHtml = "";
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      pagesHtml += `<button type="button" class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) pagesHtml += `<span style="color:#94a3b8;font-size:12px;padding:0 4px;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      pagesHtml += `<button type="button" class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pagesHtml += `<span style="color:#94a3b8;font-size:12px;padding:0 4px;">...</span>`;
      pagesHtml += `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationContainer.innerHTML = `
      <div style="font-size:12px;color:#64748b;">
        Mostrando <strong style="color:#0f172a;">${startItem} - ${endItem}</strong> de <strong style="color:#0f172a;">${totalRecords}</strong> pacientes
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button type="button" class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} title="Página anterior">
          <i class="fa-solid fa-chevron-left" style="font-size:10px;"></i>
        </button>
        ${pagesHtml}
        <button type="button" class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} title="Página siguiente">
          <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>
        </button>
      </div>
    `;

    paginationContainer.querySelectorAll(".page-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const targetPage = parseInt(btn.getAttribute("data-page"), 10);
        if (!isNaN(targetPage) && targetPage !== currentPage) {
          currentPage = targetPage;
          renderCurrentPage();
          if (tablePacientes) {
            tablePacientes.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      });
    });
  };

  // =========================================================================
  // RENDERIZAR FILAS DE LA TABLA (DISEÑO LIMPIO Y PROFESIONAL)
  // =========================================================================
  const renderTable = (list, hospMap) => {
    if (!tbodyPacientes) return;
    tbodyPacientes.innerHTML = "";

    list.forEach(p => {
      const hosp = hospMap.get(p.id) || null;
      const fechaIngreso = hosp ? hosp.fecha_ingreso : null;
      const fechaAlta = hosp ? hosp.fecha_alta : null;
      const diasHospitalizado = calculateDaysHospitalized(fechaIngreso, fechaAlta);
      const tieneDV = p.codigo_verificacion !== null && p.codigo_verificacion !== undefined && String(p.codigo_verificacion).trim() !== "";

      const pacienteData = {
        id: p.id,
        dni: p.dni || "-",
        codigoVerificacion: tieneDV ? String(p.codigo_verificacion).trim() : "",
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
      tr.className = "group cursor-pointer border-b border-slate-100 text-xs";

      tr.addEventListener("click", () => {
        window.location.href = `detalle-paciente.html?id=${p.id}`;
      });

      tr.innerHTML = `
        <!-- 1. Checkbox -->
        <td class="py-3 px-4 text-center" onclick="event.stopPropagation()">
          <input type="checkbox" class="pac-checkbox rounded border-slate-300 text-blue-600 cursor-pointer" data-id="${p.id}" />
        </td>

        <!-- 2. DNI & Dígito Verificador limpio -->
        <td class="py-3 px-3 whitespace-nowrap">
          <div style="display:flex;align-items:center;gap:4px;">
            <button type="button" class="copy-chip" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'DNI')" title="Clic para copiar documento">
              <span style="font-family:inherit;font-size:12px;font-weight:600;color:#334155;">${p.dni || "-"}</span>
              <i class="fa-regular fa-copy copy-icon" style="font-size:10px;"></i>
            </button>

            ${tieneDV ? `
              <button type="button" class="copy-chip" onclick="copiarDatoAlPortapapeles(event, '${p.codigo_verificacion}', 'Dígito Verificador')"
                style="background:#f8fafc;border:1px solid #e2e8f0;padding:1px 5px;border-radius:4px;"
                title="Dígito Verificador: ${p.codigo_verificacion} (Clic para copiar)">
                <span style="font-family:monospace;font-size:10px;font-weight:700;color:#64748b;">-${p.codigo_verificacion}</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 3. Paciente + Fecha de Nacimiento sutil -->
        <td class="py-3 px-3">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;color:#1e293b;text-transform:uppercase;letter-spacing:0.01em;">
              ${p.apellidos || ""}, ${p.nombres || ""}
            </span>
            ${p.fecha_nacimiento ? `
              <button type="button" class="copy-chip" onclick="copiarDatoAlPortapapeles(event, '${formatDateDisplay(p.fecha_nacimiento)}', 'Fecha Nacimiento')"
                style="padding:1px 6px;font-size:10.5px;color:#64748b;background:#f8fafc;border:1px solid #f1f5f9;border-radius:4px;"
                title="Fecha de Nacimiento (Clic para copiar)">
                <i class="fa-solid fa-cake-candles" style="font-size:9px;color:#94a3b8;"></i>
                <span>${formatDateDisplay(p.fecha_nacimiento)}</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 4. Nº Historia -->
        <td class="py-3 px-3 font-mono text-slate-600" style="font-size:12px;">
          ${p.historia_clinica || "-"}
        </td>

        <!-- 5. Tipo de Seguro (Con borde izquierdo azul igual a la 2da imagen) -->
        <td class="py-3 px-3 whitespace-nowrap">
          <span class="badge-seguro-pro">
            ${p.tipo_seguro || "SIS"}
          </span>
        </td>

        <!-- 6. Servicio -->
        <td class="py-3 px-3 whitespace-nowrap">
          <span style="display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px;text-transform:uppercase;letter-spacing:0.02em;${getEstiloServicio(p.servicio)}">
            ${p.servicio || "-"}
          </span>
        </td>

        <!-- 7. Condición & Estancia compacta -->
        <td class="py-3 px-3 whitespace-nowrap">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:5px;text-transform:uppercase;letter-spacing:0.02em;${getEstiloCondicion(p.condicion)}">
              ${p.condicion || "HOSPITALIZADO"}
            </span>
            ${fechaIngreso ? `
              <button type="button" onclick="mostrarModalRangoHospitalizacion(event, '${pJsonStr}')"
                style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 7px;border-radius:5px;cursor:pointer;transition:all 0.15s;"
                title="Ingreso: ${formatDateDisplay(fechaIngreso)} · Clic para ver detalle de estancia">
                <i class="fa-regular fa-calendar-check" style="font-size:10px;"></i>
                <span>${diasHospitalizado}d</span>
              </button>
            ` : ""}
          </div>
        </td>

        <!-- 8. Acción (Ícono idéntico a la 2da imagen) -->
        <td class="py-3 px-3 text-center whitespace-nowrap" onclick="event.stopPropagation()">
          <a href="detalle-paciente.html?id=${p.id}" class="btn-accion-pro" title="Ver detalle del paciente">
            <i class="fa-solid fa-address-card" style="font-size:16px;"></i>
          </a>
        </td>
      `;

      tbodyPacientes.appendChild(tr);
    });
  };

  // =========================================================================
  // EVENT LISTENERS (FILTRADO AUTOMÁTICO Y BOTONES)
  // =========================================================================
  if (btnSearch) btnSearch.addEventListener("click", loadPatients);

  // Filtrar inmediatamente al cambiar cualquier desplegable (Condición, Seguro, Servicio)
  document.querySelectorAll("select").forEach(sel => {
    sel.addEventListener("change", loadPatients);
  });

  // Filtrar al presionar Enter en los buscadores de texto
  [inputDniHc, inputApellidos].forEach(inp => {
    if (inp) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          loadPatients();
        }
      });
    }
  });

  // Botón Limpiar Filtros
  const botones = Array.from(document.querySelectorAll("button, a"));
  const btnLimpiar = botones.find(b => b.textContent && b.textContent.toLowerCase().includes("limpiar"));
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      if (inputDniHc) inputDniHc.value = "";
      if (inputApellidos) inputApellidos.value = "";
      document.querySelectorAll("select").forEach(sel => {
        // Buscar la opción "TODOS" si existe, o volver al primer ítem
        const idxTodos = Array.from(sel.options).findIndex(o => o.text.toUpperCase().includes("TODOS"));
        sel.selectedIndex = idxTodos >= 0 ? idxTodos : 0;
      });
      setTimeout(loadPatients, 50);
    });
  }

  // Carga inicial
  loadPatients();
});