import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const router = Router();
const runInput = z.object({
  code: z.string().trim().min(1).max(50_000),
  input: z.string().max(20_000).default(""),
}).strict();
const numericValue = z.union([
  z.number().finite(),
  z.string().trim().min(1).transform(Number).pipe(z.number().finite()),
]).nullable().optional();
const compilerResponse = z.object({
  output: z.string().optional(),
  error: z.string().optional(),
  exit_code: z.number().int().nullable().optional(),
  time: numericValue,
  total: numericValue,
  memory: numericValue,
});

const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RUN_RATE_LIMITED",
      message: "Too many code runs. Please wait a minute and try again.",
    },
  },
});

router.post("/run", runLimiter, async (req, res) => {
  const parsed = runInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "INVALID_CODE_RUN",
        message: "Provide Java code under 50,000 characters and input under 20,000 characters.",
      },
    });
  }

  const apiKey = process.env.ONLINECOMPILER_API_KEY;
  if (!apiKey) {
    console.error("ONLINECOMPILER_API_KEY is missing.");
    return res.status(503).json({
      error: {
        code: "COMPILER_NOT_CONFIGURED",
        message: "The online compiler is not configured on the backend.",
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch("https://api.onlinecompiler.io/api/run-code-sync/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        compiler: "openjdk-25",
        code: parsed.data.code,
        input: parsed.data.input,
        time_limit: 15,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`OnlineCompiler request failed with status ${response.status}.`);
      return res.status(response.status === 429 ? 429 : 502).json({
        error: {
          code: response.status === 429 ? "COMPILER_RATE_LIMITED" : "COMPILER_REQUEST_FAILED",
          message: response.status === 429
            ? "The online compiler is busy or its usage limit was reached. Please try again later."
            : "The online compiler could not run this request. Check the backend API key and try again.",
        },
      });
    }

    const result = compilerResponse.safeParse(await response.json());
    if (!result.success) {
      console.error("OnlineCompiler returned an unexpected response.");
      return res.status(502).json({
        error: {
          code: "INVALID_COMPILER_RESPONSE",
          message: "The online compiler returned an invalid response. Please try again.",
        },
      });
    }

    const { output = "", error = "", exit_code: exitCode, time, total, memory } = result.data;
    const succeeded = exitCode === 0;
    const status = succeeded
      ? "Accepted"
      : exitCode === 124
        ? "Time limit exceeded"
        : "Compilation or runtime error";

    return res.json({
      statusId: succeeded ? 3 : 6,
      status,
      stdout: output,
      stderr: error,
      time: total ?? time ?? null,
      memory: memory ?? null,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: {
          code: "COMPILER_TIMEOUT",
          message: "The online compiler took too long to respond. Please try again.",
        },
      });
    }

    console.error("OnlineCompiler request failed:", error.message);
    return res.status(502).json({
      error: {
        code: "COMPILER_UNAVAILABLE",
        message: "Could not reach the online compiler. Check your internet connection and try again.",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
