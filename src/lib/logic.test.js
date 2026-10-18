import { describe, expect, it } from 'vitest';
import { builderScore } from './builderScore';
import { scoreTeam } from './teamScoring';
import { planTasks } from './planner';
import { analyzeFeedback } from './feedbackThemes';
import { validateInvitation } from './invitationRules';
import { createGoalPracticeQuiz, generateGoalPracticePlan, goalProgressBaseline, goalProgressFromTasks, gradeGoalPracticeQuiz } from './goalPlanning';

describe('SkillMesh logic', () => {
  it('uses a neutral fallback for an unlinked GitHub account', () => {
    const result = builderScore({ skills: [], projectsCompleted: 0, hackathons: 0, milestones: 0, streak: 0, weeklyHours: 0 });
    expect(result.components.find(x => x.key === 'github').notLinked).toBe(true);
    expect(result.components.find(x => x.key === 'github').value).toBe(50);
  });
  it('keeps the evidence-based score capped and monotonically improves with GitHub activity', () => {
    const base = { skills: [], profileEvidenceCount: 0, recentActivityDays: 0, availabilitySlots: 0 };
    const low = builderScore({ ...base, github: { repos: 2, stars: 5, languages: 1, commits: 2 } });
    const high = builderScore({ ...base, github: { repos: 40, stars: 500, languages: 8, commits: 120 } });
    expect(high.total).toBeGreaterThan(low.total);
    expect(high.components.every(x => x.value <= 100)).toBe(true);
    expect(high.formulaVersion).toBe('v4-quiz-weighted');
  });
  it('scores only persisted profile evidence and recent learning days', () => {
    const result = builderScore({
      education: 'Computer Science',
      careerGoal: 'Build software',
      interests: ['Design'],
      preferredRoles: ['Frontend'],
      skills: [{ name: 'React', level: 'Advanced', evidence: 'https://example.com/react' }],
      profileEvidenceCount: 2,
      availabilitySlots: 3,
      recentActivityDays: 6,
      github: null,
    });
    expect(result.components.find(component => component.key === 'projectEvidence').value).toBe(60);
    expect(result.components.find(component => component.key === 'consistency').value).toBe(50);
    expect(result.components.find(component => component.key === 'profileQuality').value).toBe(100);
    expect(result.total).toBe(69);
  });
  it('weights quiz performance at 25% and updates the score with quiz results', () => {
    const base = { skills: [], github: null, quizScore: 50 };
    const baseline = builderScore(base);
    const perfectQuiz = builderScore({ ...base, quizScore: 100 });
    const failedQuiz = builderScore({ ...base, quizScore: 0 });
    expect(perfectQuiz.total - baseline.total).toBe(13);
    expect(baseline.total - failedQuiz.total).toBe(12);
    expect(perfectQuiz.components.find(component => component.key === 'quizPerformance').weight).toBe(.25);
    expect(builderScore({ skills: [] }).components.find(component => component.key === 'quizPerformance').noAttempts).toBe(true);
    expect(builderScore({ stats: { quizScore: 68 }, skills: [] }).components.find(component => component.key === 'quizPerformance')).toMatchObject({ value: 68, noAttempts: false });
  });
  it('uses profile stats for availability, consistency, and normalized GitHub thresholds', () => {
    const result = builderScore({
      skills: [{ name: 'React', level: 'Advanced' }],
      availability: [{ dayOfWeek: 1, slot: 'AM' }],
      stats: { recentActivityDays: 3, quizScore: 70 },
      github: { repos: 0, stars: 0, commits: 120 },
    });
    expect(result.components.find(component => component.key === 'consistency').value).toBe(25);
    expect(result.components.find(component => component.key === 'profileQuality').value).toBeGreaterThan(0);
    expect(result.components.find(component => component.key === 'github').value).toBeLessThan(100);
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
  it('generates goal-scoped practice and due tasks before the target date', () => {
    const plan = generateGoalPracticePlan(
      { title: 'Build a portfolio', targetDate: '2026-10-25' },
      new Date('2026-10-18T10:00:00'),
    );
    expect(plan).toHaveLength(3);
    expect(plan.map(task => task.kind)).toEqual(['practice', 'milestone', 'review']);
    expect(plan.every(task => task.title.includes('Build a portfolio'))).toBe(true);
    expect(plan.every(task => task.dueDate > '2026-10-18' && task.dueDate <= '2026-10-25')).toBe(true);
    expect(plan.every(task => task.quiz.length === 3 && task.quiz.every(question => question.options.length === 4))).toBe(true);
    expect(plan[0].quiz[0].prompt).toContain('Build a portfolio');
  });
  it('grades correct and incorrect goal practice quiz answers', () => {
    const quiz = createGoalPracticeQuiz('Learn React', 'Build a component', 'practice');
    expect(quiz).toHaveLength(3);
    expect(gradeGoalPracticeQuiz(quiz, ['1', '2', '3'])).toMatchObject({ correct: 3, total: 3, score: 100 });
    expect(gradeGoalPracticeQuiz(quiz, ['0', '2', '0']).score).toBe(33);
    expect(gradeGoalPracticeQuiz(quiz, ['0'])).toBeNull();
  });
  it('tracks goal completion while retaining the existing progress baseline', () => {
    const tasks = [{ completed: true }, { completed: false }, { completed: false }];
    expect(goalProgressFromTasks(60, tasks)).toBe(73);
    expect(goalProgressBaseline(73, tasks)).toBe(60);
    expect(goalProgressFromTasks(60, [{ completed: true }, { completed: true }, { completed: true }])).toBe(100);
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
