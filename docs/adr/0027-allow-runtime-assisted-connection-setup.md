---
status: accepted
---

# Allow runtime-assisted Connection setup

The owner-facing onboarding remains three stages: sign in with Google, tell an Agent to connect using a short-lived Pairing Code, and confirm the Connection in the dashboard. The Agent performs technical configuration, but the flow may ask the owner to complete one runtime-required action such as restarting Codex after its MCP configuration changes. AgentUtils does not promise instant in-session setup where the runtime cannot reload MCP servers dynamically.
