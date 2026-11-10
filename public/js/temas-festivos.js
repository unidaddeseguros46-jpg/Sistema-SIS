// =========================================================================
// UNIDAD DE SEGUROS - TEMAS ESTACIONALES SUTILES (public/js/temas-festivos.js)
// - Navidad: 10/11 al 31/12 (copos de nieve sutiles)
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
  if (!tema) return; // Fuera de fechas festivas no renderiza nada

  const CONFIG_TEMAS = {
    navidad: {
      cantidad: 32,
      colores: ["rgba(186, 230, 253, 0.75)", "rgba(255, 255, 255, 0.85)", "rgba(147, 197, 253, 0.55)"],
      forma: "copo",
      velocidadMin: 0.45,
      velocidadMax: 1.15
    },
    amor: {
      cantidad: 20,
      colores: ["rgba(244, 114, 182, 0.35)", "rgba(251, 113, 133, 0.35)", "rgba(253, 164, 175, 0.4)"],
      forma: "corazon",
      velocidadMin: 0.4,
      velocidadMax: 0.9
    },
    patrio: {
      cantidad: 24,
      colores: ["rgba(220, 38, 38, 0.32)", "rgba(255, 255, 255, 0.65)"],
      forma: "punto",
      velocidadMin: 0.45,
      velocidadMax: 1.0
    },
    primavera: {
      cantidad: 24,
      colores: ["rgba(244, 114, 182, 0.35)", "rgba(250, 204, 21, 0.35)", "rgba(74, 222, 128, 0.35)"],
      forma: "petalo",
      velocidadMin: 0.4,
      velocidadMax: 0.95
    }
  };

  const cfg = CONFIG_TEMAS[tema];

  const iniciarLluvia = () => {
    if (document.getElementById("canvas-tema-festivo")) return;

    const canvas = document.createElement("canvas");
    canvas.id = "canvas-tema-festivo";
    canvas.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "width: 100vw",
      "height: 100vh",
      "pointer-events: none", // Clave: nunca bloquea clics ni scroll
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
      radio: 2.2 + Math.random() * 3.2,
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
      ctx.lineWidth = 1.1;

      if (p.radio < 3.5) {
        ctx.beginPath();
        ctx.arc(0, 0, p.radio * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const r = p.radio * 1.1;
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