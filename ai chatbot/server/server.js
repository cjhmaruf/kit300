// Avatar AMSA examiner - backend proxy.
//
// Why this exists: the LLM API key must never live in the browser (NFR:03 / risk R6),
// and the answer key (model answers + keywords) must not be shipped to students either.
// So the widget talks to THIS server, and this server is the only thing that sees the
// key and the model answers. The browser only ever receives question text and feedback.

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// dotenv is optional at runtime - if it's not installed we just read process.env.
try { require('dotenv').config(); } catch (e) { /* running without dotenv, that's fine */ }

const PORT = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const QUESTIONS_PER_SESSION = parseInt(process.env.QUESTIONS_PER_SESSION || '6', 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS - lock this down to the dashboard origin in production via ALLOWED_ORIGINS.
if (ALLOWED_ORIGINS === '*') {
  app.use(cors());
} else {
  const origins = ALLOWED_ORIGINS.split(',').map(s => s.trim());
  app.use(cors({ origin: origins }));
}

// Serve the widget + demo so everything works from one origin during dev.
app.use('/widget', express.static(path.join(__dirname, '..', 'widget')));
app.use(express.static(path.join(__dirname, '..'))); // lets you open /demo.html

// ---- load the question bank ------------------------------------------------

const QUESTIONS_PATH = path.join(__dirname, '..', 'data', 'questions.json');
let QUESTION_BANK = [];

function loadQuestions() {
  try {
    const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    QUESTION_BANK = Array.isArray(parsed.questions) ? parsed.questions : [];
    console.log(`Loaded ${QUESTION_BANK.length} questions from bank.`);
  } catch (err) {
    console.error('Could not load questions.json:', err.message);
    QUESTION_BANK = [];
  }
}
loadQuestions();

// ---- session store ---------------------------------------------------------
// In-memory for now. This is enough for the prototype, but when session history
// needs to survive restarts / be tracked per student (backlog DB-09) this should
// move to the project database. Keeping the shape simple so that swap is easy.

const sessions = new Map();

// crude periodic cleanup so old/abandoned sessions don't pile up in memory
setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60 * 2; // 2 hours
  for (const [id, s] of sessions) {
    if (s.lastActivity < cutoff) sessions.delete(id);
  }
}, 1000 * 60 * 10);

function pickQuestions({ licenceType, topic, count }) {
  let pool = QUESTION_BANK.slice();
  if (licenceType) pool = pool.filter(q => q.licenceType === licenceType);
  if (topic) pool = pool.filter(q => q.topic === topic);
  // if the filter emptied the pool, fall back to the whole bank rather than 0 questions
  if (pool.length === 0) pool = QUESTION_BANK.slice();

  // shuffle (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count || QUESTIONS_PER_SESSION);
}

// Only expose what the browser is allowed to see.
function publicQuestion(q, index, total) {
  return {
    id: q.id,
    topic: q.topic,
    licenceType: q.licenceType,
    questionText: q.questionText,
    index: index,      // 0-based
    number: index + 1, // human friendly
    total: total
  };
}

// ---- LLM calls -------------------------------------------------------------

function buildFeedbackPrompt(question, studentAnswer) {
  // Grounded, and explicitly NOT allowed to grade/pass/fail (risk R4). Real
  // competency judgement stays with human examiners and AMSA.
  return [
    'You are a supportive AMSA oral examination PRACTICE assistant - not the real examiner.',
    `Question asked: "${question.questionText}"`,
    `Key points an ideal answer would cover: ${(question.keywords || []).join(', ')}`,
    `Reference model answer (for your judgement only, do not read it out verbatim): "${question.modelAnswer || ''}"`,
    `The student's answer was: "${studentAnswer}"`,
    '',
    'Give 2 to 3 sentences of warm, specific feedback: name the key points they covered,',
    'the important ones they missed, and one concrete tip to improve. Do NOT give a score,',
    'a pass/fail verdict, a percentage, or certify competency. This is practice only.'
  ].join('\n');
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 220
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${AI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 220 }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// Fallback used when no API key is set OR the provider call fails. It isn't clever
// but it keeps the loop working and is grounded in the same keywords, so the demo
// never dead-ends. This is deliberately transparent about being basic feedback.
function heuristicFeedback(question, studentAnswer) {
  const answer = (studentAnswer || '').toLowerCase();
  const keywords = question.keywords || [];
  const hit = [];
  const missed = [];
  for (const kw of keywords) {
    // match on the most significant word of each keyword phrase, keeps it forgiving
    const parts = kw.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const found = parts.some(w => answer.includes(w)) || answer.includes(kw.toLowerCase());
    if (found) hit.push(kw); else missed.push(kw);
  }

  let msg;
  if (answer.trim().length < 3) {
    msg = "I didn't catch much of an answer there. Have a go at the key points - even a short attempt helps.";
  } else if (hit.length === 0) {
    msg = `Thanks for that. I didn't pick up the key points I was listening for on this one. Try to mention things like: ${keywords.slice(0, 3).join(', ')}.`;
  } else if (missed.length === 0) {
    msg = `Good - you covered the main points I was listening for (${hit.slice(0, 4).join(', ')}). Keep that structure up.`;
  } else {
    msg = `Nice work mentioning ${hit.slice(0, 3).join(', ')}. To round it out, also bring in ${missed.slice(0, 3).join(', ')}.`;
  }
  return { feedback: msg, keywordsHit: hit, mode: 'heuristic' };
}

async function generateFeedback(question, studentAnswer) {
  if (!AI_API_KEY) {
    return heuristicFeedback(question, studentAnswer);
  }
  try {
    const prompt = buildFeedbackPrompt(question, studentAnswer);
    const text = AI_PROVIDER === 'gemini'
      ? await callGemini(prompt)
      : await callOpenAI(prompt);
    if (!text) throw new Error('empty response from provider');

    // still record which keywords were present, for the end-of-session summary
    const h = heuristicFeedback(question, studentAnswer);
    return { feedback: text, keywordsHit: h.keywordsHit, mode: AI_PROVIDER };
  } catch (err) {
    console.error('AI feedback failed, using fallback:', err.message);
    const h = heuristicFeedback(question, studentAnswer);
    h.mode = 'heuristic-fallback';
    return h;
  }
}

// ---- routes ----------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    questionsLoaded: QUESTION_BANK.length,
    aiConfigured: Boolean(AI_API_KEY),
    provider: AI_API_KEY ? AI_PROVIDER : 'heuristic'
  });
});

