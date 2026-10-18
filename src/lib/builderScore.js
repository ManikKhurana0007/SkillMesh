const clamp = n => Math.max(0, Math.min(100, Math.round(n)));

export function builderScore(user = {}) {
  const github = user.github;
  const skills = user.skills || [];
  const skillStrength = skills.length
    ? skills.reduce((sum, skill) => sum + ({ Beginner: 40, Intermediate: 70, Advanced: 100 }[skill.level] || 40), 0) / skills.length
    : 0;
  const githubActivity = github
    ? 100 * Math.min(1, Math.log1p((github.repos || 0) + (github.stars || 0) / 12 + (github.commits || 0) * 2) / Math.log1p(40 + 500 / 12 + 120 * 2))
    : 50;
  const evidenceLinks = skills.filter(skill => skill.evidence).length + (user.profileEvidenceCount || 0);
  const availabilitySlots = user.availabilitySlots ?? user.availability?.length ?? 0;
  const recentActivityDays = user.recentActivityDays ?? user.stats?.recentActivityDays ?? 0;
  const hasQuizScore = Number.isFinite(user.quizScore) || Number.isFinite(user.stats?.quizScore);
  const quizScore = Number.isFinite(user.quizScore)
    ? user.quizScore
    : Number.isFinite(user.stats?.quizScore)
      ? user.stats.quizScore
      : 50;
  const profileFields = [
    Boolean(user.education),
    Boolean(user.careerGoal),
    (user.interests || []).length > 0,
    (user.preferredRoles || []).length > 0,
    skills.length > 0,
    availabilitySlots > 0,
  ];
  const components = [
    { key: 'quizPerformance', label: 'Quiz performance', weight: .25, value: clamp(quizScore), noAttempts: !hasQuizScore },
    { key: 'github', label: 'GitHub activity', weight: .15, value: clamp(github ? githubActivity * (github.verified === false ? .9 : 1) : 50), notLinked: !github },
    { key: 'skillStrength', label: 'Skill strength', weight: .25, value: clamp(skillStrength) },
    { key: 'projectEvidence', label: 'Evidence', weight: .15, value: clamp(evidenceLinks / 5 * 100) },
    { key: 'consistency', label: 'Consistency', weight: .10, value: clamp(recentActivityDays / 12 * 100) },
    { key: 'profileQuality', label: 'Profile completeness', weight: .10, value: clamp(profileFields.filter(Boolean).length / profileFields.length * 100) }
  ];
  const total = clamp(components.reduce((sum, component) => sum + component.value * component.weight, 0));
  const tier = total < 40 ? 'Starter' : total < 65 ? 'Builder' : total < 85 ? 'Contributor' : 'Pro';
  const tips = components.filter(component => component.value < 65).map(component => `Strengthen ${component.label.toLowerCase()} to raise your signal.`);
  return { formulaVersion: 'v4-quiz-weighted', total, tier, components, tips };
}
