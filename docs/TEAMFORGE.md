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

Challenge team size limits the number of members in each team, not the number
of students who can join the challenge. This lets students build a candidate
pool in Find teammates before invitations and team formation.

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

### Local database repair

If the database is missing team/chat or profile feature tables, run
`npm run repair:team-invitations` (or `npm run repair:profile`) from `backend`.
This applies an additive, repeatable schema repair and does not modify existing
challenge or membership records. It is separate from Prisma Migrate because
some local databases have migration-history names that differ from this
repository's migration folders.

Team members can see their roster and exchange persisted group-chat messages
from My Hackathons & Teams. Chat is restricted to members of that team and
refreshes automatically while open.
Chat messages can include one PDF, DOC, DOCX, TXT, PNG, JPG, GIF, or WEBP
attachment up to 10 MB. Files are stored by generated server-side names and
downloaded only after checking the requesting user's team membership. Local
uploads are stored under `backend/uploads/team-chat` and excluded from Git.

Profile settings, availability, evidence links, learning activity, and cached
GitHub statistics are persisted for each account. Builder Score v4 gives 25%
weight to quiz performance, 15% GitHub activity, 25% skill strength, 15%
evidence, 10% consistency, and 10% profile completeness. Its expanded formula
is shown in the profile.

For linked GitHub profiles, activity is
`100 * min(1, ln(1 + repos + stars/12 + 2*commits30d) / ln(1 + 40 + 500/12 + 240))`.
Unverified profiles receive 90% of this component; unlinked accounts get a
neutral 50. Skill levels map to 40/70/100 and are averaged. Evidence scores
20 points per saved project/evidence URL (including skill evidence), capped
at five URLs. Consistency is `min(100, distinctActiveDays30d / 12 * 100)`.
Profile completeness awards one sixth for each populated education, career
goal, interests, preferred roles, skills, and availability category. Quiz
performance is the average score from attempts in the previous 90 days; before
the first attempt, it contributes a neutral 50/100. The weighted component
sum is rounded to an integer; score tiers are Starter (0–39), Builder
(40–64), Contributor (65–84), and Pro (85–100).

### AI skill-practice plan

The planner uses saved profile skills and weekly availability to create
upcoming practice sessions with Gemini. Add `GEMINI_API_KEY` to
`backend/.env` and restart the backend; optionally set `GEMINI_MODEL` (defaults
to `gemini-2.5-flash`). API keys stay on the backend and are never sent to the
browser. A generated session's reminder is listed in Notifications with its
scheduled time and becomes actionable when the session is due.
Starting a session creates three skill-check questions and two coding
questions; coding responses are evaluated against an AI-generated rubric and
are not executed.
