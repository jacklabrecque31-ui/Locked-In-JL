"use strict";
/* Locked-in HEC — site statique ; tout le contenu est chiffré (voir tools/crypto.mjs pour le format). */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*(.+?)\*/g, "<em>$1</em>");
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const S = { courses: [], seances: [], agenda: { manuel: null, zc: null, ics: null }, etat: null, ix: null, tab: "resume", weekOff: 0 };
let PRIV = null;

/* ---------- Dates ---------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDay = (s) => new Date(s + "T12:00:00");
const daysTo = (s) => Math.round((parseDay(s) - today()) / 864e5 - 0.5);
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtDay = (s, o = { weekday: "long", day: "numeric", month: "long" }) => parseDay(s).toLocaleDateString("fr-CA", o);
const fmtShort = (d) => d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });

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

/* ---------- Chargement ---------- */
async function loadAll() {
  const ix = await fetch("data/index.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
  S.ix = ix;
  const out = await Promise.all(Object.entries(ix.fichiers).map(async ([f, m]) => {
    const r = await fetch(`data/s/${f}.bin?v=${encodeURIComponent(m.maj)}`);
    if (!r.ok) return null;
    const txt = new TextDecoder().decode(await decryptBin(await r.arrayBuffer()));
    return [m.t, f, JSON.parse(txt)];
  }));
  S.seances = []; S.agenda = { manuel: null, zc: null, ics: null };
  for (const row of out) {
    if (!row) continue;
    const [t, , d] = row;
    if (t === "seance") S.seances.push(d);
    else if (t === "cours") S.courses = d.cours;
    else if (t === "etat") S.etat = d;
    else if (t === "agenda") { const k = d.source || (d.items?.[0]?.source) || "manuel"; S.agenda[k] = d; }
  }
}

/* ---------- Données dérivées ---------- */
const course = (id) => S.courses.find((c) => c.id === id);
const seancesOf = (id) => S.seances.filter((s) => s.cours === id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
const ready = (s) => s.statut === "pret";
const cc = (id) => `--cc:var(--c-${id},var(--accent))`;
const TYPES = { examen: "Examen", remise: "À remettre", quiz: "Quiz", lecture: "À lire / visionner", preparation: "Préparation", exercices: "Exercices", seance: "Cours", autre: "Autre" };
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
// Deux items sont le même s'ils tombent le même jour et que l'un des titres prolonge l'autre
// (ex. « Q7-S08 » et « Q7-S08 (A01) » : le flux du calendrier et ZoneCours nomment parfois un peu différemment).
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
      if (dup) { // on garde la première version (manuel > ZoneCours > flux) et on la complète
        dup.cours ||= it.cours; dup.heure ||= it.heure; dup.lien ||= it.lien; dup.details ||= it.details;
        continue;
      }
      out.push({ ...it, key: it.uid || `${it.date}|${norm(it.titre).slice(0, 48)}` });
    }
  }
  return out.sort((a, b) => (a.date + (a.heure || "99")).localeCompare(b.date + (b.heure || "99")));
}
const doneSet = () => new Set(ls.get("li-done", []));
const TODO_TYPES = new Set(["remise", "quiz", "lecture", "preparation", "exercices"]);

/* ---------- Rendu : rail ---------- */
function renderRail(route) {
  const items = [`<a class="nlink" href="#agenda" style="--cc:var(--ink)" aria-current="${route.v === "agenda" ? "page" : "false"}"><span class="dot"></span><span><span class="code">Agenda</span><br><span class="nm">Cette semaine</span></span><span class="jx"></span></a>`];
  items.push(`<div class="navsep">Cours</div>`);
  for (const c of [...S.courses].sort((a, b) => a.ordre - b.ordre)) {
    const j = daysTo(c.examen);
    items.push(`<a class="nlink" href="#cours/${c.id}" style="${cc(c.id)}" aria-current="${route.c === c.id ? "page" : "false"}"><span class="dot"></span><span><span class="code">${c.id}</span><br><span class="nm">${esc(c.nom)}</span></span><span class="jx" title="Examen final">${j >= 0 ? "J-" + j : "terminé"}</span></a>`);
  }
  $("#nav").innerHTML = items.join("");
  $("#status").innerHTML = statusHtml();
}
function statusHtml() {
  const e = S.etat, ics = S.agenda.ics;
  const f = (s) => new Date(s).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
  return `<div>Séances vérifiées sur ZoneCours : ${e?.derniereVerif ? `<span class="mono">${esc(f(e.derniereVerif))}</span>` : "jamais"}</div>
    <div>Flux du calendrier : ${ics?.maj ? `dernier changement <span class="mono">${esc(f(ics.maj))}</span>` : "pas encore branché"}</div>
    <button type="button" data-lockout>Verrouiller cet appareil</button>`;
}

