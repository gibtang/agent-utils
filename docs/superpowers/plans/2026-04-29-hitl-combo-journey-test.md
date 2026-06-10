# TODO: HITL Combo Journey Test

> Write tests for the combined human-in-the-loop flow using DLQ + Checkpoint + Agent Form + Notify together.

## Flows to test

### DLQ + Form + Notify
1. Agent crashes → POST /api/dlq → dlq_7f3k9p
2. Agent creates review form with failure context → POST /api/form → form_x9k2mp
3. Agent emails form link to reviewer → POST /api/notify
4. Reviewer submits form → webhook fires with decision
5. Agent resumes from cursor with reviewer's instructions

### Checkpoint + Form + Notify
1. Agent creates checkpoint → POST /api/checkpoint → chk_m8p2xq (agent sleeps)
2. Agent creates approval form with decision details → POST /api/form → form_c8p3xq
3. Agent emails form link to approver → POST /api/notify
4. Approver submits form → app resolves checkpoint → POST /api/checkpoint/{id}/resume
5. Checkpoint webhook fires → agent wakes with full state

## Notes
- All external deps (B2, Resend, Twilio, MongoDB) should be mocked
- Follow the same pattern as `2026-04-29-file-host-journey-test.md`
- Test the full sequence in order — each step uses output from the previous
- Key assertion: agent state is correctly passed through checkpoint and recovered after approval
