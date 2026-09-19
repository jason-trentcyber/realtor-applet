// Popup (ADR-0001 §5): state display only. Probe -> count; click -> download
// message to the content script; progress messages -> bar; result or drift
// notice (REQUIREMENTS F6/F7). No settings.

import type { DownloadResponse, Message, ProbeResponse } from './messages';
import { driftIssueUrl, SITE_LABEL } from './download';

const status = document.getElementById('status') as HTMLParagraphElement;
const bar = document.getElementById('progress') as HTMLProgressElement;
const button = document.getElementById('download') as HTMLButtonElement;

function setStatus(text: string) {
  status.textContent = text;
}

function showDrift(site: string, pageUrl: string) {
  const version = chrome.runtime.getManifest().version;
  status.textContent = `Layout changed on ${SITE_LABEL[site] ?? site}. `;
  const a = document.createElement('a');
  a.href = driftIssueUrl(site, pageUrl, version);
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Report it';
  status.appendChild(a);
  status.appendChild(document.createTextNode(' (sends the page URL and extension version only).'));
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const tabId = tab?.id;
  if (tabId === undefined) {
    setStatus('Open a listing detail page to activate. (realtor.com, Zillow, homes.com)');
    return;
  }

  let probe: ProbeResponse;
  try {
    probe = (await chrome.tabs.sendMessage(tabId, { type: 'probe', url } satisfies Message)) as ProbeResponse;
  } catch {
    // content script not present: page not eligible, or loaded before install
    setStatus('Open a listing detail page to activate. (realtor.com, Zillow, homes.com)');
    return;
  }

  if (!probe.active) {
    setStatus('Not a recognized listing page.');
    return;
  }
  if (probe.found === 0) {
    showDrift(probe.site, url);
    return;
  }

  if (probe.expectedCount && probe.found < probe.expectedCount) {
    setStatus(`${probe.found} of ${probe.expectedCount} photos are loaded. Open the photo viewer (click the main photo), then click the icon again to save all ${probe.expectedCount}.`);
  } else {
    setStatus(`Found ${probe.found} photos.`);
  }
  button.hidden = false;
  button.onclick = async () => {
    button.disabled = true;
    bar.hidden = false;
    bar.max = probe.found;
    bar.value = 0;
    setStatus(`Saving 0 of ${probe.found}…`);
    const onProgress = (msg: Message) => {
      if (msg?.type === 'progress') {
        bar.value = msg.done;
        setStatus(`Saving ${msg.done} of ${msg.total}…`);
      }
    };
    chrome.runtime.onMessage.addListener(onProgress);
    try {
      const res = (await chrome.tabs.sendMessage(tabId, { type: 'download', url } satisfies Message)) as DownloadResponse;
      bar.hidden = true;
      if (res.ok) {
        setStatus(res.saved === res.total ? `Saved ${res.total} photos → ${res.filename}` : `Saved ${res.saved} of ${res.total} photos → ${res.filename} (failures are listed in listing.json)`);
      } else {
        setStatus(`Could not save: ${res.error ?? 'unknown error'}`);
        button.disabled = false;
      }
    } catch (e) {
      bar.hidden = true;
      setStatus(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      button.disabled = false;
    } finally {
      chrome.runtime.onMessage.removeListener(onProgress);
    }
  };
}

void init();
