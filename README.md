# SkillMesh

SkillMesh is a React/Vite learning and project workspace with a PostgreSQL-backed API for accounts, challenge participation, mentor sessions, project ideas, and student performance.

## Setup

```bash
npm install
npm run dev
npm test
npm run build
```

For persisted accounts and mentor workflows, configure `DATABASE_URL` and `JWT_SECRET` in `backend/.env`, then run:

```bash
cd backend
npm install
npm exec prisma migrate deploy -- --config prisma7.config.ts
npm run dev
```

The mentor and resume migrations add session booking, project opportunities, idea review, resume storage metadata, and job-match history. If an existing database reports that its migration history differs from the local migration files, do not run `migrate deploy`; run `npm run repair:schema` from `backend` instead. That repair path applies additive, idempotent schema updates without dropping data. Demo accounts continue to use localStorage and need no backend.

## Demo login

Open `/login` and use one of the demo buttons:

- **Student**: Aisha Rahman — StudentOS AI, challenges, invitations, projects, and VentureTrack.
- **Organizer**: Priya Shah — TeamForge dashboard, participants, recommendations, and approval.
- **Mentor**: Jordan Lee — sessions, project briefs and submissions, and a performance leaderboard.

Organizer and Mentor demo workspaces can create records without the backend; demo data is saved in the browser.

The store is persisted as `skillmesh-store` in localStorage. Settings includes **Reset demo data**.

## Structure and routes

`src/components`-style UI primitives are colocated in `src/App.jsx` for this compact demo; business logic is split into `src/lib`, state into `src/store`, and the async service seam is in `src/services/api.js`.

| Role | Key routes |
| --- | --- |
| Public | `/`, `/login`, `/register` |
| Student | `/dashboard`, `/profile`, `/resumes`, `/goals`, `/activities`, `/coding-practice`, `/deadlines`, `/planner`, `/challenges`, `/invitations`, `/hackathons`, `/mentor-sessions`, `/meet/sessions/:id`, `/project-ideas`, `/projects`, `/startups/s1`, `/notifications`, `/settings` |
| Organizer | `/organizer`, `/organizer/challenges`, `/organizer/challenges/new`, `/organizer/challenges/c1/participants`, `/organizer/challenges/c1/teams`, `/organizer/challenges/c1/approved` |
| Mentor | `/mentor`, `/mentor/resumes`, `/mentor/sessions`, `/mentor/sessions/:id/meeting`, `/mentor/projects`, `/mentor/leaderboard`, `/projects`, `/notifications`, `/settings` |

## Mentor meeting rooms

Students who book a session and its mentor can open the meeting workspace from their session card. The room supports group audio/video calls, microphone and camera controls, and shared notes/key points. The meeting link is available 15 minutes before session start; signaling closes 30 minutes after its scheduled end. Browser microphone/camera access requires `localhost` or HTTPS.

Persisted accounts use the authenticated backend WebSocket and PostgreSQL notes. Run `npm run repair:schema` in `backend` to apply the additive meeting-note schema update to an existing database, then restart the backend. Demo accounts use local browser storage and same-browser-tab BroadcastChannel signaling; use persisted accounts to test calls between separate browser profiles/devices.

WebRTC attempts a direct peer connection by default. Calls across restrictive networks may need a TURN server; configure it with `VITE_WEBRTC_ICE_SERVERS` as a JSON array, for example `[{"urls":"turn:turn.example.com:3478","username":"...","credential":"..."}]`. Provide your own TURN service and keep credentials out of committed source.

## Student coding practice

