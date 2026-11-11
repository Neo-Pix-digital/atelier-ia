/* Atelier IA · NéoPix digital — espace animateur (version 1.2) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY_STORE = "neopix_admin_key";
  var A = { key: store(KEY_STORE) || "", data: null, session: store("neopix_atelier_session") || "", tab: "suivi",
            open: {}, editId: null, lastMsg: 0, msgs: [], unread: 0, timer: null, filter: "all", q: "",
            seenHelp: null, baseTitle: document.title };
  var TITLES = { suivi: ["Tableau de bord", "Mis à jour en direct"], chat: ["Chat", "Messages de la session"],
                 contenu: ["Contenu", "Modules de l'atelier, communs à toutes les sessions"], sessions: ["Sessions et codes", "Un code d'accès par atelier"],
                 reglages: ["Réglages", "Données personnelles et vérification"] };
  var ICON = {
    users: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8"/>',
    live: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    check: '<path d="M5 12l5 5L20 7"/>', clock: '<path d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-8a1.5 1.5 0 0 1 3 0V12M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a7 7 0 0 1-5.3-2.4L4 16.5a1.6 1.6 0 0 1 2.3-2.2L8 16"/>'
  };
  function svg(p, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (w || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; }
  function toast(t) { var el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2800); }
  function participantURL(code) { return new URL("./?code=" + encodeURIComponent(code), location.href).href.replace("admin.html", ""); }
  function initials(n) { return String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""); }
  function avClass(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return "c" + (Math.abs(h) % 4); }
  function validDate(v) { var d = new Date(v); return isNaN(d.getTime()) || typeof v !== "string" ? null : d; }

  /* ---------- Connexion ---------- */
  $("keyForm").addEventListener("submit", async function (e) {
    e.preventDefault(); $("keyErr").textContent = ""; $("keyBtn").disabled = true; $("keyBtn").textContent = "Connexion…";
    A.key = $("key").value.trim();
    try { await load(); store(KEY_STORE, A.key); start(); } catch (err) { $("keyErr").textContent = err.message; }
    $("keyBtn").disabled = false; $("keyBtn").textContent = "Entrer";
  });
  $("logout").addEventListener("click", function () { store(KEY_STORE, null); location.reload(); });

  async function load() {
    A.data = await rpc("atelier_admin_overview", { p_key: A.key });
    var ids = A.data.sessions.map(function (s) { return s.id; });
    if (ids.indexOf(A.session) < 0) A.session = ids[0] || "";
    A.updated = new Date();
  }
  function start() {
    $("gate").hidden = true; $("app").hidden = false;
    renderAll(); pollChat();
    clearInterval(A.timer);
    A.timer = setInterval(async function () {
      if (document.hidden) return;
      try { await load(); renderLive(); } catch (e) {}
      pollChat();
    }, 5000);
  }

  /* ---------- Navigation ---------- */
  function goto(tab) {
    A.tab = tab;
    document.querySelectorAll("[data-tab]").forEach(function (x) { if (x.dataset.tab === tab) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
    document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
    $("sessionSel").hidden = tab === "contenu" || tab === "sessions" || tab === "reglages";
    $("pageTitle").textContent = TITLES[tab][0];
    if (tab === "chat") { A.unread = 0; updateBadge(); var box = $("msgs"); box.scrollTop = box.scrollHeight; setTimeout(function () { $("chatInput").focus(); }, 50); }
    renderAll();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { goto(b.dataset.tab); }); });
  document.addEventListener("click", function (e) { var g = e.target.closest("[data-goto]"); if (g) goto(g.dataset.goto); });

  function curSession() { return (A.data.sessions || []).find(function (s) { return s.id === A.session; }); }
  function renderAll() { renderHead(); renderSessionSel(); renderSessCard(); renderSuivi(); renderModList(); renderSessions(); renderSettings(); }
  function renderLive() { renderHead(); renderSessionSel(); renderSessCard(); if (A.tab === "suivi") renderSuivi(); else renderHelpCount(); }
  function renderHead() {
    $("pageSub").textContent = A.tab === "suivi" || A.tab === "chat"
      ? TITLES[A.tab][1] + " · actualisé à " + A.updated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : TITLES[A.tab][1];
  }

  function renderSessionSel() {
    var sel = $("sessionSel"), html = A.data.sessions.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === A.session ? " selected" : "") + '>' + esc(s.label) + " · code " + esc(s.code) + (s.active ? "" : " (fermée)") + "</option>";
    }).join("");
    if (sel.dataset.h !== html) { sel.innerHTML = html || "<option>Aucune session</option>"; sel.dataset.h = html; }
  }
  $("sessionSel").addEventListener("change", function () {
    A.session = this.value; store("neopix_atelier_session", A.session);
    A.lastMsg = 0; A.msgs = []; A.seenHelp = null; $("msgs").innerHTML = '<p class="empty" id="msgsEmpty">Aucun message pour cette session.</p>';
    renderAll(); pollChat();
  });
  function renderSessCard() {
    var s = curSession();
    if (!s) { $("sessCard").innerHTML = '<span class="t">Aucune session</span><button class="linkbtn small" type="button" data-goto="sessions">Créer une session</button>'; return; }
    var n = s.participants.length, max = s.max_participants || 30;
    $("sessCard").innerHTML = '<span class="muted small">Session affichée</span><span class="t">' + esc(s.label) + "</span>" +
      '<span class="muted">Code <code>' + esc(s.code) + "</code></span>" +
      '<div class="bar" style="margin-top:6px"><i style="width:' + Math.min(100, Math.round(n / max * 100)) + '%"></i></div>' +
      '<span class="muted small">' + n + " participant" + (n > 1 ? "s" : "") + " sur " + max + " places</span>";
  }

  /* ---------- Tableau de bord ---------- */
  function online(p) { return Date.now() - new Date(p.last_seen).getTime() < 60000; }
  function doneOf(p) { return (p.progress && p.progress.done) || {}; }
  function doneCount(p) { var d = doneOf(p); return A.data.modules.filter(function (m) { return d[m.id]; }).length; }
  function hasFb(p) { return !!(p.feedback && p.feedback.note); }

  function renderHelpCount() {
    var s = curSession(), n = s ? s.participants.filter(function (p) { return p.help_at; }).length : 0;
    $("helpCount").hidden = !n; $("helpCount").textContent = n;
    document.title = (n ? "(" + n + ") Aide demandée · " : "") + A.baseTitle;
    // Signal sonore discret à chaque nouvelle demande d'aide
    var ids = s ? s.participants.filter(function (p) { return p.help_at; }).map(function (p) { return p.id; }) : [];
    if (A.seenHelp) {
      var fresh = ids.filter(function (id) { return A.seenHelp.indexOf(id) < 0; });
      if (fresh.length) {
        beep();
        var who = s.participants.find(function (p) { return p.id === fresh[0]; });
        toast((who ? who.name : "Un participant") + " demande de l'aide.");
      }
    }
    A.seenHelp = ids;
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ctx = beep.ctx || (beep.ctx = new C()), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  }

  function renderSuivi() {
    renderHelpCount();
    if (A.tab !== "suivi") return;
    var s = curSession(), mods = A.data.modules;
    if (!s) {
      $("alerts").innerHTML = ""; $("kpis").innerHTML = ""; $("modBars").innerHTML = ""; $("feed").innerHTML = ""; $("crit").innerHTML = "";
      $("rows").innerHTML = '<tr><td colspan="6"><div class="empty-state">Créez d\'abord une session dans « Sessions et codes ».</div></td></tr>'; return;
    }
    var ps = s.participants, n = ps.length, max = s.max_participants || 30;
    var fb = ps.filter(hasFb), on = ps.filter(online);
    var avgNote = fb.length ? fb.reduce(function (a, p) { return a + (+p.feedback.note || 0); }, 0) / fb.length : null;
    var pay = fb.filter(function (p) { return p.feedback.prix && p.feedback.prix !== "Rien"; }).length;
    var suite = fb.filter(function (p) { return p.feedback.suite === "Oui, contactez-moi"; }).length;
    var totalDone = ps.reduce(function (a, p) { return a + doneCount(p); }, 0);
    var avgProg = n ? Math.round(totalDone / n / (mods.length || 1) * 100) : 0;

    // Alertes d'aide
    var helps = ps.filter(function (p) { return p.help_at; }).sort(function (a, b) { return new Date(a.help_at) - new Date(b.help_at); });
    $("alerts").innerHTML = helps.map(function (p) {
      var m = mods.find(function (x) { return x.id === p.current_module; });
      return '<div class="alert"><span class="ico">' + svg(ICON.hand, 17) + '</span><div class="txt"><strong>' + esc(p.name) + "</strong> demande de l'aide" +
        "<small>" + (m ? "Module « " + esc(m.title) + " » · " : "") + timeAgo(p.help_at) + "</small></div>" +
        '<button class="btn sm" type="button" data-helpdone="' + p.id + '">C\'est réglé</button></div>';
    }).join("");

    // Indicateurs
    var kp = [
      ["Participants", n, n + " inscrit" + (n > 1 ? "s" : "") + " sur " + max + " places", Math.round(n / max * 100), ICON.users],
      ["En ligne", on.length, n ? on.length + " sur " + n + " actifs depuis 1 minute" : "Personne pour l'instant", n ? Math.round(on.length / n * 100) : 0, ICON.live],
      ["Avancée moyenne", avgProg + " %", totalDone + " module" + (totalDone > 1 ? "s" : "") + " terminé" + (totalDone > 1 ? "s" : "") + " au total", avgProg, ICON.bars],
      ["Note moyenne", avgNote == null ? "–" : (Math.round(avgNote * 10) / 10).toString().replace(".", ",") + "/10", fb.length + " avis reçu" + (fb.length > 1 ? "s" : "") + " sur " + n, avgNote == null ? 0 : avgNote * 10, ICON.star]
    ];
    $("kpis").innerHTML = kp.map(function (k, i) {
      return '<div class="card kpi" style="animation-delay:' + (i * 0.04) + 's"><div class="top"><span>' + k[0] + '</span><span class="ico">' + svg(k[4]) + "</span></div>" +
        '<div class="v">' + k[1] + '</div><div class="bar"><i style="width:' + Math.max(0, Math.min(100, k[3])) + '%"></i></div><div class="s">' + k[2] + "</div></div>";
    }).join("");

    // Avancée par module
    $("modBars").innerHTML = mods.map(function (m) {
      var c = ps.filter(function (p) { return doneOf(p)[m.id]; }).length;
      return '<div class="modrow"><span class="n" title="' + esc(m.title) + '"><span class="tt">' + esc(m.title) + "</span>" + (m.id === s.current_module ? '<span class="live">EN COURS</span>' : "") + "</span>" +
        '<div class="bar"><i style="width:' + (n ? Math.round(c / n * 100) : 0) + '%"></i></div><span class="c">' + c + "</span></div>";
    }).join("");
    var psel = $("pilotSel"), ph = mods.map(function (m, i) { return '<option value="' + esc(m.id) + '"' + (m.id === s.current_module ? " selected" : "") + ">" + (i + 1) + ". " + esc(m.title) + "</option>"; }).join("");
    if (psel.dataset.h !== ph + s.id && document.activeElement !== psel) { psel.innerHTML = ph; psel.dataset.h = ph + s.id; }
    $("pilotFree").disabled = !s.current_module;

    // Activité récente
    renderFeed(s);

    // Décision
    var crit = [
      ["Note moyenne", "8/10 ou plus", avgNote == null ? "–" : (Math.round(avgNote * 10) / 10).toString().replace(".", ",") + "/10", avgNote == null ? "wait" : avgNote >= 8 ? "ok" : avgNote >= 7 ? "wait" : "ko"],
      ["Prêts à payer", "la moitié ou plus", fb.length ? pay + "/" + fb.length : "–", !fb.length ? "wait" : pay / fb.length >= 0.5 ? "ok" : pay / fb.length >= 1 / 3 ? "wait" : "ko"],
      ["Demandes de suite", "2 ou plus", String(suite), suite >= 2 ? "ok" : "wait"],
      ["Avis reçus", "tous les participants", fb.length + "/" + n, n && fb.length === n ? "ok" : "wait"]
    ];
    $("crit").innerHTML = crit.map(function (c) {
      return '<div class="r"><span class="mk ' + c[3] + '">' + svg(c[3] === "ok" ? ICON.check : c[3] === "ko" ? ICON.x : ICON.clock, 14) + '</span>' +
        '<span class="l"><b>' + c[0] + "</b><small>Objectif : " + c[1] + '</small></span><span class="v">' + c[2] + "</span></div>";
    }).join("");

    renderRows(s);
  }

  function renderFeed(s) {
    var ev = [], mods = A.data.modules;
    s.participants.forEach(function (p) {
      ev.push({ at: new Date(p.created_at), who: p.name, what: "a rejoint l'atelier" });
      Object.keys(doneOf(p)).forEach(function (id) {
        var d = validDate(doneOf(p)[id]), m = mods.find(function (x) { return x.id === id; });
        if (d && m && m.kind !== "feedback") ev.push({ at: d, who: p.name, what: "a terminé « " + m.title + " »" });
      });
      if (p.feedback && p.feedback.sent_at) ev.push({ at: new Date(p.feedback.sent_at), who: p.name, what: "a envoyé son avis : " + p.feedback.note + "/10" + (p.feedback.prix ? ", prêt à payer « " + p.feedback.prix + " »" : "") });
      if (p.help_at) ev.push({ at: new Date(p.help_at), who: p.name, what: "demande de l'aide" });
    });
    A.msgs.forEach(function (m) { if (!m.is_staff) ev.push({ at: new Date(m.created_at), who: m.author, what: "dans le chat : « " + (m.body.length > 70 ? m.body.slice(0, 70) + "…" : m.body) + " »" }); });
    ev.sort(function (a, b) { return b.at - a.at; });
    $("feed").innerHTML = ev.length ? ev.slice(0, 7).map(function (e) {
      return '<div class="it"><span class="av ' + avClass(e.who) + '" aria-hidden="true">' + esc(initials(e.who)) + '</span><div><div><strong>' + esc(e.who) + "</strong> " + esc(e.what) + '</div><div class="w">' + timeAgo(e.at.toISOString()) + "</div></div></div>";
    }).join("") : '<div class="empty-state">L\'activité des participants apparaîtra ici.<br>Lien à partager : <strong>' + esc(participantURL(s.code)) + "</strong></div>";
  }

  function status(p) {
    if (p.help_at) return ["help", "Demande d'aide"];
    if (hasFb(p) && doneCount(p) >= A.data.modules.length) return ["done", "Terminé"];
    if (online(p)) return ["on", "En ligne"];
    return ["off", timeAgo(p.last_seen)];
  }
  function renderRows(s) {
    var mods = A.data.modules, q = A.q.toLowerCase();
    var list = s.participants.filter(function (p) {
      if (q && (p.name + " " + (p.business || "")).toLowerCase().indexOf(q) < 0) return false;
      if (A.filter === "on") return online(p);
      if (A.filter === "help") return !!p.help_at;
      if (A.filter === "fb") return hasFb(p);
      return true;
    });
    if (!s.participants.length) { $("rows").innerHTML = '<tr><td colspan="6"><div class="empty-state">Personne n\'est encore connecté.<br>Lien à partager : <strong>' + esc(participantURL(s.code)) + "</strong></div></td></tr>"; return; }
    if (!list.length) { $("rows").innerHTML = '<tr><td colspan="6"><div class="empty-state">Aucun participant ne correspond à ce filtre.</div></td></tr>'; return; }
    var rows = "";
    list.forEach(function (p) {
      var d = doneOf(p), cur = mods.find(function (m) { return m.id === p.current_module; }), st = status(p);
      var bar = mods.map(function (m) { return '<i class="' + (d[m.id] ? "d" : m.id === p.current_module ? "c" : "") + '" title="' + esc(m.title) + '"></i>'; }).join("");
      rows += '<tr><td><div class="who"><span class="av ' + avClass(p.name) + '" aria-hidden="true">' + esc(initials(p.name)) + '</span><div><div class="n">' + esc(p.name) + '</div><div class="b">' + esc(p.business || "—") + "</div></div></div></td>" +
        '<td><div class="minibar" aria-label="' + doneCount(p) + " modules terminés sur " + mods.length + '">' + bar + '</div><span class="small muted">' + doneCount(p) + "/" + mods.length + "</span></td>" +
        "<td>" + (cur ? esc(cur.title) : "—") + "</td>" +
        '<td><span class="pill ' + st[0] + '">' + esc(st[1]) + "</span></td>" +
        "<td>" + (hasFb(p) ? "<strong>" + esc(p.feedback.note) + "/10</strong>" : '<span class="muted">—</span>') + "</td>" +
        '<td style="text-align:right"><button class="btn sm" type="button" data-toggle="' + p.id + '" aria-expanded="' + !!A.open[p.id] + '">' + (A.open[p.id] ? "Masquer" : "Détails") + "</button></td></tr>";
      if (A.open[p.id]) {
        var plan = ((p.progress && p.progress.plan) || []).filter(Boolean);
        var items = [["Plan d'action", plan.length ? plan.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") : "Pas encore rempli"],
                     ["Connecté depuis", new Date(p.created_at).toLocaleString("fr-FR")]];
        FEEDBACK_QUESTIONS.forEach(function (q2) { if (q2.type !== "consent" && p.feedback && p.feedback[q2.id]) items.push([q2.label, p.feedback[q2.id]]); });
        if (p.feedback && p.feedback.contact) items.push(["Accord pour être recontacté", p.contact_consent ? "Oui" : "Non"]);
        rows += '<tr class="detail"><td colspan="6"><dl>' + items.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>" +
          '<button class="btn sm danger" type="button" style="margin-top:12px" data-delp="' + p.id + '">Retirer ce participant</button></td></tr>';
      }
    });
    $("rows").innerHTML = rows;
  }
  $("search").addEventListener("input", function () { A.q = this.value.trim(); var s = curSession(); if (s) renderRows(s); });
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    A.filter = b.dataset.f;
    this.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    var s = curSession(); if (s) renderRows(s);
  });
  $("rows").addEventListener("click", async function (e) {
    var t = e.target.closest("[data-toggle]"), d = e.target.closest("[data-delp]");
    if (t) { A.open[t.dataset.toggle] = !A.open[t.dataset.toggle]; renderRows(curSession()); }
    if (d && confirm("Retirer ce participant et ses réponses ? Cette action est définitive.")) {
      try { await rpc("atelier_admin_participant_delete", { p_key: A.key, p_id: d.dataset.delp }); await load(); renderSuivi(); toast("Participant retiré."); } catch (err) { toast(err.message); }
    }
  });
  $("alerts").addEventListener("click", async function (e) {
    var b = e.target.closest("[data-helpdone]"); if (!b) return;
    b.disabled = true;
    try { await rpc("atelier_admin_help_clear", { p_key: A.key, p_participant: b.dataset.helpdone }); await load(); renderSuivi(); toast("Demande d'aide réglée."); }
    catch (err) { b.disabled = false; toast(err.message); }
  });

  /* ---------- Module affiché à tous ---------- */
  async function setPilot(mod) {
    var s = curSession(); if (!s) return;
    try {
      await rpc("atelier_admin_pilot", { p_key: A.key, p_session: s.id, p_module: mod });
      await load(); renderSuivi();
      toast(mod ? "Les participants voient maintenant ce module en cours." : "Navigation libre pour les participants.");
    } catch (err) { toast(err.message); }
  }
  $("pilotSet").addEventListener("click", function () { setPilot($("pilotSel").value); });
  $("pilotFree").addEventListener("click", function () { setPilot(null); });

  /* ---------- Chat ---------- */
  function updateBadge() { var b = $("unread"); b.hidden = !A.unread; b.textContent = A.unread > 9 ? "9+" : A.unread; }
  async function pollChat() {
    if (!A.session) return;
    var sid = A.session;
    try {
      var list = await rpc("atelier_chat", { p_token: null, p_key: A.key, p_session: sid, p_after: A.lastMsg });
      if (sid !== A.session || !list.length) return;
      var box = $("msgs"), first = A.lastMsg === 0;
      if ($("msgsEmpty")) $("msgsEmpty").hidden = true;
      list.forEach(function (m) {
        if (m.id <= A.lastMsg) return; A.lastMsg = m.id; A.msgs.push(m); if (A.msgs.length > 60) A.msgs.shift();
        var el = document.createElement("div");
        el.className = "msg" + (m.is_staff ? " mine" : "");
        el.innerHTML = '<p class="who">' + (m.is_staff ? "Vous (animateur)" : esc(m.author)) + " · " + hhmm(m.created_at) + '</p><div class="bubble"></div>';
        el.querySelector(".bubble").textContent = m.body; box.appendChild(el);
        if (!first && !m.is_staff && A.tab !== "chat") A.unread++;
      });
      updateBadge(); box.scrollTop = box.scrollHeight;
      if (A.tab === "suivi") { var s = curSession(); if (s) renderFeed(s); }
    } catch (e) {}
  }
  $("chatForm").addEventListener("submit", async function (e) {
    e.preventDefault(); var t = $("chatInput").value.trim(); if (!t || !A.session) return;
    $("chatInput").value = "";
    try { await rpc("atelier_send", { p_token: null, p_key: A.key, p_session: A.session, p_body: t }); pollChat(); }
    catch (err) { $("chatInput").value = t; toast(err.message); }
  });
  $("chatInput").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chatForm").requestSubmit(); } });

  /* ---------- Contenu ---------- */
  function renderModList() {
    if (A.tab !== "contenu") return;
    var mods = A.data.modules;
    if (A.editId === null && mods[0]) { A.editId = mods[0].id; fillForm(mods[0]); }
    $("modList").innerHTML = mods.map(function (m, i) {
      return '<li><button class="pick" type="button" data-pick="' + esc(m.id) + '" aria-current="' + (m.id === A.editId) + '">' + (i + 1) + ". " + esc(m.title) + "</button>" +
        '<button class="btn sm ghost" type="button" data-move="' + i + ':-1" aria-label="Monter « ' + esc(m.title) + ' »"' + (i ? "" : " disabled") + ">↑</button>" +
        '<button class="btn sm ghost" type="button" data-move="' + i + ':1" aria-label="Descendre « ' + esc(m.title) + ' »"' + (i < mods.length - 1 ? "" : " disabled") + ">↓</button></li>";
    }).join("");
  }
  $("modList").addEventListener("click", async function (e) {
    var p = e.target.closest("[data-pick]"), mv = e.target.closest("[data-move]");
    if (p) { var m = A.data.modules.find(function (x) { return x.id === p.dataset.pick; }); A.editId = m.id; fillForm(m); renderModList(); }
    if (mv) {
      var parts = mv.dataset.move.split(":"), i = +parts[0], j = i + (+parts[1]), mods = A.data.modules.slice();
      var tmp = mods[i]; mods[i] = mods[j]; mods[j] = tmp;
      try {
        for (var k = 0; k < mods.length; k++) {
          if (mods[k].position !== (k + 1) * 10) await rpc("atelier_admin_module", { p_key: A.key, p_module: Object.assign({}, mods[k], { position: (k + 1) * 10 }) });
        }
        await load(); renderModList();
      } catch (err) { toast(err.message); }
    }
  });
  $("addMod").addEventListener("click", function () {
    A.editId = "";
    fillForm({ id: "", title: "Nouveau module", duration: "10 min", summary: "", body: "## Titre de section\nVotre texte ici.", prompts: [], image_url: "", video_url: "", kind: "lesson",
               position: ((A.data.modules.length + 1) * 10) });
    renderModList(); $("fTitle").focus(); $("fTitle").select();
  });

  function promptRow(v) {
    var d = document.createElement("div"); d.className = "promptItem";
    d.innerHTML = '<textarea maxlength="2000" aria-label="Modèle de demande"></textarea><button class="btn sm ghost" type="button" aria-label="Supprimer ce modèle">✕</button>';
    d.querySelector("textarea").value = v || "";
    d.querySelector("button").onclick = function () { d.remove(); updatePreview(); };
    d.querySelector("textarea").addEventListener("input", updatePreview);
    $("fPrompts").appendChild(d);
  }
  $("addPrompt").addEventListener("click", function () { promptRow(""); });

  var editing = null;
  function fillForm(m) {
    editing = m;
    $("fTitle").value = m.title || ""; $("fDuration").value = m.duration || ""; $("fSummary").value = m.summary || "";
    $("fBody").value = m.body || ""; $("fImage").value = m.image_url || ""; $("fVideo").value = m.video_url || ""; $("fKind").value = m.kind || "lesson";
    $("fPrompts").innerHTML = ""; (m.prompts || []).forEach(promptRow);
    $("delMod").hidden = !m.id; $("modStatus").textContent = "";
    updatePreview();
  }
  function formModule() {
    return { id: editing && editing.id || "", position: editing && editing.position || 100,
      title: $("fTitle").value.trim(), duration: $("fDuration").value.trim(), summary: $("fSummary").value.trim(), body: $("fBody").value,
      image_url: $("fImage").value.trim(), video_url: $("fVideo").value.trim(), kind: $("fKind").value,
      prompts: Array.prototype.map.call($("fPrompts").querySelectorAll("textarea"), function (t) { return t.value.trim(); }).filter(Boolean) };
  }
  function updatePreview() {
    var m = formModule(), idx = Math.max(0, A.data.modules.findIndex(function (x) { return x.id === m.id; }));
    $("preview").innerHTML = '<h1 style="font-size:26px">' + esc(m.title) + "</h1>" + (m.summary ? '<p class="lead">' + esc(m.summary) + "</p>" : "") +
      (m.video_url ? videoHTML(m.video_url) : m.image_url ? '<div class="media"><img src="' + esc(m.image_url) + '" alt=""></div>' : '<div class="media">' + defaultArt(idx) + "</div>") +
      '<div class="body">' + renderBody(m.body).replace('<div data-slot="plan"></div>', '<div class="plan muted small">[Ici : les 3 champs du plan d\'action]</div>') + "</div>" +
      (m.prompts.length ? '<section class="prompts"><h2>Modèles à copier</h2>' + m.prompts.map(function (p) { return '<div class="prompt"><p>' + esc(p) + "</p></div>"; }).join("") + "</section>" : "") +
      (m.kind === "feedback" ? '<div class="plan muted small">[Ici : le questionnaire de retour en ' + FEEDBACK_QUESTIONS.length + " questions]</div>" : "");
  }
  ["fTitle", "fSummary", "fBody", "fImage", "fVideo", "fKind"].forEach(function (id) { $(id).addEventListener("input", function () { clearTimeout(updatePreview.t); updatePreview.t = setTimeout(updatePreview, 250); }); });

  $("modForm").addEventListener("submit", async function (e) {
    e.preventDefault(); $("saveMod").disabled = true; $("modStatus").textContent = "Enregistrement…";
    try {
      var id = await rpc("atelier_admin_module", { p_key: A.key, p_module: formModule() });
      await load(); A.editId = id; fillForm(A.data.modules.find(function (m) { return m.id === id; })); renderModList();
      $("modStatus").textContent = "Enregistré ✓ Les participants le voient au prochain changement de module.";
    } catch (err) { $("modStatus").textContent = err.message; }
    $("saveMod").disabled = false;
  });
  $("delMod").addEventListener("click", async function () {
    if (!editing || !editing.id || !confirm("Supprimer définitivement le module « " + editing.title + " » ?")) return;
    try { await rpc("atelier_admin_module_delete", { p_key: A.key, p_id: editing.id }); await load(); A.editId = null; renderModList(); toast("Module supprimé."); } catch (err) { toast(err.message); }
  });

  async function upload(file, field) {
    if (file.size > 50 * 1024 * 1024) { toast("Fichier trop lourd (50 Mo maximum). Pour une vidéo, utilisez YouTube."); return; }
    $("modStatus").textContent = "Import en cours…";
    try {
      var ticket = await rpc("atelier_admin_upload_ticket", { p_key: A.key });
      var safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+/, "");
      var path = ticket + "/" + Date.now() + "-" + safe;
      var r = await fetch(SB_URL + "/storage/v1/object/" + MEDIA_BUCKET + "/" + path, { method: "POST",
        headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": file.type, "x-upsert": "false" }, body: file });
      if (!r.ok) throw new Error("Import refusé (" + r.status + "). Vérifiez le format : image ou vidéo MP4/WebM.");
      $(field).value = SB_URL + "/storage/v1/object/public/" + MEDIA_BUCKET + "/" + path;
      updatePreview(); $("modStatus").textContent = "Fichier importé. Pensez à enregistrer le module.";
    } catch (err) { $("modStatus").textContent = err.message; }
  }
  $("upImage").addEventListener("change", function () { if (this.files[0]) upload(this.files[0], "fImage"); this.value = ""; });
  $("upVideo").addEventListener("change", function () { if (this.files[0]) upload(this.files[0], "fVideo"); this.value = ""; });

  /* ---------- Sessions ---------- */
  function renderSessions() {
    if (A.tab !== "sessions") return;
    var list = A.data.sessions;
    $("sessList").innerHTML = list.length ? list.map(function (s) {
      return '<form class="sess" data-sid="' + s.id + '">' +
        '<label class="field" style="margin:0"><span>Nom</span><input type="text" name="label" value="' + esc(s.label) + '"></label>' +
        '<label class="field" style="margin:0"><span>Code d\'accès</span><input type="text" name="code" value="' + esc(s.code) + '"></label>' +
        '<label class="field" style="margin:0"><span>Places</span><input type="number" name="max" min="1" max="500" value="' + (s.max_participants || 30) + '"></label>' +
        '<div class="toolbar"><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="active"' + (s.active ? " checked" : "") + "> Ouverte</label>" +
        '<button class="btn sm primary" type="submit">Enregistrer</button><button class="btn sm danger" type="button" data-dels="' + s.id + '">Supprimer</button></div>' +
        '<div class="linkbox">Lien participant : <strong>' + esc(participantURL(s.code)) + '</strong> <button class="btn sm" type="button" data-copylink="' + esc(participantURL(s.code)) + '">Copier le lien</button> · ' +
        s.participants.length + "/" + (s.max_participants || 30) + " participant(s)</div></form>";
    }).join("") : '<div class="empty-state">Aucune session pour l\'instant.</div>';
  }
  $("sessList").addEventListener("submit", async function (e) {
    e.preventDefault(); var f = e.target;
    try {
      await rpc("atelier_admin_session", { p_key: A.key, p_id: f.dataset.sid, p_label: f.label.value, p_code: f.code.value, p_active: f.active.checked, p_max: +f.max.value || 30 });
      await load(); renderAll(); toast("Session enregistrée.");
    } catch (err) { toast(err.message); }
  });
  $("sessList").addEventListener("click", async function (e) {
    var c = e.target.closest("[data-copylink]"), d = e.target.closest("[data-dels]");
    if (c) navigator.clipboard.writeText(c.dataset.copylink).then(function () { toast("Lien copié."); }, function () { toast("Copie impossible : sélectionnez le lien à la main."); });
    if (d && confirm("Supprimer cette session, ses participants, leurs réponses et le chat ? Cette action est définitive.")) {
      try { await rpc("atelier_admin_session_delete", { p_key: A.key, p_id: d.dataset.dels }); await load(); renderAll(); toast("Session supprimée."); } catch (err) { toast(err.message); }
    }
  });
  $("newSess").addEventListener("submit", async function (e) {
    e.preventDefault(); $("nsErr").textContent = "";
    try {
      A.session = await rpc("atelier_admin_session", { p_key: A.key, p_id: null, p_label: $("nsLabel").value, p_code: $("nsCode").value, p_active: true, p_max: +$("nsMax").value || 30 });
      store("neopix_atelier_session", A.session); A.lastMsg = 0; A.msgs = [];
      $("nsLabel").value = ""; $("nsCode").value = ""; await load(); renderAll(); toast("Session créée.");
    } catch (err) { $("nsErr").textContent = err.message; }
  });

  /* ---------- Export et sauvegarde ---------- */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function slug(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function today() { return new Date().toISOString().slice(0, 10); }
  $("exportCsv").addEventListener("click", function () {
    var s = curSession(); if (!s) return;
    var mods = A.data.modules;
    var head = ["Nom", "Entreprise", "Inscription", "Dernière activité", "Modules terminés", "Module en cours", "Usage 1", "Usage 2", "Usage 3"]
      .concat(FEEDBACK_QUESTIONS.filter(function (q) { return q.type !== "consent"; }).map(function (q) { return q.label; }), ["Accord recontact"]);
    var rows = s.participants.map(function (p) {
      var d = doneOf(p), plan = (p.progress && p.progress.plan) || [], fb = p.feedback || {};
      var cur = mods.find(function (m) { return m.id === p.current_module; });
      return [p.name, p.business, new Date(p.created_at).toLocaleString("fr-FR"), new Date(p.last_seen).toLocaleString("fr-FR"),
        mods.filter(function (m) { return d[m.id]; }).length + "/" + mods.length, cur ? cur.title : "", plan[0] || "", plan[1] || "", plan[2] || ""]
        .concat(FEEDBACK_QUESTIONS.filter(function (q) { return q.type !== "consent"; }).map(function (q) { return fb[q.id] || ""; }), [p.contact_consent ? "Oui" : "Non"]);
    });
    var csv = [head].concat(rows).map(function (r) {
      return r.map(function (c) { c = String(c == null ? "" : c); if (/^[=+\-@]/.test(c)) c = "'" + c; return '"' + c.replace(/"/g, '""') + '"'; }).join(";");
    }).join("\r\n");
    download("atelier-" + slug(s.label) + "-" + today() + ".csv", "﻿" + csv, "text/csv;charset=utf-8");
    toast("Export téléchargé : ouvrez-le avec Excel.");
  });
  $("exportJson").addEventListener("click", async function () {
    try {
      var data = await rpc("atelier_admin_export", { p_key: A.key });
      download("sauvegarde-atelier-ia-" + today() + ".json", JSON.stringify(data, null, 2), "application/json");
      toast("Sauvegarde téléchargée. Gardez-la en lieu sûr : elle contient des données personnelles.");
    } catch (err) { toast(err.message); }
  });

  /* ---------- Réglages et vérification ---------- */
  function renderSettings() {
    if (A.tab !== "reglages") return;
    var st = A.data.settings || {};
    if (document.activeElement !== $("setContact")) $("setContact").value = st.contact_email || "";
    if (document.activeElement !== $("setRetention")) $("setRetention").value = st.retention_months || 12;
    $("appVersion").textContent = APP_VERSION;
  }
  $("settingsForm").addEventListener("submit", async function (e) {
    e.preventDefault(); $("setStatus").textContent = "Enregistrement…";
    try {
      await rpc("atelier_admin_settings", { p_key: A.key, p_contact: $("setContact").value.trim(), p_retention: +$("setRetention").value || 12 });
      await load(); $("setStatus").textContent = "Enregistré ✓";
    } catch (err) { $("setStatus").textContent = err.message; }
  });
  $("selftest").addEventListener("click", async function () {
    var b = this, ul = $("selftestRes"); b.disabled = true; b.textContent = "Vérification en cours…"; ul.innerHTML = "";
    var steps = [];
    try {
      var r = await fetch("shared.js?v=" + Date.now(), { cache: "no-store" });
      var txt = await r.text(), m = txt.match(/APP_VERSION = "([^"]+)"/);
      steps.push({ etape: "Fichiers du site à jour (version " + (m ? m[1] : "inconnue") + ")", ok: !!m && m[1] === APP_VERSION });
      steps = steps.concat(await rpc("atelier_admin_selftest", { p_key: A.key }));
    } catch (err) { steps.push({ etape: err.message, ok: false }); }
    var allOk = steps.every(function (s) { return s.ok; });
    ul.innerHTML = steps.map(function (s, i) {
      return '<li style="animation-delay:' + (i * 0.05) + 's"><strong style="color:' + (s.ok ? "var(--ok)" : "var(--danger)") + '">' + (s.ok ? "✓" : "✕") + "</strong> " + esc(s.etape) + "</li>";
    }).join("") + '<li style="border:0;padding-top:12px;font-weight:600;color:' + (allOk ? "var(--ok)" : "var(--danger)") + '">' +
      (allOk ? "Tout fonctionne : la plateforme est prête." : "Un problème a été détecté : envoyez une capture de cet écran à Claude.") + "</li>";
    b.disabled = false; b.textContent = "Lancer la vérification";
  });

  /* ---------- Démarrage ---------- */
  (async function () {
    if (!A.key) { $("gate").hidden = false; return; }
    try { await load(); start(); } catch (err) { $("gate").hidden = false; if (err.code !== "forbidden") $("keyErr").textContent = err.message; }
  })();
})();
