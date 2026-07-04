# gitcord (Discord Bot)

`gitcord` is a Git-like version control system for Discord *server state*. It can:

- **Snapshot** a server (roles + channels) into immutable “commits”.
- Compute **diffs** between commits and/or commit vs. live guild.
- **Rollback** a guild to a previous commit (queued + progress updates).
- Manage a per-guild **audit log** channel.
- Manage a **gitignore-like** list of roles/channels/types to exclude from snapshots.
- **Prune** old commits beyond retention.

Back-end storage is MongoDB. Rollbacks are executed via a BullMQ worker (Redis).

---

## Features (what the bot does)

### 1) Commit (snapshot) guild state
`/commit message:"..."`

- Checks that the caller has **MANAGE_GUILD**.
- Takes a snapshot of the guild’s **roles** and **channels**.
- Computes a deterministic **commit id** using SHA-256 of:
  - server id
  - parent commit(s)
  - author information
  - message
  - normalized channel + role snapshots (permission order normalized)
- Stores the commit in MongoDB and updates the server’s `head_commit_id`.
- Writes an **audit log** entry.
- Replies with an embed and also posts the same event to the configured log channel (best-effort).

Snapshot details (implemented in `src/snapshotter/index.ts`):
- Fetches `guild.roles.fetch()` and `guild.channels.fetch()`.
- Excludes `@everyone`, plus any ids/types configured in `ignored_*` settings.
- Captures:
  - roles: name, color, hoist, position, permissions, mentionable
  - channels: type, name, position, parent, topic, nsfw, bitrate, user limit, rate-limit per user
  - channel permission overwrites (member/role, allow/deny lists)

### 2) Status
`/status`

- Reads guild config from MongoDB.
- Shows:
  - current `head_commit_id` (shortened)
  - retention days
- If a head commit exists, looks up the commit and shows last snapshot metadata:
  - commit message
  - author
  - timestamp
  - channel/role counts

### 3) Commit log
`/log limit?:N`

- Lists recent commits for the guild (up to 50).
- Replies with an embed containing each commit message and metadata.

### 4) Diff between two commits
`/diff commit_a:"..." commit_b:"..."`

- Loads both commits.
- Computes a structural diff for:
  - **roles**: added / removed / modified (name/color/hoist/position/mentionable/permissions)
  - **channels**: added / removed / modified (name/type/position/parent/topic/nsfw/bitrate/userLimit/rateLimit/overwrites)
- Replies with counts and a truncated list (up to 25 changes in the description).
- Logs “Diff Viewed” to the guild’s log channel.

### 5) Preview commit vs live guild
`/preview commit_id:"..."`

- Loads the target commit.
- Snapshots the *current live* guild state.
- Computes diff from commit → live.
- Replies similarly to `/diff` but labels changes as:
  - create / update / delete operations needed to reach live from the commit baseline.
- Logs “Preview Viewed” to the log channel.

### 6) Rollback (queue + confirmation)
`/rollback commit_id:"..."`

- Requires **MANAGE_GUILD**.
- Validates commit exists.
- Uses guild config to enforce a **cooldown** between successful rollbacks.
- Snapshots live guild state.
- Builds a restore plan using stored commit snapshots vs. live snapshots.
- Shows a “Confirm Rollback” embed with the total number of operations and counts of protected skips.
- Requires a button confirmation (Confirm/Cancel) for safety.

When confirmed:
- Adds a BullMQ job to the `rollback` queue.
- Posts “Rollback Queued” to the log channel (best-effort).

Worker execution (in `src/jobs/rollback.ts` + `src/restore/*`):
- Fetches guild + target commit.
- Builds the restore plan and executes it step-by-step with a rate-limit delay.
- Progress is posted/edited in the target text channel.
- On success:
  - updates `head_commit_id` to the rolled-back commit id
  - logs “Rollback Completed”
  - sends a completion message
- On failure:
  - logs “Rollback Failed” (with the last failed step)
  - sends a failure message indicating manual intervention.
- Always writes an audit log entry (success/failure).

Restore plan building (in `src/restore/planner.ts`):
- Diffs current/live → target/commit.
- Plans:
  - create missing roles
  - update role settings + position/permissions/etc.
  - create missing categories + channels
  - update channel settings (name/topic/nsfw/rate limits) when text-based
  - reorder channels by parent then position
  - delete removed roles/channels, except **protected ids**

