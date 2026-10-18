export class GeminiServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "GeminiServiceError";
    this.status = status;
  }
}

export async function generateGeminiJson(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError(
      "Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the backend.",
      503,
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let response;
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
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    throw new GeminiServiceError("Could not reach Gemini. Try again shortly.");
  }

  if (!response.ok) {
    console.error(`Gemini returned HTTP ${response.status}.`);
    throw new GeminiServiceError(
      response.status === 429
        ? "Gemini is busy or the API quota was reached. Try again later."
        : "Gemini could not generate this practice content. Check the backend API key and try again.",
      response.status === 429 ? 429 : 502,
    );
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
  if (!text) {
    throw new GeminiServiceError("Gemini returned an empty response. Please try again.");
  }

  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new GeminiServiceError("Gemini returned invalid structured content. Please try again.");
  }
}
