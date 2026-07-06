window.SERVICIO_COLORES = {
  "CIRUGÍA":       {text: "#dc2626", bg: "#fef2f2"},
  "EMERGENCIA":    {text: "#d97706", bg: "#fffbeb"},
  "GINECOLOGÍA":   {text: "#db2777", bg: "#fdf2f8"},
  "MEDICINA":      {text: "#2563eb", bg: "#eff6ff"},
  "NEONATOLOGÍA":  {text: "#0d9488", bg: "#f0fdfa"},
  "PEDIATRÍA":     {text: "#0891b2", bg: "#ecfeff"},
  "PUERPERIO":     {text: "#9333ea", bg: "#faf5ff"},
  "SALUD MENTAL":  {text: "#4f46e5", bg: "#eef2ff"},
  "SHOCK TRAUMA":  {text: "#ea580c", bg: "#fff7ed"},
  "UVI":           {text: "#e11d48", bg: "#fff1f2"}
};

(function () {
  function aplicarColores() {
    var tbody = document.getElementById('tabla-pacientes');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function (row) {
      var cell = row.cells[4];
      if (!cell) return;
      var srv = cell.textContent.trim();
      if (!srv || srv === '-') return;
      var c = window.SERVICIO_COLORES[srv.toUpperCase()];
      if (!c) return;
      cell.innerHTML = '<span class="servicio-badge" style="background:' + c.bg + ';color:' + c.text + ';">' + srv + '</span>';
    });
  }

  aplicarColores();

  var tbody = document.getElementById('tabla-pacientes');
  if (tbody) {
    var obs = new MutationObserver(aplicarColores);
    obs.observe(tbody, { childList: true });
  }
})();
