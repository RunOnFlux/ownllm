/**
 * Embeddable documentation assistant, served by the ownllm router.
 *
 *   <script src="https://ownllmrouter.app.runonflux.io/widget.js"
 *           data-title="Ask the Flux docs"></script>
 *
 * The router serves this file and is also the default endpoint, so that is
 * the whole integration. Optional attributes:
 *   data-endpoint     override the API origin
 *   data-title        panel title (default "Ask the docs")
 *   data-subtitle     one line under the title
 *   data-accent       brand colour (default Flux blue)
 *   data-suggestions  starter questions, separated by |
 *   data-theme        light | dark (default: follows the page's colour scheme)
 *   data-logo         URL of a logo to show instead of the Flux mark
 *   data-button-hide  "true" to render no launcher; open it from your own
 *                     button with window.ownllm.open()
 *
 * window.ownllm = { open, close, toggle, ask(question), reset } is set once
 * the widget is mounted, and an "ownllm-ready" event fires on window.
 *
 * Deliberately dependency-free: a docs widget that pulls a framework onto
 * every page of your site is a bad trade. No API key: the endpoint runs in
 * public mode and rate limits per IP, and it only serves published docs.
 *
 * Conversation: the widget keeps the thread and sends the last four turns with
 * every question (the bot keeps HISTORY_TURNS of them, default two), so "and on NIMBUS?" after a question about STRATUS works.
 * Turns are trimmed on the way out - history is prompt, and prompt is what
 * costs seconds on a CPU.
 */
