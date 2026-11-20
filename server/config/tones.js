// Tone -> system instruction modifier (validated server-side).
const TONES = {
  professional:
    "Respond in a professional, polished and formal tone. Be precise, structured and courteous.",
  casual:
    "Respond in a casual, friendly, conversational tone, like chatting with a friend. Contractions and light humor are fine.",
  concise:
    "Respond as concisely as possible. Use the fewest words needed, no filler, and prefer short bullet points over paragraphs.",
};

const DEFAULT_TONE = "professional";

const BASE = "You are a helpful AI chat assistant.";

function buildSystemPrompt(tone) {
  const key = TONES[tone] ? tone : DEFAULT_TONE;
  return { tone: key, system: `${BASE} ${TONES[key]}` };
}

module.exports = { TONES, buildSystemPrompt };
