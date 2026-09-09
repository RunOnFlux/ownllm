#!/usr/bin/env node
/**
 * Registers a Flux app directly against a node, so YOU choose the payment
 * amount and can pay the consensus-enforced price instead of the Flux Home
 * quote (which prices off the 5x USD table).
 *
 * This does steps 1-3 of registration. It does not spend anything - it only
 * broadcasts the (free) specification message and prints the hash and the
 * exact amount that consensus requires. You send the payment yourself.
 *
 *   FLUX_WIF=<your WIF private key> node tools/register.js specs/ownllm-standard.json
 *
 * The WIF must be the private key of the spec's owner ZelID. It is read from
 * the environment, never stored or logged.
 */
const fs = require('fs');
const crypto = require('crypto');
const bitcoinMessage = require('bitcoinjs-message');
const { wifToPrivateKey, requireArcane } = require('./fluxclient');

const NODE = process.env.FLUX_NODE || 'https://162-55-245-240-16127.node.api.runonflux.io';
const WIF = process.env.FLUX_WIF;
const specPath = process.argv[2];

if (!specPath) throw new Error('usage: FLUX_WIF=... node tools/register.js <spec.json>');
if (!WIF) throw new Error('FLUX_WIF is not set (WIF private key of the owner ZelID)');

// FluxOS reads the raw request body itself; Content-Type: application/json
// makes it wait for a body it never parses, until the gateway 504s.
async function post(path, body, headers = {}) {
  const res = await fetch(`${NODE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== 'success') {
    throw new Error(`${path}: ${JSON.stringify(json.data)}`);
  }
  return json.data;
}

// The consensus rule, verbatim from messageVerifier.js:736 - chain price
// segment only, no HW discount, no g: discount, no USD conversion.
const CHAIN = { cpu: 0.03, ram: 0.01, hdd: 0.004, scope: 0.8, staticip: 0.4, port: 0.4, minPrice: 0.01 };
const ENTERPRISE_PORTS = [[0, 1023], [8080, 8080], [8081, 8081], [8443, 8443], [6667, 6667]];
const isEnterprisePort = (p) => ENTERPRISE_PORTS.some(([lo, hi]) => p >= lo && p <= hi);

function consensusPrice(spec) {
  let cpu = 0; let ram = 0; let hdd = 0; let entPorts = 0;
  spec.compose.forEach((c) => {
    cpu += c.cpu; ram += c.ram; hdd += c.hdd;
    c.ports.forEach((p) => { if (isEnterprisePort(p)) entPorts += 1; });
  });
  let total = cpu * CHAIN.cpu * 10 + (ram * CHAIN.ram) / 100 + hdd * CHAIN.hdd;
  if (spec.enterprise || (spec.nodes && spec.nodes.length)) total += CHAIN.scope;
  if (spec.staticip) total += CHAIN.staticip;
  total += entPorts * CHAIN.port;

  let price = Math.ceil((total / 3) * 100) / 100;
  const extra = spec.instances - 1;
  if (extra > 0) {
    price = price < 0.5 && extra > 2
      ? price + extra * 0.5
      : (Math.ceil(price * extra * 100) + Math.ceil(price * 100)) / 100;
  }
  price *= spec.expire / 88000; // 88000 blocks = 1 month post-PON
  price = Math.ceil(price * 100) / 100;
  return Math.max(price, CHAIN.minPrice);
}

(async () => {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const { key, compressed } = wifToPrivateKey(WIF);

  if (spec.enterprise) {
    if (String(spec.enterprise).startsWith('<')) {
      throw new Error(`${specPath} still has a placeholder enterprise field. Run tools/encrypt-enterprise.js first.`);
    }
    // Enterprise specs are decrypted before they are validated, so only an
    // ArcaneOS node can accept this registration at all.
    console.log(`checking ${NODE} runs ArcaneOS ...`);
    console.log(`  arcane ${await requireArcane(NODE)}`);
  }

  // The node signs over ITS formatting of the spec, and JSON.stringify is
  // key-order sensitive - so take the formatted spec back from the node rather
  // than guessing the field order.
  console.log(`validating against ${NODE} ...`);
  const formatted = await post('/apps/verifyappregistrationspecifications', spec);
  console.log(`  ok: ${formatted.name}, ${formatted.compose.length} components`);

  const type = 'fluxappregister';
  const version = 1;
  const timestamp = Date.now();
  const message = type + version + JSON.stringify(formatted) + timestamp;
  const signature = bitcoinMessage.sign(message, key, compressed).toString('base64');

  // verifyUserSession accepts a self-made login phrase: 13-digit ms timestamp
  // prefix, 40-70 chars, signed by the owner, under 16 hours old.
  const loginPhrase = `${Date.now()}${crypto.randomBytes(16).toString('hex')}`;
  const loginSignature = bitcoinMessage.sign(loginPhrase, key, compressed).toString('base64');
  const zelidauth = `zelid=${formatted.owner}&signature=${encodeURIComponent(loginSignature)}&loginPhrase=${loginPhrase}`;

  console.log('broadcasting registration message (free) ...');
  const hash = await post('/apps/appregister', {
    type, version, appSpecification: formatted, timestamp, signature,
  }, { zelidauth });

  const price = consensusPrice(formatted);
  console.log('');
  console.log(`  message hash : ${hash}`);
  console.log(`  pay at least : ${price.toFixed(2)} FLUX`);
  console.log('  to address   : t3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX');
  console.log(`  with OP_RETURN data: ${hash}`);
  console.log('');
  console.log('The transaction must carry the hash as an OP_RETURN output and pay the');
  console.log('app address; explorerService.js sums the outputs to that address and');
  console.log('messageVerifier.js accepts the app once valueSat >= the amount above.');
  console.log('The message lives about an hour, so pay promptly. See tools/pay.md.');
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
