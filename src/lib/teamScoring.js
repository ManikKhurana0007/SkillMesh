export function scoreTeam(challenge, members) {
  const skills = new Set(members.flatMap(m => (m.skills || []).map(s => typeof s === 'string' ? s : s.name)));
  const requirements = challenge.requiredSkills || [];
  const covered = requirements.filter(r => skills.has(typeof r === 'string' ? r : r.name)).map(r => typeof r === 'string' ? r : r.name);
  const missing = requirements.filter(r => !skills.has(typeof r === 'string' ? r : r.name)).map(r => typeof r === 'string' ? r : r.name);
  const skillCoverage = requirements.length ? covered.length / requirements.length * 100 : 100;
  const roleDiversity = new Set(members.map(m => m.role || m.preferredRole)).size / Math.max(1, Math.min(members.length, (challenge.roles || []).length || members.length)) * 100;
  const availabilityFit = members.length ? members.reduce((s, m) => s + (m.availabilityMatch || 75), 0) / members.length : 0;
  const violations = members.length > challenge.teamSize ? [`Team size cannot exceed ${challenge.teamSize}.`] : [];
  return { score: Math.round(skillCoverage * .45 + availabilityFit * .3 + Math.min(100, roleDiversity) * .25), breakdown: { skillCoverage: Math.round(skillCoverage), availabilityFit: Math.round(availabilityFit), roleDiversity: Math.round(Math.min(100, roleDiversity)) }, coveredSkills: covered, missingSkills: missing, reasons: missing.length ? ['Add members with missing skills.'] : ['Strong coverage across required skills.'], violations };
}
