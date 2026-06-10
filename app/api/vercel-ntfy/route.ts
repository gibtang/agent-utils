import { NextRequest, NextResponse } from 'next/server';

// Relay Vercel deployment webhooks → ntfy.sh/gibtang-vercel-events
// Vercel webhook payload: https://vercel.com/docs/webhooks/webhooks-api

const NTFY_URL = 'https://ntfy.sh';

interface NtfyAction {
  action: string;
  label: string;
  url: string;
}

interface NtfyPayload {
  topic: string;
  title: string;
  message: string;
  tags: string[];
  priority: number;
  actions: NtfyAction[];
}

type EventConfig = {
  title: string;
  tag: string;
  priority: number;
  errorMessage?: string;
};

const EVENT_CONFIG: Record<string, EventConfig> = {
  'deployment.created': {
    title: '🚀 Deployment Started',
    tag: 'rocket',
    priority: 3, // default
  },
  'deployment.succeeded': {
    title: '✅ Deployment Succeeded',
    tag: 'white_check_mark',
    priority: 3, // default
  },
  'deployment.ready': {
    title: '✅ Deployment Ready',
    tag: 'white_check_mark',
    priority: 3, // default
  },
  'deployment.error': {
    title: '❌ Deployment Failed',
    tag: 'x',
    priority: 4, // high
  },
  'deployment.canceled': {
    title: '⏹️ Deployment Canceled',
    tag: 'no_entry_sign',
    priority: 2, // low
  },
  'deployment.promoted': {
    title: '⬆️ Deployment Promoted',
    tag: 'arrow_up',
    priority: 3, // default
  },
  'deployment.check-rerequested': {
    title: '🔄 Check Rerequested',
    tag: 'arrows_counterclockwise',
    priority: 3, // default
  },
};

function formatDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${day}${suffix} ${month} ${year}, ${displayHours}:${minutes} ${ampm} SGT`;
}

function buildDashboardUrl(teamId: string | undefined, projectId: string | undefined, deploymentId: string | undefined): string {
  const base = 'https://vercel.com';
  if (teamId && projectId && deploymentId) {
    return `${base}/${teamId}/${projectId}/deployments/${deploymentId}`;
  }
  return `${base}/dashboard`;
}

function buildNtfyPayload(
  eventType: string,
  project: string,
  teamId: string | undefined,
  projectId: string | undefined,
  deploymentId: string | undefined,
  deploymentUrl: string | undefined,
  productionDomains: string[],
  targetBranch: string | undefined,
  errorMessage: string | undefined,
): NtfyPayload {
  const config = EVENT_CONFIG[eventType] ?? {
    title: `📦 Deployment ${eventType}`,
    tag: 'package',
    priority: 3,
  };

  const now = formatDate(new Date());
  let message = '';

  // Production domain first (if available)
  if (productionDomains.length > 0) {
    const prodUrl = productionDomains[0].startsWith('http')
      ? productionDomains[0]
      : `https://${productionDomains[0]}`;
    message = `🌐 ${prodUrl}`;
    if (deploymentUrl) {
      const depUrl = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
      message += `\n🔗 ${depUrl}`;
    }
  } else if (deploymentUrl) {
    const url = deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
    message = `${url}`;
  } else {
    message = `${project}`;
  }
  message += `\n📅 ${now}`;

  if (errorMessage) {
    message += `\n${errorMessage}`;
  }

  const actions: NtfyAction[] = [];

  // "view" action for production domain (succeeded/ready only)
  if (
    (eventType === 'deployment.succeeded' || eventType === 'deployment.ready') &&
    productionDomains.length > 0
  ) {
    const prodUrl = productionDomains[0].startsWith('http')
      ? productionDomains[0]
      : `https://${productionDomains[0]}`;
    actions.push({
      action: 'view',
      label: 'Visit Production',
      url: prodUrl,
    });
  }

  // "view" action for deployment preview URL (succeeded/ready only)
  if (
    (eventType === 'deployment.succeeded' || eventType === 'deployment.ready') &&
    deploymentUrl
  ) {
    actions.push({
      action: 'view',
      label: 'Visit Preview',
      url: deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`,
    });
  }

  // Dashboard link for all events
  actions.push({
    action: 'view',
    label: 'Open Dashboard',
    url: buildDashboardUrl(teamId, projectId, deploymentId),
  });

  return {
    topic: 'gibtang-vercel-events',
    title: config.title,
    message,
    tags: [config.tag],
    priority: config.priority,
    actions,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Vercel sends { type, payload: { deployment, project, ... } }
    const eventType = body?.type ?? 'unknown';
    const payload = body?.payload ?? {};
    const project =
      payload?.project?.name ??
      payload?.deployment?.meta?.githubRepo ??
      'unknown-project';
    const deploymentUrl: string | undefined =
      payload?.deployment?.url ?? payload?.url;
    const targetBranch: string | undefined =
      payload?.deployment?.meta?.branch ??
      payload?.deployment?.meta?.gitBranch;
    const teamId: string | undefined = payload?.account?.id;
    const projectId: string | undefined =
      payload?.project?.id ?? payload?.projectId;
    const deploymentId: string | undefined =
      payload?.deployment?.id ?? payload?.id;
    const errorMessage: string | undefined =
      payload?.deployment?.meta?.buildErrorMessage;

    // Extract production domains from webhook payload
    const productionDomains: string[] = [];
    const aliasedDomains: string[] | undefined =
      payload?.deployment?.meta?.aliasedDomains ?? payload?.deployment?.alias;
    if (Array.isArray(aliasedDomains)) {
      productionDomains.push(...aliasedDomains);
    }

    const ntfyPayload = buildNtfyPayload(
      eventType,
      project,
      teamId,
      projectId,
      deploymentId,
      deploymentUrl,
      productionDomains,
      targetBranch,
      errorMessage,
    );

    // Forward to ntfy.sh as JSON
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      body: JSON.stringify(ntfyPayload),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    if (!res.ok) {
      console.error(`ntfy.sh returned ${res.status}: ${await res.text()}`);
      return NextResponse.json({ error: 'ntfy.sh failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ntfyPayload });
  } catch (err) {
    console.error('vercel-ntfy relay error:', err);
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
