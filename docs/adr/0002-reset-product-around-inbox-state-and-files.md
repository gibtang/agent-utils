---
status: accepted
---

# Reset the product around Inbox, State and Files

AgentUtils will be rebuilt as a runtime-independent product centred on Inbox, State and Files. A future Human capability may be composed from these primitives, but ADR 0012 excludes it from the rebuilt launch. Because the product has no users, the rebuild will not preserve compatibility for the existing Checkpoint, Confession, Scheduler, DLQ, Audit Log or image-only product surfaces; reusable authentication, tenant, credential and storage foundations may be retained where they fit the new model. This deliberately accepts a breaking reset now to avoid carrying two conflicting product architectures forward.
