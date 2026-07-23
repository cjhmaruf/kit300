# Avatar AMSA — AI Examiner Chatbot

An oral-exam practice chatbot for the Avatar AMSA project. A student is asked
client-approved AMSA-style questions one at a time, answers by typing (or speaking),
and gets short, supportive, keyword-grounded feedback. It **does not grade, score, or
certify** anyone — that stays with human examiners and AMSA (risk R4).

It is built to drop onto the existing dashboard — or any future rebuild of it — with a
single connection, and it does not modify any of the existing repo files.

## What's here

```
ai chatbot/
├── widget/
│   └── amsa-chatbot.js     # the drop-in front-end widget (self-contained, one file)
├── server/
│   ├── server.js           # backend proxy: holds the API key, grounds feedback
│   ├── package.json
│   ├── .env.example        # copy to .env and fill in
│   └── .gitignore          # keeps .env and node_modules out of git
├── data/
│   └── questions.json      # PLACEHOLDER question bank - replace with approved content
├── demo.html               # test page + copy-paste embed snippet
└── README.md
```

## The "one simple connection"

To add the examiner to any page, add these two lines — that's the whole integration:

```html
<script src="ai chatbot/widget/amsa-chatbot.js"></script>
<script>
  AMSAChatbot.init({ apiBase: "http://localhost:3000/api" });
</script>
```

The widget injects its own styling and markup (themed to match the dashboard's
navy/teal), so it doesn't depend on the host page's CSS and doesn't touch existing code.
You can also wire the dashboard's existing "Practice Examination" button to
`AMSAChatbot.open()`.

## Why there's a backend server

The LLM API key must never live in the browser (NFR:03 / risk R6), and students must
not be able to read the answer key. So the widget only ever talks to `server.js`, and
that server is the only thing that sees the API key and the model answers/keywords. The
browser only receives question text and feedback.

## Running it locally

Requires **Node.js 18+** (uses the built-in `fetch`).

```bash
cd "ai chatbot/server"
npm install
cp .env.example .env      # then edit .env
npm start
```

Then open `http://localhost:3000/demo.html`.

### Configure `.env`

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `openai` (default) or `gemini` |
| `AI_API_KEY` | your key. **Leave blank to run without an LLM** (see below) |
| `AI_MODEL` | e.g. `gpt-4o-mini` (OpenAI) or `gemini-1.5-flash` (Gemini) |
| `PORT` | server port (default 3000) |
| `QUESTIONS_PER_SESSION` | default questions per session |
| `ALLOWED_ORIGINS` | comma-separated dashboard origins for CORS. Use `*` only for local testing |

### It runs without an API key too

If `AI_API_KEY` is blank, or a provider call fails, the server falls back to a simple
keyword-matching feedback mode so the flow never dead-ends. This is fine for showing the
UX, but real feedback quality needs an LLM key. The same fallback also acts as a safety
net if the API is down at runtime.

## The question bank is a placeholder

`data/questions.json` contains ~15 **clearly-marked placeholder** questions so the
system works end-to-end. They are **not** official AMSA content. An AMC Search
subject-matter expert should replace them with client-approved Master&nbsp;<45m questions,
model answers, and feedback keywords before real use. Keep the same field structure:

```json
{
  "id": "...",
  "licenceType": "M45",
  "topic": "...",
  "difficulty": "Medium",
  "scene": "Bridge",
  "questionText": "...",
  "keywords": ["...", "..."],
  "modelAnswer": "..."
}
```

`keywords` and `modelAnswer` stay server-side and are never sent to the browser.

## Voice

With `voice: true`, the widget uses the browser's built-in Web Speech API for
speech-to-text and text-to-speech — free, no keys, set to Australian English (`en-AU`).
Quality and accent handling are basic (relevant to risk R3), and typed input is always
available as a fallback. To upgrade to ElevenLabs / a cloud STT provider later, the
`speak()` function and the recognition setup in `amsa-chatbot.js` are the single place
to swap.

## Deployment notes (for later)

- Set `ALLOWED_ORIGINS` to the real dashboard origin(s), not `*`.
- Session state is currently in-memory; for per-student history that survives restarts
  (backlog DB-09), move the session store to the project database.
- Serve the widget and API over HTTPS.