/* ---------- Rendu : agenda ---------- */
function itemHtml(it, done) {
  const c = course(it.cours);
  const s = it.seance && S.seances.find((x) => x.id === it.seance);
  const links = [];
  if (s && ready(s)) links.push(`<a href="#s/${s.id}">Réviser la séance ${esc(s.num)}</a>`);
  if (it.lien) links.push(`<a href="${esc(it.lien)}" target="_blank" rel="noopener">Ouvrir sur ZoneCours</a>`);
  const check = TODO_TYPES.has(it.type) ? `<input type="checkbox" data-done="${esc(it.key)}" ${done ? "checked" : ""} aria-label="Marquer comme fait">` : `<span style="width:20px"></span>`;
  return `<div class="item ${done ? "done" : ""}" style="${cc(it.cours)}">${check}<div>
    <div class="ihead"><span class="pill p-${esc(it.type)}">${TYPES[it.type] || "Autre"}</span><span class="mono">${esc(it.cours || "")}</span>${it.heure ? `<span class="meta">${esc(it.heure)}</span>` : ""}</div>
    <div class="ititle">${esc(it.titre)}</div>
    ${it.details ? `<div class="idet">${md(it.details)}</div>` : ""}
    ${links.length ? `<div class="ilinks">${links.join("")}</div>` : ""}
  </div></div>`;
}
function viewAgenda() {
  const all = agendaItems(), done = doneSet();
  const mon = mondayOf(today()); mon.setDate(mon.getDate() + 7 * S.weekOff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const inWeek = all.filter((it) => it.date >= iso(mon) && it.date <= iso(sun));
  const t = iso(today());
  const late = S.weekOff === 0 ? all.filter((it) => TODO_TYPES.has(it.type) && it.date < t && daysTo(it.date) >= -21 && !done.has(it.key)) : [];
  const exams = [...S.courses].sort((a, b) => a.examen.localeCompare(b.examen));
  const title = S.weekOff === 0 ? "Cette semaine" : S.weekOff === 1 ? "La semaine prochaine" : S.weekOff === -1 ? "La semaine dernière" : `Semaine du ${fmtShort(mon)}`;
  let days = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i); const ds = iso(d);
    const its = inWeek.filter((x) => x.date === ds);
    if (!its.length) continue;
    days += `<div class="day"><div class="dayh">${fmtDay(ds)} ${ds === t ? `<span class="today">Aujourd'hui</span>` : ""}</div>${its.map((x) => itemHtml(x, done.has(x.key))).join("")}</div>`;
  }
  const todoCount = inWeek.filter((x) => TODO_TYPES.has(x.type) && !done.has(x.key)).length;
  const noFeeds = !S.agenda.ics && !S.agenda.zc;
  return `<div class="eyebrow">Agenda</div><h1>${title}</h1>
  <p class="lede">${fmtShort(mon)} au ${fmtShort(sun)} · ${todoCount ? `${todoCount} chose${todoCount > 1 ? "s" : ""} à faire` : "rien à faire d'indiqué"}</p>
  <div class="grid" style="margin:14px 0 6px">${exams.map((c) => { const j = daysTo(c.examen); return `<a class="card exam" href="#cours/${c.id}" style="${cc(c.id)}"><span class="eyebrow">${c.id}</span><span class="big">${j >= 0 ? j : "—"} <span>jours</span></span><span class="meta">Final : ${fmtDay(c.examen, { day: "numeric", month: "long" })}</span></a>`; }).join("")}</div>
  <div class="weekbar"><h2>Semaine</h2><button class="btn" data-week="-1" type="button" aria-label="Semaine précédente">←</button><button class="btn" data-week="0" type="button">Aujourd'hui</button><button class="btn" data-week="1" type="button" aria-label="Semaine suivante">→</button></div>
  ${late.length ? `<div class="late"><h3>En retard ou oublié</h3>${late.map((x) => itemHtml(x, false)).join("")}</div>` : ""}
  ${days || `<div class="empty">${noFeeds ? "L'agenda se remplira automatiquement dès que le flux du calendrier ZoneCours sera branché et que la vérification du matin aura tourné. Les examens finaux et les remises déjà connues sont affichés dans les semaines concernées." : "Rien de prévu cette semaine."}</div>`}
  <h2 style="margin-top:28px">Ajouts récents</h2>${recentFeed()}
  <div class="mobile-status">${statusHtml()}</div>`;
}
function recentFeed() {
  const r = S.seances.filter(ready).sort((a, b) => String(b.maj || "").localeCompare(String(a.maj || ""))).slice(0, 6);
  return r.length ? `<div class="feed">${r.map((s) => `<a href="#s/${s.id}"><span class="d">${esc(s.maj || "")}</span><span><span class="mono">${s.cours}</span> ${esc(s.num)} · ${esc(s.titre)}</span></a>`).join("")}</div>` : `<div class="empty">Aucune séance pour l'instant.</div>`;
}

