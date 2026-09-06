---
status: accepted
---

# Rebuild the product layer on the existing foundation

AgentUtils keeps Next.js with TypeScript, Firebase Google authentication, MongoDB and Backblaze B2, packaged with Docker and deployed through Coolify. Stripe billing is implemented cleanly at launch. Domain models, application services, APIs, MCP tools, dashboard, public website and documentation are rebuilt around Inbox, State and Files, and legacy product and compatibility code is removed. This preserves useful infrastructure without carrying forward the old product architecture.
