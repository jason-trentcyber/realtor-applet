// Content script (ADR-0001 §4). Runs on detail pages and does the work:
// probe = run the adapter against the live document; download = fetch every
// photo from the page's own origin (concurrency 4), zip in memory with fflate,
// save via <a download> on a blob URL, chrome.downloads through the service
// worker as the fallback. Nothing is injected into the page.

import { findAdapterForUrl } from './adapters';
import { buildManifest, buildZip, fetchAll, zipName } from './download';
import type { DownloadResponse, Message, ProbeResponse } from './messages';

function zipBlob(bytes: Uint8Array): Blob {
  // TS 5.7+ types Uint8Array over ArrayBufferLike; Blob wants a plain ArrayBuffer view.
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

function saveViaAnchor(bytes: Uint8Array, filename: string): boolean {
  try {
    const blob = zipBlob(bytes);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return true;
  } catch {
    return false;
  }
}

function toDataUrl(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(zipBlob(bytes));
  });
}

async function saveViaDownloadsApi(bytes: Uint8Array, filename: string): Promise<void> {
  const dataUrl = await toDataUrl(bytes);
  const res = (await chrome.runtime.sendMessage({ type: 'save-fallback', filename, dataUrl } satisfies Message)) as
    | { ok: boolean; error?: string }
    | undefined;
  if (!res?.ok) throw new Error(res?.error ?? 'chrome.downloads failed');
}

async function download(url: string): Promise<DownloadResponse> {
  const adapter = findAdapterForUrl(url);
  if (!adapter) return { ok: false, saved: 0, total: 0, filename: '', error: 'Not a listing page' };
  const listing = adapter.extract(document);
  const filename = zipName(listing);
  if (listing.photos.length === 0) return { ok: false, saved: 0, total: 0, filename, error: 'No photos found' };

  const results = await fetchAll(listing.photos, (u) => fetch(u, { credentials: 'omit' }), (done, total) => {
    void chrome.runtime.sendMessage({ type: 'progress', done, total } satisfies Message).catch(() => undefined);
  });
  const manifest = buildManifest(listing, results, {
    sourceUrl: location.href,
    extensionVersion: chrome.runtime.getManifest().version,
  });
  const zip = buildZip(results, manifest);

  if (!saveViaAnchor(zip, filename)) {
    try {
      await saveViaDownloadsApi(zip, filename);
    } catch (e) {
      return { ok: false, saved: manifest.saved, total: manifest.total, filename, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ok: true, saved: manifest.saved, total: manifest.total, filename };
}

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg?.type === 'probe') {
    const adapter = findAdapterForUrl(msg.url);
    if (!adapter) {
      sendResponse({ active: false, site: '', found: 0, listingId: '' } satisfies ProbeResponse);
      return true;
    }
    const listing = adapter.extract(document);
    sendResponse({
      active: true,
      site: adapter.site,
      found: listing.photos.length,
      listingId: listing.listingId,
      ...(listing.expectedCount ? { expectedCount: listing.expectedCount } : {}),
    } satisfies ProbeResponse);
    return true;
  }
  if (msg?.type === 'download') {
    download(msg.url).then(sendResponse, (e: unknown) =>
      sendResponse({ ok: false, saved: 0, total: 0, filename: '', error: e instanceof Error ? e.message : String(e) } satisfies DownloadResponse),
    );
    return true; // async response
  }
  return false;
});
