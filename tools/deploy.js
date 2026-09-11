#!/usr/bin/env node
/**
 * Registers or updates a Flux app and pays for it, with no UI and no wallet
 * extension: one command from a spec file to running instances.
 *
 *   node tools/deploy.js specs/<app>.json [--dry-run] [--no-wait] [--margin 25]
 *
 * Keys come from .env (gitignored - this repository is public):
 *   FLUXID_PRIVATEKEY   WIF of the owner ZelID; signs the app message and the session
 *   FLUX_PRIVATEKEY     WIF of the transparent address that pays the deployment fee
 *
 * What it does, in order:
 *   1. picks a healthy FluxOS node (an ArcaneOS one for enterprise apps - only
 *      those can decrypt and validate an enterprise blob), opens a session
 *   2. for an enterprise envelope with a sibling .plaintext.json, encrypts the
 *      plaintext against the app's public key and writes the blob back, so the
 *      blob always matches what is on disk
 *   3. asks the node to validate and format the spec (the node's key order is
 *      what gets signed), signs it, broadcasts the message, gets the hash
 *   4. prices it the way consensus does - the chain table, the expire
 *      multiplier, and for updates the 90% rule with credit for the unused
 *      part of the previous term (messageVerifier.js) - adds a margin, and
 *      pays the deployment address with the hash in an OP_RETURN
 *   5. waits for the network to accept the message and for instances to run
 *
 * Pricing, signing and payment reuse ~/repos/moonshine-launch (MOONSHINE_DIR
 * to override), which mirrors the consensus code bug-for-bug and is
 * differential-tested against FluxOS. Underpaying does not error: the message
 * is dropped and the FLUX is gone, which is why nothing here rounds down.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MOONSHINE = process.env.MOONSHINE_DIR || path.join(__dirname, '..', '..', 'moonshine-launch');
const keys = require(path.join(MOONSHINE, 'src', 'keys'));
const specModule = require(path.join(MOONSHINE, 'src', 'spec'));
const price = require(path.join(MOONSHINE, 'src', 'price'));
const { Explorer, selectSpendable, buildPayment } = require(path.join(MOONSHINE, 'src', 'chain'));
const { FluxNode, findHealthyNodes, unwrap } = require(path.join(MOONSHINE, 'src', 'fluxnode'));

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--'));
const DRY_RUN = argv.includes('--dry-run');
const WAIT = !argv.includes('--no-wait');
const marginArg = argv.indexOf('--margin');
const MARGIN = marginArg >= 0 ? Number(argv[marginArg + 1]) / 100 : 0.25;
if (!specPath) {
  console.error('usage: node tools/deploy.js specs/<app>.json [--dry-run] [--no-wait] [--margin <pct>]');
  process.exit(1);
}

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) throw new Error('.env not found (needs FLUXID_PRIVATEKEY and FLUX_PRIVATEKEY)');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const k of ['FLUXID_PRIVATEKEY', 'FLUX_PRIVATEKEY']) if (!env[k]) throw new Error(`.env is missing ${k}`);
  return env;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flux = (sat) => (sat / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
const log = (m) => console.log(m);

// --- enterprise blob (layout from enterpriseHelper.js decryptEnterpriseFromSession) ---
const PADDINGS = [
  { name: 'OAEP-SHA256', opts: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' } },
  { name: 'OAEP-SHA1', opts: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' } },
  { name: 'PKCS1v1.5', opts: { padding: crypto.constants.RSA_PKCS1_PADDING } },
];
function toPublicKey(raw) {
  const s = String(raw).trim();
  if (s.includes('-----BEGIN')) return crypto.createPublicKey(s);
  return crypto.createPublicKey({ key: Buffer.from(s, 'base64'), format: 'der', type: 'spki' });
}
function buildBlob(publicKey, plaintextJson, padding) {
  const aesKey = crypto.randomBytes(32);
  // The RSA block wraps the BASE64 TEXT of the AES key, not its raw bytes:
  // enterpriseCrypto.js encryptAesKeyWithRsaKey encrypts Buffer.from(base64)
  // and enterpriseHelper.js base64-decodes what it unwraps. Raw bytes decrypt
  // fine and then fail as "Invalid key length" one step later.
  const encryptedKey = crypto.publicEncrypt({ key: publicKey, ...padding.opts }, Buffer.from(aesKey.toString('base64')));
  if (encryptedKey.length !== 256) throw new Error(`expected a 256-byte RSA block, got ${encryptedKey.length}`);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
  const body = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  return Buffer.concat([encryptedKey, nonce, body, cipher.getAuthTag()]).toString('base64');
}

/** Node-side validation; returns the node's formatted spec, which is what gets signed. */
async function verify(node, spec, isUpdate) {
  const pathname = isUpdate ? '/apps/verifyappupdatespecifications' : '/apps/verifyappregistrationspecifications';
  const payload = await node.call('post', pathname, { data: spec, timeout: 120000 });
  return unwrap(payload, pathname);
}

