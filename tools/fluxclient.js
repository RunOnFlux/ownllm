/** Shared helpers for talking to a FluxOS node. */
const crypto = require('crypto');

/**
 * FluxOS reads the raw request body itself; a POST with
 * Content-Type: application/json waits for a body it never parses, until the
 * gateway 504s. text/plain is the working content type.
 */
async function post(node, path, body, headers = {}) {
  const res = await fetch(`${node}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== 'success') {
    throw new Error(typeof json.data === 'object' ? json.data.message : String(json.data));
  }
  return json.data;
}

/**
 * Enterprise specs can only be decrypted - and therefore only validated and
 * only registered - on a node running ArcaneOS (enterpriseHelper.js:21). Fail
 * here with a clear message rather than at a confusing "Error decrypting AES
 * key" three calls later.
 */
async function requireArcane(node) {
  const res = await fetch(`${node}/flux/info`);
  const info = await res.json();
  const flux = info?.data?.flux;
  if (!flux?.arcaneVersion) {
    throw new Error(`${node} is not running ArcaneOS - enterprise apps cannot be validated or registered there. Set FLUX_NODE to an Arcane node.`);
  }
  return flux.arcaneVersion;
}

/** WIF -> { key, compressed }. Base58check, minus version byte and compression flag. */
function wifToPrivateKey(wif) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  for (const ch of wif) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Invalid character in WIF');
    num = num * 58n + BigInt(i);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = Buffer.from(hex, 'hex');
  for (const ch of wif) {
    if (ch !== '1') break;
    bytes = Buffer.concat([Buffer.from([0]), bytes]);
  }
  const payload = bytes.subarray(0, -4);
  const checksum = bytes.subarray(-4);
  const hash = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(payload).digest(),
  ).digest();
  if (!hash.subarray(0, 4).equals(checksum)) throw new Error('WIF checksum mismatch');
  return { key: payload.subarray(1, 33), compressed: payload.length === 34 && payload[33] === 0x01 };
}

module.exports = { post, requireArcane, wifToPrivateKey };
