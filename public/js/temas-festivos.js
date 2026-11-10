// =========================================================================
// UNIDAD DE SEGUROS - TEMAS ESTACIONALES SUTILES (public/js/temas-festivos.js)
// - Navidad: 10/11 al 31/12 (fondo invierno medio + copos de nieve nítidos)
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
    `;
    document.head.appendChild(style);
  };

  const iniciarLluvia = () => {
    aplicarFondoEstacional();

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