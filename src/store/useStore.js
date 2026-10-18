import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { builderScore } from '../lib/builderScore';
import { validateInvitation } from '../lib/invitationRules';

const student = (id, name, role, skills) => ({ id, name, email: `${id}@skillmesh.demo`, role: 'student', preferredRole: role, preferredRoles: [role], interests: ['Product building', 'Peer learning'], education: 'Computer Science', careerGoal: 'Build useful products', skills: skills.map(name => ({ name, level: 'Intermediate', evidence: `https://example.com/${id}/${name.toLowerCase().replace(/[^a-z]+/g, '-')}`, verified: true })), github: id === 'aisha' ? { username: 'aisha-dev', repos: 18, commits: 74, stars: 120, languages: 5, topLanguages: ['JavaScript', 'TypeScript', 'CSS'], activity: [3, 5, 4, 7, 6, 9, 8], lastSynced: 'Today, 10:42 AM', source: 'Demo data' } : null, profileCompleteness: 86, projectsCompleted: 2, hackathons: 2, milestones: 5, streak: 8, weeklyHours: 8 });
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
const generatedStudents = Array.from({ length: 32 }, (_, index) => {
  const names = ['Ivy Patel', 'Owen Brooks', 'Sara Kim', 'Liam Jones', 'Nia Thomas', 'Eli Morgan', 'Zoe Adams', 'Ravi Shah'];
  const skillSets = [['React', 'Testing'], ['Node.js', 'Databases'], ['Python', 'Data Analysis'], ['UI/UX', 'Product']];
  const id = `student-${String(index + 1).padStart(2, '0')}`;
  const skills = skillSets[index % skillSets.length];
  const u = student(id, `${names[index % names.length]} ${index + 1}`, ['Frontend', 'Backend', 'Data', 'Product'][index % 4], skills);
  return { ...u, github: index % 4 === 3 ? null : { username: id, repos: 3 + index % 18, commits: 8 + index * 2, stars: 12 + index * 9, languages: 2, topLanguages: ['JavaScript', 'Python'].slice(0, index % 2 + 1), activity: [1, 2, 3, index % 8, 4, 2, 5], lastSynced: 'Yesterday', source: 'Demo data' } };
});
const allStudents = [...seedUsers, ...generatedStudents];
const challengeSeed = [
  { id: 'c1', title: 'Climate Action Sprint', description: 'Build a practical tool that helps communities measure and reduce climate impact.', requiredSkills: ['React', 'Data Analysis', 'Product'], roles: ['Frontend', 'Data', 'Product'], teamSize: 4, deadline: '2026-11-02', participants: ['aisha', 'ben', 'chloe', 'diego', 'maya'] },
  { id: 'c2', title: 'Campus Innovation Lab', description: 'Create a student-first experience for learning, collaboration, or wellbeing.', requiredSkills: ['UI/UX', 'React', 'Node.js'], roles: ['Design', 'Frontend', 'Backend'], teamSize: 3, deadline: '2026-10-28', participants: ['aisha', 'ben', 'noah'] },
  { id: 'c3', title: 'Open Data for Good', description: 'Turn open datasets into accessible insights for a real audience.', requiredSkills: ['Python', 'Data Analysis', 'Cloud'], roles: ['ML Engineer', 'Analyst', 'DevOps'], teamSize: 4, deadline: '2026-12-10', participants: ['diego', 'maya', 'chloe'] }
];
const initialState = {
  users: allStudents, currentUserId: null, challenges: challengeSeed.map((challenge, index) => ({ ...challenge, participants: Array.from(new Set([...challenge.participants, ...generatedStudents.slice(index * 10, index * 10 + 10).map(u => u.id)])) })), invitations: [
    { id: 'i1', challengeId: 'c3', senderId: 'ben', receiverId: 'aisha', role: 'Backend', requiredSkills: ['Node.js'], hours: 5, message: 'Let’s build a climate dashboard.', status: 'Pending', createdAt: '2026-10-13' },
    { id: 'i2', challengeId: 'c3', senderId: 'chloe', receiverId: 'aisha', role: 'Product', requiredSkills: ['Product'], hours: 4, message: 'I can help shape the user research.', status: 'Pending', createdAt: '2026-10-14' },
    { id: 'i3', challengeId: 'c3', senderId: 'diego', receiverId: 'aisha', role: 'Data', requiredSkills: ['Data Analysis'], hours: 4, message: 'Would love to collaborate.', status: 'Declined', createdAt: '2026-10-05' },
    { id: 'i4', challengeId: 'c3', senderId: 'maya', receiverId: 'aisha', role: 'DevOps', requiredSkills: ['Cloud'], hours: 3, message: 'Let’s ship a reliable demo.', status: 'Expired', createdAt: '2026-09-20' },
    { id: 'i5', challengeId: 'c2', senderId: 'aisha', receiverId: 'ben', role: 'Frontend', requiredSkills: ['React'], hours: 5, message: 'Join the campus sprint?', status: 'Pending', createdAt: '2026-10-14' },
    { id: 'i6', challengeId: 'c2', senderId: 'aisha', receiverId: 'noah', role: 'Frontend', requiredSkills: ['React'], hours: 5, message: 'Let’s build together.', status: 'Accepted', createdAt: '2026-10-05' }
  ],
  teams: [{ id: 't1', challengeId: 'c2', members: ['aisha', 'noah'], approval: 'Approved', score: 82, coveredSkills: ['React', 'UI/UX', 'Testing'], missingSkills: ['Node.js'] }],
  goals: [{ id: 'g1', userId: 'aisha', title: 'Ship a portfolio project', targetDate: '2026-10-25', progress: 68, priority: 'High', status: 'In progress' }, { id: 'g2', userId: 'aisha', title: 'Practice algorithms', targetDate: '2026-11-01', progress: 42, priority: 'Medium', status: 'In progress' }],
  activities: [{ id: 'a1', userId: 'aisha', type: 'coding', duration: 90, date: '2026-10-14', notes: 'Built score card' }, { id: 'a2', userId: 'aisha', type: 'practice', duration: 60, date: '2026-10-13', notes: 'Algorithm practice set' }],
  deadlines: [{ id: 'd1', userId: 'aisha', title: 'Climate Action Sprint pitch', date: '2026-11-02', effort: 6, importance: 'High' }, { id: 'd2', userId: 'aisha', title: 'Algorithms study review', date: '2026-10-20', effort: 3, importance: 'Medium' }],
  projects: [{ id: 'p1', name: 'CampusCart', description: 'A student marketplace for trusted textbook exchanges.', status: 'Active', progress: 64, members: ['aisha', 'noah'], tasks: [{ id: 'task1', title: 'Polish onboarding', column: 'In Progress', priority: 'High', assignee: 'aisha' }, { id: 'task2', title: 'Add search filters', column: 'To Do', priority: 'Medium', assignee: 'noah' }, { id: 'task3', title: 'User interview notes', column: 'Review', priority: 'Low', assignee: 'aisha' }, { id: 'task4', title: 'Project scaffold', column: 'Done', priority: 'High', assignee: 'aisha' }], milestones: [{ id: 'm1', title: 'Clickable prototype', status: 'Done', progress: 100 }, { id: 'm2', title: 'Pilot launch', status: 'In progress', progress: 48 }], evidence: [{ id: 'e1', label: 'Repository', url: 'https://github.com/skillmesh/campuscart' }] }],
  startups: [{ id: 's1', projectId: 'p1', name: 'CampusCart', stage: 'Validation', problem: 'Students struggle to find affordable, trustworthy used books.', experiments: [{ id: 'x1', hypothesis: 'Students prefer local pickup', method: 'Landing page test', audience: '25 students', metric: '60% choose pickup', result: '58% chose pickup', status: 'validated' }, { id: 'x2', hypothesis: 'Verified condition increases trust', method: 'Interview', audience: '12 students', metric: '8 mention trust', result: '', status: 'running' }], feedback: [{ id: 'f1', comment: 'I want to see book condition before I pay.', source: 'Interview 1', consent: true }, { id: 'f2', comment: 'Pickup near campus would be convenient.', source: 'Survey 2', consent: true }, { id: 'f3', comment: 'The price is the biggest reason I would switch.', source: 'Interview 3', consent: true }], metrics: [{ week: 'W1', interviews: 4, signups: 12, repeat: 2, conversion: 16 }, { week: 'W2', interviews: 7, signups: 21, repeat: 5, conversion: 24 }], risks: [{ id: 'r1', title: 'Low trust between strangers', likelihood: 4, impact: 5, owner: 'Aisha', mitigation: 'Verified profiles and condition photos' }] }],
  notifications: [{ id: 'n1', userId: 'aisha', type: 'invites', title: 'New team invitation', body: 'Ben invited you to Climate Action Sprint.', read: false }, { id: 'n2', userId: 'aisha', type: 'tasks', title: 'Task due soon', body: 'Polish onboarding is due Friday.', read: false }],
  theme: 'light',
  preferences: { showNotificationBadge: true }
};

