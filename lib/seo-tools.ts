/**
 * Tool metadata for the launch surface.
 * Only the shipped tools should appear in public navigation and SEO pages.
 */
export interface ToolSEO {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
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
    metaDescription: 'Per-agent key-value storage with compare-and-set, TTL, and namespaces. Persistent agent memory with a single HTTP call.',
    h1: 'Key-Value Store for AI Agent State',
    subtitle: 'Per-agent state. Compare-and-set. No database to run.',
    whatItDoes: 'Give every agent its own namespaced key-value store. Read and write JSON values with optional TTL expiry and compare-and-set (CAS) tokens for safe concurrent updates. State is isolated per agent and per tenant.',
    whyAgentsNeed: [
      'Agents are stateless by default and need durable memory between runs',
      'Long-running agents need checkpointable progress that survives restarts',
      'Concurrent agent invocations corrupt shared state without optimistic locking',
      'Running your own Redis or Postgres for agent memory is infrastructure you should not have to manage',
    ],
    useCases: [
      { title: 'Conversation memory', description: 'Store per-user chat context so an agent picks up exactly where the last turn left off' },
      { title: 'Cursor tracking', description: 'Remember the last-processed event ID so a polling agent never reprocesses or skips work' },
      { title: 'Feature flags & config', description: 'Agents read live config values per namespace without a redeploy or a separate config service' },
      { title: 'Idempotency keys', description: 'Store request fingerprints with TTL so retried agent actions do not double-execute' },
    ],
    codeExample: {
      curl: `curl -X PUT "https://www.agent-utils.com/v1/kv/state/last-seen" \\
  -H "x-agent-id: poller" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{
    "value": { "event_id": "evt_42" },
    "ttl_seconds": 86400
  }'`,
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
    relatedTools: ['audit-log', 'checkpoint'],
  },
  {
    slug: 'audit-log',
    name: 'Audit Log',
    icon: '📜',
    tagline: 'Append-only, server-timestamped audit trail for every agent action.',
    docsUrl: '/docs/v2',
    metaTitle: 'Audit Log API for AI Agents | AgentUtils',
    metaDescription: 'Immutable, server-timestamped audit trail for AI agent actions. Record every decision with structured metadata.',
    h1: 'Audit Logging for AI Agents',
    subtitle: 'Immutable records. Server timestamps. Compliance-ready.',
    whatItDoes: 'Append immutable audit entries that record what your agent did, when, and why. Every entry is server-timestamped and stored append-only.',
    whyAgentsNeed: [
      'Autonomous agents make consequential decisions that customers will ask you to justify after the fact',
      'Client-side or self-reported timestamps are unreliable and tamper-able',
      'Reconstructing an incident from scattered logs across services is painful',
      'SOC 2 / HIPAA / financial controls demand evidence of what an automated system did and when',
    ],
    useCases: [
      { title: 'Decision provenance', description: 'Record each agent decision with its rationale so you can explain why an action was taken later' },
      { title: 'Access logging', description: 'Log every time an agent reads or writes sensitive data for compliance evidence' },
      { title: 'Incident reconstruction', description: 'Replay the exact sequence of agent actions during an outage or bad outcome by time range' },
      { title: 'Cost & usage tracking', description: 'Stamp token spend and model calls per agent run for billing and attribution' },
    ],
    codeExample: {
      curl: `curl -X POST https://www.agent-utils.com/v1/audit \\
  -H "x-agent-id: support-bot" -H "x-api-key: agutil_agt_…" \\
  -H "content-type: application/json" \\
  -d '{
    "action": "refund.issued",
    "metadata": { "order_id": "ord_9", "amount": 4999 }
  }'`,
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
    slug: 'dlq',
    name: 'Dead Letter Queue',
    icon: '📬',
    tagline: 'Catch, inspect, and retry failed agent tasks.',
    docsUrl: '/docs/v2',
    metaTitle: 'Dead Letter Queue API for AI Agents | AgentUtils',
    metaDescription: 'Capture failed agent tasks, inspect error payloads, and retry via webhook. One API call to set up error handling for any AI agent workflow.',
    h1: 'Dead Letter Queue for AI Agents',
    subtitle: 'Catch failed tasks. Inspect payloads. Retry with one click.',
    whatItDoes: 'When an agent task fails, catch the error payload and original input in a dead letter queue. Inspect failures, debug payloads, and retry.',
    whyAgentsNeed: [
      'Agents fail silently and do not have built-in error handling or retry mechanisms',
      'Debugging agent failures requires the original input and the error context',
      'Retrying failed tasks means re-running the entire pipeline from scratch',
      'Most agent frameworks have no persistent error store between invocations',
    ],
    useCases: [
      { title: 'API call failures', description: 'Agent calls an external API that returns 500 and captures the request plus error for retry' },
      { title: 'Data validation errors', description: 'Agent output fails downstream validation and is saved for human review' },
      { title: 'Timeout recovery', description: 'Long-running agent task times out and partial state is captured for resumption' },
      { title: 'Multi-step pipeline failures', description: 'Step 3 of 5 fails and the exact input plus error is captured for targeted retry' },
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
    relatedTools: ['checkpoint', 'kv-store'],
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
    whatItDoes: 'Create a checkpoint that pauses your agent mid-task. A human reviews the proposed action, approves or rejects it, and the agent resumes or stops.',
    whyAgentsNeed: [
      'Autonomous agents can take irreversible actions',
      'Regulatory compliance requires human oversight for high-stakes decisions',
      'Agent confidence is probabilistic and some decisions need human verification',
      'Production deployments need guardrails before agents interact with real users',
    ],
    useCases: [
      { title: 'Financial transactions', description: 'Agent wants to execute a transfer and pauses for human approval of amount and recipient' },
      { title: 'Content publishing', description: 'Agent drafted a blog post and pauses for editorial review before publishing' },
      { title: 'Data deletion', description: 'Agent identified records to delete and pauses for human to confirm which ones' },
      { title: 'Email sending', description: 'Agent composed an email to a customer and pauses for manager approval' },
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
    keywords: ['human in the loop api', 'agent approval workflow', 'ai agent guardrails', 'human oversight for ai', 'agent pause resume', 'human approval for agents'],
    relatedTools: ['dlq', 'audit-log'],
  },
  {
    slug: 'image-upload',
    name: 'Image Upload',
    icon: '🖼️',
    tagline: 'Upload images and get a hosted URL in one call.',
    docsUrl: '/docs/image-upload',
    metaTitle: 'Image Upload API for AI Agents | AgentUtils',
    metaDescription: 'Upload an image and receive a hosted URL in a single API call. No SDK, no extra setup.',
    h1: 'Image Upload for AI Agents',
    subtitle: 'One upload. One URL. Simple handoff.',
    whatItDoes: 'Upload an image and receive a durable hosted URL that an agent can pass to downstream tools or humans.',
    whyAgentsNeed: [
      'Agents that generate or capture images need a place to store them between steps',
      'Durable URLs are easier to hand off than raw file blobs',
      'Keeping image storage behind one API keeps the agent workflow simple',
    ],
    useCases: [
      { title: 'Generated images', description: 'Upload model outputs and get a URL for the next agent step' },
      { title: 'Screenshot sharing', description: 'Store screenshots and send a link in a report or message' },
      { title: 'User media handoff', description: 'Persist user-provided images for later processing' },
      { title: 'Pipeline outputs', description: 'Pass a hosted image URL to another service without local storage' },
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
    keywords: ['image upload api', 'image hosting api', 'agent image storage', 'upload image get url api', 'hosted image api'],
    relatedTools: ['dlq', 'checkpoint'],
  },
];

export function getToolBySlug(slug: string): ToolSEO | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getAllToolSlugs(): string[] {
  return tools.map((t) => t.slug);
}
