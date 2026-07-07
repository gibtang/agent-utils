import { getToolBySlug, tools as seoTools, type ToolSEO } from '@/lib/seo-tools';

export interface ToolDocPage {
  slug: string;
  title: string;
  canonicalPath: string;
  summary: string;
  endpoint: string;
  method: string;
  auth: string;
  machineReadable: boolean;
  tool: ToolSEO;
  whatItDoes: string;
  whenToUse: string[];
  whenNotToUse: string[];
  agentWorkflows: string[];
  requestShape: string[];
  codeExamples: ToolSEO['codeExample'];
  failureModes: string[];
  relatedSlugs: string[];
}

function requireTool(slug: string): ToolSEO {
  const tool = getToolBySlug(slug);
  if (!tool) {
    throw new Error(`Missing tool metadata for slug: ${slug}`);
  }
  return tool;
}

function buildDocPage(slug: string, fields: Omit<ToolDocPage, 'slug' | 'tool'>): ToolDocPage {
  return {
    slug,
    tool: requireTool(slug),
    ...fields,
  };
}

export const toolDocPages: ToolDocPage[] = [
  buildDocPage('kv-store', {
    title: 'KV Store',
    canonicalPath: '/docs/kv-store',
    summary: 'Tenant-isolated JSON state with CAS and TTL for durable agent memory.',
    endpoint: 'PUT /v1/kv/{namespace}/{key}',
    method: 'PUT',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Stores namespaced JSON values for each agent with optional TTL expiry and compare-and-set tokens so concurrent writes do not clobber each other.',
    whenToUse: [
      'Persist an agent conversation or task state between runs.',
      'Track cursors, last-seen IDs, or resumable progress markers.',
      'Store feature flags or agent configuration without running your own Redis.',
    ],
    whenNotToUse: [
      'You only need ephemeral in-process variables during one request.',
      'You need full relational queries, joins, or analytics.',
    ],
    agentWorkflows: [
      'A polling agent reads the last processed event ID, fetches new events, then writes the new cursor back with CAS.',
      'An orchestrator stores a task plan under a namespace and child agents update progress independently.',
      'A recovery agent resumes after restart by loading the last checkpointed JSON blob.',
    ],
    requestShape: ['value: any JSON serializable object', 'ttl_seconds?: number', 'cas?: string'],
    codeExamples: requireTool('kv-store').codeExample,
    failureModes: [
      'Concurrent writers should use CAS or they may overwrite each other.',
      'TTL expiry deletes state, so do not store only copy of important data there.',
      'Namespaces must be chosen consistently or agents will read the wrong state.',
    ],
    relatedSlugs: ['audit-log', 'checkpoint'],
  }),
  buildDocPage('audit-log', {
    title: 'Audit Log',
    canonicalPath: '/docs/audit-log',
    summary: 'Append-only decision records for accountability, compliance, and debugging.',
    endpoint: 'POST /v1/audit',
    method: 'POST',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Creates immutable, server-timestamped audit records that explain what an agent did, when it did it, and which metadata was attached.',
    whenToUse: [
      'You need a permanent trail of each agent decision.',
      'You need evidence for support, SOC 2, or regulated workflows.',
      'You want to reconstruct incidents from a single canonical log.',
    ],
    whenNotToUse: [
      'You only need debug logs that can be freely overwritten.',
      'You need high-volume analytics where append-only records are not enough.',
    ],
    agentWorkflows: [
      'A support agent logs the reason for every refund or escalation before it acts.',
      'A pricing bot records the model, prompt version, and decision metadata for later review.',
      'An ops agent stamps every high-risk action so humans can replay the full chain.',
    ],
    requestShape: ['action: string', 'metadata?: object', 'request_id?: string'],
    codeExamples: requireTool('audit-log').codeExample,
    failureModes: [
      'Do not treat the log as mutable state; entries are append-only by design.',
      'If metadata is missing, the record is still stored but may be less useful later.',
      'Sensitive fields should be redacted before logging.',
    ],
    relatedSlugs: ['checkpoint', 'dlq'],
  }),
  buildDocPage('dlq', {
    title: 'Dead Letter Queue',
    canonicalPath: '/docs/dlq',
    summary: 'Failure inbox for retries, inspection, and human triage of agent tasks.',
    endpoint: 'POST /v1/dlq',
    method: 'POST',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Captures failed task payloads and error context so an agent or operator can inspect, retry, or hand off the failure without rerunning the whole workflow.',
    whenToUse: [
      'An external API fails and you need to preserve the original input.',
      'A downstream validator rejects an agent response.',
      'A multi-step workflow fails and only one step needs retrying.',
    ],
    whenNotToUse: [
      'The task can be safely retried immediately and statelessly.',
      'You do not need the original payload after failure.',
    ],
    agentWorkflows: [
      'An API worker stores the failing request and error message, then a separate retry agent replays it later.',
      'A human operator reviews dead letters in a queue and decides whether to fix data or rerun the step.',
      'An autonomous pipeline escalates unrecoverable failures into a triage workflow instead of dropping them.',
    ],
    requestShape: ['payload: object', 'error: string', 'context?: object'],
    codeExamples: requireTool('dlq').codeExample,
    failureModes: [
      'If the payload is incomplete, retries may not be reproducible.',
      'Dead letters should be drained regularly or the queue becomes a dump bin.',
      'Retry logic must be idempotent or duplicate processing can happen.',
    ],
    relatedSlugs: ['checkpoint', 'kv-store'],
  }),
  buildDocPage('checkpoint', {
    title: 'Human-in-the-Loop',
    canonicalPath: '/docs/checkpoint',
    summary: 'Pause an agent and wait for human approval before continuing.',
    endpoint: 'POST /v1/checkpoints',
    method: 'POST',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Creates an approval gate that pauses execution until a human approves, rejects, or modifies the proposed action.',
    whenToUse: [
      'An agent is about to perform an irreversible or high-cost action.',
      'You need human sign-off for compliance or safety reasons.',
      'The agent is confident but the business impact is too high to automate completely.',
    ],
    whenNotToUse: [
      'The action is low risk and should never block the workflow.',
      'You need pure automation with no human review path.',
    ],
    agentWorkflows: [
      'A finance agent pauses before sending a wire transfer and resumes only after approval.',
      'An editor reviews a drafted article before publication.',
      'An operations agent asks for approval before deleting data or closing an account.',
    ],
    requestShape: ['title: string', 'callback_url: string', 'timeout_action?: string', 'timeout_seconds?: number'],
    codeExamples: requireTool('checkpoint').codeExample,
    failureModes: [
      'If the callback URL is wrong, the agent cannot resume.',
      'Timeout behaviour must be defined or the workflow can hang indefinitely.',
      'High-friction approvals should be reserved for genuinely risky steps.',
    ],
    relatedSlugs: ['audit-log', 'dlq'],
  }),
  buildDocPage('scheduler', {
    title: 'Scheduler',
    canonicalPath: '/docs/scheduler',
    summary: 'Schedule one-off callbacks with retries and optional DLQ fallback.',
    endpoint: 'POST /v1/schedules',
    method: 'POST',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Creates a scheduled callback for a future time, retries delivery on a fixed cadence if it fails, and can cascade unrecoverable failures into the dead letter queue.',
    whenToUse: [
      'You need to defer a follow-up step until a future timestamp.',
      'You want a callback delivery mechanism that survives process restarts.',
      'The workflow should retry before escalating to the DLQ or a human.',
    ],
    whenNotToUse: [
      'The task can run immediately in the current request.',
      'You need a recurring cron job rather than a one-off callback.',
    ],
    agentWorkflows: [
      'A reminder agent schedules a callback to re-check a stalled workflow after a fixed delay.',
      'A backend worker defers delivery until a payment window opens and then continues processing.',
      'A retry coordinator uses the scheduler to re-attempt delivery before handing the task off to the DLQ.',
    ],
    requestShape: ['callback_url: string', 'callback_payload?: object', 'fire_at: string', 'dlq_on_failure?: boolean'],
    codeExamples: requireTool('scheduler').codeExample,
    failureModes: [
      'If the callback URL is invalid, the job will fail before it can resume.',
      'If the fire time is in the past, scheduling should be rejected.',
      'When retries are exhausted, the job should move to the DLQ or be surfaced to an operator.',
    ],
    relatedSlugs: ['checkpoint', 'dlq', 'kv-store'],
  }),
  buildDocPage('image-upload', {
    title: 'Image Upload',
    canonicalPath: '/docs/image-upload',
    summary: 'Upload an image and return a durable hosted URL for downstream agent steps.',
    endpoint: 'POST /v1/upload',
    method: 'POST',
    auth: 'x-agent-id + x-api-key',
    machineReadable: true,
    whatItDoes:
      'Accepts a file upload and returns a hosted image URL so agents can hand off screenshots, generated images, or user media without local storage.',
    whenToUse: [
      'An agent needs to persist screenshots or generated images between steps.',
      'You want to hand off a stable URL to another service or human reviewer.',
      'Your workflow should not depend on temporary files on disk.',
    ],
    whenNotToUse: [
      'You need a full media CDN with transformations and image editing.',
      'The payload is not an image file.',
    ],
    agentWorkflows: [
      'A QA agent uploads a screenshot and drops the URL into a bug report.',
      'A multimodal agent stores a generated image before sending it to the next model.',
      'A support bot uploads customer-provided media for later review by a human.',
    ],
    requestShape: ['file: multipart/form-data', 'retentionHours?: number'],
    codeExamples: requireTool('image-upload').codeExample,
    failureModes: [
      'Large files may exceed upload or retention limits.',
      'If the agent discards the returned URL, the asset becomes hard to reference later.',
      'Temporary uploads should be purged or expiry can surprise downstream steps.',
    ],
    relatedSlugs: ['dlq', 'checkpoint'],
  }),
];

export function getToolDocPageBySlug(slug: string): ToolDocPage | undefined {
  return toolDocPages.find((page) => page.slug === slug);
}

export function getAllToolDocSlugs(): string[] {
  return toolDocPages.map((page) => page.slug);
}

export function getToolSeoPages(): ToolSEO[] {
  return seoTools;
}
