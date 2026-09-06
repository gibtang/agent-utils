---
status: accepted
---

# Preserve Events as immutable source records

AgentUtils preserves each Event's original request body, safe relevant headers, received time, source, verification status and provider event identifier. Provider-specific readable views and processing status are derived records; they never replace or rewrite the original Event. AgentUtils does not generate AI summaries automatically.
