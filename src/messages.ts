// Messages between popup, content script and service worker (ADR-0001 §4/§5).

export interface ProbeRequest {
  type: 'probe';
  url: string;
}

export interface ProbeResponse {
  active: boolean;
  site: string;
  found: number;
  listingId: string;
  /** Page states this many photos but fewer are in the DOM — ask the user to open the viewer. */
  expectedCount?: number;
}

export interface DownloadRequest {
  type: 'download';
  url: string;
}

export interface DownloadResponse {
  ok: boolean;
  saved: number;
  total: number;
  filename: string;
  /** Set when the zip could not be saved at all (not for individual photo failures). */
  error?: string;
}

/** Content script -> popup, fire-and-forget, during a download. */
export interface ProgressMessage {
  type: 'progress';
  done: number;
  total: number;
}

/** Content script -> service worker: save via chrome.downloads when <a download> is blocked. */
export interface SaveFallbackRequest {
  type: 'save-fallback';
  filename: string;
  dataUrl: string;
}

export type Message = ProbeRequest | DownloadRequest | ProgressMessage | SaveFallbackRequest;
