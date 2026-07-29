# Avatar AMSA — Help Assistant Chatbot

A help/navigation assistant for the Avatar AMSA dashboard. It answers "how do I..."
questions about using the app — signing in, creating an account, resetting a password,
finding things in the dashboard. It is **not** the oral examiner and does not run
quizzes; that's a separate part of the project.

It's built to drop onto the existing dashboard — or any future rebuild of it — with a
single connection, and it does not modify any of the existing repo files.

## What's here

```
ai chatbot/
├── widget/
│   └── amsa-chatbot.js     # the drop-in help-chat widget (self-contained, one file)
├── server/
│   ├── server.js           # backend: holds the API key, answers from the knowledge base
│   ├── package.json
│   ├── .env.example        # copy to .env and fill in
│   └── .gitignore          # keeps .env and node_modules out of git
├── data/
│   └── knowledge.md        # what the assistant is allowed to answer from - edit this
├── demo.html               # test page + copy-paste embed snippet
└── README.md
```

## The "one simple connection"

```html
<script src="ai chatbot/widget/amsa-chatbot.js"></script>
<script>
  AMSAChatbot.init({ apiBase: "http://localhost:3000/api" });
</script>
```

The widget injects its own styling and markup (themed to match the dashboard's
navy/teal), so it doesn't depend on the host page's CSS. You can also open it from your
own button with `AMSAChatbot.open()`.

## Why there's a backend server

The LLM API key must never live in the browser — anyone could read it in dev tools. So
the widget only ever talks to `server.js`, and that server is the only thing holding the
key. This is the standard way to use an AI API from a website safely.

## Running it locally

Requires **Node.js 18+** (uses the built-in `fetch`).

```bash
cd "ai chatbot/server"
npm install
cp .env.example .env      # then edit .env and add your key
npm start
```

Then open `http://localhost:3000/demo.html`.

### Configure `.env`

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `gemini` (default) or `openai` |
| `AI_API_KEY` | your key. Leave blank to run in fallback mode (a few canned FAQ answers) |
| `AI_MODEL` | e.g. `gemini-flash-latest` (Gemini) or `gpt-4o-mini` (OpenAI) |
| `PORT` | server port (default 3000) |
| `ALLOWED_ORIGINS` | comma-separated dashboard origins for CORS. Use `*` only for local testing |

A free Gemini API key works fine here — get one at https://aistudio.google.com/apikey.

### It runs without a key too

If `AI_API_KEY` is blank, or the provider call fails, the server falls back to a small
set of hard-coded FAQ answers so the widget still does something useful. Real, flexible
answers need a key.

## What the assistant knows

The assistant only answers from `data/knowledge.md`. That file is written to match what
the app **actually does today**, including being honest that some features (password
reset emails, the practice exam launch) are still prototype stubs. When you build those
out for real, update `knowledge.md` so the assistant's answers stay truthful.

## Security notes

- The API key is server-side only and gitignored via `.env`.
- The chat endpoint is rate-limited per IP (20 requests/minute) to protect the API quota.
- Incoming messages and conversation history are length-capped and shape-validated —
  the server doesn't trust whatever the browser sends.
- Replies are rendered with `textContent`, not `innerHTML`, so nothing in a message can
  inject HTML/script into the page.
- The system prompt tells the model to ignore attempts to override its instructions or
  reveal the prompt, and never to handle passwords.
- For deployment: set `ALLOWED_ORIGINS` to the real dashboard origin(s), not `*`, and
  serve everything over HTTPS.

## Note on the wider app

The login, register and forgot-password pages in this repo are currently front-end
prototypes — they validate input in the browser but don't yet connect to a real account
system or database. This help assistant is honest about that. Wiring up real
authentication is a separate piece of work and can be added next.