/* ---------- Rendu : cours ---------- */
function viewCourse(id) {
  const c = course(id); if (!c) return viewAgenda();
  const ss = seancesOf(id), j = daysTo(c.examen), prog = ls.get("li-progress", {});
  const upcoming = agendaItems().filter((x) => x.cours === id && x.date >= iso(today())).slice(0, 4);
  return `<div style="${cc(id)}"><a class="back" href="#agenda">← Agenda</a>
  <div class="eyebrow">${id}</div><h1>${esc(c.nom)}</h1>
  <p class="lede">Examen final le ${fmtDay(c.examen)} (${j >= 0 ? "dans " + j + " jours" : "passé"})${c.projet ? ", plus un projet" : ""}.</p>
  ${upcoming.length ? `<h2 style="margin-top:18px">Prochaines échéances</h2>${upcoming.map((x) => `<div class="meta" style="margin-bottom:4px"><span class="mono">${fmtDay(x.date, { day: "numeric", month: "short" })}</span> · ${esc(TYPES[x.type] || "")} · ${esc(x.titre)}</div>`).join("")}` : ""}
  <h2 style="margin-top:18px">Séances</h2>
  <div class="list">${ss.map((s) => {
    const p = prog[s.id];
    const pill = ready(s) ? (p ? `<span class="pill p-ok">QCM ${p.ok}/${p.n}</span>` : `<span class="pill p-new">À réviser</span>`) : `<span class="pill p-wait">À venir</span>`;
    return ready(s) ? `<a class="srow" href="#s/${s.id}"><span class="snum">${esc(s.num)}</span><span class="stit">${esc(s.titre)}</span>${pill}</a>` : `<div class="srow off"><span class="snum">${esc(s.num)}</span><span class="stit">${esc(s.titre)}</span>${pill}</div>`;
  }).join("")}</div></div>`;
}

/* ---------- Rendu : séance ---------- */
function perm(key, n) {
  let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
let QS = { id: null, ans: {} };
function figs(list) {
  if (!list || !list.length) return "";
  return `<div class="fig">${list.map((im) => `<figure><img data-enc="${esc(im.url)}" alt="${esc(im.legende || "Diapo du cours")}" data-cap="${esc(im.legende || "")}"><figcaption>${md(im.legende || "")}${im.diapo ? ` <span class="mono">diapo ${esc(im.diapo)}</span>` : ""}</figcaption></figure>`).join("")}</div>`;
}
function viewQcm(s) {
  if (QS.id !== s.id) QS = { id: s.id, ans: {} };
  const qs = s.qcm || []; if (!qs.length) return `<div class="empty">QCM à venir.</div>`;
  const answered = Object.keys(QS.ans).length, ok = Object.entries(QS.ans).filter(([i, a]) => qs[i] && qs[i].bonne === a).length;
  const best = ls.get("li-progress", {})[s.id];
  return `<div class="score"><span class="meta">${answered}/${qs.length} répondues · ${ok} bonnes${best ? ` · dernier essai complet : ${best.ok}/${best.n}` : ""}</span><button class="btn" type="button" data-reset>Recommencer</button></div>
  ${qs.map((q, i) => {
    const a = QS.ans[i], done = a !== undefined;
    const ord = perm(s.id + "|" + i, q.choix.length), pos = (k) => String.fromCharCode(65 + ord.indexOf(k));
    return `<div class="card q"><div class="qt">${i + 1}. ${md(q.q)}</div><div class="opts">${ord.map((k, j) => {
      const cls = done ? (k === q.bonne ? "right" : k === a ? "wrong" : "") : "";
      return `<button class="opt ${cls}" type="button" data-q="${i}" data-k="${k}" ${done ? "disabled" : ""}>${String.fromCharCode(65 + j)}. ${md(q.choix[k])}</button>`;
    }).join("")}</div>
    ${done ? `<div class="expl"><b>${a === q.bonne ? "Bonne réponse." : "Pas tout à fait. La bonne réponse est " + pos(q.bonne) + "."}</b>${md(q.explication)}</div>` : ""}</div>`;
  }).join("")}`;
}
function viewSeance(id) {
  const s = S.seances.find((x) => x.id === id); if (!s || !ready(s)) return viewAgenda();
  const c = course(s.cours);
  const tabs = [["resume", "Résumé"], ["cheat", "Cheat sheet"], ["qcm", `QCM (${(s.qcm || []).length})`]];
  let body = "";
  if (S.tab === "resume") body = (s.resume || []).map((x) => `<div class="sec"><h2>${md(x.titre)}</h2><ul>${(x.points || []).map((p) => `<li>${md(p)}</li>`).join("")}</ul>${figs(x.images)}</div>`).join("");
  if (S.tab === "cheat") body = `<div class="cheat">${(s.cheat || []).map((x) => `<div class="card"><h3>${esc(x.titre)}</h3><ul>${(x.lignes || []).map((l) => `<li>${md(l)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  if (S.tab === "qcm") body = viewQcm(s);
  const src = (s.sources || []).map((x) => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.nom)}</a>` : esc(x.nom)).join(" · ");
  return `<div style="${cc(s.cours)}"><a class="back" href="#cours/${s.cours}">← ${esc(c ? c.nom : s.cours)}</a>
  <div class="eyebrow">${s.cours} · ${esc(s.num)}</div><h1>${esc(s.titre)}</h1>
  ${src ? `<div class="src">Sources ZoneCours : ${src}</div>` : ""}
  <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join("")}</div>
  <div>${body}</div></div>`;
}

/* ---------- Images chiffrées ---------- */
const imgCache = new Map();
async function imgUrl(path) {
  if (!imgCache.has(path)) imgCache.set(path, fetch(path).then((r) => r.arrayBuffer()).then(decryptBin).then((b) => URL.createObjectURL(new Blob([b], { type: "image/jpeg" }))));
  return imgCache.get(path);
}
function hydrateImages() {
  document.querySelectorAll("img[data-enc]").forEach(async (el) => {
    try { el.src = await imgUrl(el.dataset.enc); el.removeAttribute("data-enc"); el.dataset.zoom = "1"; } catch (e) { el.alt = "Image indisponible"; }
  });
}

/* ---------- Routage ---------- */
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("cours/")) return { v: "course", c: h.slice(6) };
  if (h.startsWith("s/")) { const s = S.seances.find((x) => x.id === h.slice(2)); return { v: "seance", s: h.slice(2), c: s?.cours }; }
  return { v: "agenda" };
}
let lastRoute = "";
function render(scrollTop) {
  const r = route();
  const key = JSON.stringify(r);
  if (key !== lastRoute) { if (r.v === "seance") S.tab = "resume"; lastRoute = key; scrollTop = true; }
  renderRail(r);
  $("#view").innerHTML = r.v === "course" ? viewCourse(r.c) : r.v === "seance" ? viewSeance(r.s) : viewAgenda();
  hydrateImages();
  if (scrollTop) window.scrollTo(0, 0);
}

