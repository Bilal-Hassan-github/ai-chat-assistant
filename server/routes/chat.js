const express = require("express");
const Conversation = require("../models/Conversation");
const { buildSystemPrompt } = require("../config/tones");
const { streamAI } = require("../services/gemini");

const router = express.Router();

// List conversations (history sidebar)
router.get("/conversations", async (_req, res) => {
  const list = await Conversation.find({}, "title updatedAt").sort({ updatedAt: -1 }).limit(100);
  res.json(list);
});

// Get one conversation
router.get("/conversations/:id", async (req, res) => {
  const convo = await Conversation.findById(req.params.id).catch(() => null);
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

// Delete a conversation
router.delete("/conversations/:id", async (req, res) => {
  await Conversation.findByIdAndDelete(req.params.id).catch(() => null);
  res.json({ ok: true });
});

// EXTRA FEATURE 1: export a conversation as Markdown
router.get("/conversations/:id/export", async (req, res) => {
  const convo = await Conversation.findById(req.params.id).catch(() => null);
  if (!convo) return res.status(404).json({ error: "Not found" });
  const md =
    `# ${convo.title}\n\n` +
    convo.messages
      .map((m) => `**${m.role === "user" ? "You" : "AI"}** _(${m.createdAt.toISOString()})_\n\n${m.content}\n`)
      .join("\n---\n\n");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="conversation.md"');
  res.send(md);
});

// Chat: validates input, applies tone, streams AI text, persists to MongoDB
router.post("/chat", async (req, res) => {
  const { conversationId, tone } = req.body;
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Message is required" });
  if (message.length > 4000) return res.status(400).json({ error: "Message too long (max 4000)" });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  let convo = conversationId ? await Conversation.findById(conversationId).catch(() => null) : null;
  if (!convo) {
    convo = new Conversation({ title: message.slice(0, 40) }); // auto-title
  }

  const { tone: appliedTone, system } = buildSystemPrompt(tone);
  convo.messages.push({ role: "user", content: message, tone: appliedTone });
  await convo.save();

  // Send last 20 messages as context
  const context = convo.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Conversation-Id", convo._id.toString());
  res.flushHeaders();

  // EXTRA FEATURE 2: "Stop generating" - client abort cancels upstream call, partial reply is saved
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let reply = "";
  try {
    for await (const text of streamAI({ system, messages: context, signal: controller.signal })) {
      reply += text;
      res.write(text);
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      const msg = `\n\n[Error: ${err.message}]`;
      reply += msg;
      res.write(msg);
    }
  }

  if (reply) {
    convo.messages.push({ role: "assistant", content: reply, tone: appliedTone });
    await convo.save();
  }
  res.end();
});

module.exports = router;
