---
status: accepted
---

# Keep State private until explicitly shared

State belongs to its creating Agent and is visible to that Agent and the Agent Owner by default. Access may be granted explicitly to named Agents and survives replacement of an Agent's runtime Connection, but there is no account-wide namespace that automatically exposes State to every current or future Agent. This replaces the existing `shared` namespace to keep cross-agent coordination intentional and private by default.