/* ---------- Événements ---------- */
addEventListener("hashchange", () => render(true));
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.done) { const d = doneSet(); t.checked ? d.add(t.dataset.done) : d.delete(t.dataset.done); ls.set("li-done", [...d]); render(); }
});
document.addEventListener("click", async (e) => {
  const z = e.target.closest("img[data-zoom]");
  if (z) { const d = $("#zoom"); d.querySelector("img").src = z.src; d.querySelector("p").textContent = z.dataset.cap || ""; try { d.showModal(); } catch (err) {} return; }
  if (e.target.closest("#zoom")) { $("#zoom").close(); return; }
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.lockout !== undefined) { await keyDel(); location.reload(); return; }
  if (t.dataset.week !== undefined) { const w = +t.dataset.week; S.weekOff = w === 0 ? 0 : S.weekOff + w; render(); return; }
  if (t.dataset.tab) { S.tab = t.dataset.tab; render(); return; }
  if (t.dataset.reset !== undefined) { QS.ans = {}; render(); return; }
  if (t.dataset.q !== undefined) {
    const s = S.seances.find((x) => x.id === route().s); const i = +t.dataset.q; QS.ans[i] = +t.dataset.k;
    if (Object.keys(QS.ans).length === s.qcm.length) {
      const prog = ls.get("li-progress", {});
      prog[s.id] = { ok: s.qcm.filter((q, j) => QS.ans[j] === q.bonne).length, n: s.qcm.length, date: iso(new Date()) };
      ls.set("li-progress", prog);
    }
    render();
  }
});

/* ---------- Démarrage ---------- */
async function start() {
  $("#loading").hidden = false;
  try { await loadAll(); }
  catch (e) {
    // Clé obsolète (mot de passe changé) ou fichier illisible : on redemande le mot de passe
    await keyDel(); PRIV = null; $("#loading").hidden = true; showLock("Le mot de passe a peut-être changé. Entre-le de nouveau."); return;
  }
  $("#loading").hidden = true; $("#lock").hidden = true; $("#app").hidden = false;
  render(true);
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  PRIV = await keyGet();
  if (PRIV) await start(); else { $("#loading").hidden = true; showLock(); }
})();
