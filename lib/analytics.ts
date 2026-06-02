// Google Analytics 4 Event Tracking — AgentUtils
// Measurement ID: G-7EMEKQ4LXK

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

// Safe GA4 event wrapper
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', eventName, eventParams);
    } catch (error) {
      console.error('GA4 tracking error:', error);
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log('[GA4 Dev]', eventName, eventParams);
  }
};

// AgentUtils-specific event helpers
export const analytics = {
  // Page & navigation
  pageView: (params: { page_title: string; page_location: string }) => {
    trackEvent('page_view', params);
  },

  navigationClick: (params: { destination: string; link_text: string }) => {
    trackEvent('navigation_click', params);
  },

  // Docs & tool discovery
  docPageView: (params: { tool_name: string; section?: string }) => {
    trackEvent('doc_page_view', params);
  },

  toolTryClick: (params: { tool_name: string }) => {
    trackEvent('tool_try_click', params);
  },

  // API usage (client-side observable events)
  apiCall: (params: {
    endpoint: string;
    method: string;
    success: boolean;
    response_time_ms?: number;
  }) => {
    trackEvent('api_call', params);
  },

  // Auth events
  authAction: (params: {
    action: 'login' | 'signup' | 'logout';
    method?: string;
    success: boolean;
  }) => {
    trackEvent('auth_action', params);
  },

  // Dashboard events
  dashboardAction: (params: {
    action: string;
    target?: string;
    success: boolean;
  }) => {
    trackEvent('dashboard_action', params);
  },

  // Pricing & billing
  pricingView: () => {
    trackEvent('pricing_view');
  },

  checkoutStart: (params: { plan: string; price_id: string }) => {
    trackEvent('checkout_start', params);
  },

  checkoutComplete: (params: { plan: string }) => {
    trackEvent('checkout_complete', params);
  },

  // File hosting
  fileUpload: (params: { file_type: string; file_size_kb: number; success: boolean }) => {
    trackEvent('file_upload', params);
  },

  fileDownload: (params: { file_id: string }) => {
    trackEvent('file_download', params);
  },

  // Error tracking
  error: (params: { error_type: string; error_message: string; component?: string }) => {
    trackEvent('error', params);
  },

  // External link clicks
  externalLinkClick: (params: { link_url: string; link_text: string }) => {
    trackEvent('external_link_click', params);
  },
};
