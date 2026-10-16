
import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export const service = {
  register: async (data) => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  login: async (data) => {
    const response = await api.post("/auth/login", data);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
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

getPublishedChallenges: async (params = {}) => {
  const response = await api.get("/challenges", { params });
  return response.data;
},

joinChallenge: async (id) => {
  const response = await api.post(`/challenges/${encodeURIComponent(id)}/join`);
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

approveRecoveryPlan: async (planId, data = {}) => {
  const response = await api.post(`/teamforge/recovery-plans/${encodeURIComponent(planId)}/approve`, data);
  return response.data;
},

rejectRecoveryPlan: async (planId, data) => {
  const response = await api.post(`/teamforge/recovery-plans/${encodeURIComponent(planId)}/reject`, data);
  return response.data;
},

};
