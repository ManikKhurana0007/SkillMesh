import { describe, expect, it } from 'vitest';
import { scoreRepositoryQuality } from '../../backend/src/services/projectQuality.js';

describe('scoreRepositoryQuality', () => {
  it('returns a zero score when no repository evidence is available', () => {
    expect(scoreRepositoryQuality({ readme: '', tree: [], languages: [], commits: [], description: '' }))
      .toEqual({
        score: 0,
        dimensions: { documentation: 0, organization: 0, testing: 0, completeness: 0 },
        evidence: { readmePresent: false, rootEntries: 0, testFiles: 0, recentCommits: 0 },
      });
  });

  it('rewards evidence of documentation, organization, tests, and recent activity', () => {
    const result = scoreRepositoryQuality({
      readme: '# Project\n'.repeat(35) + '\n## Installation\nsteps\n## Usage\nsteps\n## Testing\nsteps',
      tree: [
        { path: 'src/index.js' },
        { path: 'tests/index.test.js' },
        { path: 'package.json' },
        { path: 'jest.config.js' },
        { path: '.github/workflows/test.yml' },
        { path: 'docs/guide.md' },
      ],
      languages: ['JavaScript'],
      commits: [{ date: new Date().toISOString() }, { date: new Date().toISOString() }, { date: new Date().toISOString() }],
      description: 'A project with documented source and tests.',
    });

    expect(result.score).toBe(100);
    expect(result.dimensions).toEqual({ documentation: 25, organization: 25, testing: 25, completeness: 25 });
  });

  it('caps the composite score at 100 and counts recent commits consistently', () => {
    const result = scoreRepositoryQuality({
      readme: '## Installation\n## Usage\n## Testing\n'.repeat(30),
      tree: [{ path: 'src/main.ts' }, { path: 'tests/main.test.ts' }, { path: 'package.json' }],
      languages: ['TypeScript', 'CSS'],
      commits: [{ date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() }],
      description: 'Sample app.',
    });

    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.evidence.recentCommits).toBe(0);
  });
});
