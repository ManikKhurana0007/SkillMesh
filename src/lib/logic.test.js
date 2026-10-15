import { describe, expect, it } from 'vitest';
import { builderScore } from './builderScore';
import { scoreTeam } from './teamScoring';
import { planTasks } from './planner';
import { analyzeFeedback } from './feedbackThemes';
import { validateInvitation } from './invitationRules';

describe('SkillMesh logic', () => {
  it('uses a neutral fallback for an unlinked GitHub account', () => {
    const result = builderScore({ skills: [], projectsCompleted: 0, hackathons: 0, milestones: 0, streak: 0, weeklyHours: 0 });
    expect(result.components.find(x => x.key === 'github').notLinked).toBe(true);
    expect(result.components.find(x => x.key === 'github').value).toBe(50);
  });
  it('keeps the recalibrated score capped and monotonically improves with GitHub activity', () => {
    const base = { skills: [], projectsCompleted: 1, hackathons: 1, milestones: 1, streak: 1, weeklyHours: 2 };
    const low = builderScore({ ...base, github: { repos: 2, stars: 5, languages: 1, commits: 2 } });
    const high = builderScore({ ...base, github: { repos: 40, stars: 500, languages: 8, commits: 120 } });
    expect(high.total).toBeGreaterThan(low.total);
    expect(high.components.every(x => x.value <= 100)).toBe(true);
    expect(high.formulaVersion).toBe('v2-no-coding-provider');
  });
  it('scores coverage and flags hard team-size violations', () => {
    const result = scoreTeam({ requiredSkills: ['React'], roles: ['Frontend'], teamSize: 1 }, [{ skills: ['React'] }, { skills: ['React'] }]);
    expect(result.coveredSkills).toEqual(['React']);
    expect(result.violations.length).toBe(1);
  });
  it('fits highest priority tasks within hours', () => {
    const result = planTasks([{ title: 'low', duration: 120, score: 1 }, { title: 'high', duration: 60, score: 5 }], 1);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('high');
  });
  it('keeps feedback source ids in themes', () => {
    expect(analyzeFeedback([{ id: 'f1', comment: 'Pickup is convenient' }])[0].sourceIds).toEqual(['f1']);
  });
  it('rejects duplicate, self, full-team, and already-teamed invitations', () => {
    const base = { participants: ['a', 'b'], teams: [], invitations: [{ challengeId: 'c', senderId: 'a', receiverId: 'b', status: 'Pending' }], challenge: { id: 'c', teamSize: 3 } };
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'a' })).toMatch(/yourself/);
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'b' })).toMatch(/already exists/);
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'b', invitations: [], teams: [{ challengeId: 'c', members: ['a', 'x', 'y'] }] })).toMatch(/full/);
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'b', invitations: [], teams: [{ challengeId: 'c', members: ['b'] }] })).toMatch(/already/);
  });
});
