// Ajoute ou remplace du contenu chiffré dans le site (n'a besoin que de la clé publique).
// Usage :
//   node tools/put.mjs seance <fichier.json>        séance complète (id = <cours>-<num>, déduit du JSON)
//   node tools/put.mjs image <clé> <fichier.jpg>    image ; affiche le chemin à utiliser dans "images[].url"
//   node tools/put.mjs agenda-zc <fichier.json>     agenda tiré de ZoneCours  {maj, items:[…]}
//   node tools/put.mjs agenda-manuel <fichier.json> agenda saisi à la main    {maj, items:[…]}
//   node tools/put.mjs cours <fichier.json>         liste des cours           {cours:[…]}
//   node tools/put.mjs etat <fichier.json>          état de la vérification   {derniereVerif, fichiersVus, journal}
import { readFileSync } from "node:fs";
import { putJson, putImage, publicKey } from "./crypto.mjs";

const [kind, a, b] = process.argv.slice(2);
const pub = await publicKey();
const json = (p) => JSON.parse(readFileSync(p, "utf8"));

function checkSeance(s) {
  for (const k of ["cours", "num", "titre", "statut", "ordre"]) if (s[k] === undefined) throw new Error(`champ manquant : ${k}`);
  if (s.statut === "pret") {
    for (const k of ["resume", "cheat", "qcm"]) if (!Array.isArray(s[k]) || !s[k].length) throw new Error(`champ vide : ${k}`);
    s.qcm.forEach((q, i) => {
      if (!Array.isArray(q.choix) || q.choix.length !== 4) throw new Error(`QCM ${i + 1} : il faut 4 choix`);
      if (!(q.bonne >= 0 && q.bonne < 4)) throw new Error(`QCM ${i + 1} : « bonne » doit être 0 à 3`);
      if (!q.explication) throw new Error(`QCM ${i + 1} : explication manquante`);
    });
  }
}

if (kind === "seance") {
  const s = json(a); checkSeance(s);
  const id = `${s.cours}-${s.num}`;
  console.log(await putJson("seance:" + id, { id, ...s }, pub), id);
} else if (kind === "image") {
  console.log(await putImage(a, readFileSync(b), pub));
} else if (["agenda-zc", "agenda-manuel", "cours", "etat"].includes(kind)) {
  const id = kind.startsWith("agenda") ? "agenda:" + kind.slice(7) : kind;
  const obj = json(a);
  if (kind.startsWith("agenda")) {
    obj.source = kind.slice(7);
    for (const it of obj.items || []) { if (!it.date || !it.titre || !it.type) throw new Error("agenda : chaque item exige date, type, titre"); it.source = obj.source; }
  }
  console.log(await putJson(id, obj, pub));
} else {
  console.error("Type inconnu. Voir l'en-tête de tools/put.mjs."); process.exit(1);
}
