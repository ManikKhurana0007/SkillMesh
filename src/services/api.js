const delay = (value) => new Promise(resolve => setTimeout(() => resolve(value), 250));
export const service = {
  getDashboard: (state) => delay(state),
  saveProfile: (profile) => delay(profile),
  createGoal: (goal) => delay(goal),
  createInvitation: (invite) => delay(invite),
  createActionPlan: (items) => delay(items),
  analyzeFeedback: (themes) => delay(themes)
};
