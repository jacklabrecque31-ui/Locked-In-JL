// Migration unique depuis le contenu en clair (hors dépôt). Usage : node tools/migrate.mjs <dossier_clair>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { putJson, putImage, publicKey } from "./crypto.mjs";
const dir = process.argv[2]; const pub = await publicKey();
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
let ni = 0;
for (const f of readdirSync(join(dir, "seances")).sort()) {
  const s = j(join(dir, "seances", f));
  for (const sec of s.resume || []) for (const im of sec.images || []) {
    im.url = await putImage(im.key, readFileSync(im.src), pub); delete im.src; delete im.key; ni++;
  }
  const id = `${s.cours}-${s.num}`;
  await putJson("seance:" + id, { id, ...s }, pub);
}
await putJson("cours", j(join(dir, "cours.json")), pub);
await putJson("agenda:manuel", j(join(dir, "agenda-manuel.json")), pub);
console.log("ok, images :", ni);