The student sidebar includes original sample problems, links to LeetCode, GeeksforGeeks, and CodeChef, a focus timer, and a Java 25 editor. Java runs through [OnlineCompiler.io](https://onlinecompiler.io/) using the backend route at `/api/coding-practice/run`; no local JDK or Judge0 installation is needed. Set `ONLINECOMPILER_API_KEY` in `backend/.env` and run the backend. The API key stays server-side. Submitted source code and input are sent to OnlineCompiler.io for execution, so do not include secrets. Requests are limited to 10 runs per minute per IP, and each run is subject to the provider's plan and usage limits. Use a `public class Main` and standard Java libraries.

The execution timeout is 15 seconds. Execution time and process memory are reported by the compiler service. Built-in questions state their expected theoretical time/space complexity; optional growth benchmarks cannot prove Big-O. See [OnlineCompiler.io's API documentation](https://onlinecompiler.io/docs/run-code) and [security details](https://onlinecompiler.io/security).

## Demo script

1. Sign in as Student and inspect the Builder Score fallbacks, goals, activity, deadlines, and AI plan.
2. Open Challenges → Climate Action Sprint → Find teammates and send an invitation.
3. Use the user menu equivalent by returning to Login and choose another demo student in the seeded data, then accept the pending invitation.
4. Open Projects → CampusCart and move a Kanban task; the change persists in localStorage.
5. Switch to Organizer, generate recommendations on TeamForge, and approve a team.
6. Switch to Mentor, publish a session and project brief, review a student idea, and inspect the student leaderboard.
7. Open VentureTrack to inspect experiments, feedback themes, traction metrics, and risks.

## Scoring formulas

Builder Score is `0.25 Quiz Performance + 0.15 GitHub Activity + 0.25 Skill Strength + 0.15 Project Evidence + 0.10 Consistency + 0.10 Profile Quality`. Missing GitHub data uses a neutral 50 and is marked "Not linked"; no quiz attempts use a neutral score and are marked as not attempted. Tiers are Starter (0-39), Builder (40-64), Contributor (65-84), and Pro (85-100). The mentor leaderboard sorts by this same score.

Team score is `0.45 Skill Coverage + 0.30 Availability Fit + 0.25 Role Diversity`. Team-size constraints are hard violations. Recommendations are deterministic signals and require human approval.

## Backend schema repair

If challenge creation or TeamForge reports a schema error, run `npm run repair:schema` from the `backend` directory. This applies idempotent, additive repairs for challenge, team, TeamForge, profile, and notification tables without dropping existing data.

## Mentor API

Authenticated mentor endpoints live under `/api/mentor`: mentors can create/cancel sessions, publish/close project opportunities, review submissions, and retrieve the student leaderboard. Students can browse and book open sessions, cancel their bookings, and submit one idea per open opportunity. The backend enforces role permissions, capacity, and duplicate-submission rules.

## Resume workspace

Students using backend-authenticated accounts can upload and manage PDF or UTF-8 TXT resume versions (5 MB maximum) in one workspace with overview, resume library, resume builder, ATS review, job matching, and career-plan sections. The builder includes Modern, Classic, Technical, and Minimal single-column templates, editable contact, summary, skills, experience, projects, education, and certification sections, a live preview, persisted student drafts, and direct PDF downloads. Resume review includes a section checklist, ATS formatting signals, evidence-based keyword coverage, strengths, bullet rewrites that must preserve original facts, and improvement suggestions. Job matching separates required/preferred keywords and calculates ATS keyword coverage from the returned keyword evidence (required terms carry twice the weight). This is an estimate, not a result from a real employer ATS. Students can export an ATS report and career action plan. AI analysis and matching require `GEMINI_API_KEY` in `backend/.env`; the key remains server-side. Resume files are stored under `backend/uploads/resumes/`, are not publicly served, and are accessible to the uploading student and signed-in mentors. Using AI sends the resume contents and, for matching, the submitted job description to Gemini. Local-only demo accounts do not have backend resume storage or AI access. Mentors can browse students who have uploaded resumes and view their resume files, analyses, and recent match summaries at `/mentor/resumes`.

Apply the resume and builder tables with the normal Prisma migration command from `backend` (`npm exec prisma migrate deploy -- --config prisma7.config.ts`). Existing installations with divergent migration history should run `npm run repair:schema` from `backend` rather than forcing migration deployment; the additive repair creates both resume and builder tables.

## AI Project Mentor

The student dashboard links to a standalone Project Mentor workspace for profile-based project ideas, milestone and task roadmaps, team task assignment, public GitHub repository analysis/removal, AI debugging guidance, and publishing completed projects on the student's profile. The Architecture Planner accepts a project idea, technology stack, and optional PDF, Microsoft Word DOC/DOCX, TXT, or Markdown PRD (up to 8 MB), then saves an AI-generated architecture, visual component-flow and entity-relationship diagrams, and task roadmap into the project workspace. Word documents are text-extracted on the backend; PDFs are sent as document attachments. PRDs are processed for generation and are not stored. Gemini is the primary AI provider (`GEMINI_API_KEY`, `GEMINI_MODEL`). When Gemini is rate-limited or temporarily unavailable after retries, the backend can fall back to OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, default `openai/gpt-4o-mini`). Provider keys remain server-side.

Apply the project workspace tables by running `npm run repair:schema` from `backend` and restart the backend. The repair is additive and idempotent. Team task assignment is limited to members of a team the student already belongs to. Repository quality scores use explicit README, structure, testing, and recent activity evidence; they are estimates, not hiring or production certifications. Debugging guidance does not execute submitted code.

Scores are signals, not judgments. Organizers must use human review and contextual evidence; AI suggestions are hypotheses to test, not proof of business success.
