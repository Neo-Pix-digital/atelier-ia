/* Atelier IA · NéoPix digital — espace participant (version 1.2) */
(function () {
  var TOKEN_KEY = "neopix_atelier_token";
  var $ = function (id) { return document.getElementById(id); };
  var S = { token: store(TOKEN_KEY), me: null, session: null, modules: [], progress: {}, current: null,
            pilot: null, help: false, lastMsg: 0, seeded: false, chatOpen: false, unread: 0,
            pollTimer: null, saveTimer: null, dirty: false, fails: 0 };

  function toast(t) { var el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2800); }
  function show(id) { ["gate", "loading", "app"].forEach(function (x) { $(x).hidden = x !== id; }); }
  function modById(id) { return S.modules.find(function (m) { return m.id === id; }); }

  /* ---------- Accès ---------- */
  var params = new URLSearchParams(location.search);
  if (params.get("code")) $("code").value = params.get("code");

  $("joinForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    $("joinErr").textContent = "";
    var code = $("code").value.trim(), name = $("name").value.trim();
    if (!code) { $("joinErr").textContent = "Entrez le code d'accès."; $("code").focus(); return; }
    if (name.length < 2) { $("joinErr").textContent = "Entrez votre prénom et votre nom."; $("name").focus(); return; }
    $("joinBtn").disabled = true; $("joinBtn").textContent = "Connexion…";
    try {
      var r = await rpc("atelier_join", { p_code: code, p_name: name, p_business: $("business").value.trim() });
      S.token = r.token; store(TOKEN_KEY, r.token);
      if (params.get("code")) history.replaceState(null, "", location.pathname);
      await boot();
    } catch (err) { $("joinErr").textContent = err.message; }
    $("joinBtn").disabled = false; $("joinBtn").textContent = "Entrer dans l'atelier";
  });

  $("logout").addEventListener("click", function () {
    if (!confirm("Quitter cet accès ? Votre avancée reste enregistrée, mais il faudra le code pour revenir avec un nouveau profil.")) return;
    store(TOKEN_KEY, null); location.reload();
  });

  async function boot() {
    if (!S.token) { show("gate"); return; }
    show("loading");
    try {
      var d = await rpc("atelier_me", { p_token: S.token });
      S.me = d.participant; S.session = d.session; S.modules = d.modules || [];
      S.progress = S.me.progress && typeof S.me.progress === "object" ? S.me.progress : {};
      if (!S.progress.done) S.progress.done = {};
      if (!S.progress.plan) S.progress.plan = ["", "", ""];
      S.pilot = d.session.pilot || null; S.help = !!S.me.help;
      $("sessionLabel").textContent = S.session.label;
      $("meName").textContent = S.me.name;
      show("app");
      var start = modById(S.me.current_module) || modById(S.pilot) || S.modules[0];
      renderHelp(); if (start) openModule(start.id, true);
      startPolling();
    } catch (err) {
      if (err.code === "acces_refuse" || err.code === "session_fermee") { store(TOKEN_KEY, null); S.token = null; show("gate"); $("joinErr").textContent = err.message; }
      else {
        $("loadingBox").innerHTML = '<div class="card" style="max-width:420px;padding:24px;border-radius:18px;background:var(--surface);border:1px solid var(--line)"><p>' + esc(err.message) + '</p><button class="btn primary" type="button" id="retryBtn">Réessayer</button></div>';
        $("retryBtn").addEventListener("click", function () { location.reload(); });
      }
    }
  }

  /* ---------- Sommaire et progression ---------- */
  function isDone(id) { return !!(S.progress.done && S.progress.done[id]); }
  function renderToc() {
    var list = $("tocList"); list.innerHTML = "";
    S.modules.forEach(function (m, i) {
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" data-id="' + esc(m.id) + '" data-done="' + (isDone(m.id) ? 1 : 0) + '" aria-current="' + (m.id === S.current) + '">' +
        '<span class="num" aria-hidden="true">' + (isDone(m.id) ? "✓" : (i + 1)) + '</span><span><span class="t">' + esc(m.title) +
        (m.id === S.pilot ? '<span class="live">EN COURS</span>' : "") + '</span><br><span class="d">' + esc(m.duration) +
        (isDone(m.id) ? " · terminé" : "") + '</span></span></button>';
      li.firstChild.addEventListener("click", function () { openModule(m.id); closeToc(); });
      list.appendChild(li);
    });
    var total = S.modules.length, done = S.modules.filter(function (m) { return isDone(m.id); }).length;
    $("progFill").style.width = (total ? Math.round(done / total * 100) : 0) + "%";
    $("progTxt").textContent = done + "/" + total;
  }

  function scheduleSave() { clearTimeout(S.saveTimer); S.saveTimer = setTimeout(saveNow, 700); }
  async function saveNow() {
    clearTimeout(S.saveTimer); S.saveTimer = null;
    try { await rpc("atelier_save", { p_token: S.token, p_progress: S.progress, p_current: S.current }); S.dirty = false; setOffline(false); return true; }
    catch (err) { S.dirty = true; if (/Connexion impossible/.test(err.message)) setOffline(true); else toast(err.message); return false; }
  }

  /* ---------- Module ---------- */
  function openModule(id, initial) {
    var idx = S.modules.findIndex(function (m) { return m.id === id; });
    if (idx < 0) return;
    var m = S.modules[idx];
    S.current = id;
    var media = m.image_url ? '<figure class="media" style="margin:0 0 24px"><img src="' + esc(m.image_url) + '" alt=""></figure>'
                            : '<div class="media">' + defaultArt(idx) + '</div>';
    var html = '<div class="eyebrow">Module ' + (idx + 1) + ' sur ' + S.modules.length + (m.duration ? " · " + esc(m.duration) : "") + '</div>' +
      '<h1>' + esc(m.title) + '</h1>' + (m.summary ? '<p class="lead">' + esc(m.summary) + '</p>' : "") +
      (m.video_url ? videoHTML(m.video_url) : media) +
      '<div class="body">' + renderBody(m.body) + '</div>';
    if (m.prompts && m.prompts.length) {
      html += '<section class="prompts"><h2>Modèles à copier</h2>' + m.prompts.map(function (p, i) {
        return '<div class="prompt"><p>' + esc(p) + '</p><div class="row"><span>Remplacez les [crochets] par votre situation</span>' +
          '<button class="btn sm" type="button" data-copy="' + i + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>Copier</button></div></div>';
      }).join("") + '</section>';
    }
    if (m.kind === "feedback") html += feedbackHTML();
    var prev = S.modules[idx - 1], next = S.modules[idx + 1];
    html += '<div class="navrow">' + (prev ? '<button class="btn" type="button" id="prevBtn">← ' + esc(prev.title) + '</button>' : "<span></span>") +
      (m.kind === "feedback" ? "" : isDone(m.id) && next ? '<button class="btn primary" type="button" id="nextBtn">Module suivant →</button>' :
        isDone(m.id) ? '<span class="donetag">✓ Module terminé</span>' :
        '<button class="btn primary" type="button" id="doneBtn">' + (next ? "J'ai terminé, module suivant →" : "J'ai terminé ce module") + '</button>') + '</div>';
    var main = $("module"); main.innerHTML = html;

    main.querySelectorAll("[data-copy]").forEach(function (b) {
      var label = b.innerHTML;
      b.addEventListener("click", function () {
        var t = m.prompts[+b.dataset.copy];
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
          b.textContent = "Copié ✓"; setTimeout(function () { b.innerHTML = label; }, 1800);
        }, function () { toast("Copie impossible : sélectionnez le texte à la main."); });
      });
    });
    var slot = main.querySelector('[data-slot="plan"]'); if (slot) renderPlan(slot);
    if (m.kind === "feedback") bindFeedback();
    if ($("prevBtn")) $("prevBtn").onclick = function () { openModule(prev.id); };
    if ($("nextBtn")) $("nextBtn").onclick = function () { openModule(next.id); };
    if ($("doneBtn")) $("doneBtn").onclick = function () {
      S.progress.done[m.id] = new Date().toISOString();
      if (next) openModule(next.id); else { openModule(m.id); }
      toast("Bravo, module terminé !");
    };
    renderToc(); renderPilot();
    if (!initial) { scheduleSave(); window.scrollTo({ top: 0, behavior: "smooth" }); main.focus({ preventScroll: true }); }
  }

  function renderPlan(slot) {
    var labels = ["Usage n°1", "Usage n°2", "Usage n°3"];
    slot.className = "plan";
    slot.innerHTML = labels.map(function (l, i) {
      return '<label class="field"><span>' + l + '</span><input type="text" data-plan="' + i + '" maxlength="200" placeholder="Ex. : répondre aux avis Google avec l\'IA" value="' + esc(S.progress.plan[i] || "") + '"></label>';
    }).join("") + '<span class="saved" id="planSaved" hidden>Enregistré ✓</span>';
    slot.querySelectorAll("[data-plan]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        S.progress.plan[+inp.dataset.plan] = inp.value;
        clearTimeout(renderPlan.t);
        renderPlan.t = setTimeout(async function () { if (await saveNow()) { var el = $("planSaved"); if (el) { el.hidden = false; setTimeout(function () { el.hidden = true; }, 1500); } } }, 800);
      });
    });
  }

  /* ---------- Module affiché par l'animateur ---------- */
  function renderPilot() {
    var m = modById(S.pilot), show = !!m && S.pilot !== S.current;
    $("pilot").hidden = !show;
    if (m) $("pilotTitle").textContent = m.title;
  }
  $("pilotGo").addEventListener("click", function () { if (S.pilot) openModule(S.pilot); });

  /* ---------- Demande d'aide ---------- */
  function renderHelp() {
    var b = $("helpBtn");
    b.setAttribute("aria-pressed", S.help ? "true" : "false");
    b.setAttribute("aria-label", S.help ? "Annuler ma demande d'aide" : "Demander de l'aide à l'animateur");
    b.title = S.help ? "Demande envoyée : cliquez pour l'annuler" : "Demander de l'aide";
  }
  $("helpBtn").addEventListener("click", async function () {
    var want = !S.help;
    try {
      await rpc("atelier_help", { p_token: S.token, p_on: want });
      S.help = want; renderHelp();
      toast(want ? "L'animateur est prévenu : il arrive." : "Demande d'aide annulée.");
    } catch (err) { toast(err.message); }
  });

  /* ---------- Questionnaire ---------- */
  function feedbackHTML() {
    var sent = S.me.feedback;
    if (sent && sent.sent_at) return '<div class="plan"><p class="donetag">✓ Merci, votre avis a bien été envoyé.</p><p class="muted small" style="margin:6px 0 0">Vous pouvez le modifier et le renvoyer si besoin.</p></div>' + formHTML(sent);
    return formHTML({});
  }
  function formHTML(v) {
    return '<form class="plan" id="fbForm" style="margin-top:16px">' + FEEDBACK_QUESTIONS.map(function (q) {
      var val = v[q.id] || "";
      if (q.type === "scale") {
        var opts = ""; for (var i = 1; i <= 10; i++) opts += '<label><input type="radio" name="' + q.id + '" value="' + i + '"' + (String(val) === String(i) ? " checked" : "") + '>' + i + '</label>';
        return '<fieldset class="field" style="border:0;padding:0;margin:0 0 18px"><legend style="font-weight:600;font-size:13.5px;margin-bottom:8px">' + esc(q.label) + '</legend><div class="choices scale">' + opts + '</div></fieldset>';
      }
      if (q.type === "choice") {
        return '<fieldset class="field" style="border:0;padding:0;margin:0 0 18px"><legend style="font-weight:600;font-size:13.5px;margin-bottom:8px">' + esc(q.label) + '</legend><div class="choices">' +
          q.options.map(function (o) { return '<label><input type="radio" name="' + q.id + '" value="' + esc(o) + '"' + (val === o ? " checked" : "") + '>' + esc(o) + '</label>'; }).join("") + '</div></fieldset>';
      }
      if (q.type === "consent") return '<label class="check"><input type="checkbox" name="' + q.id + '" value="true"' + (val === "true" || val === true ? " checked" : "") + '><span>' + esc(q.label) + '</span></label>';
      if (q.type === "text") return '<label class="field"><span>' + esc(q.label) + '</span><textarea name="' + q.id + '" maxlength="1000">' + esc(val) + '</textarea></label>';
      return '<label class="field"><span>' + esc(q.label) + '</span><input type="text" name="' + q.id + '" maxlength="200" value="' + esc(val) + '"></label>';
    }).join("") + '<button class="btn primary" type="submit" id="fbBtn">Envoyer mon avis</button><p class="err" id="fbErr" role="alert"></p></form>';
  }
  function bindFeedback() {
    var f = $("fbForm"); if (!f) return;
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(f), ans = {};
      FEEDBACK_QUESTIONS.forEach(function (q) { var v = fd.get(q.id); if (v) ans[q.id] = String(v).trim(); });
      if (!ans.note) { $("fbErr").textContent = "Donnez au moins une note de 1 à 10."; return; }
      ans.consent = ans.consent === "true";
      if (ans.contact && !ans.consent) { $("fbErr").textContent = ERRORS.consentement_requis; return; }
      if (!ans.contact) delete ans.consent;
      $("fbBtn").disabled = true; $("fbBtn").textContent = "Envoi…";
      try {
        await rpc("atelier_feedback", { p_token: S.token, p_answers: ans });
        S.me.feedback = Object.assign({}, ans, { sent_at: new Date().toISOString() });
        S.progress.done[S.current] = new Date().toISOString();
        await saveNow();
        openModule(S.current); toast("Merci pour votre avis !");
      } catch (err) { $("fbErr").textContent = err.message; $("fbBtn").disabled = false; $("fbBtn").textContent = "Envoyer mon avis"; }
    });
  }

  /* ---------- Chat ---------- */
  function setChat(open) {
    S.chatOpen = open;
    $("chat").hidden = !open;
    $("layout").classList.toggle("with-chat", open);
    $("chatBtn").setAttribute("aria-expanded", open);
    if (open) { S.unread = 0; updateBadge(); var box = $("msgs"); box.scrollTop = box.scrollHeight; $("chatInput").focus(); pulse(); }
    else $("chatBtn").focus();
  }
  $("chatBtn").addEventListener("click", function () { setChat(!S.chatOpen); });
  $("chatClose").addEventListener("click", function () { setChat(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (S.chatOpen) setChat(false);
    if ($("toc").classList.contains("open")) { closeToc(); $("tocBtn").focus(); }
  });
  function updateBadge() { var b = $("unread"); b.hidden = !S.unread; b.textContent = S.unread > 9 ? "9+" : S.unread; }

  function addMessages(list) {
    if (!list || !list.length) { S.seeded = true; return; }
    var box = $("msgs"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    $("msgsEmpty").hidden = true;
    list.forEach(function (m) {
      if (m.id <= S.lastMsg) return;
      S.lastMsg = m.id;
      var el = document.createElement("div");
      el.className = "msg" + (m.mine ? " mine" : "") + (m.is_staff ? " staff" : "");
      el.innerHTML = '<p class="who">' + (m.mine ? "Vous" : esc(m.author)) + " · " + hhmm(m.created_at) + '</p><div class="bubble"></div>';
      el.querySelector(".bubble").textContent = m.body;
      box.appendChild(el);
      if (!m.mine && !S.chatOpen && S.seeded) S.unread++;
    });
    S.seeded = true;
    updateBadge();
    if (atBottom || S.chatOpen) box.scrollTop = box.scrollHeight;
  }

  /* Un seul appel régulier : chat, module affiché par l'animateur, demande d'aide */
  async function pulse() {
    try {
      var r = await rpc("atelier_pulse", { p_token: S.token, p_after: S.lastMsg });
      S.fails = 0; setOffline(false);
      if (S.dirty) saveNow();
      addMessages(r.messages);
      if (r.pilot !== S.pilot) {
        var m = modById(r.pilot);
        S.pilot = r.pilot || null;
        if (m && r.pilot !== S.current) toast("L'animateur passe au module « " + m.title + " ».");
        renderToc(); renderPilot();
      }
      if (!!r.help !== S.help) { S.help = !!r.help; renderHelp(); if (!S.help) toast("L'animateur a pris en compte votre demande."); }
    } catch (e) {
      if (e.code === "acces_refuse") { store(TOKEN_KEY, null); location.reload(); return; }
      if (++S.fails >= 2) setOffline(true);
    }
  }
  function startPolling() {
    pulse();
    clearInterval(S.pollTimer);
    S.pollTimer = setInterval(function () { if (!document.hidden || S.chatOpen) pulse(); }, 4000);
  }
  function setOffline(on) { $("offline").hidden = !on; }
  window.addEventListener("offline", function () { setOffline(true); });
  window.addEventListener("online", function () { pulse(); });

  $("chatForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var t = $("chatInput").value.trim(); if (!t) return;
    $("chatInput").value = "";
    try { await rpc("atelier_send", { p_token: S.token, p_key: null, p_session: null, p_body: t }); await pulse(); }
    catch (err) { $("chatInput").value = t; toast(err.message); }
  });
  $("chatInput").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("chatForm").requestSubmit(); } });

  /* ---------- Sommaire mobile ---------- */
  function closeToc() { $("toc").classList.remove("open"); $("tocBtn").setAttribute("aria-expanded", "false"); }
  $("tocBtn").addEventListener("click", function () {
    var o = $("toc").classList.toggle("open"); $("tocBtn").setAttribute("aria-expanded", o);
    if (o) { var cur = $("toc").querySelector('[aria-current="true"]') || $("toc").querySelector("button"); if (cur) cur.focus(); }
  });
  window.addEventListener("pagehide", function () { if (S.saveTimer || S.dirty) saveNow(); });

  /* ---------- Vos données ---------- */
  var privacyCache = null;
  document.addEventListener("click", async function (e) {
    if (!e.target.closest("[data-privacy]")) return;
    var d = $("privacy");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    try { privacyCache = privacyCache || await rpc("atelier_privacy", {}); } catch (err) { privacyCache = null; }
    $("privacyBody").innerHTML = privacyHTML(privacyCache || {});
    var h = $("privacyBody").querySelector("h2"); if (h) h.id = "privacyTitle";
  });
  $("privacyClose").addEventListener("click", function () { var d = $("privacy"); if (d.close) d.close(); else d.removeAttribute("open"); });
  $("forgetBtn").addEventListener("click", async function () {
    if (!confirm("Supprimer définitivement votre profil, votre avancée, vos réponses et vos messages ? Cette action est irréversible.")) return;
    try {
      await rpc("atelier_forget", { p_token: S.token });
      store(TOKEN_KEY, null);
      alert("Vos données ont été supprimées.");
      location.reload();
    } catch (err) { toast(err.message); }
  });

  boot();
})();
