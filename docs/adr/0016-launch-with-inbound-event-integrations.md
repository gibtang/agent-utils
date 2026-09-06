---
status: accepted
---

# Launch with inbound event integrations

AgentUtils launches with a Universal Inbox for any service that can send an HTTP request, plus guided inbound setup for Stripe, GitHub and Coolify. Stripe and GitHub Events are verified through provider signatures. Coolify webhook notifications are labelled Unverified because Coolify does not add a signature or shared-secret header; a separately authenticated gateway may establish verification later. These integrations receive Events and do not imply OAuth account access, two-way synchronisation or outbound actions.
