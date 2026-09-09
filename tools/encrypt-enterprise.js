#!/usr/bin/env node
/**
 * Builds the v8 "enterprise" blob and PROVES it is correct before you use it.
 *
 * Layout, read off enterpriseHelper.js:105 (decryptEnterpriseFromSession):
 *   base64( RSA(256 bytes)(AES-256 key) || nonce(12) || ciphertext || tag(16) )
 *
 * The RSA padding scheme lives in fluxbench (Rust), not in FluxOS, so rather
 * than guess it this tool tries each candidate and asks an ArcaneOS node to
 * decrypt the result via /apps/verifyappregistrationspecifications. A blob only
 * gets written after a node has actually decrypted and validated it - if none
 * of the candidates works, you get an error instead of an app nobody can run.
 *
 *   FLUX_WIF=<WIF> node tools/encrypt-enterprise.js specs/ownllm-small-api.register.json
 *
 * Writes the envelope back with "enterprise" filled in, reading the plaintext
 * from the matching specs/<name>.plaintext.json.
 */
const fs = require('fs');
const crypto = require('crypto');
const bitcoinMessage = require('bitcoinjs-message');
const { wifToPrivateKey, post, requireArcane } = require('./fluxclient');

const NODE = process.env.FLUX_NODE || 'https://162-55-245-240-16127.node.api.runonflux.io';
const WIF = process.env.FLUX_WIF;
const specPath = process.argv[2];

if (!specPath) throw new Error('usage: FLUX_WIF=... node tools/encrypt-enterprise.js <envelope.json>');
if (!WIF) throw new Error('FLUX_WIF is not set (WIF private key of the owner ZelID)');

const PADDINGS = [
  { name: 'OAEP-SHA256', opts: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' } },
  { name: 'OAEP-SHA1', opts: { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' } },
  { name: 'PKCS1v1.5', opts: { padding: crypto.constants.RSA_PKCS1_PADDING } },
];

function buildBlob(publicKey, plaintextJson, padding) {
  const aesKey = crypto.randomBytes(32);
  const encryptedKey = crypto.publicEncrypt({ key: publicKey, ...padding.opts }, aesKey);
  if (encryptedKey.length !== 256) {
    throw new Error(`expected a 256-byte RSA block (RSA-2048), got ${encryptedKey.length}`);
  }
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
  const body = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([encryptedKey, nonce, body, tag]).toString('base64');
}

(async () => {
  const envelope = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const ptPath = specPath.replace(/\.json$/, '.plaintext.json');
  const plaintext = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
  delete plaintext._comment;

  const { key, compressed } = wifToPrivateKey(WIF);
  const sign = (m) => bitcoinMessage.sign(m, key, compressed).toString('base64');

  await requireArcane(NODE);

  // getpublickey is a 'user'-privileged endpoint; the session is a self-made
  // login phrase (13-digit ms prefix, 40-70 chars) signed by the owner.
  const loginPhrase = `${Date.now()}${crypto.randomBytes(16).toString('hex')}`;
  const zelidauth = `zelid=${envelope.owner}&signature=${encodeURIComponent(sign(loginPhrase))}&loginPhrase=${loginPhrase}`;

  console.log(`requesting app public key for ${envelope.name} ...`);
  const publicKey = await post(NODE, '/apps/getpublickey', { owner: envelope.owner, name: envelope.name }, { zelidauth });

  const plaintextJson = JSON.stringify(plaintext);
  for (const padding of PADDINGS) {
    process.stdout.write(`  trying ${padding.name} ... `);
    let blob;
    try {
      blob = buildBlob(publicKey, plaintextJson, padding);
    } catch (err) {
      console.log(`cannot encrypt (${err.message})`);
      continue;
    }
    const candidate = { ...envelope, enterprise: blob };
    try {
      // The node decrypts this blob and validates what is inside. Success here
      // is proof the padding matches fluxbench - nothing else needs to be
      // assumed about a scheme that is not visible from this repo.
      await post(NODE, '/apps/verifyappregistrationspecifications', candidate);
      console.log('ACCEPTED - node decrypted and validated it');
      fs.writeFileSync(specPath, `${JSON.stringify(candidate, null, 2)}\n`);
      console.log(`\nwrote ${specPath} with the enterprise blob (${blob.length} chars)`);
      console.log('Next: FLUX_WIF=... node tools/register.js ' + specPath);
      return;
    } catch (err) {
      console.log(`rejected (${err.message})`);
    }
  }
  throw new Error('No padding scheme produced a blob the node could decrypt. Do not use this spec.');
})().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
