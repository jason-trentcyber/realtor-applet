// esbuild bundler for the MV3 extension (ADR-0006 §1). Outputs dist/.
import esbuild from 'esbuild';
import fs from 'node:fs';

const DIST = 'dist';
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// Copy static assets first so a build failure can't leave a half-dist.
for (const f of ['manifest.json', 'src/popup.html', 'src/icons/icon16.png', 'src/icons/icon32.png', 'src/icons/icon48.png', 'src/icons/icon128.png']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, `${DIST}/${f.split('/').pop()}`);
}

await esbuild.build({
  entryPoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup.ts',
  },
  outdir: DIST,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: 'inline',
  logLevel: 'info',
});
console.log('built -> dist/ (load unpacked at chrome://extensions)');
