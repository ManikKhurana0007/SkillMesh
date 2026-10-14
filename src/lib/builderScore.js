const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const logCap = (n, cap) => clamp(Math.log1p(Math.max(0, n)) / Math.log1p(cap) * 100);
export function builderScore(user) {
  const github = user.github;
  const leetcode = user.leetcode;
  const skills = user.skills || [];
  const skillStrength = skills.length ? skills.reduce((sum, s) => sum + ({ Beginner: 40, Intermediate: 70, Advanced: 100 }[s.level] || 40) + (s.evidence ? 5 : 0) + (s.verified ? 5 : 0), 0) / skills.length : 40;
  const components = [
    { key: 'github', label: 'GitHub activity', weight: .2, value: github ? clamp(logCap(github.repos * 2 + github.commits * 2 + github.stars + github.languages * 8, 300)) : 50, notLinked: !github },
    { key: 'problemSolving', label: 'Problem solving', weight: .2, value: leetcode ? clamp(logCap(leetcode.easy + leetcode.medium * 3 + leetcode.hard * 5, 500) + Math.max(0, (leetcode.rating - 1200) / 20)) : 50, notLinked: !leetcode },
    { key: 'skillStrength', label: 'Skill strength', weight: .25, value: clamp(skillStrength) },
    { key: 'projectEvidence', label: 'Project evidence', weight: .15, value: clamp((user.projectsCompleted * 18) + (user.hackathons * 10) + (user.milestones * 5)) },
    { key: 'consistency', label: 'Consistency', weight: .1, value: clamp((user.streak * 4) + (user.weeklyHours * 3)) },
    { key: 'profileQuality', label: 'Profile quality', weight: .1, value: clamp((user.profileCompleteness || 60) + (skills.filter(s => s.evidence).length * 3)) }
  ];
  const total = clamp(components.reduce((sum, c) => sum + c.value * c.weight, 0));
  const tier = total < 40 ? 'Starter' : total < 65 ? 'Builder' : total < 85 ? 'Contributor' : 'Pro';
  const tips = components.filter(c => c.value < 65).map(c => `Strengthen ${c.label.toLowerCase()} to raise your signal.`);
  return { total, tier, components, tips };
}
