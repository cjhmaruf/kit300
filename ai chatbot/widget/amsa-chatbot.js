/*
 * Avatar AMSA examiner - drop-in chat widget.
 *
 * The whole point of this file: you can bolt the examiner onto ANY page (even a
 * completely rebuilt dashboard) with a single script tag and one init call, e.g.
 *
 *   <script src="ai chatbot/widget/amsa-chatbot.js"></script>
 *   <script>AMSAChatbot.init({ apiBase: 'http://localhost:3000/api' });</script>
 *
 * It injects its own styling and markup, so it doesn't depend on the host page's CSS.
 * It never touches the existing dashboard code.
 */
(function () {
  'use strict';

  if (window.AMSAChatbot) return; // already loaded, don't double up

  var cfg = {
    apiBase: '/api',        // where the backend proxy lives
    title: 'AMSA Practice Examiner',
    subtitle: 'Oral exam practice',
    licenceType: '',        // '', 'M45', 'MED1', 'ENG3' - filters the question bank
    topic: '',              // optional topic filter
    questionCount: null,    // null = server default
    voice: false,           // enable browser speech-to-text + text-to-speech
    startOpen: false,
    // theme (matches the existing dashboard navy/teal by default)
    colors: {
      navy: '#06233f',
      teal: '#07818c',
      tealDark: '#075d72',
      lightTeal: '#e8f7f7'
    }
  };

  var state = {
    sessionId: null,
    busy: false,
    awaitingAnswer: false,
    recognizing: false
  };

  var el = {}; // holds references to DOM nodes we build

  // ---- styling -------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById('amsa-chatbot-styles')) return;
    var c = cfg.colors;
    var css = `
    .amsa-launcher{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;
      border:none;cursor:pointer;z-index:2147483000;color:#fff;font-size:26px;
      box-shadow:0 8px 24px rgba(6,35,63,.32);
      background:linear-gradient(140deg, ${c.navy}, ${c.teal});transition:transform .15s ease;}
    .amsa-launcher:hover{transform:scale(1.06);}
    .amsa-panel{position:fixed;bottom:96px;right:24px;width:380px;max-width:calc(100vw - 32px);
      height:560px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;overflow:hidden;
      display:none;flex-direction:column;z-index:2147483000;
      box-shadow:0 18px 50px rgba(6,35,63,.30);font-family:Arial,Helvetica,sans-serif;}
    .amsa-panel.open{display:flex;}
    .amsa-header{padding:16px 18px;color:#fff;display:flex;align-items:center;gap:12px;
      background:linear-gradient(140deg, ${c.navy}, ${c.tealDark});}
    .amsa-header .amsa-badge{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;
      justify-content:center;font-size:20px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);}
    .amsa-header h3{font-size:15px;margin:0;}
    .amsa-header p{font-size:11px;margin:2px 0 0;color:rgba(255,255,255,.7);}
    .amsa-header .amsa-close{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.8;}
    .amsa-header .amsa-close:hover{opacity:1;}
    .amsa-body{flex:1;overflow-y:auto;padding:16px;background:#f4f7fa;}
    .amsa-msg{margin-bottom:12px;display:flex;}
    .amsa-msg .bubble{max-width:82%;padding:10px 13px;border-radius:13px;font-size:13.5px;line-height:1.5;
      white-space:pre-wrap;word-wrap:break-word;}
    .amsa-msg.bot .bubble{background:#fff;border:1px solid #e4e7ec;color:#172b3a;border-bottom-left-radius:4px;}
    .amsa-msg.user{justify-content:flex-end;}
    .amsa-msg.user .bubble{background:${c.teal};color:#fff;border-bottom-right-radius:4px;}
    .amsa-msg.system .bubble{background:${c.lightTeal};color:${c.tealDark};font-size:12px;border-radius:8px;}
    .amsa-question{font-weight:bold;color:${c.navy};display:block;margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;}
    .amsa-typing .bubble{color:#667085;font-style:italic;}
    .amsa-footer{border-top:1px solid #e4e7ec;padding:10px;background:#fff;}
    .amsa-inputrow{display:flex;gap:8px;align-items:flex-end;}
    .amsa-inputrow textarea{flex:1;resize:none;border:1px solid #e4e7ec;border-radius:10px;padding:9px 11px;
      font-family:inherit;font-size:13.5px;max-height:90px;outline:none;}
    .amsa-inputrow textarea:focus{border-color:${c.teal};}
    .amsa-btn{border:none;border-radius:10px;cursor:pointer;color:#fff;font-size:15px;
      width:40px;height:40px;flex-shrink:0;background:${c.teal};}
    .amsa-btn:hover{background:${c.tealDark};}
    .amsa-btn:disabled{opacity:.5;cursor:default;}
    .amsa-mic{background:#fff;border:1px solid #e4e7ec;color:${c.tealDark};}
    .amsa-mic.rec{background:#d92d20;color:#fff;border-color:#d92d20;}
    .amsa-start{margin:8px 0 2px;width:100%;padding:11px;border:none;border-radius:10px;color:#fff;
      font-size:14px;cursor:pointer;background:linear-gradient(140deg, ${c.navy}, ${c.teal});}
    .amsa-hint{font-size:11px;color:#667085;text-align:center;margin-top:6px;}
    `;
    var style = document.createElement('style');
    style.id = 'amsa-chatbot-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- DOM build -----------------------------------------------------------

  function build() {
    el.launcher = document.createElement('button');
    el.launcher.className = 'amsa-launcher';
    el.launcher.setAttribute('aria-label', 'Open practice examiner');
    el.launcher.innerHTML = '🎙';
    el.launcher.onclick = togglePanel;

    el.panel = document.createElement('div');
    el.panel.className = 'amsa-panel';
    el.panel.innerHTML = ''
      + '<div class="amsa-header">'
      +   '<div class="amsa-badge">⚓</div>'
      +   '<div><h3></h3><p></p></div>'
      +   '<button class="amsa-close" aria-label="Close">×</button>'
      + '</div>'
      + '<div class="amsa-body"></div>'
      + '<div class="amsa-footer"></div>';

    el.panel.querySelector('.amsa-header h3').textContent = cfg.title;
    el.panel.querySelector('.amsa-header p').textContent = cfg.subtitle;
    el.panel.querySelector('.amsa-close').onclick = togglePanel;

    el.body = el.panel.querySelector('.amsa-body');
    el.footer = el.panel.querySelector('.amsa-footer');

    document.body.appendChild(el.launcher);
    document.body.appendChild(el.panel);

    renderStartScreen();
  }

  function togglePanel() {
    el.panel.classList.toggle('open');
    if (el.panel.classList.contains('open') && !state.sessionId) {
      // nothing yet, start screen is already shown
    }
  }

  // ---- rendering -----------------------------------------------------------

  function renderStartScreen() {
    el.body.innerHTML = '';
    addSystem("Ready when you are. This is practice only - you won't be graded, and you can type or (if enabled) speak your answers.");

    el.footer.innerHTML = '';
    var btn = document.createElement('button');
    btn.className = 'amsa-start';
    btn.textContent = 'Start practice session';
    btn.onclick = startSession;
    el.footer.appendChild(btn);

    var hint = document.createElement('div');
    hint.className = 'amsa-hint';
    hint.textContent = cfg.licenceType ? ('Licence focus: ' + cfg.licenceType) : 'Mixed question set';
    el.footer.appendChild(hint);
  }

  function renderInputRow() {
    el.footer.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'amsa-inputrow';

    el.input = document.createElement('textarea');
    el.input.rows = 1;
    el.input.placeholder = 'Type your answer...';
    el.input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer(); }
    };
    row.appendChild(el.input);

    if (cfg.voice && speechSupported()) {
      el.mic = document.createElement('button');
      el.mic.className = 'amsa-btn amsa-mic';
      el.mic.innerHTML = '🎤';
      el.mic.title = 'Speak your answer';
      el.mic.onclick = toggleMic;
      row.appendChild(el.mic);
    }

    el.send = document.createElement('button');
    el.send.className = 'amsa-btn';
    el.send.innerHTML = '➤';
    el.send.onclick = submitAnswer;
    row.appendChild(el.send);

    el.footer.appendChild(row);
    el.input.focus();
  }

  function addMessage(text, who, questionLabel) {
    var wrap = document.createElement('div');
    wrap.className = 'amsa-msg ' + who;
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (questionLabel) {
      var lbl = document.createElement('span');
      lbl.className = 'amsa-question';
      lbl.textContent = questionLabel;
      bubble.appendChild(lbl);
    }
    bubble.appendChild(document.createTextNode(text));
    wrap.appendChild(bubble);
    el.body.appendChild(wrap);
    el.body.scrollTop = el.body.scrollHeight;
    return wrap;
  }

  function addSystem(text) { return addMessage(text, 'system'); }

  function showTyping() {
    var wrap = addMessage('Examiner is thinking...', 'bot');
    wrap.classList.add('amsa-typing');
    return wrap;
  }

  // ---- server calls --------------------------------------------------------

  function api(pathName, body) {
    return fetch(cfg.apiBase + pathName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  function startSession() {
    if (state.busy) return;
    state.busy = true;
    el.body.innerHTML = '';
    el.footer.innerHTML = '';
    var typing = showTyping();

    api('/session/start', {
      licenceType: cfg.licenceType || undefined,
      topic: cfg.topic || undefined,
      count: cfg.questionCount || undefined
    }).then(function (data) {
      typing.remove();
      state.sessionId = data.sessionId;
      addMessage(data.greeting, 'bot');
      presentQuestion(data.question);
      renderInputRow();
      state.busy = false;
      state.awaitingAnswer = true;
    }).catch(function (err) {
      typing.remove();
      addSystem('Could not start a session: ' + err.message);
      renderStartScreen();
      state.busy = false;
    });
  }

  function presentQuestion(q) {
    var label = 'Question ' + q.number + ' of ' + q.total + ' · ' + q.topic;
    addMessage(q.questionText, 'bot', label);
    if (cfg.voice) speak(q.questionText);
  }

  function submitAnswer() {
    if (state.busy || !state.awaitingAnswer) return;
    var text = (el.input.value || '').trim();
    if (!text) return;

    addMessage(text, 'user');
    el.input.value = '';
    state.busy = true;
    state.awaitingAnswer = false;
    if (el.send) el.send.disabled = true;
    var typing = showTyping();

    api('/session/answer', { sessionId: state.sessionId, answer: text })
      .then(function (data) {
        typing.remove();
        addMessage(data.feedback, 'bot');
        if (cfg.voice) speak(data.feedback);

        if (data.done) {
          finishSession(data.summary);
        } else {
          presentQuestion(data.nextQuestion);
          state.awaitingAnswer = true;
          if (el.send) el.send.disabled = false;
          el.input.focus();
        }
        state.busy = false;
      })
      .catch(function (err) {
        typing.remove();
        addSystem('Something went wrong: ' + err.message);
        state.busy = false;
        state.awaitingAnswer = true;
        if (el.send) el.send.disabled = false;
      });
  }

  function finishSession(summary) {
    if (summary && summary.message) {
      addMessage(summary.message, 'bot');
      if (cfg.voice) speak(summary.message);
    }
    state.sessionId = null;
    el.footer.innerHTML = '';
    var btn = document.createElement('button');
    btn.className = 'amsa-start';
    btn.textContent = 'Start another session';
    btn.onclick = startSession;
    el.footer.appendChild(btn);
  }

  // ---- optional voice (browser Web Speech API) -----------------------------
  // This is the free, no-key path. To upgrade to ElevenLabs / a cloud STT later,
  // this is the ONE place to swap: replace speak() and the recognition setup.

  function speechSupported() {
    return ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  var recognition = null;
  function toggleMic() {
    if (!speechSupported()) return;
    if (state.recognizing) { recognition && recognition.stop(); return; }

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-AU'; // Australian English - relevant to accent risk R3
    recognition.interimResults = true;
    recognition.continuous = false;

    var finalText = '';
    recognition.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      el.input.value = (finalText + interim).trim();
    };
    recognition.onstart = function () { state.recognizing = true; el.mic.classList.add('rec'); };
    recognition.onend = function () { state.recognizing = false; el.mic.classList.remove('rec'); };
    recognition.onerror = function () { state.recognizing = false; el.mic.classList.remove('rec'); };
    recognition.start();
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-AU';
      u.rate = 0.98;
      window.speechSynthesis.speak(u);
    } catch (e) { /* voice is a nice-to-have, never let it break the flow */ }
  }

  // ---- public API ----------------------------------------------------------

  function deepMerge(target, src) {
    for (var k in src) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {
        target[k] = deepMerge(target[k] || {}, src[k]);
      } else if (src[k] !== undefined) {
        target[k] = src[k];
      }
    }
    return target;
  }

  window.AMSAChatbot = {
    init: function (options) {
      deepMerge(cfg, options || {});
      function boot() {
        injectStyles();
        build();
        if (cfg.startOpen) togglePanel();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
      return window.AMSAChatbot;
    },
    open: function () { if (el.panel && !el.panel.classList.contains('open')) togglePanel(); },
    close: function () { if (el.panel && el.panel.classList.contains('open')) togglePanel(); },
    config: cfg
  };
})();