Protected safety filter (in `src/restore/safety.ts`):
- `delete_ids` excludes any objects whose ids are in:
  - `protected_role_ids`
  - `protected_channel_ids`

### 7) Prune (delete old commits)
`/prune days:N`

- Requires **MANAGE_GUILD**.
- Reads guild retention limit (`retention_days`).
- Refuses pruning if `days > retention_days`.
- Finds commits older than cutoff.
- Never deletes the current `head_commit_id`.
- Deletes the remaining commits.
- Writes an audit log entry and logs “Prune Executed”.

### 8) Log channel setup
`/logsetup`

- Requires **MANAGE_GUILD**.
- Creates a private-ish text channel named `gitcord-logs`:
  - denies `ViewChannel` to `@everyone`
- Updates guild config with:
  - `log_channel_id`
  - also auto-adds the log channel id into `ignored_channel_ids` so it is excluded from snapshots.
- Sends an embed confirming setup.

### 9) Gitignore-like snapshot exclusions
`/gitignore ...`

Manages items excluded from future snapshots. Supported categories:
- ignored roles
- ignored channels
- ignored categories
- ignored channel types

Commands:
- `/gitignore add channel|role|category|type`
- `/gitignore remove channel|role|category|type`
- `/gitignore list`
- `/gitignore clear`

Behavior:
- Updates MongoDB guild config.
- Replies with an embed showing what changed.
- Logs changes to the log channel.

Channel type mapping (from command choices to Discord channel types) is implemented in `src/commands/gitignore.ts`.

---

## Slash commands reference

### Public (no auth role beyond permissions)
All modifying commands check permissions:

- **Requires `MANAGE_GUILD`:**
  - `/commit`
  - `/rollback` (and confirmation)
  - `/prune`
  - `/logsetup`
  - `/gitignore add|remove|clear`

Read-only commands:
- `/status`
- `/log`
- `/diff`
- `/preview`

### Command list
- `/status`
- `/commit message:"..."`
- `/log limit?:N`
- `/diff commit_a:"..." commit_b:"..."`
- `/preview commit_id:"..."`
- `/rollback commit_id:"..."`
- `/prune days:N`
- `/logsetup`
- `/gitignore add|remove|list|clear`

---

## Configuration (environment variables)

Create a `.env` file with at least:

- `DISCORD_TOKEN` **(required)**: Discord bot token.
- `MONGODB_URI` **(required)**: Mongo connection string.
- `REDIS_URL` *(optional)*: defaults to `redis://localhost:6379`.

---

## Data model (what’s stored in MongoDB)

MongoDB database name is `gitcord`.

Collections:

1. `commits`
- Fields include:
  - `commit_id` (SHA-256 hex)
  - `server_id`
  - `parent_ids`
  - `author_id`, `author_tag`, `timestamp`
  - `message`
  - `channels` and `roles` snapshots
  - `meta` counts

2. `audit_logs`
- Stores per-command audit entries:
  - `server_id`, `user_id`, `command`
  - `commit_id` (if applicable)
  - `result`: `success | failure | cancelled`
  - `timestamp`
  - optional `details`

3. `guild_configs`
- Per-guild settings:
  - `head_commit_id`
  - `log_channel_id`
  - `protected_role_ids`, `protected_channel_ids`
  - `retention_days`
  - `rollback_cooldown_seconds`
  - `ignored_*` lists for snapshot exclusion

---

## How rollback safety works

- Rollback is **not** executed immediately. It requires a button confirmation.
- A **cooldown** prevents repeated rollback spam.
- The restore plan filters deletions against:
  - `protected_role_ids`
  - `protected_channel_ids`

---

## Run locally (development)

1. Install dependencies:
- `npm install`

2. Set environment variables in `.env`:
- `DISCORD_TOKEN`
- `MONGODB_URI`
- `REDIS_URL` (optional)

3. Start the bot:
- `npm run dev`

4. (If rolling back) ensure Redis is running and reachable by `REDIS_URL`.

---

## Notes / limitations

- Snapshots currently include **roles** and **channels** (including permission overwrites). Other guild features (e.g., emojis, stickers, webhooks, threads, messages) are not captured in this implementation.
- Rollback deletes objects that were present in the current/live snapshot but missing in the target commit—except for protected ids.
- Channel type support for restore is limited to the channel types explicitly handled in `src/restore/executor.ts`.

