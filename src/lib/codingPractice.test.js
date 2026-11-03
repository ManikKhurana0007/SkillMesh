import { describe, expect, it } from 'vitest';
import { estimateGrowth, normalizeOutput, PRACTICE_LANGUAGE, PRACTICE_PROBLEMS, STARTER_CODE } from './codingPractice';

describe('coding practice utilities', () => {
  it('normalizes whitespace when comparing program output', () => {
    expect(normalizeOutput('  0\t 1 \n')).toBe('0 1');
  });

  it('estimates observed linear or quadratic growth without claiming certainty', () => {
    expect(estimateGrowth([
      { size: 100, seconds: 0.001 },
      { size: 500, seconds: 0.005 },
      { size: 2000, seconds: 0.02 },
    ])).toContain('close to linear');
    expect(estimateGrowth([
      { size: 100, seconds: 0.001 },
      { size: 500, seconds: 0.025 },
      { size: 2000, seconds: 0.4 },
    ])).toContain('close to quadratic');
  });

  it('does not report a growth trend with fewer than three usable measurements', () => {
    expect(estimateGrowth([{ size: 10, seconds: 0.01 }, { size: 20, seconds: 0.02 }])).toBeNull();
  });

  it('provides original Java practice problems and a Java starter program', () => {
    expect(PRACTICE_PROBLEMS.length).toBeGreaterThan(0);
    expect(PRACTICE_PROBLEMS.every(problem => problem.platforms.length === 3 && problem.testCases.length > 0)).toBe(true);
    expect(PRACTICE_LANGUAGE.name).toMatch(/^Java/);
    expect(STARTER_CODE.java).toContain('public class Main');
  });
});