/**
 * Encrypts the plaintext compose/contacts into the envelope and proves the
 * node can decrypt it, by validating the result through the endpoint the
 * real message will go through.
 */
async function encryptEnvelope(node, envelope, plaintextPath, isUpdate) {
  const plaintext = JSON.parse(fs.readFileSync(plaintextPath, 'utf8'));
  delete plaintext._comment;
  const payload = await node.call('post', '/apps/getpublickey', {
    data: { owner: envelope.owner, name: envelope.name }, timeout: 60000,
  });
  const publicKey = toPublicKey(unwrap(payload, 'getpublickey'));
  const plaintextJson = JSON.stringify({ contacts: plaintext.contacts || [], compose: plaintext.compose });
  for (const padding of PADDINGS) {
    let blob;
    try { blob = buildBlob(publicKey, plaintextJson, padding); } catch { continue; }
    const candidate = { ...envelope, contacts: [], compose: [], enterprise: blob };
    try {
      const formatted = await verify(node, candidate, isUpdate);
      log(`  encrypted with ${padding.name}; node decrypted and validated it`);
      return { candidate, formatted };
    } catch (err) {
      log(`  ${padding.name} rejected: ${err.message}`);
    }
  }
  throw new Error('no padding scheme produced a blob the node could decrypt');
}

/**
 * Consensus price for the message, in FLUX. Registration: chain price x
 * expire/88000. Update (messageVerifier.js:833-862): the same for the new
 * spec, minus the unused fraction of what the previous term cost, x0.9,
 * floored at minPrice. `height` is where the payment will confirm; a few
 * blocks of slack shrink the credit slightly, which errs toward paying more.
 */
function requiredPrice({ formatted, previous, priceTable, height }) {
  const current = price.registrationPrice(formatted, priceTable, height);
  if (!previous) return { required: current.required, detail: `registration ${current.required}` };
  const prevHeight = previous.height || height;
  const prev = price.registrationPrice(previous, priceTable, prevHeight);
  const heightDifference = height - prevHeight;
  const perc = (prev.expire - heightDifference) / prev.expire;
  let actual = current.required * 0.9;
  if (perc > 0) actual = (current.required - perc * prev.required) * 0.9;
  actual = Math.ceil(actual * 100) / 100;
  if (actual < current.minPrice) actual = current.minPrice;
  return {
    required: actual,
    detail: `update: new ${current.required} - ${(perc * 100).toFixed(1)}% unused of previous ${prev.required}, x0.9 = ${actual}`,
  };
}

