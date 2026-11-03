export const PRACTICE_PROBLEMS = [
  {
    id: 'pair-sum',
    title: 'Find a Pair With a Target Sum',
    difficulty: 'Easy',
    topic: 'Arrays · Hash maps',
    statement: 'Given a list of integers and a target, print the zero-based indices of two different values whose sum is the target. Exactly one answer exists.',
    inputFormat: 'The first line contains n and target. The second line contains n integers.',
    sampleInput: '4 9\n2 7 11 15',
    sampleOutput: '0 1',
    expectedComplexity: 'Expected: O(n) time and O(n) space with a hash map.',
    testCases: [
      { input: '4 9\n2 7 11 15', output: '0 1' },
      { input: '5 6\n3 2 4 1 5', output: '1 2' },
      { input: '2 10\n4 6', output: '0 1' },
    ],
    benchmarkInput: size => `${size} ${2 * size - 1}\n${Array.from({ length: size }, (_, index) => index + 1).join(' ')}`,
    platforms: [
      { name: 'LeetCode', url: 'https://leetcode.com/problemset/' },
      { name: 'GeeksforGeeks', url: 'https://www.geeksforgeeks.org/problems/' },
      { name: 'CodeChef', url: 'https://www.codechef.com/practice' },
    ],
  },
  {
    id: 'maximum-subarray',
    title: 'Maximum Contiguous Sum',
    difficulty: 'Medium',
    topic: 'Arrays · Dynamic programming',
    statement: 'Given a non-empty list of integers, find the largest sum obtainable from a contiguous, non-empty section of the list. Print that sum.',
    inputFormat: 'The first line contains n. The second line contains n integers.',
    sampleInput: '9\n-2 1 -3 4 -1 2 1 -5 4',
    sampleOutput: '6',
    expectedComplexity: 'Expected: O(n) time and O(1) extra space with Kadane’s algorithm.',
    testCases: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6' },
      { input: '5\n5 4 -1 7 8', output: '23' },
      { input: '4\n-8 -3 -6 -2', output: '-2' },
    ],
    benchmarkInput: size => `${size}\n${Array.from({ length: size }, (_, index) => index % 2 === 0 ? 1 : -1).join(' ')}`,
    platforms: [
      { name: 'LeetCode', url: 'https://leetcode.com/problemset/' },
      { name: 'GeeksforGeeks', url: 'https://www.geeksforgeeks.org/problems/' },
      { name: 'CodeChef', url: 'https://www.codechef.com/practice' },
    ],
  },
];

export const PRACTICE_LANGUAGE = { name: 'Java 25', extension: 'java' };

export const STARTER_CODE = {
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Read the input format shown with the question and print your answer.\n    }\n}\n',
};

export function normalizeOutput(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

export function estimateGrowth(results) {
  const usable = results.filter(result => Number.isFinite(result.size) && result.size > 0
    && Number.isFinite(result.seconds) && result.seconds > 0);
  if (usable.length < 3) return null;
  const slopes = [];
  for (let index = 1; index < usable.length; index += 1) {
    const previous = usable[index - 1];
    const current = usable[index];
    if (current.size <= previous.size || current.seconds <= previous.seconds) continue;
    slopes.push(Math.log(current.seconds / previous.seconds) / Math.log(current.size / previous.size));
  }
  if (!slopes.length) return 'Too little timing variation to estimate a trend';
  const slope = slopes.reduce((sum, value) => sum + value, 0) / slopes.length;
  if (slope < 0.65) return 'Observed growth is close to constant or sublinear';
  if (slope < 1.35) return 'Observed growth is close to linear';
  if (slope < 1.8) return 'Observed growth is between linear and quadratic';
  if (slope < 2.3) return 'Observed growth is close to quadratic';
  return 'Observed growth is faster than quadratic';
}
