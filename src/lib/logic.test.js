import { describe, expect, it } from 'vitest';
import { builderScore } from './builderScore';
import { scoreTeam } from './teamScoring';
import { planTasks } from './planner';
import { analyzeFeedback } from './feedbackThemes';
import { validateInvitation } from './invitationRules';

describe('SkillMesh logic', () => {
  it('uses neutral fallbacks for unlinked coding profiles', () => {
    const result = builderScore({ skills: [], projectsCompleted: 0, hackathons: 0, milestones: 0, streak: 0, weeklyHours: 0 });
    expect(result.components.find(x => x.key === 'github').notLinked).toBe(true);
    expect(result.components.find(x => x.key === 'github').value).toBe(50);
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
  it('rejects duplicate or self invitations', () => {
    const base = { participants: ['a', 'b'], teams: [], invitations: [{ challengeId: 'c', senderId: 'a', receiverId: 'b', status: 'Pending' }], challenge: { id: 'c', teamSize: 3 } };
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'a' })).toMatch(/yourself/);
    expect(validateInvitation({ ...base, senderId: 'a', receiverId: 'b' })).toMatch(/already exists/);
  });
});
