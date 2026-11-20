const $ = (id) => document.getElementById(id);
const messagesEl = $("messages"), historyEl = $("history"), input = $("input");
let conversationId = null;
let controller = null;

function addBubble(role, text = "") {
  const div = document.createElement("div");
  div.className = `bubble ${role === "user" ? "user" : "ai"}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function loadHistory() {
  const list = await (await fetch("/api/conversations")).json();
  historyEl.innerHTML = "";
  list.forEach((c) => {
    const li = document.createElement("li");
    if (c._id === conversationId) li.classList.add("active");
    const span = document.createElement("span");
    span.textContent = c.title;
    const del = document.createElement("button");
    del.textContent = "✕";
    del.onclick = async (e) => {
      e.stopPropagation();
      await fetch(`/api/conversations/${c._id}`, { method: "DELETE" });
      if (c._id === conversationId) newChat();
      loadHistory();
    };
    li.append(span, del);
    li.onclick = () => openConversation(c._id);
    historyEl.appendChild(li);
  });
}

async function openConversation(id) {
  const convo = await (await fetch(`/api/conversations/${id}`)).json();
  conversationId = id;
  messagesEl.innerHTML = "";
  convo.messages.forEach((m) => addBubble(m.role, m.content));
  $("title").textContent = convo.title;
  loadHistory();
}

function newChat() {
  conversationId = null;
  messagesEl.innerHTML = "";
  $("title").textContent = "AI Chat Assistant";
  loadHistory();
}

// Character-by-character typing effect fed by the network stream
function createTyper(el) {
  let queue = "", done = false, resolveDone;
  const finished = new Promise((r) => (resolveDone = r));
  el.classList.add("cursor");
  const timer = setInterval(() => {
    if (queue.length) {
      const n = queue.length > 200 ? 5 : queue.length > 60 ? 2 : 1;
      el.textContent += queue.slice(0, n);
      queue = queue.slice(n);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (done) {
      clearInterval(timer);
      el.classList.remove("cursor");
      resolveDone();
    }
  }, 15);
  return {
    push: (t) => (queue += t),
    end: () => (done = true),
    flush: () => { el.textContent += queue; queue = ""; done = true; },
    finished,
  };
}

function setBusy(busy) {
  $("send").hidden = busy;
  $("stop").hidden = !busy;
  input.disabled = busy;
  if (!busy) input.focus();
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addBubble("user", message);
  const aiEl = addBubble("ai");
  const typer = createTyper(aiEl);
  controller = new AbortController();
  setBusy(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ message, conversationId, tone: $("tone").value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      typer.push(`[Error: ${err.error || res.status}]`);
    } else {
      conversationId = res.headers.get("X-Conversation-Id");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        typer.push(decoder.decode(value, { stream: true }));
      }
    }
    typer.end();
    await typer.finished;
  } catch (err) {
    typer.flush(); // aborted by Stop button
  }
  controller = null;
  setBusy(false);
  loadHistory();
});

$("stop").onclick = () => controller && controller.abort();

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("form").requestSubmit();
  }
});

$("newChat").onclick = newChat;
$("exportBtn").onclick = () => {
  if (!conversationId) return alert("Start a conversation first.");
  window.location = `/api/conversations/${conversationId}/export`;
};

loadHistory();
