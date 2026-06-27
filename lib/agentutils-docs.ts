export type AgentUtilsDocSlug = 'kv' | 'audit' | 'dlq' | 'scheduler' | 'hitl' | 'image-upload';

export type AgentUtilsDoc = {
  slug: AgentUtilsDocSlug;
  title: string;
  shortTitle: string;
  status: 'current' | 'legacy';
  endpoint: string;
  method: string;
  summary: string;
  whatItIs: string;
  agentUse: string;
  requestExample: string;
  responseExample: string;
  failureModes: string[];
  keywords: string[];
  frontmatter: {
    title: string;
    description: string;
    canonical: string;
    status: string;
    endpoint: string;
    method: string;
    keywords: string[];
  };
  machineSummary: {
    slug: AgentUtilsDocSlug;
    title: string;
    status: 'current' | 'legacy';
    endpoint: string;
    method: string;
    purpose: string;
    agent_pattern: string;
    failure_modes: string[];
  };
};

export const agentUtilsDocs: AgentUtilsDoc[] = [
  {
    slug: 'kv',
    title: 'KV Store',
    shortTitle: 'KV',
    status: 'current',
    endpoint: 'GET/PUT/DELETE /v1/kv/{namespace}/{key}',
    method: 'GET, PUT, DELETE',
    summary: 'Tenant-isolated key-value storage with namespaces, TTL, and compare-and-swap writes.',
    whatItIs:
      'Use KV when an agent needs durable state between turns, optimistic concurrency control, or a small shared scratchpad that is still isolated by tenant.',
    agentUse:
      'Agents use KV to checkpoint progress, persist structured state, and avoid recomputing earlier steps after a restart or timeout.',
    requestExample: `curl -X PUT "https://www.agent-utils.com/v1/kv/workflows/onboarding/state" \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_…" \
  -H "content-type: application/json" \
  -d '{
    "value": {"step": "awaiting_approval", "attempt": 2},
    "ttl_seconds": 3600,
    "cas_version": 4
  }'`,
    responseExample: `{
  "success": true,
  "data": {
    "namespace": "workflows/onboarding",
    "key": "state",
    "version": 5,
    "ttl_seconds": 3600,
    "value": {"step": "awaiting_approval", "attempt": 2}
  }
}`,
    failureModes: [
      '409 CAS_MISMATCH when the stored version changed before write',
      '400 INVALID_KEY or INVALID_NAMESPACE when the path is malformed',
      '404 NOT_FOUND when reading a key that does not exist or has expired',
    ],
    keywords: ['kv store api', 'agent state persistence', 'compare and swap api', 'tenant isolated key value'],
    frontmatter: {
      title: 'KV Store API Docs — AgentUtils',
      description: 'Tenant-isolated key-value storage with CAS, TTL, and agent-friendly state persistence.',
      canonical: '/docs/kv',
      status: 'current',
      endpoint: 'GET/PUT/DELETE /v1/kv/{namespace}/{key}',
      method: 'GET, PUT, DELETE',
      keywords: ['kv store api', 'agent state persistence', 'compare and swap api', 'tenant isolated key value'],
    },
    machineSummary: {
      slug: 'kv',
      title: 'KV Store',
      status: 'current',
      endpoint: 'GET/PUT/DELETE /v1/kv/{namespace}/{key}',
      method: 'GET, PUT, DELETE',
      purpose: 'Durable agent state with TTL and optimistic concurrency.',
      agent_pattern: 'Checkpoint workflow state and resume from the latest version.',
      failure_modes: ['409 CAS_MISMATCH', '400 INVALID_KEY', '404 NOT_FOUND'],
    },
  },
  {
    slug: 'audit',
    title: 'Audit Log',
    shortTitle: 'Audit',
    status: 'current',
    endpoint: 'POST /v1/audit',
    method: 'POST',
    summary: 'Append-only event log for immutable, server-timestamped agent traces.',
    whatItIs:
      'Use Audit Log when every significant action should be recorded immutably for debugging, compliance, or human review.',
    agentUse:
      'Agents write audit entries after key decisions so operators can reconstruct what happened without trusting agent memory.',
    requestExample: `curl -X POST https://www.agent-utils.com/v1/audit \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_…" \
  -H "content-type: application/json" \
  -d '{
    "action": "email.sent",
    "workflow_id": "wf-42",
    "actor": "agent",
    "metadata": {"recipient": "ops@example.com", "template": "status_update"}
  }'`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "evt_123",
    "created_at": "2026-06-27T07:00:00.000Z",
    "workflow_id": "wf-42"
  }
}`,
    failureModes: [
      '400 INVALID_PAYLOAD when required fields are missing',
      '413 PAYLOAD_TOO_LARGE when the metadata blob is too large',
      '401 UNAUTHORIZED when the agent key is missing or invalid',
    ],
    keywords: ['audit log api', 'immutable event log', 'agent trace logging', 'append only api'],
    frontmatter: {
      title: 'Audit Log API Docs — AgentUtils',
      description: 'Append-only event logging for AI agents with immutable, server-timestamped entries.',
      canonical: '/docs/audit',
      status: 'current',
      endpoint: 'POST /v1/audit',
      method: 'POST',
      keywords: ['audit log api', 'immutable event log', 'agent trace logging', 'append only api'],
    },
    machineSummary: {
      slug: 'audit',
      title: 'Audit Log',
      status: 'current',
      endpoint: 'POST /v1/audit',
      method: 'POST',
      purpose: 'Immutable event trail for compliance and debugging.',
      agent_pattern: 'Write one log entry per meaningful state transition.',
      failure_modes: ['400 INVALID_PAYLOAD', '413 PAYLOAD_TOO_LARGE', '401 UNAUTHORIZED'],
    },
  },
  {
    slug: 'dlq',
    title: 'Dead Letter Queue',
    shortTitle: 'DLQ',
    status: 'current',
    endpoint: 'POST /v1/dlq',
    method: 'POST, GET, CLAIM, RESOLVE, FAIL',
    summary: 'Failure inbox for recovering agent tasks that need inspection or retry.',
    whatItIs:
      'Use DLQ when downstream tools fail and the original payload, error context, and retry state need to be preserved for later recovery.',
    agentUse:
      'Agents send failed work into DLQ, claim items atomically, repair the underlying issue, and then resolve or fail the record explicitly.',
    requestExample: `curl -X POST https://www.agent-utils.com/v1/dlq \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_…" \
  -H "content-type: application/json" \
  -d '{
    "payload": {"job_id": "job_7", "provider": "smtp"},
    "error": "SMTP timeout after 30s",
    "retry_after_seconds": 300
  }'`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "dlq_123",
    "status": "queued",
    "available_at": "2026-06-27T07:05:00.000Z"
  }
}`,
    failureModes: [
      '409 CLAIMED_BY_ANOTHER_WORKER when another agent already holds the item',
      '404 NOT_FOUND when the DLQ item no longer exists',
      '422 RESOLUTION_INVALID when resolve/fail payloads do not match the stored item',
    ],
    keywords: ['dead letter queue api', 'failed task recovery', 'agent retry workflow', 'error inbox for agents'],
    frontmatter: {
      title: 'Dead Letter Queue API Docs — AgentUtils',
      description: 'Failure inbox for AI agents with claim/release, retry, and resolution flows.',
      canonical: '/docs/dlq',
      status: 'current',
      endpoint: 'POST /v1/dlq',
      method: 'POST, GET, CLAIM, RESOLVE, FAIL',
      keywords: ['dead letter queue api', 'failed task recovery', 'agent retry workflow', 'error inbox for agents'],
    },
    machineSummary: {
      slug: 'dlq',
      title: 'Dead Letter Queue',
      status: 'current',
      endpoint: 'POST /v1/dlq',
      method: 'POST, GET, CLAIM, RESOLVE, FAIL',
      purpose: 'Recover failed agent work without losing original context.',
      agent_pattern: 'Persist failure, claim it later, repair, and resolve explicitly.',
      failure_modes: ['409 CLAIMED_BY_ANOTHER_WORKER', '404 NOT_FOUND', '422 RESOLUTION_INVALID'],
    },
  },
  {
    slug: 'scheduler',
    title: 'Scheduler',
    shortTitle: 'Scheduler',
    status: 'current',
    endpoint: 'POST /v1/schedules',
    method: 'POST, GET, DELETE',
    summary: 'Delayed execution with signed callbacks and deterministic retry handling.',
    whatItIs:
      'Use Scheduler when an agent needs a one-time future callback without running a long-lived worker or cron process.',
    agentUse:
      'Agents schedule follow-up actions, reminders, or delayed automations and then resume when the signed callback arrives.',
    requestExample: `curl -X POST https://www.agent-utils.com/v1/schedules \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_…" \
  -H "content-type: application/json" \
  -d '{
    "fire_at": "2026-07-01T00:00:00Z",
    "callback_url": "https://your-app.com/agent/callback",
    "callback_payload": {"job_id": "job_7"}
  }'`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "sch_123",
    "fire_at": "2026-07-01T00:00:00Z",
    "status": "scheduled"
  }
}`,
    failureModes: [
      '400 INVALID_FIRE_AT when the timestamp is malformed or in the past',
      '422 CALLBACK_URL_REJECTED when the callback target is unsafe',
      '503 CALLBACK_RETRY_EXHAUSTED when retries are exhausted',
    ],
    keywords: ['scheduler api', 'future callback api', 'delayed execution api', 'agent reminder workflow'],
    frontmatter: {
      title: 'Scheduler API Docs — AgentUtils',
      description: 'Delayed execution and signed callback scheduling for AI agents.',
      canonical: '/docs/scheduler',
      status: 'current',
      endpoint: 'POST /v1/schedules',
      method: 'POST, GET, DELETE',
      keywords: ['scheduler api', 'future callback api', 'delayed execution api', 'agent reminder workflow'],
    },
    machineSummary: {
      slug: 'scheduler',
      title: 'Scheduler',
      status: 'current',
      endpoint: 'POST /v1/schedules',
      method: 'POST, GET, DELETE',
      purpose: 'Delayed execution with webhook callbacks.',
      agent_pattern: 'Schedule work once and continue when the callback fires.',
      failure_modes: ['400 INVALID_FIRE_AT', '422 CALLBACK_URL_REJECTED', '503 CALLBACK_RETRY_EXHAUSTED'],
    },
  },
  {
    slug: 'hitl',
    title: 'Human-in-the-Loop',
    shortTitle: 'HITL',
    status: 'current',
    endpoint: 'POST /v1/checkpoints',
    method: 'POST, GET, APPROVE, REJECT',
    summary: 'Approval gate that pauses an agent until a human explicitly allows continuation.',
    whatItIs:
      'Use Human-in-the-Loop for high-stakes actions that should stop at a checkpoint until a person confirms, edits, or rejects the proposed action.',
    agentUse:
      'Agents propose an action, pause at a checkpoint, and only continue after the signed approval callback or approval key action arrives.',
    requestExample: `curl -X POST https://www.agent-utils.com/v1/checkpoints \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_…" \
  -H "content-type: application/json" \
  -d '{
    "title": "Approve refund?",
    "reason": "Refund amount exceeds auto-approve threshold",
    "callback_url": "https://your-app.com/agent/resume",
    "timeout_action": "auto_reject",
    "timeout_seconds": 3600
  }'`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "chk_123",
    "status": "waiting",
    "expires_at": "2026-06-27T08:00:00.000Z"
  }
}`,
    failureModes: [
      '403 CHECKPOINT_CLOSED when the approval window has expired',
      '409 INVALID_TRANSITION when approve/reject is called in the wrong state',
      '422 CALLBACK_SIGNATURE_INVALID when the approval callback fails verification',
    ],
    keywords: ['human in the loop api', 'approval gate api', 'agent review workflow', 'pause agent approval'],
    frontmatter: {
      title: 'Human-in-the-Loop API Docs — AgentUtils',
      description: 'Approval gates and checkpoints for pausing AI agents before high-stakes actions.',
      canonical: '/docs/hitl',
      status: 'current',
      endpoint: 'POST /v1/checkpoints',
      method: 'POST, GET, APPROVE, REJECT',
      keywords: ['human in the loop api', 'approval gate api', 'agent review workflow', 'pause agent approval'],
    },
    machineSummary: {
      slug: 'hitl',
      title: 'Human-in-the-Loop',
      status: 'current',
      endpoint: 'POST /v1/checkpoints',
      method: 'POST, GET, APPROVE, REJECT',
      purpose: 'Pause risky actions until a human approves them.',
      agent_pattern: 'Stop at the checkpoint and wait for a decision before resuming.',
      failure_modes: ['403 CHECKPOINT_CLOSED', '409 INVALID_TRANSITION', '422 CALLBACK_SIGNATURE_INVALID'],
    },
  },
  {
    slug: 'image-upload',
    title: 'Image Upload',
    shortTitle: 'Image Upload',
    status: 'legacy',
    endpoint: 'POST /api/upload',
    method: 'POST, GET',
    summary: 'Legacy image hosting endpoint that returns a stable public URL.',
    whatItIs:
      'Use this legacy endpoint only when you need to preserve discoverability for the older upload surface. New work should prefer the current v2 API documentation and avoid building around the legacy route.',
    agentUse:
      'Agents use the legacy uploader to store screenshots or generated images and then pass the returned URL into reports, emails, or chat messages.',
    requestExample: `curl -X POST https://www.agent-utils.com/api/upload \
  -H "x-api-key: au_your_key" \
  -F "file=@screenshot.png" \
  -F "retentionHours=24"`,
    responseExample: `{
  "success": true,
  "data": {
    "id": "9f3c1b2a-…",
    "url": "https://www.agent-utils.com/api/file-host/9f3c1b2a-…",
    "expiresAt": "2026-06-28T12:00:00.000Z"
  }
}`,
    failureModes: [
      '400 when the form body does not include file',
      '413 when the upload exceeds the file size limit',
      '415 when the content type is unsupported',
    ],
    keywords: ['legacy image upload api', 'host image url api', 'screenshot upload endpoint'],
    frontmatter: {
      title: 'Image Upload API Docs — AgentUtils (Legacy)',
      description: 'Legacy image upload endpoint kept for discoverability and compatibility.',
      canonical: '/docs/image-upload',
      status: 'legacy',
      endpoint: 'POST /api/upload',
      method: 'POST, GET',
      keywords: ['legacy image upload api', 'host image url api', 'screenshot upload endpoint'],
    },
    machineSummary: {
      slug: 'image-upload',
      title: 'Image Upload',
      status: 'legacy',
      endpoint: 'POST /api/upload',
      method: 'POST, GET',
      purpose: 'Legacy image hosting for backwards compatibility.',
      agent_pattern: 'Upload a file, capture the URL, and pass it downstream.',
      failure_modes: ['400 missing file', '413 file too large', '415 unsupported content type'],
    },
  },
];

export const agentUtilsDocOrder: AgentUtilsDocSlug[] = ['kv', 'audit', 'dlq', 'scheduler', 'hitl', 'image-upload'];

export function getAgentUtilsDoc(slug: string): AgentUtilsDoc | undefined {
  return agentUtilsDocs.find((doc) => doc.slug === slug);
}

export function getAgentUtilsDocSlugs(): AgentUtilsDocSlug[] {
  return agentUtilsDocs.map((doc) => doc.slug);
}

export function getCurrentAgentUtilsDocs(): AgentUtilsDoc[] {
  return agentUtilsDocs.filter((doc) => doc.status === 'current');
}

export function toYamlFrontmatter(doc: AgentUtilsDoc): string {
  const lines = [
    '---',
    `title: ${doc.frontmatter.title}`,
    `description: ${doc.frontmatter.description}`,
    `canonical: ${doc.frontmatter.canonical}`,
    `status: ${doc.frontmatter.status}`,
    `endpoint: ${doc.frontmatter.endpoint}`,
    `method: ${doc.frontmatter.method}`,
    'keywords:',
    ...doc.frontmatter.keywords.map((keyword) => `  - ${keyword}`),
    '---',
  ];
  return lines.join('\n');
}
