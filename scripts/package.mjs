// Builds the release zip listing-photo-saver-<version>.zip from dist/ (ADR-0004).
// Uses fflate (already a runtime dependency, ADR-0006) rather than a shell `zip`
// so it behaves the same on CI and on any dev box. On a tag, the tag must equal
// v<manifest version> or the script aborts.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const DIST = 'dist';
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
const version = manifest.version;

let tag = '';
try { tag = execSync('git tag --points-at HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
if (tag && tag !== `v${version}`) {
  console.error(`Tag "${tag}" != manifest version "v${version}" (ADR-0004). Aborting.`);
  process.exit(1);
}

const entries = {};
const walk = (dir, prefix = '') => {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) walk(full, rel);
    else entries[rel] = [fs.readFileSync(full), { level: 6 }];
  }
};
walk(DIST);

const name = `listing-photo-saver-${version}.zip`;
fs.writeFileSync(name, zipSync(entries));
console.log(`packaged -> ${name} (${Object.keys(entries).length} files, ${fs.statSync(name).size} bytes)`);
