'use client';

/**
 * Privacy-safe product analytics for the public AgentUtils surface.
 *
 * Event parameters are deliberately limited to route/tool labels and action
 * sources. Never pass emails, Firebase UIDs, API keys, request bodies, or
 * arbitrary URL/query-string values here.
 */
/** The first successful Agent connection is the single activation milestone. */
export const ACTIVATION_EVENT = 'connection_confirmed';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  eventName: string,
  parameters: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    window.gtag('event', eventName, parameters);
    return;
  }

  // Preserve the event until GA's script has initialised. The queue contains
  // only the same non-PII values passed to gtag above.
  window.dataLayer?.push({ event: eventName, ...parameters });
}

export function trackConnectionConfirmed(runtime: 'codex' | 'hermes' | 'other'): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(ACTIVATION_EVENT)) return;
    window.sessionStorage.setItem(ACTIVATION_EVENT, '1');
  } catch {
    // Private browsing/storage-disabled browsers still get the event once.
  }
  trackEvent(ACTIVATION_EVENT, { source: 'pairing', runtime });
}

export function trackPairingCodeCreated(runtime: 'codex' | 'hermes' | 'other'): void {
  trackEvent('pairing_code_created', { source: 'dashboard', runtime });
}
