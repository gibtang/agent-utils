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
      curl: `curl -X POST https://www.agent-utils.com/api/dlq \\
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
    "https://www.agent-utils.com/api/dlq",
    headers={"x-api-key": "au_your_key"},
    json={
        "agentName": "data-pipeline",
        "taskType": "import_csv",
        "error": "Column count mismatch",
        "payload": {"fileId": "abc123", "rows": 5000},
    },
)`,
      js: `const res = await fetch("https://www.agent-utils.com/api/dlq", {
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
    relatedTools: ['checkpoint'],
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
      curl: `curl -X POST https://www.agent-utils.com/api/checkpoint \\
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
    "https://www.agent-utils.com/api/checkpoint",
    headers={"x-api-key": "au_your_key"},
    json={
        "agentName": "finance-bot",
        "taskDescription": "Wire $5,000 to vendor",
        "state": {"amount": 5000, "vendor": "Acme Corp"},
        "webhookUrl": "https://your-server.com/resume",
    },
)
checkpoint_id = resp.json()["data"]["id"]`,
      js: `const res = await fetch("https://www.agent-utils.com/api/checkpoint", {
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
    relatedTools: ['dlq'],
  },
];

export function getToolBySlug(slug: string): ToolSEO | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getAllToolSlugs(): string[] {
  return tools.map((t) => t.slug);
}