(function () {
  var script = document.currentScript;
  var SELF = '';
  try { SELF = new URL(script.src).origin; } catch (e) { /* inline use */ }
  var ENDPOINT = (script.dataset.endpoint || SELF || '').replace(/\/$/, '');
  var TITLE = script.dataset.title || 'Ask the docs';
  var SUBTITLE = script.dataset.subtitle || 'Answers from the documentation, with sources';
  var ACCENT = script.dataset.accent || '#2656d7';
  var THEME = script.dataset.theme || '';
  var LOGO = script.dataset.logo || '';
  var HIDE_BUTTON = script.dataset.buttonHide === 'true';
  var SUGGESTIONS = (script.dataset.suggestions || 'How do I deploy an application on Flux?|What are the resource limits per node tier?|How much does an app cost per month?|How do I run a FluxNode?')
    .split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!ENDPOINT) return console.error('[ownllm] data-endpoint is required');

  var FLUX_MARK = "<svg width=\"22\" height=\"23\" viewBox=\"0 0 140 149\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M74.7415 38.4807C81.8512 38.5284 88.7876 40.6802 94.676 44.6648C100.564 48.6495 105.141 54.2885 107.829 60.8707C110.517 67.453 111.195 74.6837 109.779 81.6511C108.363 88.6185 104.915 95.0105 99.8709 100.021C94.8267 105.032 88.4117 108.437 81.435 109.806C74.4583 111.176 67.2323 110.449 60.6681 107.717C54.104 104.985 48.4957 100.371 44.5505 94.4563C40.6053 88.5415 38.4999 81.5908 38.4998 74.481C38.532 64.9012 42.3684 55.7265 49.165 48.9752C55.9616 42.2239 65.1617 38.4489 74.7415 38.4807Z\" fill=\"#2656D7\"/><path d=\"M79.0362 95.3835L74.908 97.7676L66.0398 92.6549L70.0672 90.3294L70.168 90.2707L79.0362 95.3835Z\" fill=\"white\"/><path d=\"M94.8832 63.1743V67.973L83.7856 61.5662L67.955 70.7087V73.5382L61.3185 69.7077L54.9352 73.3905V63.1743L74.908 51.6431L94.8832 63.1743Z\" fill=\"white\"/><path d=\"M94.8832 73.4332V86.2561L83.7879 92.6558H83.7739L72.6904 86.2561V73.4332L83.7879 67.0241L94.8832 73.4332Z\" fill=\"white\"/><path d=\"M67.6995 78.8526V86.2205L61.3162 89.908L54.9352 86.2229V78.855L61.3185 75.1698L67.6995 78.8526Z\" fill=\"white\"/></svg>";
  var CHAT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  var css = document.createElement('style');
  css.textContent = [
    ':root{--ol-accent:' + ACCENT + '}',
    '.ol-launch{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;',
    'padding:12px 18px 12px 14px;font:600 14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:var(--ol-accent);cursor:pointer;',
    'box-shadow:0 8px 24px rgba(38,86,215,.35);transition:transform .15s,box-shadow .15s}',
    '.ol-launch:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(38,86,215,.45)}',
    '.ol-launch.hidden{display:none}',
    '.ol-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:400px;max-width:calc(100vw - 24px);height:min(680px,calc(100vh - 40px));',
    'display:none;flex-direction:column;background:var(--ol-bg);color:var(--ol-fg);border:1px solid var(--ol-line);border-radius:16px;',
    'box-shadow:0 24px 64px rgba(0,0,0,.28);font:14px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;',
    'transform-origin:bottom right;animation:ol-in .18s ease-out}',
    '@keyframes ol-in{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}',
    '.ol-panel.open{display:flex}',
    '@media(max-width:480px){.ol-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100vh;border-radius:0}}',
    '.ol-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--ol-line);background:var(--ol-bg)}',
    '.ol-head .ol-mark{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:var(--ol-accent);flex:none}',
    '.ol-head .ol-mark img{width:22px;height:22px}',
    '.ol-head .ol-t{flex:1;min-width:0}.ol-head .ol-t b{display:block;font-size:15px;line-height:1.2}.ol-head .ol-t span{display:block;font-size:12px;color:var(--ol-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ol-ib{border:0;background:none;color:var(--ol-muted);cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px}',
    '.ol-ib:hover{background:var(--ol-soft);color:var(--ol-fg)}',
    '.ol-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}',
    '.ol-welcome{color:var(--ol-muted);font-size:13px}',
    '.ol-sugs{display:flex;flex-direction:column;gap:6px;margin-top:10px}',
    '.ol-sug{text-align:left;border:1px solid var(--ol-line);background:var(--ol-bg);color:var(--ol-fg);border-radius:10px;padding:9px 12px;font:inherit;font-size:13px;cursor:pointer}',
    '.ol-sug:hover{border-color:var(--ol-accent);color:var(--ol-accent)}',
    '.ol-row{display:flex;flex-direction:column;gap:6px}',
    '.ol-u{align-self:flex-end;max-width:85%;background:var(--ol-accent);color:#fff;padding:9px 13px;border-radius:14px 14px 4px 14px;white-space:pre-wrap;word-break:break-word}',
    '.ol-a{align-self:flex-start;max-width:100%;background:var(--ol-soft);padding:10px 13px;border-radius:14px 14px 14px 4px;word-break:break-word}',
    '.ol-a p{margin:0 0 8px}.ol-a p:last-child{margin:0}.ol-a ul,.ol-a ol{margin:4px 0 8px 20px;padding:0}.ol-a li{margin:2px 0}',
    '.ol-a code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--ol-code);padding:1px 5px;border-radius:5px}',
    '.ol-a pre{background:var(--ol-code);padding:10px 12px;border-radius:8px;overflow-x:auto;margin:6px 0 8px}.ol-a pre code{background:none;padding:0;font-size:12.5px}',
    '.ol-a a{color:var(--ol-accent);text-decoration:none}.ol-a a:hover{text-decoration:underline}',
    '.ol-a .ol-cite{display:inline-block;font-size:11px;font-weight:600;line-height:1;padding:3px 6px;border-radius:6px;background:var(--ol-bg);border:1px solid var(--ol-line);color:var(--ol-accent);vertical-align:1px;margin:0 1px}',
    '.ol-status{align-self:flex-start;font-size:12.5px;color:var(--ol-muted);display:flex;align-items:center;gap:8px;padding:2px 4px}',
    '.ol-pulse{width:8px;height:8px;border-radius:50%;background:var(--ol-accent);animation:ol-pulse 1s ease-in-out infinite}',
    '@keyframes ol-pulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}',
    '.ol-cursor::after{content:"▍";color:var(--ol-accent);animation:ol-blink 1s steps(2) infinite;margin-left:1px}',
    '@keyframes ol-blink{50%{opacity:0}}',
    '.ol-srcs{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start}',
    '.ol-src{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:1px solid var(--ol-line);border-radius:8px;padding:5px 9px;font-size:12px;color:var(--ol-fg);text-decoration:none;background:var(--ol-bg)}',
    '.ol-src:hover{border-color:var(--ol-accent)}.ol-src b{color:var(--ol-accent);font-weight:700}.ol-src span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}',
    '.ol-src i{font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ol-muted)}',
    '.ol-form{display:flex;align-items:flex-end;gap:8px;padding:12px 12px 8px;border-top:1px solid var(--ol-line)}',
    '.ol-form textarea{flex:1;resize:none;border:1px solid var(--ol-line);border-radius:12px;padding:10px 12px;font:inherit;line-height:1.4;background:var(--ol-bg);color:var(--ol-fg);outline:none;max-height:120px}',
    '.ol-form textarea:focus{border-color:var(--ol-accent);box-shadow:0 0 0 3px rgba(38,86,215,.15)}',
    '.ol-send{flex:none;width:40px;height:40px;border:0;border-radius:12px;background:var(--ol-accent);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '.ol-send:disabled{opacity:.5;cursor:default}',
    '.ol-foot{display:flex;justify-content:space-between;align-items:center;padding:0 14px 10px;font-size:11px;color:var(--ol-muted)}',
    '.ol-foot a{color:var(--ol-muted);text-decoration:none;display:inline-flex;align-items:center;gap:5px}.ol-foot a:hover{color:var(--ol-accent)}',
    '.ol-foot a img{width:14px;height:14px;border-radius:4px;background:var(--ol-accent);padding:2px;box-sizing:border-box}',
    '.ol-light{--ol-bg:#fff;--ol-fg:#111827;--ol-muted:#6b7280;--ol-line:#e5e7eb;--ol-soft:#f3f4f6;--ol-code:#e9ebf0}',
    '.ol-dark{--ol-bg:#111827;--ol-fg:#e5e7eb;--ol-muted:#9ca3af;--ol-line:#273244;--ol-soft:#1f2937;--ol-code:#0b1220}',
  ].join('');
  document.head.appendChild(css);

  // Docusaurus and similar inject scripts into <head>; there is no <body> yet.
  if (!document.body) { document.addEventListener('DOMContentLoaded', mount); return; }
  mount();

  function mount() {
  var dark = THEME ? THEME === 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var markImg = '<img alt="" src="' + (LOGO || ('data:image/svg+xml;utf8,' + encodeURIComponent(FLUX_MARK))) + '">';

  var launch = document.createElement('button');
  launch.className = 'ol-launch';
  launch.setAttribute('aria-label', TITLE);
  launch.innerHTML = CHAT_ICON + '<span>' + esc(TITLE) + '</span>';
  var panel = document.createElement('div');
  panel.className = 'ol-panel ' + (dark ? 'ol-dark' : 'ol-light');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', TITLE);
  panel.innerHTML =
    '<div class="ol-head"><div class="ol-mark">' + markImg + '</div>' +
    '<div class="ol-t"><b>' + esc(TITLE) + '</b><span>' + esc(SUBTITLE) + '</span></div>' +
    '<button class="ol-ib ol-new" title="New conversation" aria-label="New conversation">&#8635;</button>' +
    '<button class="ol-ib ol-close" aria-label="Close">&times;</button></div>' +
    '<div class="ol-log"></div>' +
    '<form class="ol-form"><textarea rows="1" placeholder="Ask a question&hellip;" aria-label="Your question"></textarea>' +
    '<button class="ol-send" type="submit" aria-label="Send">' + SEND_ICON + '</button></form>' +
    '<div class="ol-foot"><span>May be wrong &middot; check the sources</span>' +
    '<a href="https://runonflux.com" target="_blank" rel="noopener">' + markImg + 'Powered by Flux</a></div>';
  if (!HIDE_BUTTON) document.body.appendChild(launch);
  document.body.appendChild(panel);

  var log = panel.querySelector('.ol-log');
  var form = panel.querySelector('.ol-form');
  var input = panel.querySelector('textarea');
  var sendBtn = panel.querySelector('.ol-send');
  var history = [];
  var busy = false;

  function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  // Markdown-lite: enough for what the bot writes (bold, code, lists, links,
  // citations) without a parser. Everything is escaped first.
  function render(text, sources) {
    var h = esc(text);
    h = h.replace(/```([\s\S]*?)```/g, function (m, c) { return '<pre><code>' + c.replace(/^\n|\n$/g, '') + '</code></pre>'; });
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\[(\d+)\]/g, function (m, n) {
      var s = sources && sources[Number(n) - 1];
      return s && s.url ? '<a class="ol-cite" href="' + s.url + '" target="_blank" rel="noopener" title="' + esc(s.heading || s.source || '') + '">' + n + '</a>' : '<span class="ol-cite">' + n + '</span>';
    });
    var blocks = h.split(/\n{2,}/).map(function (b) {
      var lines = b.split('\n');
      if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) return '<ul>' + lines.map(function (l) { return '<li>' + l.replace(/^\s*[-*]\s+/, '') + '</li>'; }).join('') + '</ul>';
      if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) return '<ol>' + lines.map(function (l) { return '<li>' + l.replace(/^\s*\d+[.)]\s+/, '') + '</li>'; }).join('') + '</ol>';
      if (/^<pre>/.test(b)) return b;
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
    });
    return blocks.join('');
  }

  function sourceLabel(s) {
    var t = s.heading || (s.source || '').split('/').pop().replace(/\.(md|html?)$/i, '') || s.url || '';
    if (t.length > 60) t = t.slice(0, 57) + '…';
    return t;
  }

  function welcome() {
    log.innerHTML = '';
    var w = document.createElement('div');
    w.className = 'ol-welcome';
    w.innerHTML = 'Hi! Ask anything about the documentation — I answer from it and show my sources.' +
      '<div class="ol-sugs">' + SUGGESTIONS.map(function (s) { return '<button type="button" class="ol-sug">' + esc(s) + '</button>'; }).join('') + '</div>';
    log.appendChild(w);
    w.querySelectorAll('.ol-sug').forEach(function (b) { b.onclick = function () { ask(b.textContent); }; });
    history = [];
  }

  function open() { panel.classList.add('open'); launch.classList.add('hidden'); setTimeout(function () { input.focus(); }, 50); }
  function close() { panel.classList.remove('open'); launch.classList.remove('hidden'); }
  launch.onclick = open;
  panel.querySelector('.ol-close').onclick = close;
  panel.querySelector('.ol-new').onclick = welcome;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
  input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
  form.onsubmit = function (e) { e.preventDefault(); var q = input.value.trim(); if (q) ask(q); };

  function scroll() { log.scrollTop = log.scrollHeight; }

  async function ask(q) {
    if (busy) return;
    busy = true; sendBtn.disabled = true;
    try { askInner(q); } catch (err) { busy = false; sendBtn.disabled = false; throw err; }
  }

  // Everything that can throw runs under ask()'s guard, so a rendering error
  // can never leave the widget marked busy - which is what a second question
  // silently ignored looked like: the suggestion list was removed on the first
  // question, and removing it again threw before the new row was even drawn.
  async function askInner(q) {
    input.value = ''; input.style.height = 'auto';
    var sugs = log.querySelector('.ol-sugs'); if (sugs) sugs.remove();

    var row = document.createElement('div');
    row.className = 'ol-row';
    row.innerHTML = '<div class="ol-u">' + esc(q) + '</div>' +
      '<div class="ol-status"><span class="ol-pulse"></span><span>Searching the documentation…</span></div>';
    log.appendChild(row); scroll();
    var statusEl = row.querySelector('.ol-status');
    var statusText = statusEl.querySelector('span:last-child');
    var answerEl = null; var srcsEl = null;
    var sources = []; var text = '';

    function fail(msg) { if (statusEl.parentNode) statusEl.remove(); var d = document.createElement('div'); d.className = 'ol-a'; d.textContent = msg; row.appendChild(d); }

    try {
      var res = await fetch(ENDPOINT + '/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: history.slice(-4) }),
      });
      if (res.status === 429) { fail('Too many questions just now — please try again in a minute.'); return; }
      if (!res.ok) { fail('The assistant is unavailable right now.'); return; }

      // NDJSON: sources first, then a line per token, then a done line. Reading
      // it incrementally is the point - answers take tens of seconds on CPU, and
      // watching words appear is the difference between waiting and leaving.
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        var lines = buf.split('\n'); buf = lines.pop();
        lines.forEach(function (line) {
          if (!line.trim()) return;
          var obj; try { obj = JSON.parse(line); } catch (err) { return; }
          if (obj.live) statusText.textContent = 'Checking live network status…';
          if (obj.sources) {
            sources = obj.sources;
            statusText.textContent = obj.cached ? 'Answering from a recent reply…' : 'Reading ' + sources.length + ' sources, writing an answer…';
          }
          if (obj.delta) {
            if (!answerEl) { if (statusEl.parentNode) statusEl.remove(); answerEl = document.createElement('div'); answerEl.className = 'ol-a ol-cursor'; row.appendChild(answerEl); }
            text += obj.delta; answerEl.innerHTML = render(text, sources); scroll();
          }
          if (obj.error) fail('Something went wrong answering that.');
        });
      }
      if (!answerEl) { fail('No answer came back.'); return; }
      answerEl.classList.remove('ol-cursor');
      answerEl.innerHTML = render(text, sources);
      var used = sources.filter(function (s) { return s.url && text.indexOf('[' + s.n + ']') >= 0; });
      var show = used.length ? used : sources.filter(function (s) { return s.url; }).slice(0, 3);
      if (show.length) {
        srcsEl = document.createElement('div'); srcsEl.className = 'ol-srcs';
        srcsEl.innerHTML = show.map(function (s) { return '<a class="ol-src" href="' + s.url + '" target="_blank" rel="noopener"><b>' + s.n + '</b><span>' + esc(sourceLabel(s)) + '</span>' + (s.tier ? '<i>' + esc(s.tier) + '</i>' : '') + '</a>'; }).join('');
        row.appendChild(srcsEl);
      }
      history.push({ q: q, a: text });
      scroll();
    } catch (err) {
      fail('Lost the connection while answering.');
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  welcome();

  window.ownllm = {
    open: open,
    close: close,
    toggle: function () { panel.classList.contains('open') ? close() : open(); },
    ask: function (q) { open(); ask(String(q || '')); },
    reset: welcome,
  };
  window.dispatchEvent(new CustomEvent('ownllm-ready'));
  } // mount
}());
