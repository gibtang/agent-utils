/**
 * Tool metadata for programmatic SEO landing pages.
 * Each tool gets a unique, SEO-optimized landing page at /tools/[slug].
 */
export interface ToolSEO {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
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
    slug: 'file-host',
    name: 'Ephemeral File Host',
    icon: '📎',
    tagline: 'Park files for agents. Auto-expires.',
    metaTitle: 'Ephemeral File Hosting API for AI Agents | AgentUtils',
    metaDescription: 'Upload, share, and auto-expire files from AI agents with a single API call. No storage config, no credentials. Files expire automatically after a set TTL.',
    h1: 'Ephemeral File Hosting for AI Agents',
    subtitle: 'Upload files from any agent. Auto-expires. No storage credentials to manage.',
    whatItDoes: 'Give agents a place to park files — PDFs, CSVs, images, logs — without provisioning S3 buckets, managing IAM policies, or handling cleanup. Files auto-expire after a configurable TTL (default: 1 hour). Access via a simple URL.',
    whyAgentsNeed: [
      'Agents are stateless — they terminate after each invocation and lose local files',
      'Agents run in sandboxes with no persistent disk or object storage access',
      'Agents have no credentials to authenticate with S3/GCS/Azure',
      'Cleaning up temporary files is a chore that every agent workflow needs',
    ],
    useCases: [
      { title: 'Report generation', description: 'Agent creates a PDF or CSV report and returns a download URL to the user' },
      { title: 'Log sharing', description: 'Agent uploads debug logs or execution traces for human review' },
      { title: 'Screenshot capture', description: 'Browser agent saves screenshots for later analysis or user confirmation' },
      { title: 'Data pipeline handoff', description: 'Agent A processes data, uploads it, Agent B picks it up via URL' },
    ],
    codeExample: {
      curl: `curl -X POST https://agentutils.dev/api/file-host \\
  -H "x-api-key: au_your_key" \\
  -F "file=@report.csv" \\
  -F "ttl=2"`,
      python: `import requests

resp = requests.post(
    "https://agentutils.dev/api/file-host",
    headers={"x-api-key": "au_your_key"},
    files={"file": open("report.csv", "rb")},
    data={"ttl": "2"},
)
file_url = resp.json()["data"]["url"]`,
      js: `const form = new FormData();
form.append("file", fs.createReadStream("report.csv"));
form.append("ttl", "2");

const res = await fetch("https://agentutils.dev/api/file-host", {
  method: "POST",
  headers: { "x-api-key": "au_your_key" },
  body: form,
});
const { data } = await res.json();
console.log(data.url); // https://agentutils.dev/api/file-host/abc123`,
    },
    apiEndpoint: 'POST /api/file-host',
    competitors: ['AWS S3', 'Cloudflare R2', 'Filestack', 'Transfer.sh'],
    keywords: ['file hosting API', 'ephemeral file storage', 'temporary file upload API', 'agent file hosting', 'file hosting for AI agents', 'auto-expiring files'],
    relatedTools: ['webhook', 'notify', 'dlq'],
  },
  {
    slug: 'dlq',
    name: 'Dead Letter Queue',
    icon: '📬',
    tagline: 'Catch, inspect, and retry failed agent tasks.',
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
      curl: `curl -X POST https://agentutils.dev/api/dlq \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "data-pipeline",
    "taskType": "import_csv",
    "error": "Column count mismatch: expected 12, got 15",
    "payload": {"fileId": "abc123", "rows": 5000}
  }'`,
      python: `import requests

requests.post(
    "https://agentutils.dev/api/dlq",
    headers={"x-api-key": "au_your_key"},
    json={
        "agentName": "data-pipeline",
        "taskType": "import_csv",
        "error": "Column count mismatch",
        "payload": {"fileId": "abc123", "rows": 5000},
    },
)`,
      js: `const res = await fetch("https://agentutils.dev/api/dlq", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agentName: "data-pipeline",
    taskType: "import_csv",
    error: "Column count mismatch",
    payload: { fileId: "abc123", rows: 5000 },
  }),
});`,
    },
    apiEndpoint: 'POST /api/dlq',
    competitors: ['AWS SQS DLQ', 'RabbitMQ Dead Letter', 'Apache Kafka DLQ'],
    keywords: ['dead letter queue API', 'agent error handling', 'failed task recovery', 'agent retry mechanism', 'dead letter queue for AI', 'error queue for agents'],
    relatedTools: ['webhook', 'notify', 'checkpoint'],
  },
  {
    slug: 'checkpoint',
    name: 'Human-in-the-Loop',
    icon: '👤',
    tagline: 'Pause agents until humans approve.',
    metaTitle: 'Human-in-the-Loop API for AI Agents | AgentUtils',
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
      curl: `curl -X POST https://agentutils.dev/api/checkpoint \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "finance-bot",
    "taskDescription": "Wire $5,000 to vendor",
    "state": {"amount": 5000, "vendor": "Acme Corp"},
    "webhookUrl": "https://your-server.com/resume"
  }'`,
      python: `import requests

resp = requests.post(
    "https://agentutils.dev/api/checkpoint",
    headers={"x-api-key": "au_your_key"},
    json={
        "agentName": "finance-bot",
        "taskDescription": "Wire $5,000 to vendor",
        "state": {"amount": 5000, "vendor": "Acme Corp"},
        "webhookUrl": "https://your-server.com/resume",
    },
)
checkpoint_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://agentutils.dev/api/checkpoint", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agentName: "finance-bot",
    taskDescription: "Wire $5,000 to vendor",
    state: { amount: 5000, vendor: "Acme Corp" },
    webhookUrl: "https://your-server.com/resume",
  }),
});
const { data } = await res.json();`,
    },
    apiEndpoint: 'POST /api/checkpoint',
    competitors: ['LangGraph Human-in-the-Loop', 'Inkeep', 'Humanloop'],
    keywords: ['human in the loop API', 'agent approval workflow', 'AI agent guardrails', 'human oversight for AI', 'agent pause resume', 'human approval for agents'],
    relatedTools: ['notify', 'audit', 'form'],
  },
  {
    slug: 'shield',
    name: 'Agent Shield',
    icon: '🛡️',
    tagline: 'PII redaction proxy. Clean before LLM, hydrate after.',
    metaTitle: 'PII Redaction API for AI Agents | AgentUtils',
    metaDescription: 'Automatically redact PII before sending data to LLMs and hydrate it back in the response. One API call to protect sensitive data in AI workflows.',
    h1: 'PII Redaction Shield for AI Agents',
    subtitle: 'Strip PII before the LLM. Restore it after. Zero data leaks.',
    whatItDoes: 'Agent Shield sits between your agent and the LLM. Before sending data, it redacts PII (names, emails, phone numbers, SSNs, credit cards, addresses). After the LLM responds, it hydrates the original values back in. Your LLM never sees sensitive data.',
    whyAgentsNeed: [
      'LLMs are external APIs — every prompt sends data to a third party',
      'PII in prompts violates GDPR, CCPA, and most data handling policies',
      'Once PII is in an LLM context window, it can appear in logs, caches, and training data',
      'Building PII redaction is complex — regex misses edge cases, NER is expensive to maintain',
    ],
    useCases: [
      { title: 'Customer support', description: 'Agent processes support tickets containing customer names, emails, and order details' },
      { title: 'Healthcare records', description: 'Agent analyzes patient data — redact PHI before any LLM call' },
      { title: 'Financial analysis', description: 'Agent works with transaction data containing account numbers and SSNs' },
      { title: 'HR automation', description: 'Agent processes employee records — redact personal details before summarization' },
    ],
    codeExample: {
      curl: `curl -X POST https://agentutils.dev/api/shield \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hi, I am John Doe (john@example.com). My SSN is 123-45-6789."
  }'`,
      python: `import requests

resp = requests.post(
    "https://agentutils.dev/api/shield",
    headers={"x-api-key": "au_your_key"},
    json={"text": "Hi, I am John Doe (john@example.com). My SSN is 123-45-6789."},
)
redacted = resp.json()["data"]["redacted"]
# "Hi, I am [NAME_1] ([EMAIL_1]). My SSN is [SSN_1]."`,
      js: `const res = await fetch("https://agentutils.dev/api/shield", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Hi, I am John Doe (john@example.com). My SSN is 123-45-6789.",
  }),
});
const { data } = await res.json();
console.log(data.redacted);
// "Hi, I am [NAME_1] ([EMAIL_1]). My SSN is [SSN_1]."`,
    },
    apiEndpoint: 'POST /api/shield',
    competitors: ['Presidio (Microsoft)', 'Nightfall', 'Tonic.ai', 'Private AI'],
    keywords: ['PII redaction API', 'data masking for AI', 'PII removal LLM', 'agent data privacy', 'redact PII before LLM', 'AI data protection'],
    relatedTools: ['audit', 'kv', 'rate-limit'],
  },
  {
    slug: 'otp',
    name: 'AgentVerify OTP',
    icon: '🔑',
    tagline: 'Temporary phone numbers for agent 2FA.',
    metaTitle: 'OTP Verification API with Temporary Phone Numbers | AgentUtils',
    metaDescription: 'Provision temporary phone numbers for AI agents to receive SMS OTP codes. Complete 2FA verification flows with a single API call. No Twilio config needed.',
    h1: 'OTP Verification for AI Agents',
    subtitle: 'Provision a phone number. Receive OTPs. Complete 2FA. One API call.',
    whatItDoes: 'Give your agent a temporary phone number that can receive SMS messages. Use it to complete OTP/2FA verification flows that would otherwise block autonomous agents. The agent provisions a number, your app triggers the SMS, and the agent reads the code via webhook.',
    whyAgentsNeed: [
      'Many services require phone-based 2FA — agents cannot complete these flows without a number',
      'Agents cannot access physical phones or SMS inboxes',
      'Provisioning phone numbers via Twilio/Telnyx requires account setup, credentials, and billing',
      'OTP codes expire quickly — agents need real-time SMS delivery, not polling',
    ],
    useCases: [
      { title: 'Account creation', description: 'Agent creates accounts on services that require phone verification' },
      { title: 'Login automation', description: 'Agent logs into services protected by SMS-based 2FA' },
      { title: 'Testing 2FA flows', description: 'QA agents test your own product\'s OTP verification flow end-to-end' },
      { title: 'Identity verification', description: 'Agent completes KYC flows that require phone number confirmation' },
    ],
    codeExample: {
      curl: `# 1. Provision a number
curl -X POST https://agentutils.dev/api/otp \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"countryCode": "US"}'

# 2. Use the number to trigger SMS
# 3. Read the OTP code
curl https://agentutils.dev/api/otp/{sessionId} \\
  -H "x-api-key: au_your_key"`,
      python: `import requests

# Provision a number
resp = requests.post(
    "https://agentutils.dev/api/otp",
    headers={"x-api-key": "au_your_key"},
    json={"countryCode": "US"},
)
session = resp.json()["data"]
phone_number = session["phoneNumber"]

# Later: check for OTP code
resp = requests.get(
    f"https://agentutils.dev/api/otp/{session['id']}",
    headers={"x-api-key": "au_your_key"},
)
code = resp.json()["data"]["code"]`,
      js: `// Provision a number
const res = await fetch("https://agentutils.dev/api/otp", {
  method: "POST",
  headers: { "x-api-key": "au_your_key", "Content-Type": "application/json" },
  body: JSON.stringify({ countryCode: "US" }),
});
const { data: session } = await res.json();

// Later: check for OTP code
const otp = await fetch(
  \`https://agentutils.dev/api/otp/\${session.id}\`,
  { headers: { "x-api-key": "au_your_key" } }
);
const { data } = await otp.json();
console.log(data.code); // "482917"`,
    },
    apiEndpoint: 'POST /api/otp',
    competitors: ['Twilio Verify', 'Vonage Verify', 'Auth0 OTP'],
    keywords: ['OTP API for agents', 'temporary phone number API', 'SMS verification API', '2FA for AI agents', 'OTP verification service', 'agent phone number'],
    relatedTools: ['webhook', 'notify', 'shield'],
  },
  {
    slug: 'notify',
    name: 'Notification Router',
    icon: '🔔',
    tagline: 'One API call to reach a human.',
    metaTitle: 'Email Notification API for AI Agents | AgentUtils',
    metaDescription: 'Send email notifications from AI agents with a single API call. Priority levels, HTML templates, delivery tracking. No SMTP config needed.',
    h1: 'Email Notifications for AI Agents',
    subtitle: 'Agents send messages. Humans get emails. No SMTP credentials.',
    whatItDoes: 'Give agents the ability to notify humans via email. One API call with a message and priority level — the router handles email delivery, templates, tracking, and history. No Resend/Sendgrid/Mailgun API keys to manage.',
    whyAgentsNeed: [
      'Agents need to alert humans when tasks complete, fail, or need attention',
      'SMTP configuration requires credentials that agents should not hold',
      'Email templates and formatting is boilerplate that adds no value to agent logic',
      'Tracking notification delivery status requires a database and webhook integration',
    ],
    useCases: [
      { title: 'Task completion', description: 'Agent finishes a long-running task and notifies the user with results' },
      { title: 'Error escalation', description: 'Agent encounters an error it cannot resolve and alerts a human operator' },
      { title: 'Approval requests', description: 'Agent needs human sign-off before proceeding with an action' },
      { title: 'Scheduled reports', description: 'Agent generates a daily/weekly summary and delivers it to stakeholders' },
    ],
    codeExample: {
      curl: `curl -X POST https://agentutils.dev/api/notify \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Wire transfer of $5,000 is pending approval.",
    "priority": "urgent"
  }'`,
      python: `import requests

requests.post(
    "https://agentutils.dev/api/notify",
    headers={"x-api-key": "au_your_key"},
    json={
        "message": "Wire transfer of $5,000 is pending approval.",
        "priority": "urgent",
        "metadata": {"transferId": "tx_abc123"},
    },
)`,
      js: `const res = await fetch("https://agentutils.dev/api/notify", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Wire transfer of $5,000 is pending approval.",
    priority: "urgent",
  }),
});
const { data } = await res.json();`,
    },
    apiEndpoint: 'POST /api/notify',
    competitors: ['Resend', 'SendGrid', 'Postmark', 'Mailgun'],
    keywords: ['email notification API', 'agent notification service', 'send email from agent', 'email API for AI', 'notification router', 'agent to human communication'],
    relatedTools: ['checkpoint', 'audit', 'webhook'],
  },
  {
    slug: 'audit',
    name: 'Audit Log',
    icon: '📋',
    tagline: 'Immutable agent action history.',
    metaTitle: 'Audit Logging API for AI Agents | AgentUtils',
    metaDescription: 'Immutable, queryable audit trail for every AI agent action. Log decisions, track state changes, and prove compliance with a single API call.',
    h1: 'Audit Logging for AI Agents',
    subtitle: 'Every agent action. Immutable record. Queryable history.',
    whatItDoes: 'Log every agent action — decisions made, data accessed, tools called, outputs produced — in an immutable, append-only audit trail. Query by agent, action type, severity, or time range. Built for compliance, debugging, and accountability.',
    whyAgentsNeed: [
      'Regulatory frameworks (EU AI Act, SOX, HIPAA) require audit trails for automated decisions',
      'Debugging agent behavior requires knowing what it did, when, and why',
      'Incident response needs a complete history of agent actions leading to an event',
      'Agent accountability requires proving what actions were taken autonomously vs. human-directed',
    ],
    useCases: [
      { title: 'Compliance reporting', description: 'Generate audit trails for regulatory audits showing all agent decisions' },
      { title: 'Debugging agent behavior', description: 'Trace the sequence of actions that led to an unexpected outcome' },
      { title: 'Security monitoring', description: 'Alert on suspicious agent actions like accessing sensitive resources' },
      { title: 'Performance analysis', description: 'Analyze agent action patterns to optimize latency and cost' },
    ],
    codeExample: {
      curl: `curl -X POST https://agentutils.dev/api/audit \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "support-bot",
    "action": "refund_issued",
    "severity": "info",
    "metadata": {"customerId": "cus_abc", "amount": 49.99}
  }'`,
      python: `import requests

requests.post(
    "https://agentutils.dev/api/audit",
    headers={"x-api-key": "au_your_key"},
    json={
        "agentName": "support-bot",
        "action": "refund_issued",
        "severity": "info",
        "metadata": {"customerId": "cus_abc", "amount": 49.99},
    },
)`,
      js: `await fetch("https://agentutils.dev/api/audit", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agentName: "support-bot",
    action: "refund_issued",
    severity: "info",
    metadata: { customerId: "cus_abc", amount: 49.99 },
  }),
});`,
    },
    apiEndpoint: 'POST /api/audit',
    competitors: ['Auditable', 'Loom Systems', 'Datadog Audit Trail'],
    keywords: ['audit log API', 'agent audit trail', 'AI compliance logging', 'agent action tracking', 'immutable audit log', 'AI accountability'],
    relatedTools: ['shield', 'checkpoint', 'dlq'],
  },
  {
    slug: 'kv',
    name: 'KV Store',
    icon: '🗄️',
    tagline: 'State persistence for agents.',
    metaTitle: 'Key-Value Store API for AI Agents | AgentUtils',
    metaDescription: 'Persistent key-value storage for AI agents. Store state, share data between agents, and manage counters with a simple REST API. No database to configure.',
    h1: 'Key-Value Store for AI Agents',
    subtitle: 'Persistent state between agent runs. No database config.',
    whatItDoes: 'Give agents persistent storage they can read and write between invocations. Store conversation state, share data between agents, manage counters, and cache results. Simple REST API with TTL support — no Redis, no MongoDB, no database credentials.',
    whyAgentsNeed: [
      'Agents are stateless — every invocation starts from scratch with no memory',
      'Multi-agent workflows need to share data through a common store',
      'Rate limiting and quota tracking require persistent counters across agent runs',
      'Caching expensive API calls or LLM responses saves time and money',
    ],
    useCases: [
      { title: 'Conversation memory', description: 'Store user preferences and conversation history between agent sessions' },
      { title: 'Multi-agent coordination', description: 'Agent A writes results, Agent B reads them — no shared filesystem needed' },
      { title: 'Rate limit counters', description: 'Track API call counts across agent runs to stay within rate limits' },
      { title: 'Configuration cache', description: 'Cache frequently accessed config so agents do not re-fetch on every run' },
    ],
    codeExample: {
      curl: `# Set a value
curl -X POST https://agentutils.dev/api/kv \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "user:123:preferences", "value": {"lang": "en", "tz": "UTC"}}'

# Get a value
curl https://agentutils.dev/api/kv/user:123:preferences \\
  -H "x-api-key: au_your_key"`,
      python: `import requests

headers = {"x-api-key": "au_your_key"}

# Set
requests.post("https://agentutils.dev/api/kv",
    headers=headers,
    json={"key": "counter", "value": 42},
)

# Get
resp = requests.get("https://agentutils.dev/api/kv/counter",
    headers=headers,
)
print(resp.json()["data"]["value"])  # 42`,
      js: `// Set
await fetch("https://agentutils.dev/api/kv", {
  method: "POST",
  headers: { "x-api-key": "au_your_key", "Content-Type": "application/json" },
  body: JSON.stringify({ key: "counter", value: 42 }),
});

// Get
const res = await fetch("https://agentutils.dev/api/kv/counter", {
  headers: { "x-api-key": "au_your_key" },
});
const { data } = await res.json();
console.log(data.value); // 42`,
    },
    apiEndpoint: 'POST /api/kv',
    competitors: ['Redis Cloud', 'Upstash KV', 'DynamoDB', 'Cloudflare KV'],
    keywords: ['key value store API', 'agent state storage', 'KV store for AI', 'agent memory store', 'persistent state for agents', 'agent data persistence'],
    relatedTools: ['audit', 'rate-limit', 'dlq'],
  },
  {
    slug: 'rate-limit',
    name: 'Rate Limiter',
    icon: '⚡',
    tagline: 'Outbound API rate limiting.',
    metaTitle: 'Rate Limiting API for AI Agents | AgentUtils',
    metaDescription: 'Rate limit outbound API calls from AI agents. Fixed-window and sliding-window algorithms. Prevent agents from exceeding API quotas with a single API call.',
    h1: 'Rate Limiting for AI Agents',
    subtitle: 'Protect APIs from agent overload. One call to check, one to count.',
    whatItDoes: 'Wrap any outbound API call with rate limiting. Your agent checks before calling an external API — if the limit is exceeded, it gets a 429 response with a retry-after hint. Fixed-window and sliding-window algorithms supported.',
    whyAgentsNeed: [
      'Agents can make thousands of API calls per minute — far exceeding rate limits',
      'Exceeding rate limits causes service outages and account suspensions',
      'Multiple agents sharing one API key need coordinated rate limiting',
      'Backoff and retry logic is boilerplate that distracts from agent logic',
    ],
    useCases: [
      { title: 'LLM API protection', description: 'Prevent agents from burning through OpenAI/Anthropic API rate limits' },
      { title: 'Third-party API quotas', description: 'Wrap calls to Stripe, GitHub, or any rate-limited API' },
      { title: 'Multi-agent coordination', description: 'Shared rate limits across multiple agents using the same credentials' },
      { title: 'Cost control', description: 'Cap daily/hourly API call volumes to control spending' },
    ],
    codeExample: {
      curl: `# Check if allowed
curl "https://agentutils.dev/api/rate-limit/check?key=stripe-api&limit=100&window=60" \\
  -H "x-api-key: au_your_key"

# Response: {"allowed": true, "remaining": 73, "resetAt": "2025-01-15T10:01:00Z"}`,
      python: `import requests

headers = {"x-api-key": "au_your_key"}

# Check rate limit before calling external API
resp = requests.get(
    "https://agentutils.dev/api/rate-limit/check",
    headers=headers,
    params={"key": "stripe-api", "limit": 100, "window": 60},
)
result = resp.json()["data"]

if result["allowed"]:
    # Safe to call the API
    call_external_api()
else:
    print(f"Rate limited. Retry after {result['resetAt']}")`,
      js: `const res = await fetch(
  "https://agentutils.dev/api/rate-limit/check?key=stripe-api&limit=100&window=60",
  { headers: { "x-api-key": "au_your_key" } }
);
const { data } = await res.json();

if (data.allowed) {
  await callExternalAPI();
} else {
  console.log(\`Rate limited. Retry after \${data.resetAt}\`);
}`,
    },
    apiEndpoint: 'GET /api/rate-limit/check',
    competitors: ['Upstash Ratelimit', 'Redis Rate Limiting', 'Cloudflare Rate Limiting'],
    keywords: ['rate limiting API', 'agent rate limiter', 'API rate limit for AI', 'rate limiting service', 'agent API protection', 'rate limit proxy'],
    relatedTools: ['kv', 'audit', 'dlq'],
  },
  {
    slug: 'webhook',
    name: 'Webhook Inbox',
    icon: '📩',
    tagline: 'Pre-provisioned HTTPS endpoints.',
    metaTitle: 'Webhook Inbox API for AI Agents | AgentUtils',
    metaDescription: 'Pre-provisioned HTTPS webhook endpoints for AI agents. Receive webhooks from any service, inspect payloads, and forward to your agent with a single API call.',
    h1: 'Webhook Inbox for AI Agents',
    subtitle: 'Pre-provisioned endpoints. Receive webhooks. Forward to agents.',
    whatItDoes: 'Create a public HTTPS endpoint in seconds — no server, no domain, no TLS certificate. Third-party services send webhooks to this URL. You inspect, filter, and forward the payloads to your agent. Built for the receive-then-process pattern that every agent needs.',
    whyAgentsNeed: [
      'Agents cannot expose HTTP endpoints — they run in serverless or sandboxed environments',
      'Receiving webhooks requires a server with a public URL and TLS certificate',
      'Services like Stripe, GitHub, and Slack require a webhook URL to send events',
      'Inspecting and debugging webhook payloads requires logging infrastructure',
    ],
    useCases: [
      { title: 'Payment webhooks', description: 'Receive Stripe payment events and route them to your billing agent' },
      { title: 'GitHub events', description: 'Receive push/PR webhooks and trigger a code review agent' },
      { title: 'Slack interactions', description: 'Receive Slack slash command payloads and dispatch to a response agent' },
      { title: 'Third-party integrations', description: 'Receive webhooks from any SaaS and forward to the right agent' },
    ],
    codeExample: {
      curl: `# Create a webhook inbox
curl -X POST https://agentutils.dev/api/webhook \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"label": "stripe-payments", "forwardUrl": "https://your-server.com/process"}'

# Use the returned URL as your Stripe webhook endpoint
# https://agentutils.dev/hook/abc123`,
      python: `import requests

resp = requests.post(
    "https://agentutils.dev/api/webhook",
    headers={"x-api-key": "au_your_key"},
    json={
        "label": "stripe-payments",
        "forwardUrl": "https://your-server.com/process",
    },
)
webhook_url = resp.json()["data"]["url"]
# Use webhook_url as your Stripe webhook endpoint`,
      js: `const res = await fetch("https://agentutils.dev/api/webhook", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    label: "stripe-payments",
    forwardUrl: "https://your-server.com/process",
  }),
});
const { data } = await res.json();
// data.url = "https://agentutils.dev/hook/abc123"`,
    },
    apiEndpoint: 'POST /api/webhook',
    competitors: ['ngrok', 'Hookdeck', 'Svix', 'RequestBin'],
    keywords: ['webhook inbox API', 'webhook endpoint for agents', 'receive webhooks', 'webhook proxy', 'agent webhook receiver', 'webhook URL for AI'],
    relatedTools: ['dlq', 'notify', 'checkpoint'],
  },
  {
    slug: 'form',
    name: 'Agent Form',
    icon: '📝',
    tagline: 'Human-in-the-loop data collection.',
    metaTitle: 'Form API for AI Agents — Collect Data from Humans | AgentUtils',
    metaDescription: 'Create hosted forms for AI agents to collect data from humans. Pre-fill fields, validate responses, and receive submissions via webhook. No frontend needed.',
    h1: 'Hosted Forms for AI Agents',
    subtitle: 'Agent creates a form. Human fills it in. Agent gets the data via webhook.',
    whatItDoes: 'When an agent needs information from a human, it creates a hosted form with defined fields. The form URL is sent to the human (via email, Slack, etc.). When submitted, the data is posted to your webhook. No frontend code, no form validation, no hosting.',
    whyAgentsNeed: [
      'Agents often need structured input that a chat interface cannot capture reliably',
      'Forms enforce validation — required fields, types, options — that free-text prompts cannot',
      'Building and hosting forms requires frontend code, validation logic, and a server',
      'Form submissions need to reach the agent asynchronously via webhook',
    ],
    useCases: [
      { title: 'Data collection', description: 'Agent asks a human to fill in missing information before proceeding' },
      { title: 'Configuration forms', description: 'Agent generates a setup form for a new integration or service' },
      { title: 'Feedback collection', description: 'Agent sends a form to collect user feedback on its output' },
      { title: 'Approval with notes', description: 'Human approves or rejects an action and adds contextual notes' },
    ],
    codeExample: {
      curl: `curl -X POST https://agentutils.dev/api/form \\
  -H "x-api-key: au_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Shipping Details",
    "fields": [
      {"name": "address", "label": "Shipping Address", "type": "text", "required": true},
      {"name": "priority", "label": "Priority", "type": "select", "options": ["standard", "express"]}
    ],
    "webhookUrl": "https://your-server.com/submitted"
  }'`,
      python: `import requests

resp = requests.post(
    "https://agentutils.dev/api/form",
    headers={"x-api-key": "au_your_key"},
    json={
        "title": "Shipping Details",
        "fields": [
            {"name": "address", "label": "Shipping Address", "type": "text", "required": True},
            {"name": "priority", "label": "Priority", "type": "select", "options": ["standard", "express"]},
        ],
        "webhookUrl": "https://your-server.com/submitted",
    },
)
form_url = resp.json()["data"]["url"]
# Send form_url to the human`,
      js: `const res = await fetch("https://agentutils.dev/api/form", {
  method: "POST",
  headers: {
    "x-api-key": "au_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Shipping Details",
    fields: [
      { name: "address", label: "Shipping Address", type: "text", required: true },
      { name: "priority", label: "Priority", type: "select", options: ["standard", "express"] },
    ],
    webhookUrl: "https://your-server.com/submitted",
  }),
});
const { data } = await res.json();
// data.url = "https://agentutils.dev/f/abc123"`,
    },
    apiEndpoint: 'POST /api/form',
    competitors: ['Typeform API', 'Jotform API', 'Formspree', 'Google Forms'],
    keywords: ['form API for agents', 'hosted forms API', 'agent data collection', 'form builder API', 'human input for AI agents', 'webhook form submission'],
    relatedTools: ['checkpoint', 'notify', 'webhook'],
  },
];

export function getToolBySlug(slug: string): ToolSEO | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getAllToolSlugs(): string[] {
  return tools.map((t) => t.slug);
}
