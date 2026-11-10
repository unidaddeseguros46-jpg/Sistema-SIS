// =========================================================================
// UNIDAD DE SEGUROS - TEMAS ESTACIONALES SUTILES (public/js/temas-festivos.js)
// - Navidad: 10/11 al 31/12 (fondo invierno, copos, guirnalda y Papá Noel)
// - Febrero: Mes del Amor
// - Julio: Mes Patrio (Perú)
// - Setiembre: Mes de la Primavera
// =========================================================================

(function () {
  if (window.__temasFestivosInicializado) return;
  window.__temasFestivosInicializado = true;

  const obtenerTemaActual = () => {
    const ahoraLima = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
    );
    const mes = ahoraLima.getMonth() + 1; // 1 = Enero ... 12 = Diciembre
    const dia = ahoraLima.getDate();

    // 1. Navidad: 10 de noviembre al 31 de diciembre de cada año
    if ((mes === 11 && dia >= 10) || mes === 12) {
      return "navidad";
    }
    // 2. Febrero: Mes del Amor
    if (mes === 2) {
      return "amor";
    }
    // 3. Julio: Mes Patrio
    if (mes === 7) {
      return "patrio";
    }
    // 4. Setiembre: Mes de la Primavera
    if (mes === 9) {
      return "primavera";
    }

    return null;
  };

  const tema = obtenerTemaActual();
  if (!tema) return; // Fuera de fechas festivas no aplica cambios

  const CONFIG_TEMAS = {
    navidad: {
      fondoCss: "linear-gradient(135deg, #bfcfe2 0%, #cddbe9 50%, #b8c9de 100%)",
      cantidad: 38,
      colores: [
        "rgba(255, 255, 255, 0.95)",
        "rgba(255, 255, 255, 0.85)",
        "rgba(224, 242, 254, 0.90)"
      ],
      forma: "copo",
      radioMin: 3.0,
      radioMax: 6.2,
      velocidadMin: 0.5,
      velocidadMax: 1.25
    },
    amor: {
      fondoCss: "linear-gradient(135deg, #e5d0dc 0%, #eddce5 50%, #dec5d3 100%)",
      cantidad: 24,
      colores: ["rgba(225, 29, 72, 0.45)", "rgba(244, 63, 94, 0.45)", "rgba(255, 255, 255, 0.75)"],
      forma: "corazon",
      radioMin: 3.0,
      radioMax: 5.5,
      velocidadMin: 0.45,
      velocidadMax: 0.95
    },
    patrio: {
      fondoCss: "linear-gradient(135deg, #d6d3d1 0%, #e2e0de 50%, #cbc7c4 100%)",
      cantidad: 28,
      colores: ["rgba(220, 38, 38, 0.55)", "rgba(255, 255, 255, 0.9)"],
      forma: "punto",
      radioMin: 2.8,
      radioMax: 5.0,
      velocidadMin: 0.45,
      velocidadMax: 1.05
    },
    primavera: {
      fondoCss: "linear-gradient(135deg, #c6ddd0 0%, #d4e6dc 50%, #b9d4c5 100%)",
      cantidad: 26,
      colores: ["rgba(236, 72, 153, 0.5)", "rgba(234, 179, 8, 0.5)", "rgba(255, 255, 255, 0.8)"],
      forma: "petalo",
      radioMin: 3.0,
      radioMax: 5.5,
      velocidadMin: 0.45,
      velocidadMax: 1.0
    }
  };

  const cfg = CONFIG_TEMAS[tema];

  const aplicarFondoEstacional = () => {
    if (document.getElementById("estilo-fondo-estacional")) return;
    const style = document.createElement("style");
    style.id = "estilo-fondo-estacional";
    style.innerHTML = `
      body,
      .main-wrapper,
      .main-content {
        background: ${cfg.fondoCss} !important;
        background-attachment: fixed !important;
      }

      /* Guirnalda superior navideña */
      #guirnalda-navidad-top {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 24px;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .guirnalda-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 22px;
      }

      .luz-item {
        position: relative;
        width: 8px;
        height: 11px;
        border-radius: 50% 50% 45% 45%;
        margin-top: 6px;
        animation: brilloNavidad 2.2s infinite ease-in-out;
      }

      .luz-item::before {
        content: "";
        position: absolute;
        top: -4px;
        left: 1.5px;
        width: 5px;
        height: 4px;
        background: #334155;
        border-radius: 2px 2px 0 0;
      }

      @keyframes brilloNavidad {
        0%, 100% {
          opacity: 0.45;
          transform: scale(0.94);
          filter: brightness(0.9);
        }
        50% {
          opacity: 1;
          transform: scale(1.06);
          filter: brightness(1.25);
        }
      }

      /* Papá Noel con trineo */
      #santa-trineo-navidad {
        position: fixed;
        top: 68px;
        left: -240px;
        width: 190px;
        height: 62px;
        pointer-events: none;
        z-index: 9997;
        opacity: 0;
        will-change: transform, left, opacity;
        filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.18));
      }

      @keyframes vueloSantaIda {
        0% {
          left: -220px;
          transform: translateY(0px) scaleX(1);
          opacity: 0;
        }
        6% {
          opacity: 0.92;
        }
        25% {
          transform: translateY(-8px) scaleX(1);
        }
        50% {
          transform: translateY(4px) scaleX(1);
        }
        75% {
          transform: translateY(-6px) scaleX(1);
        }
        94% {
          opacity: 0.92;
        }
        100% {
          left: calc(100vw + 220px);
          transform: translateY(0px) scaleX(1);
          opacity: 0;
        }
      }

      @keyframes vueloSantaVuelta {
        0% {
          left: calc(100vw + 220px);
          transform: translateY(0px) scaleX(-1);
          opacity: 0;
        }
        6% {
          opacity: 0.92;
        }
        25% {
          transform: translateY(-8px) scaleX(-1);
        }
        50% {
          transform: translateY(4px) scaleX(-1);
        }
        75% {
          transform: translateY(-6px) scaleX(-1);
        }
        94% {
          opacity: 0.92;
        }
        100% {
          left: -220px;
          transform: translateY(0px) scaleX(-1);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const crearGuirnaldaNavidena = () => {
    if (tema !== "navidad") return;
    if (document.getElementById("guirnalda-navidad-top")) return;

    const contenedor = document.createElement("div");
    contenedor.id = "guirnalda-navidad-top";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "guirnalda-svg");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", "0 0 1200 22");

    let pathD = "M 0 2";
    for (let x = 0; x < 1200; x += 60) {
      pathD += ` Q ${x + 30} 14 ${x + 60} 2`;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(22, 101, 52, 0.55)");
    path.setAttribute("stroke-width", "1.6");
    svg.appendChild(path);
    contenedor.appendChild(svg);

    const coloresLuces = [
      { bg: "#ef4444", shadow: "0 0 8px rgba(239, 68, 68, 0.75)" },
      { bg: "#f59e0b", shadow: "0 0 8px rgba(245, 158, 11, 0.75)" },
      { bg: "#10b981", shadow: "0 0 8px rgba(16, 185, 129, 0.75)" },
      { bg: "#3b82f6", shadow: "0 0 8px rgba(59, 130, 246, 0.75)" }
    ];

    const totalLuces = Math.max(18, Math.floor(window.innerWidth / 48));
    for (let i = 0; i < totalLuces; i++) {
      const luz = document.createElement("span");
      const c = coloresLuces[i % coloresLuces.length];
      luz.className = "luz-item";
      luz.style.background = c.bg;
      luz.style.boxShadow = c.shadow;
      luz.style.animationDelay = `${(i % 4) * 0.45}s`;
      luz.style.marginTop = i % 2 === 0 ? "5px" : "8px";
      contenedor.appendChild(luz);
    }

    document.body.appendChild(contenedor);
  };

  // =========================================================================
  // PAPÁ NOEL EN TRINEO (IZQUIERDA <-> DERECHA CADA 1 MINUTO)
  // =========================================================================
  const iniciarTrineoSanta = () => {
    if (tema !== "navidad") return;
    if (document.getElementById("santa-trineo-navidad")) return;

    const santaEl = document.createElement("div");
    santaEl.id = "santa-trineo-navidad";

    // Ilustración SVG orientada hacia la derecha (para vueloSantaIda)
    santaEl.innerHTML = `
      <svg viewBox="0 0 260 80" width="190" height="62" xmlns="http://www.w3.org/2000/svg">
        <!-- Estela de estrellitas doradas -->
        <circle cx="10" cy="48" r="2" fill="#fde047" opacity="0.85"/>
        <circle cx="22" cy="42" r="1.5" fill="#fef08a" opacity="0.7"/>
        <circle cx="18" cy="54" r="1.8" fill="#ffffff" opacity="0.8"/>
        <circle cx="34" cy="49" r="2.2" fill="#fde047" opacity="0.9"/>

        <!-- Patines dorados del trineo -->
        <path d="M 38 62 Q 65 66 96 61 Q 108 59 112 52" fill="none" stroke="#eab308" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="50" y1="53" x2="50" y2="62" stroke="#ca8a04" stroke-width="2"/>
        <line x1="84" y1="53" x2="84" y2="62" stroke="#ca8a04" stroke-width="2"/>

        <!-- Saco de regalos -->
        <ellipse cx="52" cy="41" rx="11" ry="12" fill="#15803d"/>
        <rect x="46" y="31" width="12" height="5" rx="2" fill="#dc2626"/>

        <!-- Papá Noel -->
        <circle cx="72" cy="37" r="8" fill="#dc2626"/> <!-- Cuerpo -->
        <circle cx="74" cy="27" r="5.5" fill="#fed7aa"/> <!-- Cara -->
        <path d="M 70 28 Q 75 36 80 28 Z" fill="#ffffff"/> <!-- Barba -->
        <path d="M 68 24 Q 74 14 81 24 Z" fill="#dc2626"/> <!-- Gorro -->
        <circle cx="67" cy="22" r="2.2" fill="#ffffff"/> <!-- Pompón -->

        <!-- Cuerpo del trineo rojo -->
        <path d="M 40 42 L 92 42 Q 100 42 102 52 L 44 54 Q 36 52 40 42 Z" fill="#dc2626" stroke="#991b1b" stroke-width="1.2"/>
        <path d="M 42 44 L 94 44" stroke="#facc15" stroke-width="1.8"/>

        <!-- Riendas -->
        <path d="M 80 36 Q 115 44 195 36" fill="none" stroke="#ca8a04" stroke-width="1" stroke-dasharray="3,2"/>

        <!-- Reno 1 (trasero) -->
        <g transform="translate(132, 26)">
          <ellipse cx="18" cy="18" rx="11" ry="6" fill="#92400e"/>
          <path d="M 25 16 L 31 8 L 37 10 L 34 15 Z" fill="#92400e"/>
          <path d="M 29 8 L 26 2 M 29 8 L 32 2" stroke="#78350f" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="11" y1="22" x2="7" y2="33" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
          <line x1="23" y1="22" x2="29" y2="31" stroke="#78350f" stroke-width="2" stroke-linecap="round"/>
        </g>

        <!-- Reno 2 (delantero - Rodolfo) -->
        <g transform="translate(185, 20)">
          <ellipse cx="18" cy="18" rx="12" ry="6.5" fill="#b45309"/>
          <path d="M 26 16 L 32 7 L 39 10 L 35 15 Z" fill="#b45309"/>
          <circle cx="39" cy="10" r="2.2" fill="#ef4444"/> <!-- Nariz roja -->
          <path d="M 30 7 L 27 0 M 30 7 L 34 1" stroke="#78350f" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="10" y1="22" x2="5" y2="33" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
          <line x1="24" y1="22" x2="31" y2="31" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
        </g>
      </svg>
    `;

    document.body.appendChild(santaEl);

    let haciaDerecha = true;

    const lanzarPase = () => {
      if (document.hidden) return;
      santaEl.style.animation = "none";
      // Forzar reflow para reiniciar la animación limpia
      void santaEl.offsetWidth;

      if (haciaDerecha) {
        santaEl.style.animation = "vueloSantaIda 9.5s linear forwards";
      } else {
        santaEl.style.animation = "vueloSantaVuelta 9.5s linear forwards";
      }
      haciaDerecha = !haciaDerecha;
    };

    // Primer pase a los 3 segundos de cargar y luego cada 1 minuto (60000 ms)
    setTimeout(lanzarPase, 3000);
    setInterval(lanzarPase, 60000);
  };

  const iniciarLluvia = () => {
    aplicarFondoEstacional();
    crearGuirnaldaNavidena();
    iniciarTrineoSanta();

    if (document.getElementById("canvas-tema-festivo")) return;

    const canvas = document.createElement("canvas");
    canvas.id = "canvas-tema-festivo";
    canvas.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100vw",
      "height: 100vh",
      "pointer-events: none",
      "z-index: 9998"
    ].join(";");

    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const crearParticula = (inicioAleatorioY = false) => ({
      x: Math.random() * width,
      y: inicioAleatorioY ? Math.random() * height : -15,
      radio: cfg.radioMin + Math.random() * (cfg.radioMax - cfg.radioMin),
      vy: cfg.velocidadMin + Math.random() * (cfg.velocidadMax - cfg.velocidadMin),
      vx: (Math.random() - 0.5) * 0.45,
      oscilacion: Math.random() * Math.PI * 2,
      rotacion: Math.random() * Math.PI * 2,
      velRotacion: (Math.random() - 0.5) * 0.02,
      color: cfg.colores[Math.floor(Math.random() * cfg.colores.length)]
    });

    const particulas = Array.from({ length: cfg.cantidad }, () => crearParticula(true));

    const dibujarCopo = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotacion);
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
      ctx.shadowBlur = 2;
      ctx.lineWidth = 1.4;

      if (p.radio < 4.0) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radio * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const r = p.radio * 1.15;
        for (let i = 0; i < 3; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.lineTo(r, 0);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const dibujarCorazon = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      const s = p.radio * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s * 1.1, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.5, -s * 1.1, s, -s * 0.4, 0, s * 0.4);
      ctx.fill();
      ctx.restore();
    };

    const dibujarPetalo = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotacion);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radio * 1.1, p.radio * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const dibujarPunto = (p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio * 0.85, 0, Math.PI * 2);
      ctx.fill();
    };

    const animar = () => {
      if (!document.hidden) {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particulas.length; i++) {
          const p = particulas[i];
          p.oscilacion += 0.015;
          p.x += p.vx + Math.sin(p.oscilacion) * 0.25;
          p.y += p.vy;
          p.rotacion += p.velRotacion;

          if (cfg.forma === "copo") dibujarCopo(p);
          else if (cfg.forma === "corazon") dibujarCorazon(p);
          else if (cfg.forma === "petalo") dibujarPetalo(p);
          else dibujarPunto(p);

          if (p.y > height + 15) {
            particulas[i] = crearParticula(false);
          }
          if (p.x > width + 15) p.x = -15;
          if (p.x < -15) p.x = width + 15;
        }
      }
      requestAnimationFrame(animar);
    };

    requestAnimationFrame(animar);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarLluvia);
  } else {
    iniciarLluvia();
  }
})();