---
status: accepted
---

# Do not promise universal Agent wake-up

Inbox guarantees that AgentUtils receives, preserves and exposes Events; it does not guarantee that a disconnected Agent runtime will immediately start processing them. Active Agents may check or wait for Events, and verified runtime-specific integrations may add wake-up behaviour, but the website and product states must distinguish Event receipt, Agent notification and Event processing.
