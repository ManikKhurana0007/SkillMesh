import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateGeminiJson, GeminiServiceError } from '../../backend/src/services/geminiService.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function geminiResponse(status, payload, retryAfter = '0.01') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name === 'retry-after' ? retryAfter : null },
    json: async () => payload,
  };
}

function openRouterResponse(status, content) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

describe('generateGeminiJson', () => {
  it('uses Gemini as primary and does not call OpenRouter when Gemini succeeds', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(200, {
      candidates: [{ content: { parts: [{ text: '{"provider":"gemini"}' }] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Return a JSON object.')).resolves.toEqual({ provider: 'gemini' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  it('uses OpenRouter after Gemini retries a temporary server outage', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('OPENROUTER_MODEL', 'openai/test-model');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(503, { error: { status: 'UNAVAILABLE' } }))
      .mockResolvedValueOnce(geminiResponse(503, { error: { status: 'UNAVAILABLE' } }))
      .mockResolvedValueOnce(geminiResponse(503, { error: { status: 'UNAVAILABLE' } }))
      .mockResolvedValueOnce(openRouterResponse(200, '{"provider":"openrouter"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Return a JSON object.')).resolves.toEqual({ provider: 'openrouter' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).model).toBe('openai/test-model');
  });

  it('uses OpenRouter for a Gemini rate-limit response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(429, { error: { status: 'RESOURCE_EXHAUSTED' } }))
      .mockResolvedValueOnce(openRouterResponse(200, '{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Return a JSON object.')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes PDF attachments to OpenRouter fallback as file data', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    const pdf = Buffer.from('%PDF-test');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(429, { error: { status: 'RESOURCE_EXHAUSTED' } }))
      .mockResolvedValueOnce(openRouterResponse(200, '{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Use attached PRD.', { mimeType: 'application/pdf', buffer: pdf }))
      .resolves.toEqual({ ok: true });
    const requestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(requestBody.messages[0].content[1].type).toBe('file');
    expect(requestBody.messages[0].content[1].file.file_data).toContain(pdf.toString('base64'));
  });

  it('retries temporary Gemini outages and returns the successful JSON response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-test');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(503, { error: { status: 'UNAVAILABLE' } }))
      .mockResolvedValueOnce(geminiResponse(200, {
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Return a JSON object.')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry invalid API key responses', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-test');
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(401, { error: { status: 'UNAUTHENTICATED' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateGeminiJson('Return a JSON object.'))
      .rejects.toMatchObject({ name: 'GeminiServiceError', status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports an actionable configuration error when the API key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    await expect(generateGeminiJson('Return a JSON object.'))
      .rejects.toBeInstanceOf(GeminiServiceError);
    await expect(generateGeminiJson('Return a JSON object.'))
      .rejects.toThrow('Gemini is not configured.');
  });
});
