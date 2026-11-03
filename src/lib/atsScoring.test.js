import { describe, expect, it } from 'vitest';
import { scoreAtsKeywordCoverage } from './atsScoring.js';

describe('scoreAtsKeywordCoverage', () => {
  it('returns zero when no job keywords were extracted', () => {
    expect(scoreAtsKeywordCoverage([])).toBe(0);
  });

  it('weights required keywords twice as strongly as preferred keywords', () => {
    expect(scoreAtsKeywordCoverage([
      { importance: 'required', found: false },
      { importance: 'preferred', found: true },
    ])).toBe(33);
  });

  it('returns full coverage when all extracted keywords are present', () => {
    expect(scoreAtsKeywordCoverage([
      { importance: 'required', found: true },
      { importance: 'preferred', found: true },
    ])).toBe(100);
  });

  it('rounds partial keyword coverage to a whole-number percentage', () => {
    expect(scoreAtsKeywordCoverage([
      { importance: 'required', found: true },
      { importance: 'required', found: false },
      { importance: 'preferred', found: false },
    ])).toBe(40);
  });
});
