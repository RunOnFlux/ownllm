/**
 * Shared ollama client.
 *
 * This exists because the same two mistakes were made in three separate tools:
 * forgetting to pull before measuring (which reports "model not found" as
 * though it were a quality result), and reusing the pull endpoint's
 * tail-truncation on /api/generate (which silently produced 0.0 tok/s prefill,
 * because a generate response carries a token-id context array far larger than
 * the 4 KB tail kept for pull progress).
 *
 * The two endpoints need opposite handling, so they get separate functions.
 */

/** Reads a whole JSON response. For /api/generate, whose body must not be truncated. */
async function generate(base, key, body, ms = 900000) {
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const json = await res.json();
  if (json.error) throw new Error(String(json.error).slice(0, 120));
  return json;
}

/**
 * Pulls a model, discarding progress as it arrives. /api/pull streams NDJSON
 * even when told not to, and a 19 GB model emits enough of it to exhaust
 * memory if buffered - that killed a run at eleven models in.
 */
async function pull(base, key, model, ms = 3600000) {
  const res = await fetch(`${base}/api/pull`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false }),
    signal: AbortSignal.timeout(ms),
  });
  const decoder = new TextDecoder();
  let tail = '';
  if (res.body) for await (const piece of res.body) tail = (tail + decoder.decode(piece, { stream: true })).slice(-4096);
  const lines = tail.split('\n').filter(l => l.trim());
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.error) throw new Error(String(obj.error).slice(0, 120));
      return;
    } catch (err) { if (!/JSON/.test(err.message)) throw err; }
  }
}

async function remove(base, key, model) {
  await fetch(`${base}/api/delete`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  }).catch(() => {});
}

/** Tokens per second from ollama's nanosecond timings. */
const rate = (count, ns) => (count && ns ? count / (ns / 1e9) : 0);

/** Random words, so a repeat measurement can never hit the prefix cache. */
const filler = (n = 2500) => Array.from({ length: n }, () => Math.random().toString(36).slice(2, 9)).join(' ');

module.exports = { generate, pull, remove, rate, filler };
