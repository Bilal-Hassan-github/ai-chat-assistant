// Streaming client for the Google Gemini API with automatic model fallback.
// MODEL in .env can be a comma-separated list, tried in order when a model is busy/unavailable.
const FALLBACK_STATUSES = [404, 429, 500, 503];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openStream({ system, messages, signal }) {
  const models = (process.env.MODEL || "gemini-flash-latest,gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  let lastError = "No model configured";
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          // The tone preference is passed here as the system instruction
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      });
      if (res.ok) return res;
      lastError = `Gemini API ${res.status} (${model}): ${(await res.text()).slice(0, 200)}`;
      if (!FALLBACK_STATUSES.includes(res.status)) throw new Error(lastError);
    }
    await sleep(1500); // brief pause, then try the list once more
  }
  throw new Error(lastError);
}

async function* streamAI({ system, messages, signal }) {
  const res = await openStream({ system, messages, signal });
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim());
        const parts = evt.candidates?.[0]?.content?.parts || [];
        for (const p of parts) if (p.text && !p.thought) yield p.text;
      } catch (_) {
        /* ignore partial JSON */
      }
    }
  }
}

module.exports = { streamAI };