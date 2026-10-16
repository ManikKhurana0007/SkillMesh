const PROFICIENCY_SCORE = {
  BEGINNER: 0.5,
  INTERMEDIATE: 0.75,
  ADVANCED: 1,
};

export const FORMATION_ALGORITHM = "teamforge-adaptive-v1";
export const RESCUE_ALGORITHM = "teamforge-rescue-v1";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
}

function memberSkills(member) {
  return (member.skills || []).map((skill) => ({
    name: normalize(typeof skill === "string" ? skill : skill.name),
    proficiency: typeof skill === "string" ? "BEGINNER" : skill.proficiency || "BEGINNER",
  }));
}

function scoreSkillCoverage(requirements, members) {
  const covered = [];
  const missing = [];
  let weightedTotal = 0;
  let weightedCovered = 0;

  for (const requirement of requirements) {
    const name = normalize(requirement.name || requirement.skill || requirement);
    const weight = Number(requirement.weight ?? 1);
    const best = members
      .flatMap(memberSkills)
      .filter((skill) => skill.name === name)
      .reduce((score, skill) => Math.max(score, PROFICIENCY_SCORE[skill.proficiency] || 0), 0);
    weightedTotal += weight;
    if (best > 0) {
      covered.push(name);
      weightedCovered += weight * best;
    } else {
      missing.push(name);
    }
  }

  return {
    coveredSkills: unique(covered),
    missingSkills: unique(missing),
    coverage: weightedTotal ? weightedCovered / weightedTotal : 1,
  };
}

function scoreAvailability(members, requiredCapacity) {
  if (!members.length) return 0;
  const capacity = members.reduce((total, member) => total + Number(member.weeklyCapacity || 0), 0);
  return requiredCapacity > 0 ? Math.min(1, capacity / requiredCapacity) : 1;
}

function scoreRoles(requiredRoles, members) {
  if (!requiredRoles.length) return { coveredRoles: [], missingRoles: [], coverage: 1 };
  const roles = new Set(members.flatMap((member) => member.roles || (member.role ? [member.role] : []), normalize));
  const coveredRoles = requiredRoles.map(normalize).filter((role) => roles.has(role));
  return {
    coveredRoles,
    missingRoles: requiredRoles.map(normalize).filter((role) => !roles.has(role)),
    coverage: coveredRoles.length / requiredRoles.length,
  };
}

export function evaluateFormationTeam(config, members) {
  const minSize = Number(config.minTeamSize ?? 1);
  const maxSize = Number(config.maxTeamSize ?? config.teamSize ?? 1);
  const skill = scoreSkillCoverage(config.requiredSkills || [], members);
  const roles = scoreRoles(config.requiredRoles || [], members);
  const availability = scoreAvailability(members, Number(config.requiredWeeklyCapacity || 0));
  const violations = [];

  if (members.length < minSize) violations.push(`Team requires at least ${minSize} members.`);
  if (members.length > maxSize) violations.push(`Team cannot exceed ${maxSize} members.`);
  if (skill.missingSkills.length) violations.push(`Missing skills: ${skill.missingSkills.join(", ")}.`);
  if (roles.missingRoles.length) violations.push(`Missing roles: ${roles.missingRoles.join(", ")}.`);
  if (availability < 1) violations.push("The team does not meet the required weekly capacity.");

  const weights = {
    skills: Number(config.objectiveWeights?.skills ?? 0.55),
    roles: Number(config.objectiveWeights?.roles ?? 0.2),
    availability: Number(config.objectiveWeights?.availability ?? 0.25),
  };
  const score = skill.coverage * weights.skills + roles.coverage * weights.roles + availability * weights.availability;

  return {
    feasible: violations.length === 0,
    score: Math.round(score * 10000) / 100,
    metrics: {
      skillCoverage: Math.round(skill.coverage * 10000) / 100,
      roleCoverage: Math.round(roles.coverage * 10000) / 100,
      availabilityFit: Math.round(availability * 10000) / 100,
    },
    coveredSkills: skill.coveredSkills,
    missingSkills: skill.missingSkills,
    coveredRoles: roles.coveredRoles,
    missingRoles: roles.missingRoles,
    violations,
  };
}

