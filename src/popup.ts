// Popup (ADR-0001 §4): display-only. Count comes from a probe message;
// the download flow (fetch -> zip -> save) is the realtor milestone.

const el = (id: string) => document.getElementById(id) as HTMLElement;

function setStatus(text: string) {
  el('status').textContent = text;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  try {
    const resp = await chrome.tabs.sendMessage(tab!.id!, { type: 'probe', url });
    const found = (resp as { found: number })?.found ?? 0;
    if (found > 0) {
      setStatus(`Found ${found} photos. Download unavailable yet — the download flow ships in the realtor milestone.`);
    } else {
      setStatus(
        resp?.active
          ? 'This is a recognized listing page, but no gallery was detected (extraction ships in the realtor milestone).'
          : 'Not a recognized listing page.',
      );
    }
  } catch {
    // content script not present (page not yet parsed) or page not eligible
    setStatus('Open a listing detail page to activate. (realtor.com, Zillow, homes.com)');
  }
}

void init();
