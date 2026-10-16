# TeamForge Adaptive Formation and Rescue

TeamForge is implemented under `/api/teamforge` and uses the existing cookie
authentication and challenge ownership rules.

## Formation workflow

Organizers can use:

- `GET /api/teamforge/challenges/:challengeId/formation-config`
- `PATCH /api/teamforge/challenges/:challengeId/formation-config`
- `POST /api/teamforge/challenges/:challengeId/formation-runs`
- `GET /api/teamforge/formation-runs/:runId`
- `POST /api/teamforge/formation-runs/:runId/approve`

Formation uses `teamforge-adaptive-v1`. Skill labels are normalized to lower
case, proficiency contributes `0.5`, `0.75`, or `1.0`, and configurable
weights combine skill coverage, role coverage, and declared weekly capacity.
Only feasible alternatives can be approved. Approval is transactional,
prevents duplicate challenge membership, creates an approved team, creates its
project workspace, and records an audit event.

## Rescue workflow

Authorized project members, team leads, and challenge organizers can use:

- `POST /api/teamforge/projects/:projectId/tasks`
- `POST /api/teamforge/projects/:projectId/disruptions`

Task dependencies are stored as a directed graph. Task creation rejects cycles.
Disruption analysis propagates impact to downstream tasks, calculates remaining
effort, and produces deterministic reassignment alternatives using
`teamforge-rescue-v1`. Generating a plan does not mutate tasks; the approval
endpoint for applying a selected plan is the next integration point.

## Database

The schema additions are in the Prisma migration
`20261016190000_teamforge_adaptive_rescue`. The local development database was
`SkillMesh_db` on PostgreSQL at `localhost:5432`; no database reset was used.
The historical team migration was restored locally because it was already
applied to that database.

GitHub evidence is intentionally optional. Formation uses persisted profiles,
skills, memberships, and participant availability; it does not rank students
by commit count or require a GitHub account.
