/**
 * Tool metadata for programmatic SEO landing pages.
 * Each tool gets a unique, SEO-optimized landing page at /tools/[slug].
 */
export interface ToolSEO {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  /** Canonical API-docs URL for this tool's "View API Docs" button. */
  docsUrl: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  subtitle: string;
  whatItDoes: string;
  whyAgentsNeed: string[];
  useCases: { title: string; description: string }[];
  codeExample: { curl: string; python: string; js: string };
  apiEndpoint: string;
  competitors: string[];
  keywords: string[];
  relatedTools: string[];
}

export const tools: ToolSEO[] = [
  {
    slug: 'kv-store',
    name: 'KV Store',
    icon: '🗃️',
    tagline: 'Tenant-isolated key-value storage with CAS, TTL, and namespaces.',
    docsUrl: '/docs/v2',
    metaTitle: 'Key-Value Store API for AI Agents | AgentUtils',
    metaDescription: 'Per-agent key-value storage with compare-and-set, TTL, and namespaces. Persistent agent state with a single HTTP call — no Redis, no database to run.',
    h1: 'Key-Value Store for AI Agent State',
    subtitle: 'Per-agent state. Compare-and-set. No database to run.',
    whatItDoes: 'Give every agent its own namespaced key-value store. Read and write JSON values with optional TTL expiry and compare-and-set (CAS) tokens for safe concurrent updates. State is isolated per agent and per tenant — two agents never see each other\'s keys, and you never provision a database.',
    whyAgentsNeed: [
      'Agents are stateless by default — they need durable memory between runs to remember context, cursors, and decisions',
      'Long-running agents need checkpointable progress (last-seen IDs, page tokens) that survives restarts',
      'Concurrent agent invocations corrupt shared state without optimistic locking',
      'Running your own Redis or Postgres for agent memory is infrastructure you shouldn\'t have to manage',
    ],
    useCases: [
      { title: 'Conversation memory', description: 'Store per-user chat context so an agent picks up exactly where the last turn left off' },
      { title: 'Cursor tracking', description: 'Remember the last-processed event ID so a polling agent never reprocesses or skips work' },
      { title: 'Feature flags & config', description: 'Agents read live config values per namespace without a redeploy or a separate config service' },
      { title: 'Idempotency keys', description: 'Store request fingerprints with TTL so retried agent actions don\'t double-execute' },
    ],
    codeExample: {
      curl: `curl -X PUT "https://www.agent-utils.com/v1/kv/state/last-seen" \\\n  -H "x-agent-id: poller" -H "x-api-key: agutil_agt_…" \\\n  -H "content-type: application/json" \\\n  -d '{\n    "value": { "event_id": "evt_42" },\n    "ttl_seconds": 86400\n  }'`,
      python: `import requests

resp = requests.put(
    "https://www.agent-utils.com/v1/kv/state/last-seen",
    headers={
        "x-agent-id": "poller",
        "x-api-key": "agutil_agt_…",
        "content-type": "application/json",
    },
    json={
        "value": {"event_id": "evt_42"},
        "ttl_seconds": 86400,
    },
)
assert resp.status_code == 200`,
      js: `const res = await fetch("https://www.agent-utils.com/v1/kv/state/last-seen", {
  method: "PUT",
  headers: {
    "x-agent-id": "poller",
    "x-api-key": "agutil_agt_…",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    value: { event_id: "evt_42" },
    ttl_seconds: 86400,
  }),
});`,
    },
    apiEndpoint: 'PUT /v1/kv/{namespace}/{key}',
    competitors: ['Redis', 'DynamoDB', 'Upstash Redis', 'Vercel KV'],
    keywords: ['key value store api', 'agent state storage', 'kv store for ai agents', 'compare and set api', 'serverless key value store', 'persistent agent memory'],
    relatedTools: ['audit-log', 'scheduler'],
  },
  {
    slug: 'audit-log',
    name: 'Audit Log',
    icon: '📜',
    tagline: 'Append-only, server-timestamped audit trail for every agent action.',
    docsUrl: '/docs/v2',
    metaTitle: 'Audit Log API for AI Agents | AgentUtils',
    metaDescription: 'Immutable, server-timestamped audit trail for AI agent actions. Record every decision with structured metadata — compliance and observability in one API call.',
    h1: 'Audit Logging for AI Agents',
    subtitle: 'Immutable records. Server timestamps. Compliance-ready.',
    whatItDoes: 'Append immutable audit entries that record what your agent did, when, and why. Every entry is server-timestamped and stored append-only — entries cannot be edited or deleted, only read. Query by time range, actor, or action to reconstruct exactly what happened during a run.',
    whyAgentsNeed: [
      'Autonomous agents make consequential decisions that regulators and customers will ask you to justify after the fact',
      'Client-side or self-reported timestamps are unreliable and tamper-able — only server-side stamps hold up in a review',
      'Reconstructing an incident from scattered logs across services is painful; a single append-only trail is auditable',
      'SOC 2 / HIPAA / financial controls demand evidence of what an automated system did and when',
    ],
    useCases: [
      { title: 'Decision provenance', description: 'Record each agent decision with its rationale so you can explain why an action was taken weeks later' },
      { title: 'Access logging', description: 'Log every time an agent reads or writes sensitive data for compliance evidence' },
      { title: 'Incident reconstruction', description: 'Replay the exact sequence of agent actions during an outage or bad outcome by time range' },
      { title: 'Cost & usage tracking', description: 'Stamp token spend and model calls per agent run for billing and attribution' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/v1/audit \\\n  -H "x-agent-id: support-bot" -H "x-api-key: agutil_agt_…" \\\n  -H "content-type: application/json" \\\n  -d '{\n    "action": "refund.issued",\n    "metadata": { "order_id": "ord_9", "amount": 4999 }\n  }'`,
      python: `import requests

resp = requests.post(
    "https://www.agent-utils.com/v1/audit",
    headers={
        "x-agent-id": "support-bot",
        "x-api-key": "agutil_agt_…",
        "content-type": "application/json",
    },
    json={
        "action": "refund.issued",
        "metadata": {"order_id": "ord_9", "amount": 4999},
    },
)
event_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://www.agent-utils.com/v1/audit", {
  method: "POST",
  headers: {
    "x-agent-id": "support-bot",
    "x-api-key": "agutil_agt_…",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    action: "refund.issued",
    metadata: { order_id: "ord_9", amount: 4999 },
  }),
});`,
    },
    apiEndpoint: 'POST /v1/audit',
    competitors: ['AWS CloudTrail', 'Datadog Audit Logs', 'Splunk'],
    keywords: ['audit log api', 'agent audit trail', 'immutable event log', 'compliance logging for ai', 'append only audit log', 'ai agent observability'],
    relatedTools: ['checkpoint', 'dlq'],
  },
  {
    slug: 'scheduler',
    name: 'Scheduler',
    icon: '⏰',
    tagline: 'Schedule one-shot agent callbacks with retries and DLQ cascade.',
    docsUrl: '/docs/v2',
    metaTitle: 'Scheduler & Delayed Callback API for AI Agents | AgentUtils',
    metaDescription: 'Schedule one-shot callbacks to your agent at a future time, with fixed retries and automatic dead-letter-queue cascade on failure. No cron, no queues to run.',
    h1: 'Scheduling for AI Agents',
    subtitle: 'Delayed callbacks. Built-in retries. Automatic failure cascade.',
    whatItDoes: 'Register a one-shot callback that fires at a future time and POSTs to your agent\'s webhook. If the webhook fails, the scheduler retries on a fixed backoff; if retries are exhausted, the job cascades into the dead letter queue for inspection. No cron daemon, no job queue to host.',
    whyAgentsNeed: [
      'Agents need to defer work — "follow up in 24 hours", "check back after the API rate limit resets" — without standing up a cron cluster',
      'Fire-and-forget scheduling loses jobs on restart; a persistent scheduler survives crashes and redeploys',
      'Webhook delivery fails transiently — built-in retry prevents silent dropped follow-ups',
      'Coupling "delay" logic into your agent loop blocks it; an external scheduler keeps the agent responsive',
    ],
    useCases: [
      { title: 'Delayed follow-ups', description: 'Schedule a callback 24 hours after a user message so the agent nudges them without blocking' },
      { title: 'Rate-limit backoff', description: 'When an external API returns 429, schedule the retry for when the limit resets instead of busy-looping' },
      { title: 'Time-based triggers', description: 'Fire an agent run at a specific clock time — end-of-day summaries, scheduled reports' },
      { title: 'Retry orchestration', description: 'Chain a risky agent step with a delayed confirmation callback that verifies the result' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/v1/schedules \\\n  -H "x-agent-id: followup-bot" -H "x-api-key: agutil_agt_…" \\\n  -H "content-type: application/json" \\\n  -d '{\n    "callback_url": "https://your-server.com/agent/run",\n    "run_at": "2026-06-28T09:00:00Z",\n    "payload": { "user_id": "u_7" }\n  }'`,
      python: `import requests

resp = requests.post(
    "https://www.agent-utils.com/v1/schedules",
    headers={
        "x-agent-id": "followup-bot",
        "x-api-key": "agutil_agt_…",
        "content-type": "application/json",
    },
    json={
        "callback_url": "https://your-server.com/agent/run",
        "run_at": "2026-06-28T09:00:00Z",
        "payload": {"user_id": "u_7"},
    },
)
schedule_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://www.agent-utils.com/v1/schedules", {
  method: "POST",
  headers: {
    "x-agent-id": "followup-bot",
    "x-api-key": "agutil_agt_…",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    callback_url: "https://your-server.com/agent/run",
    run_at: "2026-06-28T09:00:00Z",
    payload: { user_id: "u_7" },
  }),
});`,
    },
    apiEndpoint: 'POST /v1/schedules',
    competitors: ['AWS EventBridge Scheduler', 'Google Cloud Tasks', 'Upstash QStash', 'BullMQ'],
    keywords: ['scheduler api for agents', 'delayed callback api', 'agent job scheduling', 'webhook scheduler', 'cron alternative api', 'scheduled agent task'],
    relatedTools: ['dlq', 'kv-store'],
  },
  {
    slug: 'dlq',
    name: 'Dead Letter Queue',
    icon: '📬',
    tagline: 'Catch, inspect, and retry failed agent tasks.',
    docsUrl: '/docs/v2',
    metaTitle: 'Dead Letter Queue API for AI Agents | AgentUtils',
    metaDescription: 'Capture failed agent tasks, inspect error payloads, and retry via webhook. One API call to set up error handling for any AI agent workflow.',
    h1: 'Dead Letter Queue for AI Agents',
    subtitle: 'Catch failed tasks. Inspect payloads. Retry with one click.',
    whatItDoes: 'When an agent task fails, catch the error payload and original input in a dead letter queue. Inspect failures, debug payloads, and retry — all via API or webhook. No message broker to configure.',
    whyAgentsNeed: [
      'Agents fail silently — there is no built-in error handling or retry mechanism',
      'Debugging agent failures requires the original input AND the error context',
      'Retrying failed tasks means re-running the entire pipeline from scratch',
      'Most agent frameworks have no persistent error store between invocations',
    ],
    useCases: [
      { title: 'API call failures', description: 'Agent calls an external API that returns 500 — capture the request + error for retry' },
      { title: 'Data validation errors', description: 'Agent produces output that fails downstream validation — save it for human review' },
      { title: 'Timeout recovery', description: 'Long-running agent task times out — capture partial state for resumption' },
      { title: 'Multi-step pipeline failures', description: 'Step 3 of 5 fails — capture which step, what input, and the error for targeted retry' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/v1/dlq \\
  -H "x-agent-id: data-pipeline" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{
    "payload": {"fileId": "abc123", "rows": 5000},
    "error": "Column count mismatch: expected 12, got 15"
  }'`,
      python: `import requests

resp = requests.post(
    "https://www.agent-utils.com/v1/dlq",
    headers={
        "x-agent-id": "data-pipeline",
        "x-api-key": "agutil_agt_…",
        "content-type": "application/json",
    },
    json={
        "payload": {"fileId": "abc123", "rows": 5000},
        "error": "Column count mismatch: expected 12, got 15",
    },
)
dlq_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://www.agent-utils.com/v1/dlq", {
  method: "POST",
  headers: {
    "x-agent-id": "data-pipeline",
    "x-api-key": "agutil_agt_…",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    payload: { fileId: "abc123", rows: 5000 },
    error: "Column count mismatch: expected 12, got 15",
  }),
});`,
    },
    apiEndpoint: 'POST /v1/dlq',
    competitors: ['AWS SQS DLQ', 'RabbitMQ Dead Letter', 'Apache Kafka DLQ'],
    keywords: ['dead letter queue API', 'agent error handling', 'failed task recovery', 'agent retry mechanism', 'dead letter queue for AI', 'error queue for agents'],
    relatedTools: ['checkpoint', 'scheduler'],
  },
  {
    slug: 'checkpoint',
    name: 'Human-in-the-Loop',
    icon: '👤',
    tagline: 'Pause agents until humans approve.',
    docsUrl: '/docs/v2',
    metaTitle: 'Checkpoint & Approval Gate API for AI Agents | AgentUtils',
    metaDescription: 'Pause any AI agent and wait for human approval before continuing. Pre-approve, reject, or modify agent actions with a simple API call.',
    h1: 'Human-in-the-Loop Approval for AI Agents',
    subtitle: 'Pause agents. Let humans decide. Resume on approval.',
    whatItDoes: 'Create a checkpoint that pauses your agent mid-task. A human reviews the proposed action, approves or rejects it, and the agent resumes (or stops). The agent gets the human decision via a webhook callback — no polling required.',
    whyAgentsNeed: [
      'Autonomous agents can take irreversible actions (delete data, send emails, transfer money)',
      'Regulatory compliance requires human oversight for high-stakes decisions',
      'Agent confidence is probabilistic — some decisions need human verification',
      'Production deployments need guardrails before agents interact with real users',
    ],
    useCases: [
      { title: 'Financial transactions', description: 'Agent wants to execute a wire transfer — pause for human approval of amount and recipient' },
      { title: 'Content publishing', description: 'Agent drafted a blog post — pause for editorial review before publishing' },
      { title: 'Data deletion', description: 'Agent identified records to delete — pause for human to confirm which ones' },
      { title: 'Email sending', description: 'Agent composed an email to a customer — pause for manager approval' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/v1/checkpoints \\
  -H "x-agent-id: finance-bot" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{
    "title": "Approve wire transfer?",
    "callback_url": "https://your-server.com/resume",
    "timeout_action": "auto_reject",
    "timeout_seconds": 3600
  }'`,
      python: `import requests

resp = requests.post(
    "https://www.agent-utils.com/v1/checkpoints",
    headers={
        "x-agent-id": "finance-bot",
        "x-api-key": "agutil_agt_…",
        "content-type": "application/json",
    },
    json={
        "title": "Approve wire transfer?",
        "callback_url": "https://your-server.com/resume",
        "timeout_action": "auto_reject",
        "timeout_seconds": 3600,
    },
)
checkpoint_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://www.agent-utils.com/v1/checkpoints", {
  method: "POST",
  headers: {
    "x-agent-id": "finance-bot",
    "x-api-key": "agutil_agt_…",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    title: "Approve wire transfer?",
    callback_url: "https://your-server.com/resume",
    timeout_action: "auto_reject",
    timeout_seconds: 3600,
  }),
});
const { data } = await res.json();`,
    },
    apiEndpoint: 'POST /v1/checkpoints',
    competitors: ['LangGraph Human-in-the-Loop', 'Inkeep', 'Humanloop'],
    keywords: ['human in the loop API', 'agent approval workflow', 'AI agent guardrails', 'human oversight for AI', 'agent pause resume', 'human approval for agents'],
    relatedTools: ['dlq', 'audit-log'],
  },
  {
    slug: 'image-upload',
    name: 'Image Upload',
    icon: '🖼️',
    tagline: 'Upload images and get a hosted URL in one call.',
    docsUrl: '/docs/image-upload',
    metaTitle: 'Image Upload API for AI Agents | AgentUtils',
    metaDescription: 'Upload JPEG, PNG, WebP, or GIF images and receive a hosted URL in a single API call. No SDK, no S3 config — just multipart form data and an API key.',
    h1: 'Image Upload & Hosting API for AI Agents',
    subtitle: 'One API call. Durable hosted URL. Zero S3 configuration.',
    whatItDoes: 'Send an image via multipart/form-data and get back a hosted URL you can embed anywhere. Files land in Backblaze B2 object storage with configurable retention and are served from a stable, shareable URL — no bucket policy tuning, no presigned URL juggling.',
    whyAgentsNeed: [
      'Agents that generate or capture images need a place to put them before referencing them in downstream tools',
      'Configuring S3-compatible credentials, CORS, and bucket policies per agent is tedious and error-prone',
      'Agents need durable URLs they can hand to other APIs (chat, email, CMS) without the link expiring mid-task',
      'Self-hosting object storage is a distraction from the actual agent logic',
    ],
    useCases: [
      { title: 'Generated images', description: 'Agent calls an image model — upload the result and get a URL to use in the next step' },
      { title: 'Screenshot sharing', description: 'Agent captures a page screenshot — host it and share the link in a report or Slack message' },
      { title: 'User-submitted media', description: 'Collect an image from a user mid-conversation — store it and reference it later' },
      { title: 'Pipeline handoff', description: 'One agent produces an image, hands the hosted URL to a downstream agent that needs a public link' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/api/upload \\
  -H "x-api-key: au_your_key" \\
  -F "file=@screenshot.png" \\
  -F "retentionHours=24"`,
      python: `import requests

with open("screenshot.png", "rb") as f:
    resp = requests.post(
        "https://www.agent-utils.com/api/upload",
        headers={"x-api-key": "au_your_key"},
        files={"file": f},
        data={"retentionHours": 24},
    )
image_url = resp.json()["data"]["url"]`,
      js: `const form = new FormData();
form.append("file", fs.createReadStream("screenshot.png"));
form.append("retentionHours", "24");

const res = await fetch("https://www.agent-utils.com/api/upload", {
  method: "POST",
  headers: { "x-api-key": "au_your_key" },
  body: form,
});
const { data } = await res.json();
console.log(data.url);`,
    },
    apiEndpoint: 'POST /api/upload',
    competitors: ['AWS S3 Presigned URLs', 'Cloudinary', 'Imgix', 'Uploadcare'],
    keywords: ['image upload API', 'image hosting API', 'agent image storage', 'upload image get URL API', 'S3 compatible image upload', 'host image REST API'],
    relatedTools: ['dlq', 'checkpoint'],
  },
];

export function getToolBySlug(slug: string): ToolSEO | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getAllToolSlugs(): string[] {
  return tools.map((t) => t.slug);
}
