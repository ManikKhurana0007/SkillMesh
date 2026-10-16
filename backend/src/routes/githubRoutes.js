
import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// Validate GitHub usernames.
function isValidGitHubUsername(username) {
  return (
    typeof username === "string" &&
    username.length >= 1 &&
    username.length <= 39 &&
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(
      username
    ) &&
    !username.includes("--")
  );
}

// Make authenticated requests to GitHub.
async function fetchGitHub(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || "GitHub API request failed."
    );

    error.status = response.status;
    error.remaining = response.headers.get(
      "x-ratelimit-remaining"
    );

    throw error;
  }

  return data;
}

// Handle errors from GitHub.
function handleGitHubError(res, error, resource) {
  if (error.status === 404) {
    return res.status(404).json({
      message: "GitHub user not found.",
    });
  }

  if (error.status === 401) {
    console.error("GitHub rejected the token.");
    return res.status(502).json({
      message:
        "GitHub authentication failed. Check GITHUB_TOKEN in backend/.env.",
    });
  }

  if (error.status === 403 || error.status === 429) {
    if (error.remaining === "0" || error.status === 429) {
      return res.status(503).json({
        message:
          "GitHub API rate limit reached. Please wait before retrying.",
      });
    }

    return res.status(502).json({
      message:
        "GitHub denied the request. Check the token and API permissions.",
    });
  }

  if (
    error.name === "TimeoutError" ||
    error.name === "AbortError"
  ) {
    return res.status(504).json({
      message: "GitHub took too long to respond. Please try again.",
    });
  }

  console.error(`GitHub ${resource} request failed:`, error.message);

  return res.status(502).json({
    message: `Could not retrieve GitHub ${resource}.`,
  });
}

// Fetch a public GitHub profile.
router.get("/profile/:username", requireAuth, async (req, res) => {
  try {
    const { username } = req.params;

    if (!isValidGitHubUsername(username)) {
      return res.status(400).json({
        message: "Please provide a valid GitHub username.",
      });
    }

    const profile = await fetchGitHub(
      `https://api.github.com/users/${encodeURIComponent(username)}`
    );

    return res.json({
      profile: {
        githubId: profile.id,
        username: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        profileUrl: profile.html_url,
        company: profile.company,
        location: profile.location,
        publicRepositories: profile.public_repos,
        followers: profile.followers,
        following: profile.following,
        createdAt: profile.created_at,
      },
    });
  } catch (error) {
    return handleGitHubError(res, error, "profile");
  }
});

// Fetch public repositories.
router.get(
  "/repositories/:username",
  requireAuth,
  async (req, res) => {
    try {
      const { username } = req.params;

      if (!isValidGitHubUsername(username)) {
        return res.status(400).json({
          message: "Please provide a valid GitHub username.",
        });
      }

      const repositories = await fetchGitHub(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`
      );

      return res.json({
        username,
        count: repositories.length,
        repositories: repositories.map((repo) => ({
          id: repo.id,
          name: repo.name,
          description: repo.description,
          url: repo.html_url,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          isPrivate: repo.private,
          updatedAt: repo.updated_at,
        })),
      });
    } catch (error) {
      return handleGitHubError(res, error, "repositories");
    }
  }
);

/**
 * Fetch the number of commits authored by a user
 * during the last 30 days across public repositories.
 */
router.get("/commits/:username", requireAuth, async (req, res) => {
  try {
    const { username } = req.params;

    if (!isValidGitHubUsername(username)) {
      return res.status(400).json({
        message: "Please provide a valid GitHub username.",
      });
    }

    // Calculate the date 30 days ago.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const sinceDate = since.toISOString().slice(0, 10);

    // Search public commits authored by this GitHub user.
    const query = [
      `author:${username}`,
      `committer-date:>=${sinceDate}`,
    ].join(" ");

    const searchUrl =
      `https://api.github.com/search/commits?q=${encodeURIComponent(query)}&per_page=1`;

    const result = await fetchGitHub(searchUrl);

    return res.json({
      username,
      commits: result.total_count || 0,
      periodDays: 30,
      since: sinceDate,
      metric: "Public commits in the last 30 days",
    });
  } catch (error) {
    return handleGitHubError(res, error, "commits");
  }
});

export default router;
