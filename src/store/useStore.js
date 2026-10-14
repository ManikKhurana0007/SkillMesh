import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { builderScore } from '../lib/builderScore';
import { validateInvitation } from '../lib/invitationRules';

const student = (id, name, role, skills) => ({ id, name, email: `${id}@skillmesh.demo`, role: 'student', preferredRole: role, education: 'Computer Science', careerGoal: 'Build useful products', skills: skills.map(name => ({ name, level: 'Intermediate', evidence: true, verified: true })), github: id === 'aisha' ? { username: 'aisha-dev', repos: 18, commits: 74, stars: 120, languages: 5 } : null, leetcode: id === 'aisha' ? { username: 'aisha-codes', easy: 80, medium: 45, hard: 12, rating: 1480, ranking: 84000, streak: 19 } : null, profileCompleteness: 86, projectsCompleted: 2, hackathons: 2, milestones: 5, streak: 8, weeklyHours: 8 });
const seedUsers = [
  student('aisha', 'Aisha Rahman', 'Frontend', ['React', 'UI/UX', 'Testing']),
  student('ben', 'Ben Carter', 'Backend', ['Node.js', 'Databases', 'APIs']),
  student('chloe', 'Chloe Okafor', 'Product', ['Product', 'Research', 'UI/UX']),
  student('diego', 'Diego Silva', 'ML Engineer', ['Python', 'Machine Learning', 'Data Analysis']),
  student('maya', 'Maya Chen', 'DevOps', ['Cloud', 'DevOps', 'Security']),
  student('noah', 'Noah Williams', 'Mobile', ['React Native', 'Testing', 'Product']),
  { id: 'organizer', name: 'Priya Shah', email: 'organizer@skillmesh.demo', role: 'organizer', skills: [], profileCompleteness: 100, projectsCompleted: 4, hackathons: 6, milestones: 12, streak: 20, weeklyHours: 12 },
  { id: 'mentor', name: 'Jordan Lee', email: 'mentor@skillmesh.demo', role: 'mentor', skills: [], profileCompleteness: 100, projectsCompleted: 8, hackathons: 10, milestones: 22, streak: 30, weeklyHours: 10 }
];
const challengeSeed = [
  { id: 'c1', title: 'Climate Action Sprint', description: 'Build a practical tool that helps communities measure and reduce climate impact.', requiredSkills: ['React', 'Data Analysis', 'Product'], roles: ['Frontend', 'Data', 'Product'], teamSize: 4, deadline: '2026-11-02', participants: ['aisha', 'ben', 'chloe', 'diego', 'maya'] },
  { id: 'c2', title: 'Campus Innovation Lab', description: 'Create a student-first experience for learning, collaboration, or wellbeing.', requiredSkills: ['UI/UX', 'React', 'Node.js'], roles: ['Design', 'Frontend', 'Backend'], teamSize: 3, deadline: '2026-10-28', participants: ['aisha', 'ben', 'noah'] },
  { id: 'c3', title: 'Open Data for Good', description: 'Turn open datasets into accessible insights for a real audience.', requiredSkills: ['Python', 'Data Analysis', 'Cloud'], roles: ['ML Engineer', 'Analyst', 'DevOps'], teamSize: 4, deadline: '2026-12-10', participants: ['diego', 'maya', 'chloe'] }
];
const initialState = {
  users: seedUsers, currentUserId: null, challenges: challengeSeed, invitations: [{ id: 'i1', challengeId: 'c1', senderId: 'ben', receiverId: 'aisha', role: 'Backend', requiredSkills: ['Node.js'], message: 'Let’s build a climate dashboard.', status: 'Pending', createdAt: '2026-10-12' }],
  teams: [{ id: 't1', challengeId: 'c2', members: ['aisha', 'noah'], approval: 'Approved', score: 82, coveredSkills: ['React', 'UI/UX', 'Testing'], missingSkills: ['Node.js'] }],
  goals: [{ id: 'g1', userId: 'aisha', title: 'Ship a portfolio project', targetDate: '2026-10-25', progress: 68, priority: 'High', status: 'In progress' }, { id: 'g2', userId: 'aisha', title: 'Practice algorithms', targetDate: '2026-11-01', progress: 42, priority: 'Medium', status: 'In progress' }],
  activities: [{ id: 'a1', userId: 'aisha', type: 'coding', duration: 90, date: '2026-10-14', notes: 'Built score card' }, { id: 'a2', userId: 'aisha', type: 'practice', duration: 60, date: '2026-10-13', notes: 'LeetCode medium set' }],
  deadlines: [{ id: 'd1', userId: 'aisha', title: 'Climate Action Sprint pitch', date: '2026-11-02', effort: 6, importance: 'High' }, { id: 'd2', userId: 'aisha', title: 'Algorithms study review', date: '2026-10-20', effort: 3, importance: 'Medium' }],
  projects: [{ id: 'p1', name: 'CampusCart', description: 'A student marketplace for trusted textbook exchanges.', status: 'Active', progress: 64, members: ['aisha', 'noah'], tasks: [{ id: 'task1', title: 'Polish onboarding', column: 'In Progress', priority: 'High', assignee: 'aisha' }, { id: 'task2', title: 'Add search filters', column: 'To Do', priority: 'Medium', assignee: 'noah' }, { id: 'task3', title: 'User interview notes', column: 'Review', priority: 'Low', assignee: 'aisha' }, { id: 'task4', title: 'Project scaffold', column: 'Done', priority: 'High', assignee: 'aisha' }], milestones: [{ id: 'm1', title: 'Clickable prototype', status: 'Done', progress: 100 }, { id: 'm2', title: 'Pilot launch', status: 'In progress', progress: 48 }], evidence: [{ id: 'e1', label: 'Repository', url: 'https://github.com/skillmesh/campuscart' }] }],
  startups: [{ id: 's1', projectId: 'p1', name: 'CampusCart', stage: 'Validation', problem: 'Students struggle to find affordable, trustworthy used books.', experiments: [{ id: 'x1', hypothesis: 'Students prefer local pickup', method: 'Landing page test', audience: '25 students', metric: '60% choose pickup', result: '58% chose pickup', status: 'validated' }, { id: 'x2', hypothesis: 'Verified condition increases trust', method: 'Interview', audience: '12 students', metric: '8 mention trust', result: '', status: 'running' }], feedback: [{ id: 'f1', comment: 'I want to see book condition before I pay.', source: 'Interview 1', consent: true }, { id: 'f2', comment: 'Pickup near campus would be convenient.', source: 'Survey 2', consent: true }, { id: 'f3', comment: 'The price is the biggest reason I would switch.', source: 'Interview 3', consent: true }], metrics: [{ week: 'W1', interviews: 4, signups: 12, repeat: 2, conversion: 16 }, { week: 'W2', interviews: 7, signups: 21, repeat: 5, conversion: 24 }], risks: [{ id: 'r1', title: 'Low trust between strangers', likelihood: 4, impact: 5, owner: 'Aisha', mitigation: 'Verified profiles and condition photos' }] }],
  notifications: [{ id: 'n1', userId: 'aisha', type: 'invites', title: 'New team invitation', body: 'Ben invited you to Climate Action Sprint.', read: false }, { id: 'n2', userId: 'aisha', type: 'tasks', title: 'Task due soon', body: 'Polish onboarding is due Friday.', read: false }],
  theme: 'light'
};

