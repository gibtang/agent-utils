---
status: accepted
---

# Serve MCP and HTTP from one application core

MCP is the primary Agent interface and one versioned HTTP API is available for advanced use. Both interfaces call the same Inbox, State and Files application services. Shared schemas define validation, permissions, plan limits and errors, and generate the API reference, MCP tool descriptions and machine-readable documentation. Conflicting legacy versions and feature surfaces are removed rather than preserved through compatibility layers.
