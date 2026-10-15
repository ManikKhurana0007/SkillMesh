const clamp = n => Math.max(0, Math.min(100, Math.round(n)));

export function builderScore(user = {}) {
  const github = user.github;
  const skills = user.skills || [];
  const skillStrength = skills.length
    ? skills.reduce((sum, skill) => sum + ({ Beginner: 40, Intermediate: 70, Advanced: 100 }[skill.level] || 40) + (skill.evidence ? 5 : 0), 0) / skills.length
    : 40;
  const githubActivity = github
    ? 100 * Math.min(1, Math.log1p((github.repos || 0) + (github.stars || 0) / 12 + (github.languages || 0) * 4 + (github.recentEvents || github.commits || 0) / 2) / Math.log1p(40 + 500 / 12 + 120))
    : 50;
  const components = [
    { key: 'github', label: 'GitHub activity', weight: .25, value: clamp(github ? githubActivity * (github.verified === false ? .9 : 1) : 50), notLinked: !github },
    { key: 'skillStrength', label: 'Skill strength', weight: .30, value: clamp(skillStrength) },
    { key: 'projectEvidence', label: 'Project evidence', weight: .20, value: clamp((user.approvedProjects || user.projectsCompleted || 0) * 18 + (user.milestones || 0) * 5 + (user.evidenceLinks || 0) * 7 + (user.hackathons || 0) * 8) },
    { key: 'consistency', label: 'Consistency', weight: .15, value: clamp((user.streak || 0) * 4 + (user.weeklyHours || 0) * 3) },
    { key: 'profileQuality', label: 'Profile quality', weight: .10, value: clamp((user.profileCompleteness || 0) + skills.filter(skill => skill.evidence).length * 3 + (github ? 8 : 0)) }
  ];
  const total = clamp(components.reduce((sum, component) => sum + component.value * component.weight, 0));
  const tier = total < 40 ? 'Starter' : total < 65 ? 'Builder' : total < 85 ? 'Contributor' : 'Pro';
  const tips = components.filter(component => component.value < 65).map(component => `Strengthen ${component.label.toLowerCase()} to raise your signal.`);
  return { formulaVersion: 'v2-no-coding-provider', total, tier, components, tips };
}
