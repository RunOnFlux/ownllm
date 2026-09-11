/**
 * Embeddable documentation assistant.
 *
 *   <script src="https://your.cdn/ownllm-widget.js"
 *           data-endpoint="https://ownllmdocs_33001.app.runonflux.io"
 *           data-title="Ask the Flux docs"></script>
 *
 * Deliberately dependency-free and self-contained: a docs widget that pulls a
 * framework onto every page of your site is a bad trade.
 *
 * No API key. The endpoint runs in public mode and rate limits per IP - a key
 * in page source is readable by anyone, so the honest options are "no key" or
 * "a key that is not a secret", and the bot only serves published docs anyway.
 */
(function () {
  var script = document.currentScript;
  var ENDPOINT = (script.dataset.endpoint || '').replace(/\/$/, '');
  var TITLE = script.dataset.title || 'Ask the docs';
  var ACCENT = script.dataset.accent || '#2b6cb0';
  if (!ENDPOINT) return console.error('[ownllm] data-endpoint is required');

  var css = document.createElement('style');
  css.textContent = [
    '.ol-btn{position:fixed;right:20px;bottom:20px;z-index:9998;border:0;border-radius:28px;padding:13px 20px;',
    'font:600 14px system-ui,-apple-system,sans-serif;color:#fff;background:' + ACCENT + ';cursor:pointer;',
    'box-shadow:0 4px 14px rgba(0,0,0,.18)}',
    '.ol-panel{position:fixed;right:20px;bottom:78px;z-index:9999;width:380px;max-width:calc(100vw - 40px);',
    'max-height:min(620px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;color:#1a202c;',
    'border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.22);font:14px/1.55 system-ui,-apple-system,sans-serif;overflow:hidden}',
    '.ol-panel.open{display:flex}',
    '.ol-head{padding:13px 16px;background:' + ACCENT + ';color:#fff;font-weight:600;display:flex;justify-content:space-between;align-items:center}',
    '.ol-head button{background:none;border:0;color:#fff;font-size:19px;cursor:pointer;line-height:1}',
    '.ol-log{flex:1;overflow-y:auto;padding:14px 16px}',
    '.ol-msg{margin-bottom:14px}.ol-q{font-weight:600}',
    '.ol-a{white-space:pre-wrap}',
    '.ol-status{font-size:13px;color:#718096;font-style:italic}',
    '.ol-dots::after{content:"";animation:ol-dots 1.4s steps(4,end) infinite}',
    '@keyframes ol-dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}',
    '.ol-src{margin-top:7px;font-size:12px;color:#4a5568}',
    '.ol-src a{color:' + ACCENT + ';text-decoration:none}.ol-src a:hover{text-decoration:underline}',
    '.ol-form{display:flex;border-top:1px solid #e2e8f0}',
    '.ol-form input{flex:1;border:0;padding:13px 16px;font:inherit;outline:none}',
    '.ol-form button{border:0;background:' + ACCENT + ';color:#fff;padding:0 18px;cursor:pointer;font:600 14px inherit}',
    '.ol-note{font-size:12px;color:#718096;padding:0 16px 10px}',
    '@media(prefers-color-scheme:dark){.ol-panel{background:#1a202c;color:#e2e8f0}',
    '.ol-form{border-top-color:#2d3748}.ol-form input{background:#1a202c;color:#e2e8f0}',
    '.ol-src{color:#a0aec0}.ol-note{color:#a0aec0}}',
  ].join('');
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'ol-btn';
  btn.textContent = TITLE;
  var panel = document.createElement('div');
  panel.className = 'ol-panel';
  panel.innerHTML =
    '<div class="ol-head"><span>' + TITLE + '</span><button aria-label="Close">&times;</button></div>' +
    '<div class="ol-log"></div>' +
    '<div class="ol-note">Answers come from the documentation, with sources. It says so when it does not know.</div>' +
    '<form class="ol-form"><input placeholder="Ask a question" autocomplete="off"><button>Ask</button></form>';
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var log = panel.querySelector('.ol-log');
  var form = panel.querySelector('.ol-form');
  var input = panel.querySelector('input');
  btn.onclick = function () { panel.classList.toggle('open'); input.focus(); };
  panel.querySelector('.ol-head button').onclick = function () { panel.classList.remove('open'); };

  var escape = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; };

  form.onsubmit = async function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    input.value = '';

    var msg = document.createElement('div');
    msg.className = 'ol-msg';
    msg.innerHTML = '<div class="ol-q">' + escape(q) + '</div>'
      + '<div class="ol-a"></div><div class="ol-status">Searching the documentation<span class="ol-dots"></span></div>'
      + '<div class="ol-src"></div>';
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    var answerEl = msg.querySelector('.ol-a');
    var statusEl = msg.querySelector('.ol-status');
    var srcEl = msg.querySelector('.ol-src');

    try {
      var res = await fetch(ENDPOINT + '/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (res.status === 429) { answerEl.textContent = 'Too many questions just now - try again in a minute.'; return; }
      if (!res.ok) { answerEl.textContent = 'The assistant is unavailable right now.'; return; }

      // NDJSON: sources first, then a line per token, then a done line. Reading
      // it incrementally is the point - answers take tens of seconds on CPU, and
      // watching words appear is the difference between waiting and leaving.
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var text = '';
      answerEl.textContent = '';
      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(function (line) {
          if (!line.trim()) return;
          var obj;
          try { obj = JSON.parse(line); } catch (err) { return; }
          // Sources arrive before any token, so the wait stops being blank
          // the moment retrieval finishes - which on a slow node is 20 seconds
          // before the first word.
          if (obj.live) { statusEl.textContent = 'Checking live network status…'; }
          if (obj.sources) {
            statusEl.textContent = obj.cached
              ? 'Answering from a previous reply…'
              : 'Reading ' + obj.sources.length + ' sources, writing an answer…';
            srcEl.innerHTML = obj.sources.filter(function (s) { return s.url; })
              .map(function (s) { return '<a href="' + s.url + '" target="_blank" rel="noopener">[' + s.n + ']</a>'; })
              .join(' ');
          }
          if (obj.delta) {
            if (statusEl.parentNode) statusEl.remove();
            text += obj.delta; answerEl.textContent = text; log.scrollTop = log.scrollHeight;
          }
          if (obj.done && statusEl.parentNode) statusEl.remove();
          if (obj.error) { answerEl.textContent = 'Something went wrong answering that.'; }
        });
      }
      if (!text) answerEl.textContent = 'No answer came back - please try rephrasing.';
    } catch (err) {
      answerEl.textContent = 'Could not reach the assistant.';
    }
  };
}());