export const useStore = create(persist((set, get) => ({
  ...initialState,
  login: (id) => set({ currentUserId: id }),
  logout: () => set({ currentUserId: null }),
  switchUser: (id) => set({ currentUserId: id }),
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
  resetDemo: () => set({ ...initialState, currentUserId: get().currentUserId }),
  updateProfile: (patch) => set(s => ({ users: s.users.map(u => u.id === s.currentUserId ? { ...u, ...patch } : u) })),
  addGoal: (goal) => set(s => ({ goals: [...s.goals, { ...goal, id: `g${Date.now()}`, userId: s.currentUserId, progress: 0 }] })),
  addActivity: (activity) => set(s => ({ activities: [...s.activities, { ...activity, id: `a${Date.now()}`, userId: s.currentUserId }] })),
  addDeadline: (deadline) => set(s => ({ deadlines: [...s.deadlines, { ...deadline, id: `d${Date.now()}`, userId: s.currentUserId }] })),
  joinChallenge: (id) => set(s => ({ challenges: s.challenges.map(c => c.id === id && !c.participants.includes(s.currentUserId) ? { ...c, participants: [...c.participants, s.currentUserId] } : c) })),
  sendInvite: (data) => { const s = get(); const c = s.challenges.find(c => c.id === data.challengeId); const error = validateInvitation({ ...data, participants: c.participants, teams: s.teams, invitations: s.invitations, challenge: c }); if (error) throw new Error(error); set({ invitations: [...s.invitations, { ...data, id: `i${Date.now()}`, senderId: s.currentUserId, status: 'Pending', createdAt: new Date().toISOString().slice(0, 10) }] }); },
  respondInvite: (id, status) => set(s => { const invite = s.invitations.find(i => i.id === id); if (!invite) return s; let teams = s.teams; if (status === 'Accepted') { let team = teams.find(t => t.challengeId === invite.challengeId && t.members.includes(invite.senderId)); if (!team) { team = { id: `t${Date.now()}`, challengeId: invite.challengeId, members: [invite.senderId], approval: 'Pending approval', score: 0, coveredSkills: [], missingSkills: [] }; teams = [...teams, team]; } teams = teams.map(t => t.id === team.id ? { ...t, members: [...t.members, invite.receiverId] } : t); } return { invitations: s.invitations.map(i => i.id === id ? { ...i, status } : i), teams }; }),
  withdrawInvite: (id) => set(s => ({ invitations: s.invitations.map(i => i.id === id ? { ...i, status: 'Withdrawn' } : i) })),
  addTask: (projectId, task) => set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { ...task, id: `task${Date.now()}` }] } : p) })),
  moveTask: (projectId, taskId, column) => set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, column } : t) } : p) })),
  approveTeam: (id) => set(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, approval: 'Approved', approvedAt: new Date().toISOString() } : t) })),
  markNotificationRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  addFeedback: (startupId, feedback) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, feedback: [...x.feedback, { ...feedback, id: `f${Date.now()}` }] } : x) })),
  addExperiment: (startupId, experiment) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, experiments: [...x.experiments, { ...experiment, id: `x${Date.now()}` }] } : x) })),
  addMetric: (startupId, metric) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, metrics: [...x.metrics, metric] } : x) }))
}), { name: 'skillmesh-store' }));

export const currentUser = (state) => state.users.find(u => u.id === state.currentUserId);
export const scoreFor = (user) => builderScore(user || {});
