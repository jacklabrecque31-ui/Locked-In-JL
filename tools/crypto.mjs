// Chiffrement hybride (RSA-OAEP 3072 + AES-GCM 256) partagé par les outils Node.
// Format d'un fichier .bin : [384 octets : clé AES enveloppée RSA-OAEP][12 octets : IV][texte chiffré AES-GCM]
// La clé publique (keys.json) suffit pour chiffrer : l'automatisation n'a jamais besoin du mot de passe.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const { subtle } = globalThis.crypto;
const ROOT = new URL("..", import.meta.url).pathname;

export const b64 = (buf) => Buffer.from(buf).toString("base64");
export const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

export function loadKeys() {
  return JSON.parse(readFileSync(join(ROOT, "keys.json"), "utf8"));
}

export async function publicKey() {
  const k = loadKeys();
  return subtle.importKey("spki", unb64(k.pub), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["wrapKey"]);
}

export async function encryptBytes(bytes, pub) {
  pub = pub || (await publicKey());
  const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const wrapped = new Uint8Array(await subtle.wrapKey("raw", aes, pub, { name: "RSA-OAEP" }));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, aes, bytes));
  const out = new Uint8Array(wrapped.length + 12 + ct.length);
  out.set(wrapped, 0); out.set(iv, wrapped.length); out.set(ct, wrapped.length + 12);
  return out;
}

// Nom de fichier opaque et déterministe (le même id réécrit le même fichier)
export const fileId = (id) => createHash("sha256").update("locked-in:" + id).digest("hex").slice(0, 20);

export function writeBin(rel, bytes) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, bytes);
}

// Index public : liste des fichiers chiffrés (noms opaques) et date de mise à jour.
export function readIndex() {
  try { return JSON.parse(readFileSync(join(ROOT, "data/index.json"), "utf8")); }
  catch { return { v: 1, maj: null, fichiers: {} }; }
}
export function writeIndex(ix) {
  ix.maj = new Date().toISOString();
  const sorted = Object.fromEntries(Object.entries(ix.fichiers).sort());
  writeFileSync(join(ROOT, "data/index.json"), JSON.stringify({ ...ix, fichiers: sorted }, null, 1) + "\n");
}

// Chiffre un objet JSON sous un id logique (ex. "seance:COMP20929-S05", "agenda:zc", "cours")
export async function putJson(id, obj, pub) {
  const f = fileId(id);
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  writeBin(`data/s/${f}.bin`, await encryptBytes(bytes, pub));
  const ix = readIndex();
  ix.fichiers[f] = { t: id.split(":")[0], maj: new Date().toISOString() };
  writeIndex(ix);
  return f;
}

// Chiffre une image ; renvoie le chemin à mettre dans le JSON de la séance
export async function putImage(key, bytes, pub) {
  const f = fileId("img:" + key);
  writeBin(`img/${f}.bin`, await encryptBytes(bytes, pub));
  return `img/${f}.bin`;
}
