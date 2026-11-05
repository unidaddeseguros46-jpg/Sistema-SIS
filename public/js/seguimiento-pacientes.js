// =========================================================================
// UNIDAD DE SEGUROS - SISTEMA HOSPITALARIO
// Archivo: public/js/seguimiento-pacientes.js
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = typeof supabaseClient !== "undefined" ? supabaseClient : window.supabase;
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "../../index.html";
    return;
  }

  const userId = session.user.id;
  const inputDniHc = document.getElementById("filter-dni-hc");
  const inputApellidos = document.getElementById("filter-apellidos");
  const selectSeguro = document.getElementById("filter-seguro");
  const selectServicio = document.getElementById("filter-servicio");
  const selectCondicion = document.getElementById("filter-condicion");
  const btnSearch = document.getElementById("btn-search");
  const altaCountEl = document.getElementById("alta-count");
  const tbodyPacientes = document.getElementById("tbody-pacientes");
  const loadingIndicator = document.getElementById("loading-indicator");
  const tablePacientes = document.getElementById("table-pacientes");

  if (window.showGuideTooltip) {
    window.showGuideTooltip(
      "seguimiento_pacs",
      "Haga click en la fila de un paciente para actualizar su información",
      5000,
      true,
      { oncePerSession: false }
    );
  }

  // Configuración de paginación: 30 en 30
  const PAGE_SIZE = 30;
  let lastCreatedAt = null;
  let firstCreatedAt = null;
  let hasNext = false;
  let hasPrev = false;
  let currentPage = 1;
  let totalRecords = 0;

  const selectedPatientsMap = new Map();
  let hospMap = new Map();

  // =========================================================================
  // ESTILOS SUTILES COMPLEMENTARIOS (SIN ALTERAR EL CSS NATIVO DE LA TABLA)
  // =========================================================================
  const inyectarEstilosComplementarios = () => {
    if (document.getElementById("estilos-extra-seguimiento")) return;
    const style = document.createElement("style");
    style.id = "estilos-extra-seguimiento";
    style.innerHTML = `
      .inline-copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: transparent;
        border: none;
        padding: 2px 4px;
        border-radius: 4px;
        color: inherit;
        font: inherit;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .inline-copy-btn:hover {
        background: rgba(37, 99, 235, 0.08);
        color: #2563eb;
      }
      .inline-copy-btn .copy-ico {
        font-size: 10px;
        color: #94a3b8;
        opacity: 0.6;
        transition: opacity 0.15s ease, color 0.15s ease;
      }
      .inline-copy-btn:hover .copy-ico {
        opacity: 1;
        color: #2563eb;
      }
      .dv-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-family: monospace;
        font-size: 10.5px;
        font-weight: 700;
        color: #475569;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 1px 6px;
        border-radius: 5px;
        margin-left: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .dv-pill:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .fnac-sub {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #64748b;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 1px 6px;
        border-radius: 5px;
        margin-top: 3px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .fnac-sub:hover {
        background: #f1f5f9;
        color: #1e293b;
        border-color: #cbd5e1;
      }
      .estancia-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10.5px;
        font-weight: 600;
        color: #047857;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        padding: 2px 7px;
        border-radius: 5px;
        margin-left: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .estancia-pill:hover {
        background: #d1fae5;
      }
    `;
    document.head.appendChild(style);
  };
  inyectarEstilosComplementarios();

  // =========================================================================
  // INSERTAR BOTÓN ESSALUD ALINEADO A LA IZQUIERDA DE "LIMPIAR FILTROS"
  // =========================================================================
  const insertarBotonEsSalud = () => {
    if (document.getElementById("btn-essalud-top")) return;
    const btnLimpiar = document.getElementById("btn-clear-input");
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
      aEssalud.style.cssText =
        "display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:#2563eb;color:#ffffff;border-radius:8px;font-size:12.5px;font-weight:600;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.08);transition:background 0.2s;white-space:nowrap;";
      aEssalud.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i> <span>Consulta EsSalud</span>`;
      aEssalud.onmouseenter = () => { aEssalud.style.background = "#1d4ed8"; };
      aEssalud.onmouseleave = () => { aEssalud.style.background = "#2563eb"; };

      parent.insertBefore(aEssalud, btnLimpiar);
    }
  };
  insertarBotonEsSalud();

  // =========================================================================
  // FUNCIONES AUXILIARES Y DE FORMATO
  // =========================================================================
  const getLimaDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));

  const normalizeText = (str) =>
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "-";
    const clean = String(dateStr).split("T")[0];
    const parts = clean.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
  };

  const calculateDaysHospitalized = (fechaIngreso, fechaAlta) => {
    if (!fechaIngreso) return 0;
    const start = new Date(String(fechaIngreso).split("T")[0] + "T00:00:00");
    const end = fechaAlta ? new Date(String(fechaAlta).split("T")[0] + "T00:00:00") : getLimaDate();
    const diff = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  const showToast = (msg, isError = false) => {
    try {
      if (window.showSystemTooltip) {
        window.showSystemTooltip(msg, isError);
        return;
      }
    } catch (e) {
      console.warn("[Toast] showSystemTooltip falló:", e);
    }
    const toast = document.createElement("div");
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "30px",
      right: "30px",
      zIndex: "99999",
      background: isError ? "#fef2f2" : "#f0fdf4",
      color: isError ? "#dc2626" : "#15803d",
      borderLeft: "4px solid " + (isError ? "#ef4444" : "#22c55e"),
      padding: "12px 20px",
      borderRadius: "10px",
      fontWeight: "600",
      fontSize: "14px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  };

  window.copiarDatoAlPortapapeles = (e, valor, label) => {
    e.stopPropagation();
    if (!valor || valor === "-") return;
    navigator.clipboard.writeText(String(valor).trim()).then(() => {
      showToast(`${label} copiado: ${valor}`, false);
      const btn = e.currentTarget;
      const icon = btn.querySelector("i.copy-ico");
      if (icon) {
        const prev = icon.className;
        icon.className = "fa-solid fa-check copy-ico";
        icon.style.color = "#16a34a";
        icon.style.opacity = "1";
        setTimeout(() => {
          icon.className = prev;
          icon.style.color = "";
          icon.style.opacity = "";
        }, 1200);
      }
    });
  };

  // =========================================================================
  // MODAL DE RANGO DE HOSPITALIZACIÓN Y ESTANCIA
  // =========================================================================
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
      modal.style.cssText =
        "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);backdrop-filter:blur(3px);padding:16px;";
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
            <div style="font-size:11px;color:#64748b;font-family:monospace;">
              ${p.docLabel}: <strong>${p.dni}</strong> ${p.codigoVerificacion ? `(DV: ${p.codigoVerificacion})` : ""} · HC: ${p.historiaClinica || "—"}
            </div>
          </div>
          <span class="condicion-badge ${p.condClass}">${p.condicion}</span>
        </div>

        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:14px;font-size:12px;color:#334155;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#047857;display:block;margin-bottom:4px;">● Fecha de Ingreso</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaIngresoFmt}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Servicio: <strong>${p.servicioIngreso || p.servicio}</strong></div>
            </div>

            <div style="padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1d4ed8;display:block;margin-bottom:4px;">● ${esAlta ? "Fecha de Alta" : "Estado Actual"}</span>
              <div style="font-size:14px;font-weight:700;font-family:monospace;color:#0f172a;">${fechaAltaFmt}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Servicio: <strong>${p.servicio}</strong></div>
            </div>
          </div>

          <div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;color:#475569;">Tiempo de Estancia Hospitalaria:</span>
            <span style="font-size:12px;font-weight:800;color:#1e40af;background:#dbeafe;padding:4px 12px;border-radius:8px;">
              ${p.diasHospitalizado} ${p.diasHospitalizado === 1 ? "día" : "días"}
            </span>
          </div>

          <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:6px;">Datos para Consulta EsSalud (Clic para copiar):</span>
            <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:6px;text-align:center;">
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'Documento')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;">${p.dni}</button>
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${p.codigoVerificacion || ""}', 'DV')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;">DV: ${p.codigoVerificacion || "-"}</button>
              <button type="button" onclick="copiarDatoAlPortapapeles(event, '${formatDateDisplay(p.fechaNacimiento)}', 'Fecha Nacimiento')" style="background:#fff;padding:5px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace;font-weight:700;cursor:pointer;">${formatDateDisplay(p.fechaNacimiento)}</button>
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
  // LÓGICA ORIGINAL DE CHECKS DIARIOS
  // =========================================================================
  const loadChecksDiarios = async () => {
    try {
      const today = getLimaDate().toISOString().split("T")[0];
      const { data: checks, error } = await supabase
        .from("checks_diarios")
        .select("paciente_id")
        .eq("usuario_id", userId)
        .eq("fecha_check", today);
      if (error) throw error;

      const ids = (checks || []).map(c => c.paciente_id);
      if (ids.length === 0) return;

      const { data: pacs, error: errPacs } = await supabase
        .from("pacientes")
        .select("id, dni, apellidos, nombres, servicio")
        .in("id", ids);
      if (errPacs) throw errPacs;

      (pacs || []).forEach(p => {
        selectedPatientsMap.set(p.id, {
          dni: p.dni,
          apellidos: p.apellidos,
          nombres: p.nombres,
          servicio: p.servicio || ""
        });
      });
    } catch (e) {
      console.warn("Error loading checks:", e);
    }
  };

  const updateSelectedCounter = () => {
    if (!altaCountEl) return;
    const count = selectedPatientsMap.size;
    altaCountEl.textContent = count > 0 ? `${count} seleccionados` : "";
  };

  const resetPagination = () => {
    lastCreatedAt = null;
    firstCreatedAt = null;
    hasNext = false;
    hasPrev = false;
    currentPage = 1;
  };

  // =========================================================================
  // BÚSQUEDA Y PAGINACIÓN DE 30 EN 30 (USANDO LÓGICA ORIGINAL DE CURSOR)
  // =========================================================================
  const aplicarFiltrosQuery = (query, valDniHc, valApellidos, valSeguro, valServicio, valCondicion) => {
    if (valDniHc) {
      const limpio = valDniHc.replace(/^(C\.?E\.?|E-)\s*/i, "").trim();
      query = query.or(`dni.ilike.%${limpio}%,historia_clinica.ilike.%${limpio}%`);
    }
    if (valApellidos) {
      query = query.ilike("apellidos", `%${normalizeText(valApellidos)}%`);
    }
    if (valSeguro) {
      query = query.eq("tipo_seguro", valSeguro.toUpperCase());
    }
    if (valServicio) {
      query = query.eq("servicio", valServicio.toUpperCase());
    }
    if (valCondicion) {
      query = query.ilike("condicion", valCondicion);
    }
    return query;
  };

  const searchPatients = async (direction = "first") => {
    const valDniHc = inputDniHc ? inputDniHc.value.trim() : "";
    const valApellidos = inputApellidos ? inputApellidos.value.trim() : "";
    const valSeguro = selectSeguro ? selectSeguro.value : "";
    const valServicio = selectServicio ? selectServicio.value : "";
    const valCondicion = selectCondicion ? selectCondicion.value : "";

    try {
      if (loadingIndicator) loadingIndicator.style.display = "block";
      if (tablePacientes) tablePacientes.style.display = "none";

      let query = supabase.from("pacientes").select("*").limit(PAGE_SIZE + 1);

      if (direction === "next" && lastCreatedAt) {
        query = query.lt("creado_en", lastCreatedAt).order("creado_en", { ascending: false });
        currentPage++;
      } else if (direction === "prev" && firstCreatedAt) {
        query = query.gt("creado_en", firstCreatedAt).order("creado_en", { ascending: true });
        currentPage--;
      } else {
        query = query.order("creado_en", { ascending: false });
      }

      query = aplicarFiltrosQuery(query, valDniHc, valApellidos, valSeguro, valServicio, valCondicion);

      const { data, error } = await query;
      if (error) throw error;

      let results = data || [];
      if (direction === "prev") results.reverse();

      const pageItems = results.length > PAGE_SIZE ? results.slice(0, PAGE_SIZE) : results;

      if (pageItems.length > 0) {
        lastCreatedAt = pageItems[pageItems.length - 1].creado_en;
        firstCreatedAt = pageItems[0].creado_en;

        // Verificar si hay página anterior
        let prevQuery = supabase.from("pacientes").select("*", { count: "exact", head: true }).gt("creado_en", firstCreatedAt);
        prevQuery = aplicarFiltrosQuery(prevQuery, valDniHc, valApellidos, valSeguro, valServicio, valCondicion);
        const { count: prevCount } = await prevQuery;
        hasPrev = (prevCount || 0) > 0;

        // Verificar si hay página siguiente
        let nextQuery = supabase.from("pacientes").select("*", { count: "exact", head: true }).lt("creado_en", lastCreatedAt);
        nextQuery = aplicarFiltrosQuery(nextQuery, valDniHc, valApellidos, valSeguro, valServicio, valCondicion);
        const { count: nextCount } = await nextQuery;
        hasNext = (nextCount || 0) > 0;
      } else {
        hasNext = false;
        hasPrev = false;
      }

      // Conteo total exacto para la paginación
      let countQuery = supabase.from("pacientes").select("*", { count: "exact", head: true });
      countQuery = aplicarFiltrosQuery(countQuery, valDniHc, valApellidos, valSeguro, valServicio, valCondicion);
      const { count: total, error: countErr } = await countQuery;
      if (!countErr) totalRecords = total || 0;

      // Cargar hospitalizaciones para los pacientes de la página actual
      hospMap = new Map();
      if (pageItems.length > 0) {
        try {
          const pIds = pageItems.map(p => p.id);
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
      }

      renderRows(pageItems);
      updatePaginationUI();
    } catch (e) {
      console.error(e);
      showToast("Error al buscar pacientes", true);
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = "none";
      if (tablePacientes) tablePacientes.style.display = "table";
    }
  };

  // =========================================================================
  // RENDERIZADO CON LAS CLASES CSS ORIGINALES DE LA PRIMERA VERSIÓN
  // =========================================================================
  const renderServicioBadge = (servicio) => {
    if (!servicio) return "-";
    const colorObj = window.SERVICIO_COLORES && window.SERVICIO_COLORES[servicio.toUpperCase()];
    return colorObj
      ? `<span class="servicio-badge" style="background:${colorObj.bg};color:${colorObj.text};">${servicio}</span>`
      : `<span class="servicio-badge">${servicio}</span>`;
  };

  const formatearPrefijoDoc = (dni, tipoDocumento) => {
    const prefijo = {
      DNI: "",
      DNI_TEMPORAL: "E- ",
      CARNET_EXT: "C.E "
    }[tipoDocumento] || "";
    return prefijo ? prefijo + dni : dni;
  };

  const renderRows = (pacientes) => {
    const checkAll = document.getElementById("checkbox-select-all");
    if (checkAll) checkAll.checked = false;

    tbodyPacientes.innerHTML = "";

    if (pacientes.length === 0) {
      tbodyPacientes.innerHTML =
        '<tr><td colspan="8" style="text-align:center; padding: 30px; color:#94a3b8;">No se encontraron pacientes.</td></tr>';
      return;
    }

    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";

      const condLower = (p.condicion || "").toLowerCase();
      const condClass = condLower
        ? condLower === "hospitalizado"
          ? "cond-hospitalizado"
          : condLower === "fallecido"
          ? "cond-fallecido"
          : "cond-alta"
        : "";
      const isFallecido = condLower === "fallecido";
      const isChecked = selectedPatientsMap.has(p.id);

      const tipoDoc = p.tipo_documento || "DNI";
      const docFormateado = formatearPrefijoDoc(p.dni, tipoDoc);
      const tieneDV =
        tipoDoc === "DNI" &&
        p.codigo_verificacion !== null &&
        p.codigo_verificacion !== undefined &&
        String(p.codigo_verificacion).trim() !== "";

      // Datos de estancia hospitalaria
      const hosp = hospMap.get(p.id) || null;
      const fechaIngreso = hosp ? hosp.fecha_ingreso : null;
      const fechaAlta = hosp ? hosp.fecha_alta : null;
      const diasHospitalizado = calculateDaysHospitalized(fechaIngreso, fechaAlta);

      const modalPayload = encodeURIComponent(
        JSON.stringify({
          id: p.id,
          dni: p.dni || "-",
          docLabel: tipoDoc === "CARNET_EXT" ? "C.E" : tipoDoc === "DNI_TEMPORAL" ? "E-" : "DNI",
          codigoVerificacion: tieneDV ? String(p.codigo_verificacion).trim() : "",
          fechaNacimiento: p.fecha_nacimiento || "",
          apellidos: p.apellidos || "",
          nombres: p.nombres || "",
          historiaClinica: p.historia_clinica || "—",
          servicio: p.servicio || "",
          servicioIngreso: hosp ? hosp.servicio : p.servicio,
          condicion: p.condicion || "—",
          condClass: condClass,
          fechaIngreso: fechaIngreso,
          fechaAlta: fechaAlta,
          diasHospitalizado: diasHospitalizado
        })
      );

      tr.innerHTML = `
        <td style="text-align:center; cursor: pointer;">
          <input type="checkbox" class="patient-check" data-id="${p.id}"
            data-dni="${p.dni}"
            data-apellidos="${p.apellidos}"
            data-nombres="${p.nombres}"
            data-servicio="${p.servicio || ""}"
            ${isChecked ? "checked" : ""}
            ${isFallecido ? "disabled" : ""}>
        </td>
        <td style="white-space: nowrap;">
          <button type="button" class="inline-copy-btn" onclick="copiarDatoAlPortapapeles(event, '${p.dni}', 'Documento')" title="Clic para copiar ${docFormateado}">
            <span>${docFormateado}</span>
            <i class="fa-regular fa-copy copy-ico"></i>
          </button>
          ${tieneDV ? `
            <button type="button" class="dv-pill" onclick="copiarDatoAlPortapapeles(event, '${p.codigo_verificacion}', 'Dígito Verificador')" title="Dígito Verificador (Clic para copiar)">
              <span>DV: ${p.codigo_verificacion}</span>
            </button>
          ` : ""}
        </td>
        <td>
          <div>${p.apellidos}, ${p.nombres}</div>
          ${p.fecha_nacimiento ? `
            <button type="button" class="fnac-sub" onclick="copiarDatoAlPortapapeles(event, '${formatDateDisplay(p.fecha_nacimiento)}', 'Fecha Nacimiento')" title="Fecha de Nacimiento (Clic para copiar)">
              <i class="fa-solid fa-cake-candles" style="font-size:9.5px;color:#94a3b8;"></i>
              <span>F. Nac: ${formatDateDisplay(p.fecha_nacimiento)}</span>
              <i class="fa-regular fa-copy" style="font-size:9px;color:#94a3b8;"></i>
            </button>
          ` : ""}
        </td>
        <td>${p.historia_clinica || "—"}</td>
        <td><span class="seguro-badge">${p.tipo_seguro}</span></td>
        <td>${renderServicioBadge(p.servicio)}</td>
        <td style="white-space: nowrap;">
          <span class="condicion-badge ${condClass}">${p.condicion || "—"}</span>
          ${fechaIngreso ? `
            <button type="button" class="estancia-pill" onclick="mostrarModalRangoHospitalizacion(event, '${modalPayload}')" title="Ingreso: ${formatDateDisplay(fechaIngreso)} · Ver estancia">
              <i class="fa-regular fa-calendar-days" style="font-size:10px;"></i>
              <span>${diasHospitalizado}d</span>
            </button>
          ` : ""}
        </td>
        <td style="text-align: center;">
          <button class="btn-table-action quick-query"
            title="${tipoDoc === "DNI" ? "Consulta Rápida (DNI)" : "No disponible para este tipo de documento"}"
            data-dni="${p.dni}"
            data-tipo-documento="${tipoDoc}">
            <i class="fa-solid fa-address-card"></i>
          </button>
        </td>
      `;

      // Evento click en celda de checkbox (Checks Diarios)
      const tdCheck = tr.querySelector("td:first-child");
      tdCheck.addEventListener("click", async (e) => {
        e.stopPropagation();
        const checkInput = tdCheck.querySelector(".patient-check");
        if (!checkInput || checkInput.disabled) return;

        const today = getLimaDate().toISOString().split("T")[0];
        if (selectedPatientsMap.has(p.id)) {
          selectedPatientsMap.delete(p.id);
          checkInput.checked = false;
          try {
            await supabase
              .from("checks_diarios")
              .delete()
              .eq("paciente_id", p.id)
              .eq("usuario_id", userId)
              .eq("fecha_check", today);
          } catch (err) {
            console.warn(err);
          }
        } else {
          selectedPatientsMap.set(p.id, {
            dni: p.dni,
            apellidos: p.apellidos,
            nombres: p.nombres,
            servicio: p.servicio || ""
          });
          checkInput.checked = true;
          try {
            await supabase
              .from("checks_diarios")
              .upsert(
                { paciente_id: p.id, usuario_id: userId, fecha_check: today },
                { onConflict: "paciente_id,usuario_id,fecha_check" }
              );
          } catch (err) {
            console.warn(err);
          }
        }
        updateSelectedCounter();
      });

      // Evento click en la fila para ir al detalle
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".quick-query") || e.target.closest("td:first-child")) return;
        window.location.href = `detalle-paciente.html?id=${p.id}`;
      });

      // Evento click en el botón de Consulta Rápida
      tr.querySelector(".quick-query").addEventListener("click", (e) => {
        e.stopPropagation();
        const tDoc = e.currentTarget.dataset.tipoDocumento || "DNI";
        const dniVal = e.currentTarget.dataset.dni;
        if (tDoc === "DNI") {
          window.location.href = `../consultas/consulta-rapida.html?dni=${dniVal}&auto=true`;
        } else if (window.showSystemTooltip) {
          window.showSystemTooltip(
            "Este paciente no cuenta con\nCódigo de Verificación\npara realizar la consulta",
            true
          );
        }
      });

      tbodyPacientes.appendChild(tr);
    });
  };

  // =========================================================================
  // PAGINACIÓN DE 30 EN 30 (SOLO SE MUESTRA SI HAY MÁS DE 30 DATOS)
  // =========================================================================
  const updatePaginationUI = () => {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    // Si hay 30 o menos registros en el filtro, se limpia/oculta la paginación
    if (totalRecords <= PAGE_SIZE) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "";
    const totalPaginas = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

    if (typeof renderPaginacion === "function") {
      renderPaginacion({
        contenedor: container,
        pagina: currentPage,
        totalPaginas: totalPaginas,
        habilitarAnterior: hasPrev,
        habilitarSiguiente: hasNext,
        alAnterior: () => searchPatients("prev"),
        alSiguiente: () => searchPatients("next")
      });
    }
  };

  // =========================================================================
  // LISTENERS DE SELECCIÓN MASIVA, FILTROS Y LIMPIEZA
  // =========================================================================
  document.addEventListener("change", async (e) => {
    if (e.target.id === "checkbox-select-all") {
      const today = getLimaDate().toISOString().split("T")[0];
      const checks = [...document.querySelectorAll(".patient-check:not(:disabled)")];
      const ids = checks.map(c => c.dataset.id);

      if (e.target.checked) {
        checks.forEach(c => {
          selectedPatientsMap.set(c.dataset.id, {
            dni: c.dataset.dni,
            apellidos: c.dataset.apellidos,
            nombres: c.dataset.nombres,
            servicio: c.dataset.servicio || ""
          });
          c.checked = true;
        });
        try {
          await supabase.from("checks_diarios").upsert(
            ids.map(id => ({ paciente_id: id, usuario_id: userId, fecha_check: today })),
            { onConflict: "paciente_id,usuario_id,fecha_check" }
          );
        } catch (err) {
          console.warn(err);
        }
      } else {
        selectedPatientsMap.clear();
        document.querySelectorAll(".patient-check").forEach(c => (c.checked = false));
        try {
          await supabase
            .from("checks_diarios")
            .delete()
            .eq("usuario_id", userId)
            .eq("fecha_check", today)
            .in("paciente_id", ids);
        } catch (err) {
          console.warn(err);
        }
      }
      updateSelectedCounter();
    }
  });

  [inputDniHc, inputApellidos, selectSeguro, selectServicio, selectCondicion].forEach(el => {
    if (!el) return;
    el.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        resetPagination();
        searchPatients();
      }
    });
  });

  [selectSeguro, selectServicio, selectCondicion].forEach(el => {
    if (!el) return;
    el.addEventListener("change", () => {
      resetPagination();
      searchPatients();
    });
  });

  if (btnSearch) {
    btnSearch.addEventListener("click", () => {
      resetPagination();
      searchPatients();
    });
  }

  const btnClearInput = document.getElementById("btn-clear-input");
  if (btnClearInput) {
    btnClearInput.addEventListener("click", () => {
      if (inputDniHc) inputDniHc.value = "";
      if (document.getElementById("clear-dni-hc")) {
        document.getElementById("clear-dni-hc").style.display = "none";
      }
      if (inputApellidos) inputApellidos.value = "";
      if (document.getElementById("clear-apellidos")) {
        document.getElementById("clear-apellidos").style.display = "none";
      }
      if (selectSeguro) selectSeguro.value = "";
      if (selectServicio) selectServicio.value = "";
      if (selectCondicion) selectCondicion.value = "Hospitalizado";

      if (selectServicio && selectServicio.customDropdownUpdate) selectServicio.customDropdownUpdate();
      if (selectSeguro && selectSeguro.customDropdownUpdate) selectSeguro.customDropdownUpdate();
      if (selectCondicion && selectCondicion.customDropdownUpdate) selectCondicion.customDropdownUpdate();

      resetPagination();
      searchPatients();
    });
  }

  [
    ["clear-dni-hc", "filter-dni-hc"],
    ["clear-apellidos", "filter-apellidos"]
  ].forEach(([clearId, inputId]) => {
    const clearBtn = document.getElementById(clearId);
    const inputEl = document.getElementById(inputId);
    if (clearBtn && inputEl) {
      clearBtn.style.display = inputEl.value.trim() ? "" : "none";
      inputEl.addEventListener("input", () => {
        clearBtn.style.display = inputEl.value.trim() ? "" : "none";
      });
      clearBtn.addEventListener("click", () => {
        const hasOtherFilters =
          (selectSeguro.value || "") !== "" ||
          (selectServicio.value || "") !== "" ||
          (selectCondicion.value || "") !== "Hospitalizado";
        if (hasOtherFilters) {
          inputEl.value = "";
          clearBtn.style.display = "none";
          inputEl.focus();
        } else if (btnClearInput) {
          btnClearInput.click();
        }
      });
    }
  });

  const cleanAltaPacientesChecks = async () => {
    try {
      const altaIds = JSON.parse(localStorage.getItem("alta_pacientes_ids") || "[]");
      if (altaIds.length === 0) return;
      const today = getLimaDate().toISOString().split("T")[0];
      await supabase
        .from("checks_diarios")
        .delete()
        .eq("usuario_id", userId)
        .eq("fecha_check", today)
        .in("paciente_id", altaIds);
      altaIds.forEach(id => selectedPatientsMap.delete(id));
      localStorage.removeItem("alta_pacientes_ids");
    } catch (e) {}
  };

  // Inicialización
  await loadChecksDiarios();
  await cleanAltaPacientesChecks();
  updateSelectedCounter();
  await searchPatients();

  window.addEventListener("pageshow", async (e) => {
    if (e.persisted) {
      await loadChecksDiarios();
      await cleanAltaPacientesChecks();
      updateSelectedCounter();
      await searchPatients();
    }
  });
});