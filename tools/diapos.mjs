// Ajoute (ou remplace) les diapos complètes d'un document dans une séance en clair, en chiffrant chaque image.
// Usage : node tools/diapos.mjs <seance.json> "<nom du document>" "<lien ZoneCours>" <dossier d'images> [autre triplet…]
// Le dossier contient d-001.webp (ou .jpg), d-002…, dans l'ordre des diapos.
// Le fichier JSON est réécrit avec un champ « diapos » : [{nom, lien, images:[img/….bin]}].
// Lancer ensuite : node tools/put.mjs seance <seance.json>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { putImage, publicKey } from "./crypto.mjs";

const [fichier, ...reste] = process.argv.slice(2);
if (!fichier || reste.length % 3) {
  console.error('Usage : node tools/diapos.mjs <seance.json> "<nom>" "<lien>" <dossier> [...]');
  process.exit(1);
}
const s = JSON.parse(readFileSync(fichier, "utf8"));
const id = s.id || `${s.cours}-${s.num}`;
const pub = await publicKey();
const slug = (x) => x.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
s.diapos = Array.isArray(s.diapos) ? s.diapos : [];
for (let i = 0; i < reste.length; i += 3) {
  const [nom, lien, dossier] = reste.slice(i, i + 3);
  const fichiers = readdirSync(dossier).filter((f) => /^d-\d+\.(webp|jpe?g)$/i.test(f)).sort();
  if (!fichiers.length) { console.error(`Aucune image d-NNN dans ${dossier}`); process.exit(1); }
  const images = [];
  for (const [n, f] of fichiers.entries()) {
    images.push(await putImage(`diapo:${id}:${slug(nom)}:${n + 1}`, readFileSync(join(dossier, f)), pub));
  }
  s.diapos = s.diapos.filter((d) => d.nom !== nom);
  s.diapos.push({ nom, lien: lien || undefined, images });
  console.log(`${id} · ${nom} : ${images.length} diapos`);
}
writeFileSync(fichier, JSON.stringify(s, null, 1));
