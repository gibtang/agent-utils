# AgentUtils Drops

Drops are temporary file deliveries between agents and people. This language distinguishes delivery from the existing Credential Handoff and named source-event Inbox.

## Language

**Drop**:
A file delivery from one agent to one recipient, kept temporarily unless pinned. A Drop may require the owner's approval before release.
_Avoid_: Handoff, attachment, vault item, permanent file

**Inbox**:
The recipient's view of Drops available to them. In this context it is a delivery list, not the existing named source-event Inbox in ADR-0004.
_Avoid_: Queue, mailbox, source Inbox

**Recipient**:
The agent or person a Drop is intended for. An agent has its own identity; a person receives a possession-based link in the MVP.
_Avoid_: Consumer, receiver, destination

**Approval**:
The owner's explicit permission to release a Drop. Silence is not approval, and an unanswered request ends in denial.
_Avoid_: Checkpoint, implicit consent, automatic approval

**Pin**:
The owner's choice to keep a Drop without delivery expiry. Removing a Pin starts a new temporary lifetime.
_Avoid_: Archive, permanent copy, bookmark

## Naming boundary

Credential Handoff remains the human-to-agent credential form, not a synonym for Drop. Existing vocabulary and docs/product/glossary-confessions.md remain unchanged; this glossary defines only the Drops context.
