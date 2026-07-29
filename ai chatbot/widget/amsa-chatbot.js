/*
 * Avatar AMSA - help assistant widget.
 *
 * Drops a little help chat onto any page with one script tag + one init call:
 *
 *   <script src="ai chatbot/widget/amsa-chatbot.js"></script>
 *   <script>AMSAChatbot.init({ apiBase: 'http://localhost:3000/api' });</script>
 *
 * It builds its own markup and styles so it doesn't clash with the page it's on, and
 * it doesn't touch any of the existing dashboard code. It's a navigation/FAQ helper -
 * it answers "how do I..." questions about the app. It does not run the oral exam.
 */
(function () {
  'use strict';

  if (window.AMSAChatbot) return; // don't load twice

  var cfg = {
    apiBase: '/api',
    title: 'Help Assistant',
    subtitle: 'Ask me about using Avatar AMSA',
    greeting: "Hi! I'm here to help you get around Avatar AMSA. Ask me things like how to sign in, create an account, or reset your password.",
    // a few starter prompts so people know what they can ask
    suggestions: [
      'How do I create an account?',
      'I forgot my password',
      'How do I start a practice exam?'
    ],
    startOpen: false,
    colors: {
      navy: '#06233f',
      teal: '#07818c',
      tealDark: '#075d72',
      lightTeal: '#e8f7f7'
    }
  };

  var state = { busy: false, history: [] };
  var el = {};

  // ---- styles --------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById('amsa-chatbot-styles')) return;
    var c = cfg.colors;
    var css = ''
    + '.amsa-launcher{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;'
    + 'border:none;cursor:pointer;z-index:2147483000;color:#fff;font-size:26px;'
    + 'box-shadow:0 8px 24px rgba(6,35,63,.32);transition:transform .15s ease;'
    + 'background:linear-gradient(140deg,' + c.navy + ',' + c.teal + ');}'
    + '.amsa-launcher:hover{transform:scale(1.06);}'
    + '.amsa-panel{position:fixed;bottom:96px;right:24px;width:380px;max-width:calc(100vw - 32px);'
    + 'height:560px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;overflow:hidden;'
    + 'display:none;flex-direction:column;z-index:2147483000;box-shadow:0 18px 50px rgba(6,35,63,.30);'
    + 'font-family:Arial,Helvetica,sans-serif;}'
    + '.amsa-panel.open{display:flex;}'
    + '.amsa-header{padding:16px 18px;color:#fff;display:flex;align-items:center;gap:12px;'
    + 'background:linear-gradient(140deg,' + c.navy + ',' + c.tealDark + ');}'
    + '.amsa-header .amsa-badge{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;'
    + 'justify-content:center;font-size:20px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);}'
    + '.amsa-header h3{font-size:15px;margin:0;}'
    + '.amsa-header p{font-size:11px;margin:2px 0 0;color:rgba(255,255,255,.7);}'
    + '.amsa-header .amsa-close{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.8;}'
    + '.amsa-header .amsa-close:hover{opacity:1;}'
    + '.amsa-body{flex:1;overflow-y:auto;padding:16px;background:#f4f7fa;}'
    + '.amsa-msg{margin-bottom:12px;display:flex;}'
    + '.amsa-msg .bubble{max-width:82%;padding:10px 13px;border-radius:13px;font-size:13.5px;line-height:1.5;'
    + 'white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;}'
    + '.amsa-msg.bot .bubble{background:#fff;border:1px solid #e4e7ec;color:#172b3a;border-bottom-left-radius:4px;}'
    + '.amsa-msg.user{justify-content:flex-end;}'
    + '.amsa-msg.user .bubble{background:' + c.teal + ';color:#fff;border-bottom-right-radius:4px;}'
    + '.amsa-typing .bubble{color:#667085;font-style:italic;}'
    + '.amsa-suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}'
    + '.amsa-chip{background:' + c.lightTeal + ';color:' + c.tealDark + ';border:none;border-radius:16px;'
    + 'padding:7px 12px;font-size:12px;cursor:pointer;font-family:inherit;}'
    + '.amsa-chip:hover{background:#d6efef;}'
    + '.amsa-footer{border-top:1px solid #e4e7ec;padding:10px;background:#fff;}'
    + '.amsa-inputrow{display:flex;gap:8px;align-items:flex-end;}'
    + '.amsa-inputrow textarea{flex:1;resize:none;border:1px solid #e4e7ec;border-radius:10px;padding:9px 11px;'
    + 'font-family:inherit;font-size:13.5px;max-height:90px;outline:none;}'
    + '.amsa-inputrow textarea:focus{border-color:' + c.teal + ';}'
    + '.amsa-btn{border:none;border-radius:10px;cursor:pointer;color:#fff;font-size:15px;'
    + 'width:40px;height:40px;flex-shrink:0;background:' + c.teal + ';}'
    + '.amsa-btn:hover{background:' + c.tealDark + ';}'
    + '.amsa-btn:disabled{opacity:.5;cursor:default;}';
    var style = document.createElement('style');
    style.id = 'amsa-chatbot-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- build ---------------------------------------------------------------

  function build() {
    el.launcher = document.createElement('button');
    el.launcher.className = 'amsa-launcher';
    el.launcher.setAttribute('aria-label', 'Open help assistant');
    el.launcher.innerHTML = '&#128172;'; // speech balloon
    el.launcher.onclick = togglePanel;

    el.panel = document.createElement('div');
    el.panel.className = 'amsa-panel';
    el.panel.innerHTML = ''
      + '<div class="amsa-header">'
      +   '<div class="amsa-badge">&#9875;</div>'
      +   '<div><h3></h3><p></p></div>'
      +   '<button class="amsa-close" aria-label="Close">&times;</button>'
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

    addMessage(cfg.greeting, 'bot');
    renderSuggestions();
    renderInputRow();
  }

  function togglePanel() {
    el.panel.classList.toggle('open');
    if (el.panel.classList.contains('open') && el.input) el.input.focus();
  }

  // ---- rendering -----------------------------------------------------------

  function addMessage(text, who) {
    var wrap = document.createElement('div');
    wrap.className = 'amsa-msg ' + who;
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text; // textContent, never innerHTML - don't render user/model text as HTML
    wrap.appendChild(bubble);
    el.body.appendChild(wrap);
    el.body.scrollTop = el.body.scrollHeight;
    return wrap;
  }

  function renderSuggestions() {
    if (!cfg.suggestions || !cfg.suggestions.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'amsa-msg bot';
    var holder = document.createElement('div');
    holder.className = 'amsa-suggestions';
    cfg.suggestions.forEach(function (s) {
      var chip = document.createElement('button');
      chip.className = 'amsa-chip';
      chip.textContent = s;
      chip.onclick = function () { send(s); };
      holder.appendChild(chip);
    });
    wrap.appendChild(holder);
    el.body.appendChild(wrap);
    el.suggestionsWrap = wrap;
  }

  function renderInputRow() {
    var row = document.createElement('div');
    row.className = 'amsa-inputrow';

    el.input = document.createElement('textarea');
    el.input.rows = 1;
    el.input.placeholder = 'Type your question...';
    el.input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };
    row.appendChild(el.input);

    el.send = document.createElement('button');
    el.send.className = 'amsa-btn';
    el.send.innerHTML = '&#10148;';
    el.send.onclick = function () { send(); };
    row.appendChild(el.send);

    el.footer.appendChild(row);
  }

  function showTyping() {
    var wrap = addMessage('Assistant is typing...', 'bot');
    wrap.classList.add('amsa-typing');
    return wrap;
  }

  // ---- talking to the server ----------------------------------------------

  function send(preset) {
    if (state.busy) return;
    var text = (preset != null ? preset : (el.input.value || '')).trim();
    if (!text) return;

    // clear the starter chips once the conversation gets going
    if (el.suggestionsWrap) { el.suggestionsWrap.remove(); el.suggestionsWrap = null; }

    addMessage(text, 'user');
    if (preset == null) el.input.value = '';
    state.busy = true;
    el.send.disabled = true;
    var typing = showTyping();

    fetch(cfg.apiBase + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: state.history })
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || ('HTTP ' + r.status)); });
        return r.json();
      })
      .then(function (data) {
        typing.remove();
        addMessage(data.reply, 'bot');
        // keep a short rolling history so follow-up questions have context
        state.history.push({ role: 'user', content: text });
        state.history.push({ role: 'assistant', content: data.reply });
        if (state.history.length > 24) state.history = state.history.slice(-24);
      })
      .catch(function (err) {
        typing.remove();
        addMessage('Sorry - ' + err.message, 'bot');
      })
      .then(function () {
        state.busy = false;
        el.send.disabled = false;
        el.input.focus();
      });
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
