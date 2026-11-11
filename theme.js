/* Thème clair / sombre : appliqué avant l'affichage pour éviter un flash, mémorisé sur l'appareil */
(function () {
  var KEY = "neopix_theme", root = document.documentElement;
  try { var t = localStorage.getItem(KEY); if (t === "light" || t === "dark") root.dataset.theme = t; } catch (e) {}
  window.toggleTheme = function () {
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) {}
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", root.dataset.theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre");
    });
  };
  document.addEventListener("click", function (e) { if (e.target.closest("[data-theme-toggle]")) window.toggleTheme(); });
})();
