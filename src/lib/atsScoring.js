export function scoreAtsKeywordCoverage(keywords) {
  if (!keywords.length) return 0;
  const totalWeight = keywords.reduce(
    (total, keyword) => total + (keyword.importance === 'required' ? 2 : 1),
    0,
  );
  const matchedWeight = keywords.reduce(
    (total, keyword) => total + (keyword.found ? (keyword.importance === 'required' ? 2 : 1) : 0),
    0,
  );
  return Math.round((matchedWeight / totalWeight) * 100);
}
