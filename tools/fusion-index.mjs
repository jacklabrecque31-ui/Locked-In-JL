// Résout un conflit git sur data/index.json en fusionnant les deux versions :
// pour chaque fichier, on garde l'entrée la plus récente (champ maj).
// Usage (pendant un rebase ou un merge en conflit) : node tools/fusion-index.mjs && git add data/index.json
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const version = (n) => JSON.parse(execSync(`git show :${n}:data/index.json`, { encoding: "utf8" }));
const a = version(2), b = version(3);
const fichiers = { ...a.fichiers };
for (const [k, v] of Object.entries(b.fichiers)) if (!fichiers[k] || v.maj > fichiers[k].maj) fichiers[k] = v;
const out = { v: 1, maj: [a.maj, b.maj].sort().pop(), fichiers: Object.fromEntries(Object.entries(fichiers).sort()) };
writeFileSync("data/index.json", JSON.stringify(out, null, 1) + "\n");
console.log(`index fusionné : ${Object.keys(out.fichiers).length} fichiers`);
