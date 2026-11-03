export class GeminiServiceError extends Error {
  constructor(message, status = 502, fallbackEligible = false) {
    super(message);
    this.name = "GeminiServiceError";
    this.status = status;
    this.fallbackEligible = fallbackEligible;
  }
}

function getGeminiHttpError(status) {
  if (status === 400) {
    return new GeminiServiceError(
      "Gemini rejected the request. Check GEMINI_MODEL in backend/.env and make sure it names a model available to your API key.",
      502,
    );
  }
  if (status === 401) {
    return new GeminiServiceError(
      "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env and restart the backend.",
      503,
    );
  }
  if (status === 403) {
    return new GeminiServiceError(
      "Gemini access is forbidden for this key. Check that the Generative Language API is enabled and that the key restrictions allow it.",
      503,
    );
  }
  if (status === 404) {
    return new GeminiServiceError(
      "The configured Gemini model is unavailable to this API key. Set GEMINI_MODEL=gemini-3.5-flash in backend/.env and restart the backend.",
      503,
    );
  }
  if (status === 429) {
    return new GeminiServiceError(
      "Gemini rate limit or quota reached. Check the API quota and try again later.",
      429,
      true,
    );
  }
  if (status >= 500) {
    return new GeminiServiceError(
      "Gemini is under heavy load or temporarily unavailable.",
      503,
      true,
    );
  }
  return new GeminiServiceError(`Gemini rejected the request (HTTP ${status}). Check the Gemini configuration and try again.`);
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5_000);
  }
  return 750 * (2 ** attempt);
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function parseJsonResponse(text) {
  if (!text) throw new GeminiServiceError("The AI provider returned an empty response. Please try again.");
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new GeminiServiceError("The AI provider returned invalid structured content. Please try again.");
  }
}

async function requestGeminiJson(prompt, attachment) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError(
      "Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the backend.",
      503,
    );
  }

  const model = (process.env.GEMINI_MODEL || "gemini-3.5-flash")
    .trim()
    .replace(/^models\//, "");
  if (!model) {
    throw new GeminiServiceError(
      "GEMINI_MODEL is empty. Set it to a Gemini model name in backend/.env and restart the backend.",
      503,
    );
  }
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                ...(attachment ? [{
                  inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.buffer.toString("base64"),
                  },
                }] : []),
              ],
            }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
    } catch (error) {
      const retryable = error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError";
      if (retryable && attempt < 2) {
        console.error(`Gemini request to ${model} failed; retrying (${attempt + 1}/2).`);
        await delay(750 * (2 ** attempt));
        continue;
      }
      console.error("Gemini request failed:", error.name === "TimeoutError" || error.name === "AbortError"
        ? "request timed out"
        : error.message);
      throw new GeminiServiceError(
        "Could not reach Gemini after retrying. Check the backend's internet connection and try again.",
        503,
        retryable,
      );
    }

    if (response.ok || response.status < 500 || attempt === 2) break;
    console.error(`Gemini returned HTTP ${response.status} for model ${model}; retrying (${attempt + 1}/2).`);
    await delay(retryDelay(response, attempt));
  }

  if (!response.ok) {
    console.error(`Gemini returned HTTP ${response.status} for model ${model}.`);
    throw getGeminiHttpError(response.status);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GeminiServiceError("Gemini returned an unreadable response. Please try again.");
  }
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  return parseJsonResponse(text);
}

async function requestOpenRouterJson(prompt, attachment) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError(
      "Gemini is temporarily unavailable and no OPENROUTER_API_KEY fallback is configured.",
      503,
    );
  }

  const model = (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();
  if (!model) {
    throw new GeminiServiceError("OPENROUTER_MODEL is empty. Configure it in backend/.env.", 503);
  }
  const content = attachment
    ? [
      { type: "text", text: prompt },
      {
        type: "file",
        file: {
          filename: "project-requirements.pdf",
          file_data: `data:${attachment.mimeType};base64,${attachment.buffer.toString("base64")}`,
        },
      },
    ]
    : prompt;

  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
        "X-Title": process.env.OPENROUTER_APP_NAME || "SkillMesh",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    console.error("OpenRouter fallback request failed:", error.name === "TimeoutError" || error.name === "AbortError"
      ? "request timed out"
      : error.message);
    throw new GeminiServiceError("OpenRouter fallback could not be reached. Check the backend's internet connection.", 503);
  }

  if (!response.ok) {
    console.error(`OpenRouter fallback returned HTTP ${response.status} for model ${model}.`);
    if (response.status === 401 || response.status === 403) {
      throw new GeminiServiceError("Gemini is under load and OpenRouter rejected its fallback key. Check OPENROUTER_API_KEY in backend/.env.", 503);
    }
    if (response.status === 429) {
      throw new GeminiServiceError("Gemini is under load and OpenRouter fallback quota or rate limit was reached.", 429);
    }
    throw new GeminiServiceError(`Gemini is under load and OpenRouter fallback failed (HTTP ${response.status}). Check OPENROUTER_MODEL and try again.`, 503);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GeminiServiceError("OpenRouter fallback returned an unreadable response.", 502);
  }
  const messageContent = payload.choices?.[0]?.message?.content;
  const text = typeof messageContent === "string"
    ? messageContent.trim()
    : Array.isArray(messageContent)
      ? messageContent.map(part => part.text || "").join("").trim()
      : "";
  return parseJsonResponse(text);
}

export async function generateGeminiJson(prompt, attachment) {
  try {
    return await requestGeminiJson(prompt, attachment);
  } catch (error) {
    if (!(error instanceof GeminiServiceError) || !error.fallbackEligible) throw error;
    if (!process.env.OPENROUTER_API_KEY) {
      throw new GeminiServiceError(
        `${error.message} No OPENROUTER_API_KEY fallback is configured.`,
        error.status,
      );
    }
    console.warn("Gemini is unavailable; using the configured OpenRouter fallback.");
    return requestOpenRouterJson(prompt, attachment);
  }
}