// list of distinct licence types / topics so the UI can offer filters
app.get('/api/topics', (req, res) => {
  const licenceTypes = [...new Set(QUESTION_BANK.map(q => q.licenceType))];
  const topics = [...new Set(QUESTION_BANK.map(q => q.topic))];
  res.json({ licenceTypes, topics });
});

app.post('/api/session/start', (req, res) => {
  const { licenceType, topic, count } = req.body || {};
  const chosen = pickQuestions({ licenceType, topic, count });
  if (chosen.length === 0) {
    return res.status(503).json({ error: 'No questions available. Check the question bank.' });
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    questions: chosen,
    index: 0,
    records: [],
    startedAt: Date.now(),
    lastActivity: Date.now()
  });

  const first = chosen[0];
  res.json({
    sessionId,
    greeting: "Welcome. I'll ask you a series of practice questions, one at a time. Answer as you would in the real oral exam - take your time. Remember this is practice, I won't be grading you.",
    question: publicQuestion(first, 0, chosen.length)
  });
});

app.post('/api/session/answer', async (req, res) => {
  try {
    const { sessionId, answer } = req.body || {};
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired. Start a new session.' });
    }
    session.lastActivity = Date.now();

    // guard against a late/duplicate answer arriving after the session already finished
    if (session.index >= session.questions.length) {
      return res.status(409).json({ error: 'This session is already complete. Start a new one.' });
    }

    const currentQuestion = session.questions[session.index];
    const result = await generateFeedback(currentQuestion, answer || '');

    session.records.push({
      questionId: currentQuestion.id,
      topic: currentQuestion.topic,
      answer: answer || '',
      keywordsHit: result.keywordsHit,
      totalKeywords: (currentQuestion.keywords || []).length
    });

    session.index += 1;
    const done = session.index >= session.questions.length;

    const payload = {
      feedback: result.feedback,
      mode: result.mode,
      done
    };

    if (done) {
      payload.summary = buildSummary(session);
    } else {
      const next = session.questions[session.index];
      payload.nextQuestion = publicQuestion(next, session.index, session.questions.length);
    }

    res.json(payload);
  } catch (err) {
    console.error('answer handler error:', err);
    res.status(500).json({ error: 'Internal error handling answer.' });
  }
});

// Deliberately NO score here - a plain "what to revisit" summary, per risk R4.
function buildSummary(session) {
  const topicsCovered = [...new Set(session.records.map(r => r.topic))];

  // rank topics by how many keywords were missed, so we can suggest what to revisit
  const missedByTopic = {};
  for (const r of session.records) {
    const missed = r.totalKeywords - r.keywordsHit.length;
    missedByTopic[r.topic] = (missedByTopic[r.topic] || 0) + missed;
  }
  const revisit = Object.entries(missedByTopic)
    .filter(([, missed]) => missed > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic);

  return {
    questionsAnswered: session.records.length,
    topicsCovered,
    suggestedRevision: revisit,
    message: revisit.length
      ? `Good session - you worked through ${session.records.length} questions across ${topicsCovered.length} topic(s). If you want to sharpen up, the areas worth another look are: ${revisit.join(', ')}.`
      : `Strong session - you worked through ${session.records.length} questions across ${topicsCovered.length} topic(s) and covered the key points well. Keep it up.`
  };
}

app.listen(PORT, () => {
  console.log(`AMSA chatbot server listening on http://localhost:${PORT}`);
  console.log(`AI mode: ${AI_API_KEY ? AI_PROVIDER + ' (' + AI_MODEL + ')' : 'heuristic fallback (no API key set)'}`);
});
