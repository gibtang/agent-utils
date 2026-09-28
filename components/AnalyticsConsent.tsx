'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CONSENT_KEY = 'agent_utils_analytics_consent';
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function mirrorConsentToCookie(value: 'accepted' | 'declined'): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadAnalytics(): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: unknown[]) => {
    window.dataLayer?.push(args);
  });

  if (!document.querySelector('script[data-agent-utils-ga]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    script.dataset.agentUtilsGa = 'true';
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  });
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [decision, setDecision] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      if (stored === 'accepted' || stored === 'declined') {
        setDecision(stored);
        mirrorConsentToCookie(stored);
      }
      if (stored === 'accepted') loadAnalytics();
    } catch {
      // Storage-disabled browsers stay opted out.
    }
  }, []);

  useEffect(() => {
    if (decision !== 'accepted' || !GA_MEASUREMENT_ID || !window.gtag) return;
    window.gtag('event', 'page_view', { page_path: pathname });
  }, [decision, pathname]);

  const choose = (value: 'accepted' | 'declined') => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
      mirrorConsentToCookie(value);
    } catch {
      // If storage is unavailable, the choice applies only to this render.
    }
    setDecision(value);
    if (value === 'accepted') loadAnalytics();
  };

  if (!GA_MEASUREMENT_ID || decision !== null) return null;

  return (
    <aside
      role="dialog"
      aria-label="Analytics preferences"
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-200 shadow-2xl"
    >
      <p>
        We use privacy-safe analytics to understand which tools and documentation are useful.
        No API keys, request bodies, email addresses, or user IDs are sent.{' '}
        <Link href="/privacy" className="text-emerald-400 underline">Read our privacy policy</Link>.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="rounded-md bg-emerald-500 px-3 py-2 font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Accept analytics
        </button>
        <button
          type="button"
          onClick={() => choose('declined')}
          className="rounded-md border border-zinc-700 px-3 py-2 text-zinc-300 hover:border-zinc-500"
        >
          Decline
        </button>
      </div>
    </aside>
  );
}