export const useStore = create(persist((set, get) => ({
  ...initialState,
  login: (id) => set(s => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      currentUserId: id,
      activities: [...s.activities, {
        id: `login-${Date.now()}`,
        userId: id,
        type: 'Platform login',
        duration: 0,
        date,
        notes: 'Signed in to SkillMesh',
      }],
    };
  }),
  logout: () => set({ currentUserId: null }),
  setAuthenticatedUser: (user) =>
  set((s) => ({
    users: [
      {
        ...user,
        skills: [],
        interests: [],
        preferredRole: "",
        preferredRoles: [],
        profileCompleteness: 0,
      },
      ...s.users.filter((u) => u.id !== user.id),
    ],
    currentUserId: user.id,
  })),
  switchUser: (id) => set({ currentUserId: id }),
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
  updatePreferences: (patch) => set(s => ({ preferences: { ...(s.preferences || {}), ...patch } })),
  resetDemo: () => set({ ...initialState, currentUserId: get().currentUserId }),
  updateProfile: (patch) => set(s => ({ users: s.users.map(u => u.id === s.currentUserId ? { ...u, ...patch } : u) })),
  upsertSkill: (skill) => set(s => ({ users: s.users.map(u => u.id === s.currentUserId ? { ...u, skills: [...(u.skills || []).filter(x => x.name.toLowerCase() !== skill.name.toLowerCase()), { ...skill, verified: Boolean(skill.evidence) }] } : u) })),
  removeSkill: (name) => set(s => ({ users: s.users.map(u => u.id === s.currentUserId ? { ...u, skills: (u.skills || []).filter(x => x.name !== name) } : u) })),
  saveLinks: (links) => set(s => ({ users: s.users.map(u => u.id === s.currentUserId ? { ...u, ...links } : u) })),
  refreshLinks: (kind) => set(s => ({ users: s.users.map(u => {
    if (u.id !== s.currentUserId || !u[kind]) return u;
    return { ...u, [kind]: { ...u[kind], lastSynced: 'Just now', source: kind === 'github' ? 'Auto' : 'Auto' } };
  }) })),
  addGoal: (goal) => set(s => ({ goals: [...s.goals, { ...goal, id: `g${Date.now()}`, userId: s.currentUserId, progress: 0 }] })),
  updateGoal: (goalId, patch) => set(s => ({
    goals: s.goals.map(goal =>
      goal.id === goalId && goal.userId === s.currentUserId
        ? { ...goal, ...patch }
        : goal
    ),
  })),
  removeGoal: (goalId) => set(s => ({
    goals: s.goals.filter(goal => goal.id !== goalId || goal.userId !== s.currentUserId),
  })),
  addActivity: (activity) => set(s => ({ activities: [...s.activities, { ...activity, id: `a${Date.now()}`, userId: s.currentUserId }] })),
  addDeadline: (deadline) => set(s => ({ deadlines: [...s.deadlines, { ...deadline, id: `d${Date.now()}`, userId: s.currentUserId }] })),
  updateDeadline: (deadlineId, patch) => set(s => ({
    deadlines: s.deadlines.map(deadline =>
      deadline.id === deadlineId && deadline.userId === s.currentUserId
        ? { ...deadline, ...patch }
        : deadline
    ),
  })),
  removeDeadline: (deadlineId) => set(s => ({
    deadlines: s.deadlines.filter(deadline =>
      deadline.id !== deadlineId || deadline.userId !== s.currentUserId
    ),
  })),
  joinChallenge: (id) => set(s => ({ challenges: s.challenges.map(c => c.id === id && !c.participants.includes(s.currentUserId) ? { ...c, participants: [...c.participants, s.currentUserId] } : c) })),
  updateChallenge: (id, patch) => set(s => ({ challenges: s.challenges.map(challenge => challenge.id === id ? { ...challenge, ...patch } : challenge) })),
  sendInvite: (data) => { const s = get(); const c = s.challenges.find(c => c.id === data.challengeId); const error = validateInvitation({ ...data, participants: c.participants, teams: s.teams, invitations: s.invitations, challenge: c }); if (error) throw new Error(error); const invite = { ...data, id: `i${Date.now()}`, senderId: s.currentUserId, status: 'Pending', createdAt: new Date().toISOString().slice(0, 10) }; set({ invitations: [...s.invitations, invite], notifications: [...s.notifications, { id: `n${Date.now()}`, userId: data.receiverId, type: 'invites', title: 'New team invitation', body: `${s.users.find(u => u.id === s.currentUserId)?.name} invited you to ${c.title}.`, read: false }] }); },
  respondInvite: (id, status) => { const s = get(); const invite = s.invitations.find(i => i.id === id); if (!invite) return; if (status === 'Accepted') { const challenge = s.challenges.find(c => c.id === invite.challengeId); const existing = s.teams.find(t => t.challengeId === invite.challengeId && t.members.includes(invite.receiverId)); if (existing) throw new Error('You are already on a team for this challenge.'); const senderTeam = s.teams.find(t => t.challengeId === invite.challengeId && t.members.includes(invite.senderId)); if (senderTeam && senderTeam.members.length >= challenge.teamSize) throw new Error('This team is already full.'); let teams = s.teams; let team = senderTeam; if (!team) { team = { id: `t${Date.now()}`, challengeId: invite.challengeId, members: [invite.senderId], approval: 'Pending approval', formation_type: 'self_formed', score: 0, coveredSkills: [], missingSkills: [] }; teams = [...teams, team]; } teams = teams.map(t => t.id === team.id ? { ...t, members: [...t.members, invite.receiverId] } : t); set({ invitations: s.invitations.map(i => i.id === id ? { ...i, status } : i), teams, notifications: [...s.notifications, { id: `n${Date.now()}`, userId: invite.senderId, type: 'responses', title: 'Invitation accepted', body: `${s.users.find(u => u.id === invite.receiverId)?.name} accepted your invitation.`, read: false }] }); return; } set({ invitations: s.invitations.map(i => i.id === id ? { ...i, status } : i) }); },
  withdrawInvite: (id) => set(s => ({ invitations: s.invitations.map(i => i.id === id && i.senderId === s.currentUserId && i.status === 'Pending' ? { ...i, status: 'Withdrawn' } : i) })),
  expireOldInvites: () => set(s => ({ invitations: s.invitations.map(i => i.status === 'Pending' && (Date.now() - new Date(i.createdAt).getTime()) > 7 * 86400000 ? { ...i, status: 'Expired' } : i) })),
  addTask: (projectId, task) => set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, { ...task, id: `task${Date.now()}` }] } : p) })),
  moveTask: (projectId, taskId, column) => set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, column } : t) } : p) })),
  addTeam: (team) => set(s => ({ teams: [...s.teams, { ...team, id: `t${Date.now()}` }] })),
  reviewTeam: (id, approval) => set(s => ({ teams: s.teams.map(team => team.id === id ? { ...team, approval, ...(approval === 'Approved' ? { approvedAt: new Date().toISOString() } : {}) } : team) })),
  approveTeam: (id) => set(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, approval: 'Approved', approvedAt: new Date().toISOString() } : t) })),
  markNotificationRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  addFeedback: (startupId, feedback) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, feedback: [...x.feedback, { ...feedback, id: `f${Date.now()}` }] } : x) })),
  addExperiment: (startupId, experiment) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, experiments: [...x.experiments, { ...experiment, id: `x${Date.now()}` }] } : x) })),
  addMetric: (startupId, metric) => set(s => ({ startups: s.startups.map(x => x.id === startupId ? { ...x, metrics: [...x.metrics, metric] } : x) }))
}), { name: 'skillmesh-store' }));

export const currentUser = (state) => state.users.find(u => u.id === state.currentUserId);
export const scoreFor = (user) => builderScore(user || {});
