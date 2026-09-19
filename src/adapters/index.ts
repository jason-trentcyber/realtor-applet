// Registry of installed adapters (ADR-0001 §3). The content script and tests
// both go through here.

import type { SiteAdapter } from './types';
import { realtorAdapter } from './realtor';
import { zillowAdapter } from './zillow';
import { homesAdapter } from './homes';

export const adapters: SiteAdapter[] = [realtorAdapter, zillowAdapter, homesAdapter];

export function findAdapterForUrl(url: string): SiteAdapter | undefined {
  return adapters.find((a) => a.matches(url));
}