export function generateFormationAlternatives(config, participants, limit = 5) {
  const maxSize = Number(config.maxTeamSize ?? config.teamSize ?? 1);
  const minSize = Number(config.minTeamSize ?? 1);
  const candidates = [...participants]
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .filter((participant) => participant.eligible !== false);
  const alternatives = [];

  function search(start, members) {
    if (members.length >= minSize) {
      const evaluation = evaluateFormationTeam(config, members);
      if (evaluation.feasible) alternatives.push({ members: [...members], evaluation });
    }
    if (members.length >= maxSize || alternatives.length >= limit * 4) return;
    for (let index = start; index < candidates.length; index += 1) {
      search(index + 1, [...members, candidates[index]]);
    }
  }

  search(0, []);
  const ranked = alternatives.sort((left, right) => {
    if (right.evaluation.score !== left.evaluation.score) return right.evaluation.score - left.evaluation.score;
    return left.members.map((member) => member.id).join(",").localeCompare(right.members.map((member) => member.id).join(","));
  });

  return ranked.slice(0, limit).map((alternative, index) => ({
    rank: index + 1,
    memberIds: alternative.members.map((member) => member.id),
    ...alternative.evaluation,
  }));
}

function topologicalTasks(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const incoming = new Map(tasks.map((task) => [task.id, 0]));
  const outgoing = new Map(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    for (const dependency of task.dependencies || []) {
      if (!byId.has(dependency)) continue;
      incoming.set(task.id, incoming.get(task.id) + 1);
      outgoing.get(dependency).push(task.id);
    }
  }
  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort();
  const ordered = [];
  while (queue.length) {
    const id = queue.shift();
    ordered.push(byId.get(id));
    for (const next of outgoing.get(id)) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
    queue.sort();
  }
  if (ordered.length !== tasks.length) throw new Error("Task dependencies contain a cycle.");
  return { ordered, outgoing };
}

export function analyzeRecovery(tasks, disruption) {
  const { ordered, outgoing } = topologicalTasks(tasks);
  const affected = new Set();
  const initial = tasks.filter((task) => (
    task.id === disruption.taskId ||
    (disruption.memberId && task.ownerId === disruption.memberId) ||
    (disruption.type === "OVERDUE_TASK" && task.status !== "DONE" && new Date(task.dueAt) < new Date())
  ));
  const queue = initial.map((task) => task.id);
  while (queue.length) {
    const id = queue.shift();
    if (affected.has(id)) continue;
    affected.add(id);
    queue.push(...(outgoing.get(id) || []));
  }
  const affectedTasks = ordered.filter((task) => affected.has(task.id));
  return {
    affectedTaskIds: affectedTasks.map((task) => task.id),
    blockedTaskIds: initial.map((task) => task.id),
    remainingEffortHours: affectedTasks.reduce((total, task) => total + Math.max(0, Number(task.estimateHours || 0) - Number(task.completedHours || 0)), 0),
    affectedTasks,
  };
}

export function generateRecoveryPlans(tasks, members, disruption) {
  const analysis = analyzeRecovery(tasks, disruption);
  const available = members.filter((member) => member.available !== false);
  const plans = available.map((member) => {
    const changes = analysis.affectedTasks
      .filter((task) => !task.ownerId || task.ownerId === disruption.memberId || task.id === disruption.taskId)
      .map((task) => ({ taskId: task.id, previousOwnerId: task.ownerId || null, proposedOwnerId: member.id }));
    const workload = available.reduce((total, candidate) => total + Number(candidate.currentWorkloadHours || 0), 0);
    const capacity = Number(member.weeklyCapacity || 0);
    return {
      proposedOwnerId: member.id,
      changes,
      remainingEffortHours: analysis.remainingEffortHours,
      availableCapacityHours: Math.max(0, capacity - workload),
      feasible: changes.length > 0 && Math.max(0, capacity - workload) >= analysis.remainingEffortHours,
      risks: changes.length ? [] : ["No affected task can be reassigned to this member."],
    };
  }).filter((plan) => plan.changes.length > 0);

  return plans
    .sort((left, right) => Number(right.feasible) - Number(left.feasible) || left.proposedOwnerId.localeCompare(right.proposedOwnerId))
    .map((plan, index) => ({ ...plan, rank: index + 1 }));
}

