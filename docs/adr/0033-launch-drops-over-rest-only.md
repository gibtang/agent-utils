# Launch Drops over REST only

Drops launches over REST without an MCP adapter even though AgentUtils already has an MCP surface, because any agent can use HTTP and a second transport adds rollout and testing work before demand. This is a Drops-only exception to ADR-0021, not removal of existing MCP tools; shared contracts generate HTTP docs but omit Drops MCP exposure until deliberately added.
