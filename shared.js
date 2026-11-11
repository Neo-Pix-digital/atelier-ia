/* Atelier IA NéoPix : outils communs (connexion Supabase, mise en forme, médias, illustrations) */
var SB_URL = "https://kpkvskuxvrscfhlckxls.supabase.co";
var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwa3Zza3V4dnJzY2ZobGNreGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDU4NTgsImV4cCI6MjEwOTkyMTg1OH0.X4UISJ6chZ1zxgfZ_cTyumjbYsnrgq9kdi1ogN439dk";
var MEDIA_BUCKET = "atelier-media";

var ERRORS = {
  code_invalide: "Ce code d'accès n'existe pas ou n'est plus actif.",
  nom_invalide: "Indiquez votre prénom et votre nom (2 caractères minimum).",
  acces_refuse: "Votre accès a expiré. Entrez de nouveau le code de l'atelier.",
  session_fermee: "Cette session est fermée. Demandez le nouveau code à l'animateur.",
  trop_de_messages: "Doucement : attendez quelques secondes avant d'envoyer un autre message.",
  message_invalide: "Le message est vide ou trop long (1 000 caractères maximum).",
  forbidden: "Clé animateur incorrecte.",
  code_trop_court: "Le code doit contenir entre 4 et 40 caractères.",
  code_deja_utilise: "Ce code est déjà utilisé par une autre session active.",
  nom_session_vide: "Donnez un nom à la session.",
  donnees_invalides: "Enregistrement impossible : données trop volumineuses."
};

async function rpc(fn, args) {
  var r;
  try {
    r = await fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args || {})
    });
  } catch (e) { throw new Error("Connexion impossible. Vérifiez votre accès à internet."); }
  var txt = await r.text();
  var data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) {
    var m = (data && data.message) || "Erreur " + r.status;
    var err = new Error(ERRORS[m] || m);
    err.code = m;
    throw err;
  }
  return data;
}

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  catch (e) { return null; }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* Mise en forme simple : ## titre, - liste, 1. liste, > encadré, **gras**, [[plan]] */
function renderBody(src) {
  var lines = String(src || "").replace(/\r/g, "").split("\n");
  var out = [], list = null, para = [];
  function inline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
  function flushList() { if (list) { out.push("<" + list.tag + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } }
  lines.forEach(function (raw) {
    var l = raw.trim(), m;
    if (!l) { flushPara(); flushList(); return; }
    if (l === "[[plan]]") { flushPara(); flushList(); out.push('<div data-slot="plan"></div>'); return; }
    if ((m = l.match(/^#{2,3}\s+(.*)/))) { flushPara(); flushList(); out.push("<h2>" + inline(m[1]) + "</h2>"); return; }
    if ((m = l.match(/^>\s?(.*)/))) { flushPara(); flushList(); out.push('<p class="callout">' + inline(m[1]) + "</p>"); return; }
    if ((m = l.match(/^[-*]\s+(.*)/))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); return; }
    if ((m = l.match(/^\d+[.)]\s+(.*)/))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); return; }
    flushList(); para.push(l);
  });
  flushPara(); flushList();
  return out.join("");
}

/* Vidéo : YouTube, Vimeo ou fichier .mp4/.webm */
function videoHTML(url) {
  url = String(url || "").trim();
  if (!url) return "";
  var m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0" title="Vidéo du module" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return '<div class="video"><iframe src="https://player.vimeo.com/video/' + m[1] + '" title="Vidéo du module" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
  if (/^https:\/\//.test(url)) return '<div class="video"><video controls preload="metadata" src="' + esc(url) + '"></video></div>';
  return "";
}

/* Illustrations par défaut (une par position dans le sommaire) */
var ICONS = [
  '<circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" stroke-width="5"/><path d="M40 52l7 7 14-16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M50 24l6 17 18 1-14 11 5 18-15-10-15 10 5-18-14-11 18-1z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
  '<path d="M30 70l6-16 30-30 10 10-30 30zM62 28l10 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M28 44v12h10l22 12V32L38 44zM68 40c4 4 4 16 0 20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<rect x="30" y="24" width="40" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="5"/><path d="M39 40l4 4 8-8M39 58l4 4 8-8M56 41h6M56 59h6" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M50 22l22 8v18c0 15-10 25-22 30-12-5-22-15-22-30V30z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M41 50l6 6 12-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M26 32h48v30H48l-12 10V62H26z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M40 47h20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'
];
function defaultArt(index) {
  var icon = ICONS[index % ICONS.length];
  return '<svg class="art" viewBox="0 0 600 220" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">' +
    '<rect width="600" height="220" fill="var(--accent-soft)"/>' +
    '<circle cx="520" cy="30" r="110" fill="var(--accent)" opacity=".10"/><circle cx="70" cy="210" r="90" fill="var(--accent)" opacity=".08"/>' +
    '<g transform="translate(240 50) scale(1.2)" style="color:var(--accent)">' + icon + '</g></svg>';
}

function timeAgo(iso) {
  var s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return "il y a " + Math.floor(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.floor(s / 3600) + " h";
  return new Date(iso).toLocaleDateString("fr-FR");
}
function hhmm(iso) { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }

/* Questions du questionnaire de retour */
var FEEDBACK_QUESTIONS = [
  { id: "note", label: "Sur 10, à quel point cet atelier vous a-t-il été utile ?", type: "scale" },
  { id: "usage", label: "Quel usage allez-vous appliquer dès cette semaine ?", type: "text" },
  { id: "ameliorer", label: "Qu'est-ce qui était trop long, inutile ou pas clair ?", type: "text" },
  { id: "prix", label: "Combien auriez-vous été prêt à payer pour cet atelier ?", type: "choice",
    options: ["Rien", "Moins de 30 €", "30 à 60 €", "60 à 100 €", "Plus de 100 €"] },
  { id: "suite", label: "Souhaitez-vous un accompagnement pour mettre en place l'IA dans votre entreprise ?", type: "choice",
    options: ["Oui, contactez-moi", "Peut-être plus tard", "Non"] },
  { id: "contact", label: "Si oui : votre téléphone ou votre e-mail", type: "line" },
  { id: "recommandation", label: "À quel autre gérant cet atelier pourrait-il servir ?", type: "line" }
];
