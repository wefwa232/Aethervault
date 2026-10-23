// Stages the shared frontend into src-tauri/dist for the Tauri build (Tauri embeds a whole directory, and the repo
// root also holds docs/, tests/, etc.). Copies exactly the runtime tree; no transformation. Used as beforeBuildCommand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src-tauri', 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// sw.js is deliberately left out: the desktop app ships its files inside the EXE (js/pwa.js stays inert there).
for (const f of ['index.html', 'manifest.webmanifest']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'vendor', 'icons', 'music']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('staged frontend ->', path.relative(root, out));
