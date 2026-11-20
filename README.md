# AI Chat Assistant

Chat app with streaming responses, conversation history, and a tone toggle. Express + MongoDB backend, plain HTML/CSS/JS frontend (no build step), Google Gemini API.

## Run
```bash
npm install
cp .env.example .env   # then add your GEMINI_API_KEY
npm start              # http://localhost:3000
```
Requires Node 18+ and a running MongoDB (`MONGODB_URI`).

## Features
- Chat UI with distinct user/AI bubbles, scrollable
- Streaming: server streams from Gemini; UI types it out character by character
- History sidebar: past threads stored in MongoDB (timestamp, prompt, response); click to reopen
- **Tone Toggle** (Professional / Casual / Concise): server validates the tone and injects it into the `system` prompt of every API call
- **Extra 1 – Export to Markdown**: download any conversation
- **Extra 2 – Stop generating**: cancels the upstream API call; partial reply is saved
- Bonus: auto-titled chats, delete conversations, last-20-message context window

## Structure
```
server/
  index.js              app + DB bootstrap
  config/tones.js       tone -> system instruction
  models/Conversation.js
  routes/chat.js        REST + streaming endpoint (all logic server-side)
  services/gemini.js    Gemini streaming client
public/                 index.html, style.css, app.js (presentation only)
```
