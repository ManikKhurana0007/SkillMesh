function hasRootPath(paths, pattern) {
  return paths.some(path => pattern.test(path));
}

export function scoreRepositoryQuality({ readme, tree, languages, commits, description }) {
  const paths = tree.map(item => item.path.toLowerCase());
  const readmeText = (readme || "").trim();
  const documentation = Math.min(25,
    (readmeText.length >= 400 ? 14 : readmeText.length >= 120 ? 9 : readmeText.length > 0 ? 4 : 0)
    + (/(^|\n)#{1,3}\s+installation/im.test(readmeText) ? 4 : 0)
    + (/(^|\n)#{1,3}\s+(usage|getting started|quick start)/im.test(readmeText) ? 4 : 0)
    + (/(^|\n)#{1,3}\s+(testing|tests)/im.test(readmeText) ? 3 : 0));
  const organization = Math.min(25,
    (hasRootPath(paths, /^(src|app|lib)\//) ? 9 : 0)
    + (hasRootPath(paths, /^(test|tests|__tests__)\//) ? 5 : 0)
    + (hasRootPath(paths, /^(docs|examples|scripts)\//) ? 4 : 0)
    + (paths.some(path => /(^|\/)(package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml)$/.test(path)) ? 4 : 0)
    + (tree.length >= 5 ? 3 : 0));
  const testing = Math.min(25,
    (paths.some(path => /(^|\/)(test|tests|__tests__)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) ? 15 : 0)
    + (paths.some(path => /(^|\/)(jest|vitest|playwright|cypress|pytest|tox|mocha)\.config\./.test(path)) ? 5 : 0)
    + (paths.some(path => /^\.github\/workflows\/.+\.ya?ml$/.test(path)) ? 5 : 0));
  const recentCommits = commits.filter(commit => Date.now() - new Date(commit.date).getTime() <= 90 * 24 * 60 * 60 * 1000).length;
  const completeness = Math.min(25,
    (description ? 5 : 0)
    + (readmeText.length >= 120 ? 5 : 0)
    + (languages.length >= 1 ? 5 : 0)
    + (commits.length >= 3 ? 5 : 0)
    + (recentCommits > 0 ? 5 : 0));
  const dimensions = { documentation, organization, testing, completeness };
  return {
    score: Object.values(dimensions).reduce((total, score) => total + score, 0),
    dimensions,
    evidence: {
      readmePresent: Boolean(readmeText),
      rootEntries: tree.length,
      testFiles: paths.filter(path => /(^|\/)(test|tests|__tests__)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)).length,
      recentCommits: recentCommits,
    },
  };
}
