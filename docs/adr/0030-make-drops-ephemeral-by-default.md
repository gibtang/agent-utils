# Make Drops ephemeral by default

Drops expire after 72 hours by default; Pin removes expiry and unpin starts a fresh 72 hours, because this product delivers files rather than storing them forever. This deliberately takes the opposite position from AgentFiles' immutable-forever model discussed in the planning session and is a Drops-only exception to ADR-0014's plan-based File lifetimes; pinned content must be protected from storage lifecycle deletion.
