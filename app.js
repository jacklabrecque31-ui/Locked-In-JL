"use strict";
/* Locked-in — site statique ; tout le contenu est chiffré (voir tools/crypto.mjs pour le format). */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*(.+?)\*/g, "<em>$1</em>");
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const S = { courses: [], seances: [], audios: [], agenda: { manuel: null, zc: null, ics: null }, etat: null, weekOff: 0, tab: null, prog: "tous", bal: "tous" };
let PRIV = null;
const PRENOM = "Jacob";

/* ---------- Icônes ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
  head: '<path d="M3 17v-4a9 9 0 0 1 18 0v4"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  lock: '<rect x="4" y="10.5" width="16" height="11" rx="3"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2 6 6M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
  pause: '<rect x="5.5" y="4" width="4.5" height="16" rx="1.5"/><rect x="14" y="4" width="4.5" height="16" rx="1.5"/>',
  slides: '<rect x="2.5" y="5" width="15" height="11" rx="2"/><path d="M6.5 19.5h13a2 2 0 0 0 2-2V8.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  read: '<path d="M2 5.5c3-1.5 6.5-1.5 10 1 3.5-2.5 7-2.5 10-1V19c-3-1.5-6.5-1.5-10 1-3.5-2.5-7-2.5-10-1z"/><path d="M12 6.5V20"/>',
  pen: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  fire: '<path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6-4-8-.5 2-1.5 3-3 3 .5-3-1-6-4-8 0 4-4 6.5-4 12 0 4.2 3.5 8 8 8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;

/* ---------- Dates ---------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDay = (s) => new Date(s + "T12:00:00");
const daysTo = (s) => Math.round((parseDay(s) - today()) / 864e5 - 0.5);
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtDay = (s, o = { weekday: "long", day: "numeric", month: "long" }) => parseDay(s).toLocaleDateString("fr-CA", o);
const fmtShort = (d) => d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
const plural = (n, a, b) => `${n} ${n > 1 ? b : a}`;

/* ---------- Clé : IndexedDB (clé non extractible) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("locked-in", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("k");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function keyOp(mode, fn) {
  try { const db = await idb(); return await new Promise((res) => { const st = db.transaction("k", mode).objectStore("k"); const rq = fn(st); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); }); }
  catch (e) { return null; }
}
const keyGet = () => keyOp("readonly", (st) => st.get("priv"));
const keyPut = (k) => keyOp("readwrite", (st) => st.put(k, "priv"));
const keyDel = () => keyOp("readwrite", (st) => st.delete("priv"));

/* ---------- Crypto ---------- */
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function unlockWith(pw) {
  const k = await fetch("keys.json", { cache: "no-store" }).then((r) => r.json());
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const kek = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: b64d(k.salt), iterations: k.iter }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(k.iv) }, kek, b64d(k.priv));
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["unwrapKey"]);
}
async function decryptBin(buf) {
  const u = new Uint8Array(buf);
  const aes = await crypto.subtle.unwrapKey("raw", u.subarray(0, 384), PRIV, { name: "RSA-OAEP" }, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.subarray(384, 396) }, aes, u.subarray(396));
}
function mime(buf) {
  const b = new Uint8Array(buf, 0, Math.min(12, buf.byteLength));
  const s = String.fromCharCode(...b);
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (s.startsWith("RIFF") && s.slice(8, 12) === "WEBP") return "image/webp";
  if (s.startsWith("RIFF") && s.slice(8, 12) === "WAVE") return "audio/wav";
  if (b[0] === 0x89 && s.slice(1, 4) === "PNG") return "image/png";
  if (s.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (s.startsWith("OggS")) return "audio/ogg";
  if (s.slice(4, 8) === "ftyp") return "audio/mp4";
  return "application/octet-stream";
}

/* ---------- Chargement ---------- */
async function loadAll() {
  const ix = await fetch("data/index.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
  const out = await Promise.all(Object.entries(ix.fichiers).map(async ([f, m]) => {
    const r = await fetch(`data/s/${f}.bin?v=${encodeURIComponent(m.maj)}`);
    if (!r.ok) return null;
    return [m.t, JSON.parse(new TextDecoder().decode(await decryptBin(await r.arrayBuffer())))];
  }));
  S.seances = []; S.audios = []; S.agenda = { manuel: null, zc: null, ics: null };
  for (const row of out) {
    if (!row) continue;
    const [t, d] = row;
    if (t === "seance") { d.id ||= `${d.cours}-${d.num}`; S.seances.push(d); }
    else if (t === "cours") S.courses = d.cours;
    else if (t === "etat") S.etat = d;
    else if (t === "audio") S.audios.push(d);
    else if (t === "agenda") { const k = d.source || d.items?.[0]?.source || "manuel"; S.agenda[k] = d; }
  }
}

/* ---------- Données dérivées ---------- */
const course = (id) => S.courses.find((c) => c.id === id);
const coursesSorted = () => [...S.courses].sort((a, b) => a.examen.localeCompare(b.examen));
const shortName = (c) => (c ? c.nom.split(":")[0].trim() : "");
const seancesOf = (id) => S.seances.filter((s) => s.cours === id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
const ready = (s) => s.statut === "pret";
const cc = (id) => `--cc:var(--c-${id},var(--violet))`;
const progress = () => ls.get("li-progress", {});
const score = (id) => { const p = progress()[id]; return p ? Math.round((100 * p.ok) / p.n) : null; };
const coverOf = (s) => (s.resume || []).flatMap((x) => x.images || [])[0]?.url || s.diapos?.[0]?.images?.[1] || s.diapos?.[0]?.images?.[0] || null;
const COURT = { COMP20900: "Compta", COMP20929: "Coûts", MATH10620: "Stats", ENTR11000: "Entrepreneuriat" };
const nDiapos = (s) => (s.diapos || []).reduce((n, d) => n + d.images.length, 0);
const TYPES = { examen: "Examen", remise: "À remettre", quiz: "Quiz", lecture: "À lire", preparation: "Préparation", exercices: "Exercices", seance: "Cours", autre: "Autre" };
const TICON = { examen: "flag", remise: "pen", quiz: "bolt", lecture: "read", preparation: "target", exercices: "list", seance: "book", autre: "cal" };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function coursDeContexte(ctx) {
  const t = norm(ctx);
  if (!t) return undefined;
  for (const c of S.courses) if (t.includes(norm(c.id))) return c.id;
  for (const c of S.courses) {
    const mots = norm(c.nom.split(":")[0]).split(" ").filter((w) => w.length > 3);
    if (mots.length && mots.every((w) => t.includes(w))) return c.id;
  }
  return undefined;
}
// Même jour et un titre qui prolonge l'autre (« Q7-S08 » et « Q7-S08 (A01) ») : c'est le même item.
function memeItem(a, b) {
  if (a.date !== b.date || (a.cours && b.cours && a.cours !== b.cours)) return false;
  const x = norm(a.titre), y = norm(b.titre);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 6 && (x.startsWith(y) || y.startsWith(x)));
}
function agendaItems() {
  const out = [];
  for (const src of ["manuel", "zc", "ics"]) {
    for (const it0 of S.agenda[src]?.items || []) {
      if (!it0.date) continue;
      const it = { ...it0 };
      if (!it.cours && it.canvas) it.cours = S.courses.find((c) => c.canvas === it.canvas)?.id;
      if (!it.cours && it.contexte) it.cours = coursDeContexte(it.contexte);
      const dup = out.find((o) => memeItem(o, it));
      if (dup) { dup.cours ||= it.cours; dup.heure ||= it.heure; dup.lien ||= it.lien; dup.details ||= it.details; continue; }
      out.push({ ...it, key: it.uid || `${it.date}|${norm(it.titre).slice(0, 48)}` });
    }
  }
  return out.sort((a, b) => (a.date + (a.heure || "99")).localeCompare(b.date + (b.heure || "99")));
}
const doneSet = () => { const d = new Set(ls.get("li-done", [])); return { has: (k) => d.has(k) }; };
const doneRaw = () => new Set(ls.get("li-done", []));
// Un travail déjà remis sur ZoneCours compte comme fait, même sans case cochée.
const isDone = (it, d) => d.has(it.key) || it.remis === true || /d[ée]j[àa] remis/i.test(it.details || "");
const TODO = new Set(["remise", "quiz", "lecture", "preparation", "exercices"]);
function markActive() { const j = new Set(ls.get("li-jours", [])); j.add(iso(new Date())); ls.set("li-jours", [...j].slice(-120)); }
function streak() {
  const j = new Set(ls.get("li-jours", [])); let n = 0; const d = today();
  if (!j.has(iso(d))) d.setDate(d.getDate() - 1);
  while (j.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- Composants ---------- */
const enc = (url, cls = "") => `<img class="ld ${cls}" data-enc="${esc(url)}" alt="">`;
const ring = (p, label, sz) => `<div class="ring" style="--p:${Math.max(0, Math.min(100, p))}${sz ? `;--sz:${sz}px` : ""}" data-l="${esc(label)}"></div>`;
function taskHtml(it, done) {
  const c = course(it.cours);
  const s = it.seance && S.seances.find((x) => x.id === it.seance);
  const links = [];
  if (s && ready(s)) links.push(`<a href="#s/${s.id}">Réviser la séance</a>`);
  if (it.lien) links.push(`<a href="${esc(it.lien)}" target="_blank" rel="noopener">Ouvrir sur ZoneCours</a>`);
  const meta = [`<span>${esc(TYPES[it.type] || "Autre")}</span>`];
  if (it.heure) meta.push(`<span>${ic("clock")}${esc(it.heure)}</span>`);
  if (c) meta.push(`<span>${esc(shortName(c))}</span>`);
  return `<div class="task ${done ? "done" : ""}" style="${cc(it.cours)}">
    <div class="tile">${ic(TICON[it.type] || "cal")}</div>
    <div class="body"><div class="tt">${esc(it.titre)}</div><div class="meta">${meta.join("")}</div>
      ${it.details ? `<div class="det">${md(it.details)}</div>` : ""}${links.length ? `<div class="links">${links.join("")}</div>` : ""}</div>
    ${TODO.has(it.type) ? `<input class="check" type="checkbox" data-done="${esc(it.key)}" ${done ? "checked" : ""} aria-label="Marquer comme fait">` : ""}
  </div>`;
}
function seanceCard(s) {
  const sc = score(s.id), cov = coverOf(s), n = nDiapos(s);
  const st = !ready(s) ? `<span class="status">À venir</span>` : sc !== null ? `<span class="status ok">QCM ${sc} %</span>` : `<span class="status new">À réviser</span>`;
  const inner = `<div class="cover">${cov ? enc(cov) : ""}<span class="n">${esc(s.num)}</span>${n ? `<span class="cnt">${ic("slides")}${n}</span>` : ""}</div>
    <div class="info"><b>${esc(s.titre)}</b>${st}</div>`;
  return ready(s) ? `<a class="scard" href="#s/${s.id}" style="${cc(s.cours)}">${inner}</a>` : `<div class="scard off" style="${cc(s.cours)}">${inner}</div>`;
}
function epHtml(a) {
  const c = course(a.cours);
  return `<div class="ep" style="${cc(a.cours)}"><button class="play" type="button" data-play="${esc(a.id)}" aria-label="Écouter">${ic(PLAY.id === a.id && !$("#audio").paused ? "pause" : "play")}</button>
    <div class="body"><b>${esc(a.titre)}</b><span>${esc(shortName(c) || a.cours || "")}${a.duree ? `, ${esc(a.duree)}` : ""}</span>${a.description ? `<div class="small muted" style="margin-top:4px">${esc(a.description)}</div>` : ""}</div></div>`;
}

/* ---------- Navigation ---------- */
const NAV = [["accueil", "home", "Accueil"], ["agenda", "cal", "Agenda"], ["cours", "book", "Cours"], ["balados", "head", "Balados"], ["progres", "chart", "Progrès"]];
function renderNav(r) {
  const cur = r.v === "seance" || r.v === "course" ? "cours" : r.v;
  $("#tabbar").innerHTML = NAV.map(([k, i, l]) => `<a href="#${k}" aria-current="${cur === k ? "page" : "false"}">${ic(i)}${l}</a>`).join("");
  const dark = document.documentElement.dataset.theme !== "light";
  $("#side").innerHTML = `<a class="brand" href="#accueil"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="20" fill="#7b61ff"/><rect x="17" y="29" width="30" height="22" rx="7" fill="#fff"/><path d="M23 29v-5a9 9 0 0 1 18 0v5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>Locked-in</a>
    ${NAV.map(([k, i, l]) => `<a class="snav" href="#${k}" aria-current="${cur === k ? "page" : "false"}">${ic(i)}${l}</a>`).join("")}
    <div class="sub">Mes cours</div>
    ${coursesSorted().map((c) => { const j = daysTo(c.examen); return `<a class="snav" href="#cours/${c.id}" style="${cc(c.id)}" aria-current="${r.c === c.id ? "page" : "false"}"><span class="dot"></span>${esc(shortName(c))}<span class="j">${j >= 0 ? j + " j" : "fini"}</span></a>`; }).join("")}
    <div class="foot"><button class="snav" type="button" data-theme style="border:0;background:none;cursor:pointer;width:100%">${ic(dark ? "sun" : "moon")}${dark ? "Thème clair" : "Thème sombre"}</button>
    <button class="snav" type="button" data-lockout style="border:0;background:none;cursor:pointer;width:100%">${ic("lock")}Verrouiller</button></div>`;
}

/* ---------- Accueil ---------- */
function viewHome() {
  const t = iso(today()), all = agendaItems(), done = doneSet();
  const next = coursesSorted().find((c) => daysTo(c.examen) >= 0) || coursesSorted()[0];
  const ss = next ? seancesOf(next.id).filter(ready) : [];
  const revues = ss.filter((s) => score(s.id) !== null).length;
  const cible = ss.find((s) => score(s.id) === null) || [...ss].sort((a, b) => score(a.id) - score(b.id))[0];
  const h = new Date().getHours(), salut = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const allReady = S.seances.filter(ready), scored = allReady.map((s) => score(s.id)).filter((x) => x !== null);
  const moy = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  const mon = mondayOf(today()), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const semaine = all.filter((it) => TODO.has(it.type) && it.date >= iso(mon) && it.date <= iso(sun) && !isDone(it, done)).length;
  const late = all.filter((it) => TODO.has(it.type) && it.date < t && daysTo(it.date) >= -14 && !isDone(it, done));
  const upcoming = all.filter((it) => it.date >= t && (TODO.has(it.type) || it.type === "examen")).slice(0, 5);
  const recent = allReady.slice().sort((a, b) => String(b.maj || "").localeCompare(String(a.maj || ""))).slice(0, 8);
  const cov = cible && coverOf(cible);
  return `<div class="top"><div class="avatar">${PRENOM[0]}</div><div class="grow"><div class="hello">${salut},</div><h1>${PRENOM}</h1></div>
    <button class="iconbtn" type="button" data-theme aria-label="Changer de thème">${ic(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}</button></div>
  ${next ? `<section class="hero" style="${cc(next.id)}"><div class="txt">
      <h2>${esc(shortName(next))}</h2>
      <p>Final dans ${plural(daysTo(next.examen), "jour", "jours")}, le ${fmtDay(next.examen, { day: "numeric", month: "long" })}. Tu as révisé ${revues} séance${revues > 1 ? "s" : ""} sur ${ss.length}.</p>
      <div class="bar"><i style="width:${ss.length ? (100 * revues) / ss.length : 0}%"></i></div>
      ${cible ? `<a class="pillbtn" href="#s/${cible.id}">${score(cible.id) === null ? "Réviser " : "Revoir "}${esc(cible.num)}</a>` : ""}
    </div>${cov ? `<div class="stack"><span></span><span></span>${enc(cov)}</div>` : ""}</section>` : ""}
  <div class="stats">
    <div class="stat" style="--tint:var(--violet-2)"><div class="ic">${ic("layers")}</div><b>${allReady.length}</b><span>séances prêtes</span></div>
    <div class="stat" style="--tint:var(--c-MATH10620)"><div class="ic">${ic("target")}</div><b>${moy === null ? "—" : moy + " %"}</b><span>moyenne aux QCM</span></div>
    <div class="stat" style="--tint:var(--c-COMP20900)"><div class="ic">${ic("list")}</div><b>${semaine}</b><span>à faire cette semaine</span></div>
    <div class="stat" style="--tint:var(--c-COMP20929)"><div class="ic">${ic("fire")}</div><b>${streak()}</b><span>jours d'affilée</span></div>
  </div>
  ${late.length ? `<div class="sect"><h2>En retard</h2>${late.length > 3 ? `<a href="#agenda">Voir les ${late.length}</a>` : ""}</div><div class="plan">${late.slice(0, 3).map((x) => taskHtml(x, false)).join("")}</div>` : ""}
  <div class="sect"><h2>À venir</h2><a href="#agenda">Voir l'agenda</a></div>
  <div class="plan">${upcoming.length ? upcoming.map((x) => taskHtml(x, isDone(x, done))).join("") : `<div class="empty">Rien d'inscrit pour les prochains jours.</div>`}</div>
  ${S.audios.length ? `<div class="sect"><h2>Balados</h2><a href="#balados">Tout écouter</a></div><div class="eps">${S.audios.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 2).map(epHtml).join("")}</div>` : ""}
  <div class="sect"><h2>Nouvelles séances</h2><a href="#cours">Tous les cours</a></div>
  <div class="rail">${recent.map(seanceCard).join("")}</div>`;
}

/* ---------- Agenda ---------- */
function viewAgenda() {
  const all = agendaItems(), done = doneSet(), t = iso(today());
  const mon = mondayOf(today()); mon.setDate(mon.getDate() + 7 * S.weekOff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const inWeek = all.filter((it) => it.date >= iso(mon) && it.date <= iso(sun));
  const late = S.weekOff === 0 ? all.filter((it) => TODO.has(it.type) && it.date < t && daysTo(it.date) >= -21 && !isDone(it, done)) : [];
  const title = S.weekOff === 0 ? "Cette semaine" : S.weekOff === 1 ? "Semaine prochaine" : S.weekOff === -1 ? "Semaine dernière" : `Semaine du ${fmtShort(mon)}`;
  let strip = "", days = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i); const ds = iso(d);
    const its = inWeek.filter((x) => x.date === ds);
    strip += `<button type="button" data-day="${ds}" class="${its.length ? "has" : ""} ${ds === t ? "today" : ""}" aria-pressed="${ds === t}"><small>${d.toLocaleDateString("fr-CA", { weekday: "short" }).replace(".", "")}</small><b>${d.getDate()}</b><i></i></button>`;
    if (its.length) days += `<div id="j-${ds}"><div class="dayh">${fmtDay(ds)}${ds === t ? `<span class="tag">Aujourd'hui</span>` : ""}</div><div class="plan">${its.map((x) => taskHtml(x, isDone(x, done))).join("")}</div></div>`;
  }
  const todo = inWeek.filter((x) => TODO.has(x.type) && !isDone(x, done)).length;
  return `<div class="top"><div class="grow"><div class="hello">${fmtShort(mon)} au ${fmtShort(sun)}</div><h1>${title}</h1></div></div>
  <div class="weeknav"><h2>${todo ? plural(todo, "tâche", "tâches") + " à faire" : "Rien à faire d'inscrit"}</h2>
    <button class="iconbtn" type="button" data-week="-1" aria-label="Semaine précédente">${ic("left")}</button>
    ${S.weekOff ? `<button class="btn" type="button" data-week="0">Aujourd'hui</button>` : ""}
    <button class="iconbtn" type="button" data-week="1" aria-label="Semaine suivante">${ic("right")}</button></div>
  <div class="week" style="margin-top:14px">${strip}</div>
  ${late.length ? `<div class="dayh"><span class="tag late">En retard</span></div><div class="plan">${late.map((x) => taskHtml(x, false)).join("")}</div>` : ""}
  ${days || `<div class="empty" style="margin-top:16px">Aucun cours ni aucune échéance inscrits cette semaine.</div>`}`;
}

/* ---------- Cours ---------- */
function viewCourses() {
  return `<div class="top"><div class="grow"><div class="hello">Session A2026</div><h1>Mes cours</h1></div></div>
  <div class="courses">${coursesSorted().map((c) => {
    const ss = seancesOf(c.id), r = ss.filter(ready), rev = r.filter((s) => score(s.id) !== null).length, j = daysTo(c.examen);
    return `<a class="ccard" href="#cours/${c.id}" style="${cc(c.id)}"><div class="row"><div style="flex:1;min-width:0"><div class="code">${c.id}</div><h3>${esc(shortName(c))}</h3></div>${ring(r.length ? (100 * rev) / r.length : 0, `${rev}/${r.length}`)}</div>
      <div class="foot"><span><b>${j >= 0 ? j : "—"}</b> jours avant le final</span><span><b>${r.reduce((n, s) => n + nDiapos(s), 0)}</b> diapos</span></div></a>`;
  }).join("")}</div>`;
}
function viewCourse(id) {
  const c = course(id); if (!c) return viewCourses();
  const ss = seancesOf(id), r = ss.filter(ready), sc = r.map((s) => score(s.id)).filter((x) => x !== null);
  const j = daysTo(c.examen), done = doneSet();
  const up = agendaItems().filter((x) => x.cours === id && x.date >= iso(today()) && x.type !== "seance").slice(0, 3);
  const eps = S.audios.filter((a) => a.cours === id);
  return `<div style="${cc(id)}"><a class="back" href="#cours">${ic("left")}Mes cours</a>
  <section class="chero"><div class="code">${id}</div><h1>${esc(c.nom)}</h1>
    <div class="facts"><div class="fact"><b>${j >= 0 ? plural(j, "jour", "jours") : "Passé"}</b>Final le ${fmtDay(c.examen, { day: "numeric", month: "long" })}</div>
    <div class="fact"><b>${r.length}/${ss.length}</b>séances prêtes</div>
    <div class="fact"><b>${sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) + " %" : "—"}</b>moyenne aux QCM</div>
    ${c.projet ? `<div class="fact"><b>Projet</b>en plus du final</div>` : ""}</div></section>
  ${up.length ? `<div class="sect"><h2>Prochaines échéances</h2></div><div class="plan">${up.map((x) => taskHtml(x, isDone(x, done))).join("")}</div>` : ""}
  ${eps.length ? `<div class="sect"><h2>Balados du cours</h2></div><div class="eps">${eps.map(epHtml).join("")}</div>` : ""}
  <div class="sect"><h2>Séances</h2></div>
  <div class="sgrid">${ss.map(seanceCard).join("")}</div></div>`;
}

/* ---------- Séance ---------- */
function perm(key, n) {
  let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
let QS = { id: null, i: 0, ans: {} };
function viewQcm(s) {
  if (QS.id !== s.id) QS = { id: s.id, i: 0, ans: {} };
  const qs = s.qcm || []; if (!qs.length) return `<div class="empty">Le QCM de cette séance n'est pas encore prêt.</div>`;
  const nAns = Object.keys(QS.ans).length, ok = Object.entries(QS.ans).filter(([i, a]) => qs[i]?.bonne === a).length;
  if (QS.i >= qs.length) {
    const p = Math.round((100 * ok) / qs.length);
    return `<div class="card result" style="${cc(s.cours)}">${ring(p, p + " %", 120)}<h2>${ok} bonnes réponses sur ${qs.length}</h2>
      <p class="muted">${p >= 80 ? "Solide. Repasse les diapos des questions ratées, puis passe à la séance suivante." : p >= 60 ? "Presque. Relis les explications des questions ratées, puis refais le QCM." : "Reprends le résumé et les diapos, puis refais le QCM."}</p>
      <div class="qnav" style="justify-content:center"><button class="btn" type="button" data-qgo="0">Revoir mes réponses</button><button class="btn pri" type="button" data-reset>Recommencer</button></div></div>`;
  }
  const i = QS.i, q = qs[i], a = QS.ans[i], done = a !== undefined, ord = perm(s.id + "|" + i, q.choix.length);
  const pos = (k) => String.fromCharCode(65 + ord.indexOf(k));
  return `<div class="card quiz" style="${cc(s.cours)}">
    <div class="qprog"><span>Question ${i + 1} sur ${qs.length}</span><div class="bar"><i style="width:${(100 * nAns) / qs.length}%"></i></div><span>${ok} ✓</span></div>
    <div class="qt">${md(q.q)}</div>
    <div class="opts">${ord.map((k, j) => {
      const cls = done ? (k === q.bonne ? "right" : k === a ? "wrong" : "") : "";
      return `<button class="opt ${cls}" type="button" data-q="${i}" data-k="${k}" ${done ? "disabled" : ""}><span class="k">${String.fromCharCode(65 + j)}</span><span>${md(q.choix[k])}</span></button>`;
    }).join("")}</div>
    ${done ? `<div class="expl"><b>${a === q.bonne ? "Bonne réponse." : `La bonne réponse est ${pos(q.bonne)}.`}</b>${md(q.explication)}</div>` : ""}
    <div class="qnav"><button class="btn" type="button" data-qgo="${i - 1}" ${i ? "" : "disabled"}>${ic("left")}Précédente</button>
      <button class="btn pri" type="button" data-qgo="${i + 1}" ${done ? "" : "disabled"}>${i + 1 === qs.length ? "Voir mon résultat" : "Suivante"}${ic("right")}</button></div></div>`;
}
function figsHtml(s, list) {
  if (!list || !list.length) return "";
  return `<div class="figs ${list.length > 1 ? "two" : ""}">${list.map((im) => `<figure><button type="button" data-fig="${esc(im.url)}" data-diapo="${esc(im.diapo || "")}" aria-label="Agrandir la diapo">${enc(im.url)}</button><figcaption>${md(im.legende || "")}${im.diapo ? ` (diapo ${esc(im.diapo)})` : ""}</figcaption></figure>`).join("")}</div>`;
}
function viewSeance(id, tab) {
  const s = S.seances.find((x) => x.id === id); if (!s || !ready(s)) return viewCourses();
  const c = course(s.cours), n = nDiapos(s), cov = coverOf(s);
  const eps = S.audios.filter((a) => (a.seances || []).includes(s.id));
  const tabs = [["resume", "Résumé"], ...(n ? [["diapos", `Diapos (${n})`]] : []), ["fiche", "Fiche"], ["qcm", `QCM (${(s.qcm || []).length})`], ...(eps.length ? [["balado", "Balado"]] : [])];
  if (!tabs.some(([k]) => k === tab)) tab = "resume";
  let body = "";
  if (tab === "resume") body = (s.resume || []).map((x) => `<section class="card sec"><h2>${md(x.titre)}</h2>${figsHtml(s, x.images)}<ul>${(x.points || []).map((p) => `<li>${md(p)}</li>`).join("")}</ul></section>`).join("");
  if (tab === "diapos") body = `<div class="decks">${s.diapos.map((d, di) => `<div><div class="deckh"><h2>${esc(d.nom)}</h2>${d.lien ? `<a href="${esc(d.lien)}" target="_blank" rel="noopener">Original sur ZoneCours</a>` : ""}</div>
      <div class="thumbs">${d.images.map((u, k) => `<button type="button" data-open="${di}:${k}" aria-label="Diapo ${k + 1}">${enc(u)}<span>${k + 1}</span></button>`).join("")}</div></div>`).join("")}</div>`;
  if (tab === "fiche") body = `<div class="cheat">${(s.cheat || []).map((x) => `<div class="card"><h3>${esc(x.titre)}</h3><ul>${(x.lignes || []).map((l) => `<li>${md(l)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  if (tab === "qcm") body = viewQcm(s);
  if (tab === "balado") body = `<div class="eps">${eps.map(epHtml).join("")}</div>`;
  const src = (s.sources || []).filter((x) => x.url && x.url.startsWith("http")).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.nom)}</a>`).join("");
  return `<div style="${cc(s.cours)}"><a class="back" href="#cours/${s.cours}">${ic("left")}${esc(shortName(c) || s.cours)}</a>
  <div class="shead"><div><div class="kicker">${s.cours}, séance ${esc(s.num.replace(/^S0?/, ""))}</div><h1>${esc(s.titre)}</h1>${src ? `<details class="srcs"><summary>Documents ZoneCours (${(s.sources || []).filter((x) => x.url && x.url.startsWith("http")).length})</summary><div>${src}</div></details>` : ""}</div>
    ${cov ? `<button class="deckhero" type="button" data-open="0:0" data-cover aria-label="Parcourir les diapos">${enc(cov)}<span class="ov">${ic("slides")}${n ? `Parcourir les ${n} diapos` : "Voir les diapos"}</span></button>` : ""}</div>
  <div class="seg" role="tablist">${tabs.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
  <div>${body}</div></div>`;
}

/* ---------- Progrès ---------- */
function viewProgress() {
  const f = S.prog, prog = progress();
  const pool = S.seances.filter(ready).filter((s) => f === "tous" || s.cours === f);
  const rev = pool.filter((s) => prog[s.id]);
  const sc = rev.map((s) => score(s.id));
  const moy = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null;
  const nq = rev.reduce((n, s) => n + prog[s.id].n, 0);
  let bars;
  if (f === "tous") bars = coursesSorted().map((c) => { const xs = S.seances.filter((s) => s.cours === c.id && ready(s)).map((s) => score(s.id)).filter((x) => x !== null); const v = xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; return { l: COURT[c.id] || c.id, v, c: c.id }; });
  else bars = seancesOf(f).filter(ready).map((s) => ({ l: s.num.replace(/^S0?/, "S"), v: score(s.id), c: f }));
  const per = coursesSorted().map((c) => ({ c, r: S.seances.filter((s) => s.cours === c.id && ready(s)), v: S.seances.filter((s) => s.cours === c.id && ready(s) && prog[s.id]).length }));
  const tot = per.reduce((n, x) => n + x.v, 0);
  let acc = 0;
  const conic = tot ? per.filter((x) => x.v).map((x) => { const a = acc; acc += (100 * x.v) / tot; return `var(--c-${x.c.id}) ${a}% ${acc}%`; }).join(",") : "var(--surface-3) 0 100%";
  const todo = S.seances.filter(ready).filter((s) => f === "tous" || s.cours === f).filter((s) => score(s.id) === null || score(s.id) < 70)
    .sort((a, b) => course(a.cours).examen.localeCompare(course(b.cours).examen) || (score(a.id) ?? -1) - (score(b.id) ?? -1)).slice(0, 6);
  const e = S.etat, ics = S.agenda.ics, fd = (x) => new Date(x).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
  return `<div class="top"><div class="grow"><div class="hello">Ta révision</div><h1>Progrès</h1></div></div>
  <div class="seg" role="tablist"><button role="tab" type="button" data-prog="tous" aria-selected="${f === "tous"}">Tous</button>${coursesSorted().map((c) => `<button role="tab" type="button" data-prog="${c.id}" aria-selected="${f === c.id}">${esc(shortName(c))}</button>`).join("")}</div>
  <div class="stats">
    <div class="stat" style="--tint:var(--violet-2)"><div class="ic">${ic("layers")}</div><b>${rev.length}/${pool.length}</b><span>séances révisées</span></div>
    <div class="stat" style="--tint:var(--c-MATH10620)"><div class="ic">${ic("target")}</div><b>${moy === null ? "—" : moy + " %"}</b><span>moyenne aux QCM</span></div>
    <div class="stat" style="--tint:var(--c-COMP20900)"><div class="ic">${ic("bolt")}</div><b>${nq}</b><span>questions répondues</span></div>
    <div class="stat" style="--tint:var(--c-COMP20929)"><div class="ic">${ic("fire")}</div><b>${streak()}</b><span>jours d'affilée</span></div>
  </div>
  <section class="card chartcard" style="margin-top:12px"><h2>${f === "tous" ? "Moyenne aux QCM par cours" : "Résultat au QCM par séance"}</h2>
    <div class="bars">${bars.map((b) => `<div class="b" style="${cc(b.c)}" title="${b.v === null ? "Pas encore fait" : b.v + " %"}"><i class="${b.v === null ? "none" : ""}" style="height:${b.v === null ? 4 : Math.max(4, b.v)}%"></i><small>${esc(b.l)}</small></div>`).join("")}</div></section>
  ${f === "tous" ? `<section class="card chartcard" style="margin-top:14px"><h2>Séances révisées</h2><div class="donut" style="margin-top:16px">
    <div class="ring" style="--sz:150px;background:conic-gradient(${conic})" data-l="${tot} faites"></div>
    <div class="legend">${per.map((x) => `<div style="${cc(x.c.id)}"><i></i><span><b>${x.v}/${x.r.length}</b>${esc(shortName(x.c))}</span></div>`).join("")}</div></div></section>` : ""}
  <div class="sect"><h2>À revoir en priorité</h2></div>
  <div class="sgrid">${todo.length ? todo.map(seanceCard).join("") : `<div class="empty">Toutes les séances de ce filtre ont un QCM réussi à 70 % ou plus.</div>`}</div>
  <section class="card setts"><h2 style="color:var(--text)">Réglages</h2>
    <div>Séances vérifiées sur ZoneCours : ${e?.derniereVerif ? esc(fd(e.derniereVerif)) : "jamais"}</div>
    <div>Calendrier ZoneCours : ${ics?.maj ? "mis à jour le " + esc(fd(ics.maj)) : "pas encore branché"}</div>
    <div class="row"><button class="btn" type="button" data-theme>${ic(document.documentElement.dataset.theme === "light" ? "moon" : "sun")}${document.documentElement.dataset.theme === "light" ? "Thème sombre" : "Thème clair"}</button>
    <button class="btn" type="button" data-lockout>${ic("lock")}Verrouiller cet appareil</button></div></section>`;
}

/* ---------- Balados ---------- */
function viewBalados() {
  const f = S.bal, list = S.audios.filter((a) => f === "tous" || a.cours === f).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<div class="top"><div class="grow"><div class="hello">Réviser en écoutant</div><h1>Balados</h1></div></div>
  <div class="seg" role="tablist"><button role="tab" type="button" data-bal="tous" aria-selected="${f === "tous"}">Tous</button>${coursesSorted().map((c) => `<button role="tab" type="button" data-bal="${c.id}" aria-selected="${f === c.id}">${esc(shortName(c))}</button>`).join("")}</div>
  <div class="eps">${list.length ? list.map(epHtml).join("") : `<div class="empty">Aucun épisode pour l'instant. Les balados de révision s'ajoutent ici dès qu'ils sont générés.</div>`}</div>`;
}

/* ---------- Images chiffrées (chargement paresseux) ---------- */
const blobCache = new Map();
function blobUrl(path) {
  if (!blobCache.has(path)) blobCache.set(path, fetch(path).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(decryptBin).then((b) => URL.createObjectURL(new Blob([b], { type: mime(b) }))));
  return blobCache.get(path);
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); loadImg(e.target); } }), { rootMargin: "400px" }) : null;
async function loadImg(el) {
  const p = el.dataset.enc; if (!p) return;
  el.removeAttribute("data-enc");
  try { el.src = await blobUrl(p); el.onload = () => el.classList.add("ok"); if (el.complete) el.classList.add("ok"); } catch (e) { el.alt = "Image indisponible"; el.classList.add("ok"); }
}
function hydrate(root = document) { root.querySelectorAll("img[data-enc]").forEach((el) => (io ? io.observe(el) : loadImg(el))); }

/* ---------- Visionneuse de diapos ---------- */
const V = { list: [], i: 0, title: "" };
function openViewer(list, i, title) {
  V.list = list; V.i = Math.max(0, Math.min(i, list.length - 1)); V.title = title;
  $("#vstrip").innerHTML = list.map((u, k) => `<button type="button" data-vgo="${k}" aria-label="Diapo ${k + 1}">${enc(u)}</button>`).join("");
  const d = $("#viewer"); if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  showSlide();
  $("#vstrip").querySelectorAll("img[data-enc]").forEach((el) => (io ? io.observe(el) : loadImg(el)));
}
async function showSlide() {
  const img = $("#vimg"); img.removeAttribute("src");
  $("#vtitle").textContent = V.title; $("#vcount").textContent = `${V.i + 1} / ${V.list.length}`;
  $("#vstrip").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", k === V.i));
  $("#vstrip").children[V.i]?.scrollIntoView({ inline: "center", block: "nearest" });
  const k = V.i;
  try { const u = await blobUrl(V.list[k]); if (k === V.i) img.src = u; } catch (e) {}
  [k + 1, k - 1].forEach((j) => V.list[j] && blobUrl(V.list[j]).catch(() => {}));
}
const step = (d) => { if (!V.list.length) return; V.i = Math.max(0, Math.min(V.list.length - 1, V.i + d)); showSlide(); };
function openFromSeance(s, di, k) {
  if (!s.diapos?.length) return;
  const d = s.diapos[di] || s.diapos[0];
  openViewer(d.images, k, `${s.num} · ${d.nom}`);
}

/* ---------- Lecteur audio ---------- */
const PLAY = { id: null };
const fmtT = (t) => (isFinite(t) ? `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}` : "0:00");
async function playEp(id) {
  const a = S.audios.find((x) => x.id === id), au = $("#audio"); if (!a) return;
  if (PLAY.id === id) { au.paused ? au.play() : au.pause(); return; }
  PLAY.id = id; $("#player").hidden = false; $("#ptitle").textContent = "Chargement de « " + a.titre + " »…";
  try { au.src = await blobUrl(a.url); $("#ptitle").textContent = a.titre; au.playbackRate = ls.get("li-vitesse", 1); au.play(); markActive(); }
  catch (e) { $("#ptitle").textContent = "Impossible de charger cet épisode."; }
}
function syncPlayer() {
  const au = $("#audio");
  $("#pp").innerHTML = ic(au.paused ? "play" : "pause"); $("#pp").setAttribute("aria-label", au.paused ? "Lecture" : "Pause");
  $("#ptime").textContent = `${fmtT(au.currentTime)} / ${fmtT(au.duration)}`;
  if (au.duration) $("#pseek").value = Math.round((1000 * au.currentTime) / au.duration);
  $("#pspeed").textContent = (au.playbackRate || 1).toString().replace(".", ",") + "×";
  document.querySelectorAll("[data-play]").forEach((b) => (b.innerHTML = ic(b.dataset.play === PLAY.id && !au.paused ? "pause" : "play")));
}

/* ---------- Routage ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("cours/")) return { v: "course", c: h.slice(6) };
  if (h.startsWith("s/")) { const [id, tab] = h.slice(2).split("/"); const s = S.seances.find((x) => x.id === id); return { v: "seance", s: id, tab, c: s?.cours }; }
  if (["agenda", "cours", "progres", "balados"].includes(h)) return { v: h };
  return { v: "accueil" };
}
let lastKey = "";
function render() {
  const r = route(), key = `${r.v}|${r.c || ""}|${r.s || ""}|${r.tab || ""}`, moved = key !== lastKey; lastKey = key;
  renderNav(r);
  if (r.v === "seance") markActive();
  $("#view").innerHTML = r.v === "agenda" ? viewAgenda() : r.v === "cours" ? viewCourses() : r.v === "course" ? viewCourse(r.c) : r.v === "seance" ? viewSeance(r.s, r.tab) : r.v === "progres" ? viewProgress() : r.v === "balados" ? viewBalados() : viewHome();
  hydrate($("#view"));
  if (moved) window.scrollTo(0, 0);
}

/* ---------- Événements ---------- */
addEventListener("hashchange", render);
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.done) { const d = doneRaw(); t.checked ? d.add(t.dataset.done) : d.delete(t.dataset.done); ls.set("li-done", [...d]); render(); }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button,[data-open]"); if (!t) return;
  const ds = t.dataset, r = route(), s = r.v === "seance" && S.seances.find((x) => x.id === r.s);
  if (ds.vclose !== undefined) { $("#viewer").close(); return; }
  if (ds.vstep) { step(+ds.vstep); return; }
  if (ds.vgo !== undefined) { V.i = +ds.vgo; showSlide(); return; }
  if (ds.open && s) { const [di, k] = ds.open.split(":").map(Number); openFromSeance(s, di, k); return; }
  if (ds.fig && s) {
    const n = parseInt(ds.diapo, 10);
    if (s.diapos?.length && n) openFromSeance(s, 0, n - 1);
    else { const all = (s.resume || []).flatMap((x) => x.images || []).map((x) => x.url); openViewer(all, all.indexOf(ds.fig), s.titre); }
    return;
  }
  if (ds.theme !== undefined) { const nt = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = nt; ls.set("li-theme", nt); $('meta[name="theme-color"]').content = nt === "light" ? "#f3f0ff" : "#0e0b1f"; render(); return; }
  if (ds.lockout !== undefined) { await keyDel(); location.reload(); return; }
  if (ds.week !== undefined) { const w = +ds.week; S.weekOff = w === 0 ? 0 : S.weekOff + w; render(); return; }
  if (ds.day) { $("#j-" + ds.day)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.tab && s) { location.hash = `#s/${s.id}/${ds.tab}`; return; }
  if (ds.prog) { S.prog = ds.prog; render(); return; }
  if (ds.bal) { S.bal = ds.bal; render(); return; }
  if (ds.play) { playEp(ds.play); return; }
  if (ds.reset !== undefined) { QS = { id: s.id, i: 0, ans: {} }; render(); return; }
  if (ds.qgo !== undefined) { QS.i = Math.max(0, +ds.qgo); render(); return; }
  if (ds.q !== undefined && s) {
    QS.ans[+ds.q] = +ds.k; markActive();
    if (Object.keys(QS.ans).length === s.qcm.length) {
      const prog = progress();
      prog[s.id] = { ok: s.qcm.filter((q, j) => QS.ans[j] === q.bonne).length, n: s.qcm.length, date: iso(new Date()) };
      ls.set("li-progress", prog);
    }
    render();
  }
});
// Visionneuse : clavier et balayage
document.addEventListener("keydown", (e) => {
  if (!$("#viewer").open) return;
  if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
});
let sx = null;
$("#vstage").addEventListener("pointerdown", (e) => { sx = e.clientX; });
$("#vstage").addEventListener("pointerup", (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) step(e.clientX < sx ? 1 : -1); sx = null; });
$("#vstage").addEventListener("click", (e) => { if (e.target === $("#vstage")) $("#viewer").close(); });
// Audio
const au = $("#audio");
["play", "pause", "timeupdate", "loadedmetadata", "ratechange", "ended"].forEach((ev) => au.addEventListener(ev, syncPlayer));
$("#pp").addEventListener("click", () => (au.paused ? au.play() : au.pause()));
$("#pseek").addEventListener("input", (e) => { if (au.duration) au.currentTime = (e.target.value / 1000) * au.duration; });
$("#pspeed").addEventListener("click", () => { const v = [1, 1.25, 1.5, 1.75, 2, 0.75]; const n = v[(v.indexOf(au.playbackRate) + 1) % v.length] || 1; au.playbackRate = n; ls.set("li-vitesse", n); });

/* ---------- Démarrage ---------- */
function setIcons() {
  document.querySelector("[data-vclose]").innerHTML = ic("x");
  document.querySelector(".nav.prev").innerHTML = ic("left");
  document.querySelector(".nav.next").innerHTML = ic("right");
  $("#pp").innerHTML = ic("play");
}
async function start() {
  $("#loading").hidden = false;
  try { await loadAll(); }
  catch (e) { await keyDel(); PRIV = null; $("#loading").hidden = true; showLock("Le mot de passe a peut-être changé. Entre-le de nouveau."); return; }
  $("#loading").hidden = true; $("#lock").hidden = true; $("#app").hidden = false;
  render();
}
function showLock(msg) { $("#app").hidden = true; $("#lock").hidden = false; $("#lockerr").textContent = msg || ""; setTimeout(() => $("#pw").focus(), 50); }
$("#lockform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#unlockbtn"); btn.disabled = true; btn.textContent = "Déverrouillage…"; $("#lockerr").textContent = "";
  try {
    PRIV = await unlockWith($("#pw").value);
    if ($("#remember").checked) await keyPut(PRIV);
    $("#pw").value = ""; await start();
  } catch (err) { $("#lockerr").textContent = "Mot de passe incorrect."; }
  btn.disabled = false; btn.textContent = "Déverrouiller";
});
(async () => {
  setIcons();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  PRIV = await keyGet();
  if (PRIV) await start(); else { $("#loading").hidden = true; showLock(); }
})();
