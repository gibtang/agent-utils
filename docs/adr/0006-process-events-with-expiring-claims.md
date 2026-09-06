---
status: accepted
---

# Process Events with expiring Claims

Inbox Events use at-least-once processing: an Agent claims an Event before acting, only one active Claim may exist, and an expired Claim makes abandoned work available again. Completion acknowledges the Event without immediately deleting its history, while a stable Event identifier supports idempotent consumers. AgentUtils will not promise exactly-once execution because it cannot determine whether an external side effect completed immediately before an Agent crashed.