(async () => {
  const env = loadEnv();
  const owner = keys.identityFromPrivateKey(keys.fromWif(env.FLUXID_PRIVATEKEY));
  const payer = keys.identityFromPrivateKey(keys.fromWif(env.FLUX_PRIVATEKEY));
  let spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  if (spec.owner !== owner.zelid) throw new Error(`${specPath} owner ${spec.owner} != FLUXID_PRIVATEKEY's ${owner.zelid}`);
  const isEnterprise = spec.version >= 8 && !!spec.enterprise;
  const plaintextPath = specPath.replace(/\.register\.json$|\.json$/, '.plaintext.json');
  if (isEnterprise && !fs.existsSync(plaintextPath)) {
    throw new Error(`${specPath} is an enterprise envelope but ${plaintextPath} is missing - nothing to encrypt`);
  }

  log(`owner ${owner.zelid}   payer ${payer.fluxAddress}`);
  log('selecting a healthy node...');
  // A node can pass the peer check and still refuse a session ("verifylogin:
  // Unavailable" while it is busy), so the login is part of the selection.
  const healthy = await findHealthyNodes(isEnterprise ? 6 : 3, { log: (m) => log(`  ${m}`) });
  let node = null;
  for (const h of healthy) {
    if (isEnterprise) {
      // Only ArcaneOS nodes hold the enterprise decryption key.
      const info = await h.node.call('get', '/flux/info', { timeout: 15000, auth: false }).catch(() => null);
      if (!info?.data?.flux?.arcaneVersion) continue;
      log(`  ${h.endpoint} runs Arcane ${info.data.flux.arcaneVersion}`);
    }
    try {
      await h.node.login(owner.zelid, (m) => keys.signMessage(m, env.FLUXID_PRIVATEKEY));
      node = h.node; break;
    } catch (err) { log(`  ${h.endpoint} refused the session (${err.message}), trying another`); }
  }
  if (!node) throw new Error(`no usable ${isEnterprise ? 'ArcaneOS ' : ''}node among the probed ones; run again`);
  log(`using ${node.endpoint}, session opened`);

  const previous = await node.appSpecification(spec.name);
  const isUpdate = !!previous;
  log(isUpdate
    ? `${spec.name} exists (height ${previous.height}, expire ${previous.expire}, hash ${String(previous.hash).slice(0, 12)}) - this is an update`
    : `${spec.name} is not registered - this is a registration`);

  let formatted;
  if (isEnterprise) {
    log(`encrypting ${path.basename(plaintextPath)} into the envelope...`);
    const out = await encryptEnvelope(node, spec, plaintextPath, isUpdate);
    spec = out.candidate;
    formatted = out.formatted;
    fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
    log(`  wrote ${specPath}`);
  } else {
    formatted = await verify(node, spec, isUpdate);
  }
  log(`validated: ${formatted.name}, ${formatted.compose.length} component(s) in the message, ${formatted.instances} instance(s), expire ${formatted.expire}`);

  const [deployment, height] = await Promise.all([node.deploymentInformation(), node.daemonHeight()]);
  const explorer = new Explorer();
  const quoteHeight = height + 5;
  const quote = requiredPrice({ formatted, previous: isUpdate ? previous : null, priceTable: deployment.price, height: quoteHeight });
  const total = Math.ceil(Math.max(quote.required * (1 + MARGIN), quote.required + 0.01) * 100) / 100;
  const satoshis = Math.round(total * 1e8);
  const balance = await explorer.balance(payer.fluxAddress);
  log(`price: ${quote.detail} FLUX at height ~${quoteHeight}`);
  log(`paying ${total} FLUX (margin ${Math.round(MARGIN * 100)}%) to ${deployment.address}; payer holds ${flux(balance.spendable)} spendable`);
  if (balance.spendable < satoshis + 100000) throw new Error('payer balance is too low');

  if (DRY_RUN) { log('\ndry run - nothing signed, nothing spent'); return; }

  const type = isUpdate ? specModule.UPDATE_TYPE : specModule.MESSAGE_TYPE;
  const timestamp = Date.now();
  const signature = keys.signMessage(specModule.signablePayload(formatted, timestamp, type), env.FLUXID_PRIVATEKEY);
  const hash = isUpdate
    ? await node.updateApp({ appSpecification: formatted, timestamp, signature, type })
    : await node.registerApp({ appSpecification: formatted, timestamp, signature, type });
  if (typeof hash !== 'string' || hash.length !== 64) throw new Error(`unexpected message hash ${JSON.stringify(hash)}`);
  log(`message broadcast, hash ${hash}`);

  // Re-check the price against a fresh table/height right before spending.
  const [freshDeployment, freshHeight] = await Promise.all([node.deploymentInformation(), node.daemonHeight()]);
  const fresh = requiredPrice({ formatted, previous: isUpdate ? previous : null, priceTable: freshDeployment.price, height: freshHeight + 5 });
  if (Math.round(fresh.required * 1e8) > satoshis) throw new Error(`price moved to ${fresh.required} FLUX - nothing paid, run again`);
  if (freshDeployment.address !== deployment.address) throw new Error('deployment address changed - nothing paid');

  const utxos = selectSpendable(await explorer.utxos(payer.fluxAddress));
  const payment = buildPayment({
    wif: env.FLUX_PRIVATEKEY, to: deployment.address, amountSat: satoshis, message: hash, utxos, height: freshHeight,
  });
  const txid = await explorer.broadcast(payment.hex);
  log(`paid ${total} FLUX, fee ${flux(payment.fee)}, txid ${txid}`);

  if (!WAIT) return;
  log('waiting for the network to accept the message (payment must confirm first)...');
  const deadline = Date.now() + 45 * 60 * 1000;
  let accepted = null;
  while (Date.now() < deadline && !accepted) {
    await sleep(30000);
    const now = await node.appSpecification(spec.name);
    if (now && (!isUpdate || now.hash !== previous.hash)) accepted = now;
  }
  if (!accepted) throw new Error('message was not accepted within 45 minutes - check the txid above');
  log(`accepted at height ${accepted.height}, hash ${String(accepted.hash).slice(0, 12)}`);

  const wanted = formatted.instances;
  let reported = -1;
  const instDeadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < instDeadline) {
    const locations = await node.appLocations(spec.name);
    if (locations.length !== reported) {
      reported = locations.length;
      log(`${reported}/${wanted} instance(s) running${reported ? `: ${locations.map((l) => l.ip).join(', ')}` : ''}`);
    }
    if (reported >= wanted) break;
    await sleep(30000);
  }
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
