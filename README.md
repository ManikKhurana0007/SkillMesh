# SkillMesh

SkillMesh is a frontend-only React/Vite demo for student growth, hackathon team formation, project delivery, and lightweight startup validation.

## Setup

```bash
npm install
npm run dev
npm test
npm run build
```

## Demo login

Open `/login` and use one of the demo buttons:

- **Student**: Aisha Rahman — StudentOS AI, challenges, invitations, projects, and VentureTrack.
- **Organizer**: Priya Shah — TeamForge dashboard, participants, recommendations, and approval.
- **Mentor**: Jordan Lee — shared project and mentoring workspace.

The store is persisted as `skillmesh-store` in localStorage. Settings includes **Reset demo data**.

## Structure and routes

`src/components`-style UI primitives are colocated in `src/App.jsx` for this compact demo; business logic is split into `src/lib`, state into `src/store`, and the async service seam is in `src/services/api.js`.

| Role | Key routes |
| --- | --- |
| Public | `/`, `/login`, `/register` |
| Student | `/dashboard`, `/profile`, `/goals`, `/activities`, `/deadlines`, `/planner`, `/challenges`, `/invitations`, `/hackathons`, `/projects`, `/startups/s1`, `/notifications`, `/settings` |
| Organizer | `/organizer`, `/organizer/challenges`, `/organizer/challenges/new`, `/organizer/challenges/c1/participants`, `/organizer/challenges/c1/teams`, `/organizer/challenges/c1/approved` |
| Mentor | `/mentor`, `/projects`, `/notifications`, `/settings` |

## Demo script

1. Sign in as Student and inspect the Builder Score fallbacks, goals, activity, deadlines, and AI plan.
2. Open Challenges → Climate Action Sprint → Find teammates and send an invitation.
3. Use the user menu equivalent by returning to Login and choose another demo student in the seeded data, then accept the pending invitation.
4. Open Projects → CampusCart and move a Kanban task; the change persists in localStorage.
5. Switch to Organizer, generate recommendations on TeamForge, and approve a team.
6. Open VentureTrack to inspect experiments, feedback themes, traction metrics, and risks.

## Scoring formulas

Builder Score is `0.20 GitHub Activity + 0.20 Problem Solving + 0.25 Skill Strength + 0.15 Project Evidence + 0.10 Consistency + 0.10 Profile Quality`. Each component is 0–100. Missing GitHub or LeetCode data uses a neutral 50 and is marked “Not linked”. Tiers are Starter (0–39), Builder (40–64), Contributor (65–84), and Pro (85–100).

Team score is `0.45 Skill Coverage + 0.30 Availability Fit + 0.25 Role Diversity`. Team-size constraints are hard violations. Recommendations are deterministic signals and require human approval.

## Future service endpoints

The service seam is intentionally async with simulated latency so it can map to a REST API:

`POST /api/auth/register|login|logout`, `GET/PATCH /api/students/me`, `PATCH /api/students/me/links`, `GET /api/students/me/score`, `GET/POST /api/goals`, `GET/POST /api/activities`, `GET/POST /api/challenges`, `GET /api/challenges/:id/participants`, `POST /api/challenges/:id/recommend-teams`, `POST /api/challenges/:id/invitations`, `GET /api/invitations`, `PATCH /api/invitations/:id`, `POST /api/teams`, `GET/POST /api/projects`, `POST /api/projects/:id/tasks`, `PATCH /api/tasks/:id`, `POST /api/startups`, `GET/POST /api/experiments`, `POST /api/startups/:id/feedback`, `POST /api/ai/feedback-analysis`, `POST /api/ai/action-plan`, `GET /api/analytics/dashboard`.

Scores are signals, not judgments. Organizers must use human review and contextual evidence; AI suggestions are hypotheses to test, not proof of business success.
