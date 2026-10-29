// Crée keys.json : paire RSA, clé privée chiffrée par le mot de passe (PBKDF2 600 000 itérations).
// Usage : LI_PASSWORD='…' node tools/keygen.mjs            (nouvelle paire)
//         LI_OLD='…' LI_PASSWORD='…' node tools/keygen.mjs --rewrap   (changer le mot de passe, même paire)
import { writeFileSync, readFileSync } from "node:fs";
import { b64, unb64 } from "./crypto.mjs";
const { subtle } = globalThis.crypto;
const ITER = 600000;
const pw = process.env.LI_PASSWORD;
if (!pw || pw.length < 12) throw new Error("LI_PASSWORD manquant ou trop court");

async function kek(password, salt, usage) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, base, { name: "AES-GCM", length: 256 }, false, usage);
}

let pkcs8, spki;
if (process.argv.includes("--rewrap")) {
  const k = JSON.parse(readFileSync("keys.json", "utf8"));
  const key = await kek(process.env.LI_OLD, unb64(k.salt), ["decrypt"]);
  pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv: unb64(k.iv) }, key, unb64(k.priv));
  spki = unb64(k.pub);
} else {
  const pair = await subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["wrapKey", "unwrapKey"]);
  pkcs8 = await subtle.exportKey("pkcs8", pair.privateKey);
  spki = await subtle.exportKey("spki", pair.publicKey);
}
const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
const key = await kek(pw, salt, ["encrypt"]);
const priv = await subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
writeFileSync("keys.json", JSON.stringify({ v: 1, alg: "RSA-OAEP-3072/AES-GCM-256", kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), pub: b64(spki), priv: b64(priv) }, null, 1) + "\n");
console.log("keys.json écrit");
