#!/usr/bin/env node
/**
 * Admin account management from the server's shell. Passwords are typed at a
 * hidden prompt, so they never appear in the code, env files, shell history
 * or process list.
 *
 *   npm run admin -- create <username> [--role owner|admin]
 *   npm run admin -- reset-password <username>
 *   npm run admin -- disable-2fa <username>
 *   npm run admin -- unlock <username>
 *   npm run admin -- unblock-ips          (clears the panel's blocked-IP list)
 *   npm run admin -- list
 *
 * Run it after the app has started (or been built) once, so the database exists.
 * Uses the same scrypt format as lib/auth/password.ts; keep them in step.
 */
import Database from "better-sqlite3";
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "storage"));
const DB_FILE = path.join(DATA_DIR, "gtasixhub.db");
const N = 131072, R = 8, P = 1, KEYLEN = 64;

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

if (!existsSync(DB_FILE)) fail(`No database at ${DB_FILE}. Build or start the site once first (or set DATA_DIR).`);
const db = new Database(DB_FILE);
db.pragma("busy_timeout = 15000");
if (!db.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").get()) fail("The database hasn't been set up yet. Start the site once, then run this again.");

const hash = (pw) =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(32);
    scryptCb(pw.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`),
    );
  });

function problem(pw, username) {
  if (pw.length < 12) return "Use at least 12 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) return "Mix at least three of: lowercase, uppercase, numbers and symbols.";
  if (pw.toLowerCase().includes(username.toLowerCase())) return "Don't include your username.";
  return null;
}

/**
 * One readline and one line iterator for every prompt: lines are buffered,
 * so this works typed at a terminal or piped in. On a terminal, typed
 * characters are echoed as "*".
 */
let rl = null;
let lines = null;
let muted = false;
async function askHidden(question) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    const write = rl._writeToOutput?.bind(rl);
    if (write) rl._writeToOutput = (s) => (muted && !s.includes("\n") ? rl.output.write("*") : write(s));
    lines = rl[Symbol.asyncIterator]();
  }
  process.stdout.write(question);
  muted = true;
  const { value, done } = await lines.next();
  muted = false;
  if (!process.stdin.isTTY) process.stdout.write("\n");
  if (done) fail("No input.");
  return value;
}

async function askPassword(username) {
  for (;;) {
    const a = await askHidden(`Password for ${username}: `);
    const why = problem(a, username);
    if (why) {
      console.log(`  ${why}`);
      continue;
    }
    const b = await askHidden("Repeat password: ");
    if (a !== b) {
      console.log("  Those didn't match. Try again.");
      continue;
    }
    return a;
  }
}

const user = (name) => db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(name);
const audit = (action, target) =>
  db.prepare("INSERT INTO audit_log (at, user_id, username, action, target, detail, ip) VALUES (?, NULL, 'cli', ?, ?, NULL, 'server shell')").run(Date.now(), action, target);

const [cmd, name, ...rest] = process.argv.slice(2);
const role = rest.includes("--role") ? rest[rest.indexOf("--role") + 1] : "owner";

switch (cmd) {
  case "create": {
    if (!name || !/^[A-Za-z0-9_.-]{3,24}$/.test(name)) fail("Usernames are 3–24 characters: letters, numbers, dot, dash or underscore.");
    if (!["owner", "admin"].includes(role)) fail("--role must be owner or admin.");
    if (user(name)) fail(`${name} already exists. Use reset-password instead.`);
    const pw = await askPassword(name);
    const t = Date.now();
    db.prepare(
      "INSERT INTO users (id, username, display_name, role, password_hash, created_at, updated_at, password_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(randomUUID(), name, name, role, await hash(pw), t, t, t);
    audit("user.create", name);
    console.log(`✔ Created ${role} ${name}. Sign in at /chewy and turn on two-factor authentication in your profile.`);
    break;
  }
  case "reset-password": {
    const u = user(name ?? "");
    if (!u) fail(`No user called ${name}.`);
    const pw = await askPassword(u.username);
    const t = Date.now();
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?").run(await hash(pw), t, t, u.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
    db.prepare("DELETE FROM login_throttle WHERE key = ?").run(`user:${u.username.toLowerCase()}`);
    audit("user.password.reset", u.username);
    console.log(`✔ Password reset for ${u.username}. All their sessions were signed out.`);
    break;
  }
  case "disable-2fa": {
    const u = user(name ?? "");
    if (!u) fail(`No user called ${name}.`);
    db.prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_last_step = 0, recovery_codes = '[]', updated_at = ? WHERE id = ?").run(Date.now(), u.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
    audit("user.2fa.disable", u.username);
    console.log(`✔ Two-factor authentication turned off for ${u.username}. Turn it back on after signing in.`);
    break;
  }
  case "unlock": {
    if (!name) fail("Give a username (or ip:<address>).");
    const key = name.startsWith("ip:") ? name : `user:${name.toLowerCase()}`;
    const r = db.prepare("DELETE FROM login_throttle WHERE key = ? OR key = ?").run(key, `mfa:${user(name)?.id ?? ""}`);
    audit("throttle.unlock", key);
    console.log(r.changes ? `✔ Unlocked ${name}.` : `${name} wasn't locked.`);
    break;
  }
  case "unblock-ips": {
    const r = db.prepare("DELETE FROM meta WHERE key = 'security:blocked_ips'").run();
    audit("security.unblock_all", null);
    console.log(r.changes ? "✔ Cleared the blocked IP list." : "No IPs were blocked.");
    break;
  }
  case "list": {
    const rows = db.prepare("SELECT username, role, disabled, totp_enabled, last_login_at FROM users ORDER BY role DESC, username").all();
    if (!rows.length) console.log("No users yet. Create one with: npm run admin -- create <username>");
    for (const r of rows)
      console.log(
        `${r.username.padEnd(24)} ${r.role.padEnd(6)} ${r.disabled ? "disabled" : "active  "} 2FA ${r.totp_enabled ? "on " : "off"}  last login ${r.last_login_at ? new Date(r.last_login_at).toISOString() : "never"}`,
      );
    break;
  }
  default:
    console.log("Usage: npm run admin -- <create|reset-password|disable-2fa|unlock|unblock-ips|list> [username] [--role owner|admin]");
}
rl?.close();
db.close();
