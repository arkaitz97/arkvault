# Schedule jobs inside the API process with node-cron

## Status

Accepted.

## Context and problem statement

Jobs carry a cron expression in the `jobs` table. The user edits jobs through the API.
A schedule change must take effect without a restart, and the scheduled run must take
the same path as a manual run, so history, encryption and notification cannot diverge.

The deployment target is one container with one SQLite file. There is no message
broker and no worker process.

## Decision drivers

- No second service to deploy or monitor.
- One run path for manual and scheduled runs.
- Schedule changes take effect without a restart.
- The scheduler must survive the process exiting and starting again.

## Considered options

1. In-process `node-cron` tasks that call the internal run endpoint over HTTP.
2. In-process `node-cron` tasks that call the run pipeline function directly.
3. An external queue with a worker (for example Redis plus BullMQ).
4. OS cron or systemd timers that call the API with `curl`.

## Decision outcome

Chosen option 1. `server/index.js` keeps a `Map` of job id to `node-cron` task.
`scheduleJob` stops any existing task for the id and creates a new one when the job is
`active` and the expression passes `cron.validate`. The task sends `POST` to
`http://localhost:PORT/api/backups/run/:jobId` with the `x-internal-trigger` header.

`refreshAllSchedules` stops every task, re-reads the active jobs, and schedules them
again. It runs at boot and once per minute. The `jobs` table is therefore the only
source of truth, and a restart rebuilds the schedule set.

The internal header lets the auth gate accept the call without a session. The compared
value is `INTERNAL_TRIGGER_SECRET`, which has a development fallback constant when the
variable is not set.

Option 2 was rejected because the runner is an Express handler. Calling it directly
would need the handler split into an HTTP-free function plus a caller, and the scheduled
path would bypass the auth gate and the rate limiter. Option 3 was rejected because a
broker adds a service and a second failure domain for a job volume measured in runs per
day. Option 4 was rejected because job edits would not reach cron without rewriting a
timer file.

### Consequences

Good:

- One run implementation. A scheduled run is an HTTP request to the same route a user
  calls.
- No external dependency. The container image needs no scheduler sidecar.
- A schedule edit reaches the scheduler within one minute.

Bad:

- One instance only. Two processes would schedule every job twice, and SQLite allows
  both to write.
- No retry, no backoff and no run lock. A failed run waits for the next cron tick.
- Every minute, the process stops and rebuilds all tasks. This is cheap for tens of
  jobs and untested beyond that.
- The default trigger secret is a known string, so it is not a security boundary until
  the operator sets the variable.

Neutral:

- `next_run` is a display value computed by `calculateNextRun` in `server/utils.js`.
  Cron validity is decided by `node-cron`, so the two can disagree for unusual
  expressions.

## Confirmation

- `server/index.js` contains `scheduledTasks`, `scheduleJob`, `refreshAllSchedules`, the
  boot call, and the `* * * * *` refresh task.
- `server/index.js` accepts the internal trigger header before the session check.
- `server/utils.js` contains `calculateNextRun` with its hourly fallback.

The scheduler has no automated test. The integration suite for jobs runs against a mock
Express app, so it does not cover task creation. Verify a schedule by hand: create a
job, check the `Scheduled job` log line, then change the expression and confirm a new
log line within one minute.


## More information

- `docs/design.md`, "Scheduling".
- ADR 0001 for what a run calls.
