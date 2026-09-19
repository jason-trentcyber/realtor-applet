// ADR-0007: which adapters route photo bytes through the service worker.
// The relay itself is Chrome runtime behaviour (exercised by the headless
// harness); this pins the contract so a new adapter cannot silently opt in.
import { describe, expect, it } from 'vitest';
import { adapters } from '../src/adapters';

describe('fetchVia contract (ADR-0007 §1/§4)', () => {
  it('defaults to page-origin fetch; only homes.com uses the worker relay', () => {
    const viaWorker = adapters.filter((a) => a.fetchVia === 'worker').map((a) => a.site);
    expect(viaWorker).toEqual(['homes']);
    expect(adapters.filter((a) => a.fetchVia === undefined || a.fetchVia === 'page').map((a) => a.site)).toEqual(['realtor', 'zillow']);
  });
  it('every worker-relay adapter has its CDN in host_permissions and nothing else is listed', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')) as { host_permissions?: string[] };
    expect(manifest.host_permissions).toEqual(['https://images.homes.com/*', 'https://imagescdn.homes.com/*']);
    for (const h of manifest.host_permissions ?? []) expect(h).not.toMatch(/www\.|\*\.homes|realtor|zillow/);
  });
});
