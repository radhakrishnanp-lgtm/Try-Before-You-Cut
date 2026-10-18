// Prints an ADMIN_PASSWORD_HASH for .env. Usage: node scripts/hash-password.mjs 'your password'
import { randomBytes, scryptSync } from "node:crypto";

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error("Usage: node scripts/hash-password.mjs '<password of at least 8 characters>'");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw.normalize("NFKC"), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
console.log(`scrypt:16384:8:1:${salt.toString("base64url")}:${hash.toString("base64url")}`);
