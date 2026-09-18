// Builds the release zip listing-photo-saver-<version>.zip from dist/ (ADR-0004).
// Only ever run by CI (release.yml) on a tag, so shell `zip` is available.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
const version = manifest.version;
let tag = '';
try { tag = execSync('git tag --points-at HEAD').toString().trim(); } catch { /* not on a tag */ }
if (tag && tag !== `v${version}`) {
  console.error(`Tag "${tag}" != manifest version "v${version}" (ADR-0004). Aborting.`);
  process.exit(1);
}
const name = `listing-photo-saver-${version}.zip`;
execSync(`cd dist && zip -qr ../${name} .`, { stdio: 'inherit' });
console.log(`packaged -> ${name}`);