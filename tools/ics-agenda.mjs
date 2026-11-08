// Lit le flux de calendrier ZoneCours (Canvas, format iCalendar) et en tire l'agenda chiffré.
// Exécuté par .github/workflows/agenda.yml ; l'URL du flux vient du secret CANVAS_ICS_URL.
// N'écrit rien si le contenu n'a pas changé (évite un commit toutes les 3 heures).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { putJson } from "./crypto.mjs";

const url = process.env.CANVAS_ICS_URL;
if (!url) { console.log("CANVAS_ICS_URL absent : rien à faire."); process.exit(0); }

const res = await fetch(url);
if (!res.ok) { console.error("Flux inaccessible :", res.status); process.exit(1); }
const raw = await res.text();

// Déplie les lignes (RFC 5545) puis découpe les VEVENT
const lines = raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
const events = []; let cur = null;
for (const l of lines) {
  if (l === "BEGIN:VEVENT") cur = {};
  else if (l === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
  else if (cur) { const i = l.indexOf(":"); if (i > 0) { const [k, ...params] = l.slice(0, i).split(";"); cur[k] = { v: l.slice(i + 1), p: params.join(";") }; } }
}
const unesc = (s) => (s || "").replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
const TZ = "America/Toronto";
function when(f) {
  if (!f) return {};
  const v = f.v;
  if (/^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/); if (!m) return {};
  let d;
  if (m[7] === "Z") d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  else return { date: `${m[1]}-${m[2]}-${m[3]}`, heure: `${m[4]}:${m[5]}` }; // déjà en heure locale (TZID)
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, heure: `${parts.hour}:${parts.minute}` };
}
function kind(uid, title) {
  const t = title.toLowerCase();
  if (/examen|intra|final/.test(t)) return "examen";
  if (/quiz|\bq\d+-s\d+/.test(t)) return "quiz";
  if (uid.includes("assignment")) return "remise";
  if (/remise|livrable|travail|tp\b|devoir/.test(t)) return "remise";
  return "autre";
}
const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const items = [];
for (const e of events) {
  const uid = e.UID?.v || "";
  const titleFull = unesc(e.SUMMARY?.v).trim();
  const title = titleFull.replace(/\s*\[[^\]]*\]\s*$/, ""); // retire « [Nom du cours] »
  const contexte = titleFull.match(/\[([^\]]*)\]\s*$/)?.[1];
  const link = e.URL?.v || "";
  const canvas = +(link.match(/\/courses\/(\d+)/)?.[1] || unesc(e.DESCRIPTION?.v).match(/\/courses\/(\d+)/)?.[1] || 0) || null;
  const w = when(e.DTSTART);
  if (!w.date || w.date < since) continue;
  const det = unesc(e.DESCRIPTION?.v).replace(/\s+/g, " ").trim().slice(0, 400);
  items.push({ uid, date: w.date, heure: w.heure && w.heure !== "00:00" ? w.heure : undefined, canvas, contexte, type: kind(uid, title), titre: title, details: det || undefined, lien: link || undefined });
}
items.sort((a, b) => (a.date + (a.heure || "")).localeCompare(b.date + (b.heure || "")));

const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
const HF = new URL("../data/ics.hash", import.meta.url).pathname;
if (existsSync(HF) && readFileSync(HF, "utf8").trim() === hash) { console.log("Agenda inchangé."); process.exit(0); }
await putJson("agenda:ics", { source: "ics", maj: new Date().toISOString(), items }, null);
writeFileSync(HF, hash + "\n");
console.log(`Agenda mis à jour : ${items.length} éléments.`);
