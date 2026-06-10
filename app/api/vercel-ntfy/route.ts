import { NextRequest, NextResponse } from 'next/server';

// Relay Vercel deployment webhooks → ntfy.sh + Telegram

const NTFY_URL = 'https://ntfy.sh';
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '-1003669787601';
const TELEGRAM_THREAD_ID = process.env.TELEGRAM_THREAD_ID;

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
  emoji: string;
  tag: string;
  priority: number;
};

const EVENT_CONFIG: Record<string, EventConfig> = {
  'deployment.created': {
    title: 'Deployment Started',
    emoji: '🚀',
    tag: 'rocket',
    priority: 3,
  },
  'deployment.succeeded': {
    title: 'Deployment Succeeded',
    emoji: '✅',
    tag: 'white_check_mark',
    priority: 3,
  },
  'deployment.ready': {
    title: 'Deployment Ready',
    emoji: '✅',
    tag: 'white_check_mark',
    priority: 3,
  },
  'deployment.error': {
    title: 'Deployment Failed',
    emoji: '❌',
    tag: 'x',
    priority: 4,
  },
  'deployment.canceled': {
    title: 'Deployment Canceled',
    emoji: '⏹️',
    tag: 'no_entry_sign',
    priority: 2,
  },
  'deployment.promoted': {
    title: 'Deployment Promoted',
    emoji: '⬆️',
    tag: 'arrow_up',
    priority: 3,
  },
  'deployment.check-rerequested': {
    title: 'Check Rerequested',
    emoji: '🔄',
    tag: 'arrows_counterclockwise',
    priority: 3,
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

function getProdUrl(productionDomains: string[]): string | undefined {
  if (productionDomains.length === 0) return undefined;
  const d = productionDomains[0];
  return d.startsWith('http') ? d : `https://${d}`;
}

function getDepUrl(deploymentUrl: string | undefined): string | undefined {
  if (!deploymentUrl) return undefined;
  return deploymentUrl.startsWith('http') ? deploymentUrl : `https://${deploymentUrl}`;
}

// ── ntfy.sh ─────────────────────────────────────────────────────────────────

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
    title: `Deployment ${eventType}`,
    emoji: '📦',
    tag: 'package',
    priority: 3,
  };

  const now = formatDate(new Date());
  const prodUrl = getProdUrl(productionDomains);
  const depUrl = getDepUrl(deploymentUrl);

  let message = '';
  if (prodUrl) {
    message = `🌐 ${prodUrl}`;
    if (depUrl) message += `\n🔗 ${depUrl}`;
  } else if (depUrl) {
    message = depUrl;
  } else {
    message = project;
  }
  message += `\n📅 ${now}`;
  if (errorMessage) message += `\n${errorMessage}`;

  const actions: NtfyAction[] = [];
  if ((eventType === 'deployment.succeeded' || eventType === 'deployment.ready')) {
    if (prodUrl) actions.push({ action: 'view', label: 'Visit Production', url: prodUrl });
    if (depUrl) actions.push({ action: 'view', label: 'Visit Preview', url: depUrl });
  }
  actions.push({ action: 'view', label: 'Open Dashboard', url: buildDashboardUrl(teamId, projectId, deploymentId) });

  return {
    topic: 'gibtang-vercel-events',
    title: `${config.emoji} ${config.title}`,
    message,
    tags: [config.tag],
    priority: config.priority,
    actions,
  };
}

// ── Telegram ────────────────────────────────────────────────────────────────

function buildTelegramText(
  eventType: string,
  project: string,
  teamId: string | undefined,
  projectId: string | undefined,
  deploymentId: string | undefined,
  deploymentUrl: string | undefined,
  productionDomains: string[],
  targetBranch: string | undefined,
  errorMessage: string | undefined,
): string {
  const config = EVENT_CONFIG[eventType] ?? {
    title: `Deployment ${eventType}`,
    emoji: '📦',
    tag: 'package',
    priority: 3,
  };

  const now = formatDate(new Date());
  const prodUrl = getProdUrl(productionDomains);
  const depUrl = getDepUrl(deploymentUrl);
  const dashUrl = buildDashboardUrl(teamId, projectId, deploymentId);

  let lines: string[] = [];
  lines.push(`${config.emoji} **${config.title}**`);
  lines.push(`📦 \`${project}\``);

  if (targetBranch) {
    lines.push(`🌿 Branch: \`${targetBranch}\``);
  }

  if (prodUrl) {
    lines.push(`🌐 [Production](${prodUrl})`);
  }
  if (depUrl) {
    lines.push(`🔗 [Preview](${depUrl})`);
  }

  lines.push(`🔗 [Dashboard](${dashUrl})`);
  lines.push(`📅 ${now}`);

  if (errorMessage) {
    lines.push('');
    lines.push(`⚠️ ${errorMessage}`);
  }

  return lines.join('\n');
}

async function sendToTelegram(text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set, skipping Telegram notification');
    return;
  }

  try {
    const payload: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (TELEGRAM_THREAD_ID) {
      payload.message_thread_id = Number(TELEGRAM_THREAD_ID);
    }

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Telegram sendMessage failed (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.error('Telegram send error:', err);
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

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

    // Build ntfy payload
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

    // Build Telegram text
    const tgText = buildTelegramText(
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

    // Send to both in parallel
    const [ntfyRes] = await Promise.all([
      fetch(NTFY_URL, {
        method: 'POST',
        body: JSON.stringify(ntfyPayload),
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
      sendToTelegram(tgText),
    ]);

    if (!ntfyRes.ok) {
      console.error(`ntfy.sh returned ${ntfyRes.status}: ${await ntfyRes.text()}`);
      return NextResponse.json({ error: 'ntfy.sh failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ntfyPayload });
  } catch (err) {
    console.error('vercel-ntfy relay error:', err);
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
