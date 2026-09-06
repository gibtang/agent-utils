---
status: accepted
---

# Use plan limits based on product resources

AgentUtils launches with monthly Stripe plans and hard product limits rather than generic API-call metering.

| Plan | Price per month | Connections | Inboxes | Events per month | Active File storage | State storage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Free | US$0 | 1 | 2 | 500 | 100 MB | 1 MB |
| Plus | US$19 | 3 | 10 | 10,000 | 5 GB | 25 MB |
| Pro | US$49 | 10 | 50 | 100,000 | 25 GB | 100 MB |

API and MCP calls are not metered as a billable unit. Owners are warned at 80 percent usage. At 100 percent, new activity covered by that limit is rejected until the monthly allowance resets or the owner upgrades. Previously agreed plan-based Event and File retention remains in force.
