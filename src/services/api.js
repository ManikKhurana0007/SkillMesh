
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

};
