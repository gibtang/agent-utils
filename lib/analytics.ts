'use client';

/**
 * Privacy-safe product analytics for the public AgentUtils surface.
 *
 * Event parameters are deliberately limited to route/tool labels and action
 * sources. Never pass emails, Firebase UIDs, API keys, request bodies, or
 * arbitrary URL/query-string values here.
 */
export const ACTIVATION_KEY_EVENT = 'api_key_activated';

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

export function trackApiActivation(source: 'auth_sync' | 'dashboard_key'): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(ACTIVATION_KEY_EVENT)) return;
    window.sessionStorage.setItem(ACTIVATION_KEY_EVENT, '1');
  } catch {
    // Private browsing/storage-disabled browsers still get the event once.
  }
  trackEvent(ACTIVATION_KEY_EVENT, { source });
}
