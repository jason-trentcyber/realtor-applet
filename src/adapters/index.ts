// Registry of installed adapters (ADR-0001 §3). The content script and tests
// both go through here.

import type { SiteAdapter } from './types';
import { realtorAdapter } from './realtor';

export const adapters: SiteAdapter[] = [realtorAdapter];

export function findAdapterForUrl(url: string): SiteAdapter | undefined {
  return adapters.find((a) => a.matches(url));
}
