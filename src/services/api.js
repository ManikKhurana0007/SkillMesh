
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const service = {
  executePracticeCode: async (code, input = "") => {
    const response = await api.post("/coding-practice/run", { code, input });
    return response.data;
  },

  register: async (data) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  login: async (data) => {
    const response = await api.post("/auth/login", data);
    return response.data;
  },

  googleLogin: async (credential) => {
    const response = await api.post("/auth/google", { credential });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get("/profile");
    return response.data;
  },

  updateProfileAbout: async (data) => {
    const response = await api.patch("/profile/about", data);
    return response.data;
  },

  saveGitHubStats: async (github) => {
    const response = await api.patch("/profile/github", { github });
    return response.data;
  },

  saveProfileAvailability: async (slots) => {
    const response = await api.put("/profile/availability", { slots });
    return response.data;
  },

  saveProfileSkill: async (skill) => {
    const response = await api.post("/profile/skills", skill);
    return response.data;
  },

  deleteProfileSkill: async (skillId) => {
    const response = await api.delete(`/profile/skills/${encodeURIComponent(skillId)}`);
    return response.data;
  },

  addProfileEvidence: async (evidence) => {
    const response = await api.post("/profile/evidence", evidence);
    return response.data;
  },

  deleteProfileEvidence: async (evidenceId) => {
    const response = await api.delete(`/profile/evidence/${encodeURIComponent(evidenceId)}`);
    return response.data;
  },

  logProfileActivity: async (activity) => {
    const response = await api.post("/profile/activities", activity);
    return response.data;
  },

  getPracticePlan: async () => {
    const response = await api.get("/planner");
    return response.data;
  },

  generatePracticePlan: async (timeZone) => {
    const response = await api.post("/planner/generate", { timeZone });
    return response.data;
  },

  generatePracticeQuiz: async (taskId) => {
    const response = await api.post(`/planner/tasks/${encodeURIComponent(taskId)}/quiz`);
    return response.data;
  },

  submitPracticeQuiz: async (taskId, answers, activeMinutes) => {
    const response = await api.post(`/planner/tasks/${encodeURIComponent(taskId)}/attempts`, { answers, activeMinutes });
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get("/notifications");
    return response.data;
  },

  markNotificationRead: async (notificationId) => {
    const response = await api.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
    return response.data;
  },

  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  getGitHubProfile: async (username) => {
    const response = await api.get(
      `/github/profile/${encodeURIComponent(username)}`
    );
    return response.data;
  },

  getGitHubRepositories: async (username) => {
    const response = await api.get(
      `/github/repositories/${encodeURIComponent(username)}`
    );
    return response.data;
  },
  
getGitHubCommits: async (username) => {
  const response = await api.get(
    `/github/commits/${encodeURIComponent(username)}`
  );
  return response.data;
},

getOrganizerChallenges: async () => {
  const response = await api.get("/challenges/mine");
  return response.data;
},

getOrganizerTeams: async () => {
  const response = await api.get("/teamforge/organizer/teams");
  return response.data;
},

reviewOrganizerTeam: async (teamId, status) => {
  const response = await api.patch(`/teamforge/organizer/teams/${encodeURIComponent(teamId)}/review`, { status });
  return response.data;
},

getPublishedChallenges: async (params = {}) => {
  const response = await api.get("/challenges", { params });
  return response.data;
},

joinChallenge: async (id) => {
  const response = await api.post(`/challenges/${encodeURIComponent(id)}/join`);
  return response.data;
},

getChallengeParticipants: async (id) => {
  const response = await api.get(`/challenges/${encodeURIComponent(id)}/participants`);
  return response.data;
},

getChallengeTeammates: async (id) => {
  const response = await api.get(`/challenges/${encodeURIComponent(id)}/teammates`);
  return response.data;
},

getInvitations: async () => {
  const response = await api.get("/challenges/invitations");
  return response.data;
},

getMyTeams: async () => {
  const response = await api.get("/challenges/teams");
  return response.data;
},

getTeamChat: async (teamId) => {
  const response = await api.get(`/challenges/teams/${encodeURIComponent(teamId)}/chat`);
  return response.data;
},

sendTeamChatMessage: async (teamId, body) => {
  const response = await api.post(`/challenges/teams/${encodeURIComponent(teamId)}/messages`, { body });
  return response.data;
},

uploadTeamChatMessage: async (teamId, body, file) => {
  const formData = new FormData();
  if (body.trim()) formData.append("body", body);
  formData.append("file", file);
  const response = await api.post(`/challenges/teams/${encodeURIComponent(teamId)}/messages`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
},

getTeamChatAttachmentUrl: (downloadUrl, inline = false) =>
  `${api.defaults.baseURL}${downloadUrl}${inline ? "?inline=1" : ""}`,

sendInvitation: async (challengeId, data) => {
  const response = await api.post(`/challenges/${encodeURIComponent(challengeId)}/invitations`, data);
  return response.data;
},

respondToInvitation: async (invitationId, status) => {
  const response = await api.patch(`/challenges/invitations/${encodeURIComponent(invitationId)}`, { status });
  return response.data;
},

createChallenge: async (data) => {
  const response = await api.post("/challenges", data);
  return response.data;
},

updateChallenge: async (id, data) => {
  const response = await api.patch(`/challenges/${encodeURIComponent(id)}`, data);
  return response.data;
},

publishChallenge: async (id) => {
  const response = await api.post(`/challenges/${encodeURIComponent(id)}/publish`);
  return response.data;
},

getFormationConfig: async (challengeId) => {
  const response = await api.get(`/teamforge/challenges/${encodeURIComponent(challengeId)}/formation-config`);
  return response.data;
},

updateFormationConfig: async (challengeId, data) => {
  const response = await api.patch(`/teamforge/challenges/${encodeURIComponent(challengeId)}/formation-config`, data);
  return response.data;
},

generateFormationRun: async (challengeId, data) => {
  const response = await api.post(`/teamforge/challenges/${encodeURIComponent(challengeId)}/formation-runs`, data);
  return response.data;
},

getFormationRun: async (runId) => {
  const response = await api.get(`/teamforge/formation-runs/${encodeURIComponent(runId)}`);
  return response.data;
},

approveFormationAlternative: async (runId, data) => {
  const response = await api.post(`/teamforge/formation-runs/${encodeURIComponent(runId)}/approve`, data);
  return response.data;
},

createProjectTask: async (projectId, data) => {
  const response = await api.post(`/teamforge/projects/${encodeURIComponent(projectId)}/tasks`, data);
  return response.data;
},

createDisruption: async (projectId, data) => {
  const response = await api.post(`/teamforge/projects/${encodeURIComponent(projectId)}/disruptions`, data);
  return response.data;
},

getDisruption: async (scenarioId) => {
  const response = await api.get(`/teamforge/disruptions/${encodeURIComponent(scenarioId)}`);
  return response.data;
},

getMentorSessions: async () => {
  const response = await api.get("/mentor/sessions/mine");
  return response.data;
},

getResumes: async () => {
  const response = await api.get("/resumes");
  return response.data;
},

getProjectMentorWorkspace: async () => {
  const response = await api.get("/project-mentor");
  return response.data;
},

getPublicProjectShowcase: async (userId) => {
  const response = await api.get(`/profile/students/${encodeURIComponent(userId)}/showcase`);
  return response.data;
},

getProjectRecommendations: async () => {
  const response = await api.post("/project-mentor/recommendations");
  return response.data;
},

createProjectRoadmap: async (data) => {
  const response = await api.post("/project-mentor/roadmaps", data);
  return response.data;
},

generateProjectArchitecture: async ({ name, idea, techStack, teamId, prdFile }) => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("idea", idea);
  formData.append("techStack", techStack);
  if (teamId) formData.append("teamId", teamId);
  if (prdFile) formData.append("prd", prdFile);
  const response = await api.post("/project-mentor/architecture", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
},

createBuildTask: async (projectId, data) => {
  const response = await api.post(`/project-mentor/projects/${encodeURIComponent(projectId)}/tasks`, data);
  return response.data;
},

updateBuildTask: async (projectId, taskId, data) => {
  const response = await api.patch(`/project-mentor/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, data);
  return response.data;
},

updateBuildProjectStatus: async (projectId, status) => {
  const response = await api.patch(`/project-mentor/projects/${encodeURIComponent(projectId)}/status`, { status });
  return response.data;
},

deleteBuildProject: async (projectId) => {
  const response = await api.delete(`/project-mentor/projects/${encodeURIComponent(projectId)}`);
  return response.data;
},

analyzeBuildRepository: async (projectId, githubUrl) => {
  const response = await api.post(`/project-mentor/projects/${encodeURIComponent(projectId)}/github-analysis`, { githubUrl });
  return response.data;
},

removeBuildRepository: async (projectId) => {
  const response = await api.delete(`/project-mentor/projects/${encodeURIComponent(projectId)}/github-analysis`);
  return response.data;
},

explainBuildError: async (data) => {
  const response = await api.post("/project-mentor/debug", data);
  return response.data;
},

updateBuildProjectShowcase: async (projectId, data) => {
  const response = await api.patch(`/project-mentor/projects/${encodeURIComponent(projectId)}/showcase`, data);
  return response.data;
},

getResumeBuilderDraft: async () => {
  const response = await api.get("/resumes/builder/draft");
  return response.data;
},

saveResumeBuilderDraft: async (draft) => {
  const response = await api.put("/resumes/builder/draft", draft);
  return response.data;
},

uploadResume: async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/resumes", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
},

deleteResume: async (resumeId) => {
  const response = await api.delete(`/resumes/${encodeURIComponent(resumeId)}`);
  return response.data;
},

analyzeResume: async (resumeId) => {
  const response = await api.post(`/resumes/${encodeURIComponent(resumeId)}/analyze`);
  return response.data;
},

matchResumeToJob: async (resumeId, data) => {
  const response = await api.post(`/resumes/${encodeURIComponent(resumeId)}/matches`, data);
  return response.data;
},

getMentorResumeStudents: async () => {
  const response = await api.get("/resumes/students");
  return response.data;
},

getResumeDownloadUrl: (resumeId) =>
  `${api.defaults.baseURL}/resumes/${encodeURIComponent(resumeId)}/download`,

getMentorMeeting: async (sessionId) => {
  const response = await api.get(`/mentor/sessions/${encodeURIComponent(sessionId)}/meeting`);
  return response.data;
},

createMeetingNote: async (sessionId, data) => {
  const response = await api.post(`/mentor/sessions/${encodeURIComponent(sessionId)}/meeting/notes`, data);
  return response.data;
},

deleteMeetingNote: async (sessionId, noteId) => {
  const response = await api.delete(`/mentor/sessions/${encodeURIComponent(sessionId)}/meeting/notes/${encodeURIComponent(noteId)}`);
  return response.data;
},

getMeetingSocketUrl: () => {
  const url = new URL("/api/mentor/meeting-signal", api.defaults.baseURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
},

getOpenMentorSessions: async () => {
  const response = await api.get("/mentor/sessions/open");
  return response.data;
},

getBookedMentorSessions: async () => {
  const response = await api.get("/mentor/sessions/booked");
  return response.data;
},

createMentorSession: async (data) => {
  const response = await api.post("/mentor/sessions", data);
  return response.data;
},

updateMentorSession: async (sessionId, status) => {
  const response = await api.patch(`/mentor/sessions/${encodeURIComponent(sessionId)}`, { status });
  return response.data;
},

bookMentorSession: async (sessionId) => {
  const response = await api.post(`/mentor/sessions/${encodeURIComponent(sessionId)}/book`);
  return response.data;
},

cancelMentorSessionBooking: async (sessionId) => {
  const response = await api.delete(`/mentor/sessions/${encodeURIComponent(sessionId)}/book`);
  return response.data;
},

getMentorProjects: async () => {
  const response = await api.get("/mentor/projects/mine");
  return response.data;
},

getOpenMentorProjects: async () => {
  const response = await api.get("/mentor/projects/open");
  return response.data;
},

createMentorProject: async (data) => {
  const response = await api.post("/mentor/projects", data);
  return response.data;
},

updateMentorProject: async (projectId, status) => {
  const response = await api.patch(`/mentor/projects/${encodeURIComponent(projectId)}`, { status });
  return response.data;
},

submitProjectIdea: async (projectId, data) => {
  const response = await api.post(`/mentor/projects/${encodeURIComponent(projectId)}/ideas`, data);
  return response.data;
},

resubmitProjectIdea: async (submissionId, data) => {
  const response = await api.patch(`/mentor/ideas/${encodeURIComponent(submissionId)}/resubmit`, data);
  return response.data;
},

reviewProjectIdea: async (submissionId, data) => {
  const response = await api.patch(`/mentor/ideas/${encodeURIComponent(submissionId)}`, data);
  return response.data;
},

getMentorLeaderboard: async () => {
  const response = await api.get("/mentor/leaderboard");
  return response.data;
},

approveRecoveryPlan: async (planId, data = {}) => {
  const response = await api.post(`/teamforge/recovery-plans/${encodeURIComponent(planId)}/approve`, data);
  return response.data;
},

rejectRecoveryPlan: async (planId, data) => {
  const response = await api.post(`/teamforge/recovery-plans/${encodeURIComponent(planId)}/reject`, data);
  return response.data;
},

};
