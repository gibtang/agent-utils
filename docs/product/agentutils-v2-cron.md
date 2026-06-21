# v2 Cron Tick — Production Wiring

The v2 Scheduler (`fireDueSchedules`) and HitL checkpoint timeouts (`processTimeouts`) only run when invoked. They must be driven by an external tick at 30–60s intervals.

## Endpoint

```
POST https://www.agent-utils.com/v1/tick
Authorization: Bearer <CRON_SECRET>
```

- **Auth:** shared secret in `CRON_SECRET` env var, verified via `Authorization: Bearer`.
- Tenant keys (admin/agent) are intentionally rejected — this endpoint crosses tenant boundaries.
- Returns `{ data: { schedules: FireResult, timeouts: {...} } }`.

## Wiring (pick one)

### Option A — external cron (recommended for Coolify deployments)

Coolify does not run Next.js cron jobs, so use an external scheduler that hits the endpoint. Any of:

**cron-job.org / EasyCron / UptimeRobot (HTTP monitor mode):**
- URL: `https://www.agent-utils.com/v1/tick`
- Method: `POST`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Interval: every minute (the minimum free tier on most providers)

**systemd timer on a cheap VPS:**
```ini
# /etc/systemd/system/agentutils-tick.service
[Unit]
Description=AgentUtils v2 cron tick

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS -X POST -H "Authorization: Bearer %d" https://www.agent-utils.com/v1/tick
EnvironmentFile=/etc/agentutils-tick.env   # contains: CRON_SECRET=...
```
```ini
# /etc/systemd/system/agentutils-tick.timer
[Unit]
Description=AgentUtils v2 cron tick (every minute)

[Timer]
OnBootSec=30s
OnUnitActiveSec=60s
AccuracySec=1s

[Install]
WantedBy=timers.target
```
```bash
systemctl enable --now agentutils-tick.timer
```

### Option B — Vercel Cron (if redeployed to Vercel)

Add `vercel.json`:
```json
{
  "crons": [{ "path": "/v1/tick", "schedule": "* * * * *" }]
}
```
Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is set.

## Idempotency & overlap

- Both engines are safe to run concurrently or back-to-back: they use atomic conditional updates (`status: 'pending'` guards) so a schedule/checkpoint is processed exactly once per state transition.
- There is no lock — if two ticks race, the loser's `findOneAndUpdate` returns null and it no-ops.
- A missed tick interval is harmless: the next tick picks up everything that became due in the gap (retry intervals are `+30s, +90s`, far longer than the tick cadence).

## Required env var

```
CRON_SECRET=<random 32+ char string>
```
Generate with: `openssl rand -hex 32`

If `CRON_SECRET` is unset, the endpoint returns 401 for everyone — it refuses to run unsecured rather than let anonymous callers fan out schedule callbacks or resolve checkpoints.
