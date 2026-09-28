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
/** The first usable API key is the legacy activation milestone for the public tools. */
export const ACTIVATION_KEY_EVENT = 'api_key_activated';
const CONSENT_KEY = 'agent_utils_analytics_consent';

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

  try {
    if (window.localStorage.getItem(CONSENT_KEY) !== 'accepted') return;
  } catch {
    return;
  }

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

/** Record a newly created account without sending identity or account data. */
export function trackSignUp(method: 'google'): void {
  trackEvent('sign_up', { method });
}

/** Record first API-key activation without exposing the key or account identity. */
export function trackApiActivation(source: 'auth_sync' | 'dashboard_key'): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(ACTIVATION_KEY_EVENT)) return;
    window.sessionStorage.setItem(ACTIVATION_KEY_EVENT, '1');
  } catch {
    // Storage-disabled browsers still get the event once per eligible call.
  }
  trackEvent(ACTIVATION_KEY_EVENT, { source });
}
