# Flux Decentralized Cloud API - FluxOS 8.18.0

Generated from the OpenAPI specification behind https://docs.runonflux.io/fluxapi. 492 operations in 14 groups. Each section below is self-contained.


## How to get the zelidauth header (ZelID authentication) <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/complete-authentication-flow>
FluxOS API calls that need a login send a zelidauth header. ZelID is an authentication system based on Bitcoin message signing and Ethereum personal sign. zelidauth header consist of stringified query of zelid, signature, loginPhrase Please refer to Authentication workflow section on how to obtain correct zelidauth header. An example of a header is `zelid=1CbErtneaX2QVyUfwU7JGB7VzvPgrgc3uC&signature=%2BZB3oSrsw6XkBxxlbwk33LEBJYvqtbMIm2kL9JzuoXMC6pSZd0lBHdnhJYzMTXv81zZQ7G%2FpkK1NvYN7cNF0GE%3D&loginPhrase=1574991374806spbcvsuwerl52tppx9dw5khuz8rew13mkq86gg8r2c`

Steps: 1. GET https://api.runonflux.io/id/loginphrase returns a login phrase. 2. Sign the phrase with the Flux ID (ZelID) - SSP Wallet, ZelCore, MetaMask personal_sign or WalletConnect. 3. POST https://api.runonflux.io/id/verifylogin with zelid, loginPhrase and signature. 4. Send zelidauth: zelid=<address>&signature=<signature>&loginPhrase=<phrase> on every authenticated call.

## Flux API Documentation <https://docs.runonflux.io/fluxapi/section/flux-api-documentation>
Flux API documentation: Flux API Documentation.

Welcome to the comprehensive API reference for **Flux**, the world's leading decentralized Web3 cloud computing platform. This documentation covers all available API endpoints for interacting with the Flux network, nodes, and decentralized applications.

## About Flux <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/about-flux>
Flux API documentation: About Flux.

**Flux** is a decentralized Web3 cloud infrastructure powered by globally distributed, user-operated nodes. Built for scalability and censorship resistance, Flux eliminates single points of failure while providing enterprise-grade computing resources for deploying and managing applications.

## Key Features <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/key-features>
Flux API documentation: Key Features.

- **🌐 Decentralized Infrastructure**: ~6,400 confirmed FluxNodes worldwide providing 52,000+ CPU cores, 170TB+ RAM and 3PB+ SSD storage across three tiers (Cumulus, Nimbus, Stratus)
- **⚡ High Performance**: Enterprise-grade computing with automatic placement, fault-domain spreading and high availability
- **🔐 Secure by Design**: Multiple authentication methods, enterprise app encryption and runtime tampering detection
- **💰 Cost Effective**: Competitive pricing compared to traditional cloud providers
- **🚀 Developer Friendly**: Docker-based deployments with comprehensive API support
- **🛡️ ArcaneOS**: Hardened, attested node operating system with hardware-backed key custody

*Network figures are a live snapshot; query `GET /daemon/getfluxnodecount` or
[stats.runonflux.io](https://stats.runonflux.io) for current totals.*

## API Architecture <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/api-architecture>
Flux API documentation: API Architecture.

The Flux API uses a **seven-level permission model** to ensure secure and controlled access. Every endpoint in this document ends its description with the level it requires:

| Permission Level | Description | Authentication Required |
|------------------|-------------|-------------------------|
| **Public** | Open access endpoints | ❌ No |
| **User** (`user`) | Any FluxID with a valid signature and a live session | ✅ Yes |
| **FluxTeam** (`fluxteam`) | Flux Team and Flux Support identities | ✅ Yes |
| **Admin** (`admin`) | The operator of *this* node (`initial.zelid` in its config) | ✅ Yes |
| **AdminAndFluxTeam** (`adminandfluxteam`) | Node operator **or** Flux Team | ✅ Yes |
| **AppOwner** (`appowner`) | The FluxID that registered the application | ✅ Yes |
| **AppOwnerAbove** (`appownerorfluxteam`) | Application owner **or** Flux Team | ✅ Yes |

Every privilege is a set of identities and asks whether the caller is one of
them — the compounds read **OR**, never AND. `admin` is a hardware role: the
node operator administers the machine and is *not* a party to a customer's
application, so app verbs (`appstart`, `appremove`, `appkill`, `redeploy`, …)
require **AppOwnerAbove** rather than Admin.

## Request Methods <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/request-methods>
Flux API documentation: Request Methods.

- **GET**: Most endpoints support GET requests with parameters as query strings or path variables
- **POST**: Used for endpoints requiring large payloads or sensitive data
- **WebSocket**: Used for real-time communication and simplified authentication flows

## Supported Wallet Authentication <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/supported-wallet-authentication>
Flux API documentation: Supported Wallet Authentication.

Flux supports multiple modern authentication methods for maximum flexibility and security:

## SSP Wallet <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/ssp-wallet>
Flux API documentation: SSP Wallet.

**Secure, Simple, Powerful** - The next-generation 2FA wallet with enterprise security:

- **True 2-of-2 Multi-Signature**: Requires both browser extension and mobile app authorization
- **Advanced Security**: BIP48 derivation, Account Abstraction (ERC-4337), Schnorr signatures
- **Multi-Chain Support**: Bitcoin, Ethereum, Polygon, BSC, Avalanche, and 15+ blockchains
- **WalletConnect v2**: Connect to thousands of dApps seamlessly
- **Professional Audit**: Thoroughly audited by security experts in 2025

**Installation**:
- Chrome Extension: [SSP Wallet - Chrome Web Store](https://chromewebstore.google.com/detail/ssp-wallet/mgfbabcnedcejkfibpafadgkhmkifhbd)
- Mobile App: Available on iOS App Store and Google Play Store
- Website: [sspwallet.io](https://sspwallet.io)

## ZelCore Wallet <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/zelcore-wallet>
Flux API documentation: ZelCore Wallet.

**Multi-Asset Cryptocurrency Wallet** - The original Flux ecosystem wallet:

- **Self-Custodial**: Full control over your private keys
- **Decentralized 2FA (d2FA)**: Unique blockchain-based two-factor authentication
- **Multi-Chain**: Support for 80+ blockchains and thousands of assets
- **Hardware Integration**: Connect with hardware wallets for enhanced security
- **Deep Linking**: Native `zel:` protocol support

**Installation**: [zelcore.io](https://zelcore.io)

## MetaMask Integration <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/metamask-integration>
Flux API documentation: MetaMask Integration.

**Ethereum Ecosystem Wallet** - Popular browser extension wallet:

- **Ethereum Native**: Full Ethereum and EVM chain support
- **Sign-In with Ethereum (SIWE)**: ERC-4361 standard compliance
- **Wide Adoption**: Most popular Web3 wallet with extensive dApp support
- **Domain Binding**: Advanced phishing protection

**Installation**: [metamask.io](https://metamask.io)

## WalletConnect v2 <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/walletconnect-v2>
Flux API documentation: WalletConnect v2.

**Universal Wallet Connection Protocol** - Connect any compatible wallet:

- **700+ Wallets**: Support for hundreds of popular wallets
- **Cross-Platform**: Mobile, desktop, and web wallet compatibility
- **Secure Bridge**: Encrypted communication between wallet and dApp
- **QR Code Connection**: Simple mobile wallet connection

## Traditional Authentication <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/traditional-authentication>
Flux API documentation: Traditional Authentication.

**Email-Based Login** - For users preferring traditional authentication:

- **Firebase Integration**: Google Firebase authentication backend
- **Email/Password**: Standard username/password login
- **Google OAuth**: Sign in with Google account
- **Account Recovery**: Standard password reset flows

## Getting Started <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/getting-started>
Flux API documentation: Getting Started.

Follow these steps to start using the Flux API:

## 1. Choose Your Authentication Method <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/1.-choose-your-authentication-method>
Flux API documentation: 1. Choose Your Authentication Method.

Select from the supported wallet options above based on your development needs and user preferences. All methods are supported by the FluxOS API.

## 2. Set Up Your Wallet <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/2.-set-up-your-wallet>
Flux API documentation: 2. Set Up Your Wallet.

Install and configure your chosen wallet:
- Download from official sources only
- Secure your seed phrase or recovery information
- Enable two-factor authentication where available
- Test with small amounts first

## 3. Obtain Authentication Credentials <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/3.-obtain-authentication-credentials>
Flux API documentation: 3. Obtain Authentication Credentials.

Follow the **Authentication** section in this API documentation to:
- Generate login phrases
- Sign authentication messages
- Obtain session tokens
- Set up API headers

## 4. Configure API Headers <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/4.-configure-api-headers>
Flux API documentation: 4. Configure API Headers.

Authenticated requests carry a single `zelidauth` header. It is a
**URL-encoded query string**, not JSON:

```
zelidauth: zelid=<address>&signature=<urlencoded-signature>&loginPhrase=<phrase>
```

A complete example:

```
zelidauth: zelid=1CbErtneaX2QVyUfwU7JGB7VzvPgrgc3uC&signature=H%2BZB3oSrsw6XkBxxlbwk33LEBJYvqtbMIm2kL9JzuoXMC6pSZd0lBHdnhJYzMTXv81zZQ7G%2FpkK1NvYN7cNF0GE%3D&loginPhrase=1574991374806spbcvsuwerl52tppx9dw5khuz8rew13mkq86gg8r2c
```

**Signatures are base64 and routinely contain `+`, `/` and `=`** — all three
change meaning inside a query string, so the signature must be URL-encoded or
the request will be refused as unauthentic.

## 5. Start Making API Calls <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/5.-start-making-api-calls>
Flux API documentation: 5. Start Making API Calls.

Test your setup with public endpoints first, then proceed to authenticated endpoints once your credentials are properly configured.

## Support & Community <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/support-and-community>
Flux API documentation: Support & Community.

- **Documentation**: [docs.runonflux.com](https://docs.runonflux.com)
- **Discord Community**: [discord.gg/runonflux](https://discord.gg/runonflux)
- **GitHub**: [github.com/RunOnFlux](https://github.com/RunOnFlux)
- **Twitter/X**: [@RunOnFlux](https://x.com/runonflux)
- **Website**: [runonflux.com](https://runonflux.com)


---


FluxOS is free software published under the GNU AGPLv3. Flux, FluxOS,
FluxNode and ArcaneOS are projects of **InFlux Technologies USA LLC**.
© 2026 InFlux Technologies USA LLC.


**🚀 Ready to build on the decentralized web? Let's get started!**

## Important Notes <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/important-notes>
Flux API documentation: Important Notes.

- Login phrases expire after 15 minutes
- Session tokens are valid for up to 14 days
- Always use HTTPS in production environments
- Signature values must be URL-encoded inside the `zelidauth` header

## Response Envelope & Error Handling (part 1 of 2) <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/response-envelope-and-error-handling>
Flux API documentation: Response Envelope & Error Handling.

**This is the single most important thing to know about the Flux API.**

A request that reaches a handler is answered **at HTTP 200**, in the body —
*including when the answer is a failure*:

```json
{ "status": "success", "data": { ... } }
{ "status": "error",   "data": { "code": 401, "name": "Unauthorized", "message": "..." } }
```

The `code` inside an error body is a **FluxOS code, not a wire status**. A
removed endpoint answers HTTP 200 with `data.code: 410`; an unauthorised call
answers HTTP 200 with `data.code: 401`. A client that branches on
`response.ok` or `response.status` will read every one of these as a success.

```javascript
const res = await fetch(url, { headers: { zelidauth } });
const body = await res.json();
if (body.status !== 'success') {      // <- the check that matters
  throw new Error(body.data?.message ?? 'Flux API error');
}
```

The in-band shape exists so that a transport failure cannot impersonate a
service answer. Wire statuses are therefore reserved for refusals that happen
**before** a handler runs, and for a handful of endpoints that deliberately
speak HTTP semantics:

## Response Envelope & Error Handling (part 2 of 2) <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/response-envelope-and-error-handling>
Flux API documentation: Response Envelope & Error Handling.

| Status | Where it comes from |
|--------|---------------------|
| `403` | `requireHttps` — an ArcaneOS endpoint reached over plain HTTP |
| `503` / `400` | route guards — the node has not finished booting, or query parameters were sent to a route that rejects them |
| `413` | a request body too large to accept |
| `404` | a resource that does not exist to be addressed (an unknown operation id, a stream that is not enabled) |
| `202` | an endpoint that started long-running work — see below |

Endpoints that use wire statuses say so in their own `responses` section.
Everything else answers 200 and puts the outcome in `status`.

## Long-Running Operations <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/long-running-operations>
Flux API documentation: Long-Running Operations.

Work whose duration scales with the data — copying, compressing or extracting
inside an application volume — does not block the request. It answers
**`202 Accepted`** with a `jobId`, a `Location` header pointing at the status
resource and a `Retry-After` header:

```json
{ "status": "success",
  "data": { "jobId": "op_2f8f...", "statusUrl": "/apps/operations/op_2f8f...", "status": "Running" } }
```

Poll `GET /apps/operations/{jobId}` until `data.status` reaches a terminal
value. **Completion is read from that field, never from the HTTP code** — a
failed operation is still a successful poll.

| `status` | Meaning |
|----------|---------|
| `Running` | still working; respect `Retry-After` |
| `Succeeded` | finished |
| `Failed` | the work could not be done — `error` carries an RFC 9457 problem object |
| `Canceled` | the caller asked for it via `DELETE /apps/operations/{jobId}` |
| `Evicted` | the node took the work away — neither the caller's request nor their input was at fault |

Cancellation is **best effort**: the flag is raised and the worker stops at
its next checkpoint, so `status` stays `Running` until it does.

Unknown, expired and not-yours are one answer (`404`) — a `jobId` must not
reveal whether someone else has an operation running.

## Node-Scoped vs Network-Scoped Calls <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/node-scoped-vs-network-scoped-calls>
Flux API documentation: Node-Scoped vs Network-Scoped Calls.

Every endpoint in this specification is served by **an individual FluxNode**.
The `https://api.runonflux.io` gateway load-balances across confirmed nodes,
so it is the right target for network-wide data (blockchain state, global
application specifications, node lists) and the wrong target for anything
that reports or changes the state of one machine.

Call a specific node directly — `https://<node-ip>:16127` — for:

- node status, benchmark, tier, DOS state, clock drift, peers, topology
- the applications installed *on that node*, their logs, monitoring and volumes
- anything marked **Admin** or **AdminAndFluxTeam**, which is authorised
  against *that node's* operator FluxID
- the FluxShare, Syncthing, backup/restore and volume-browser surfaces

Node API calls are **not rate-limited by FluxOS itself**. The public gateway
may apply its own limits.

## Deprecated & Removed Endpoints <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/deprecated-and-removed-endpoints>
Flux API documentation: Deprecated & Removed Endpoints.

Endpoints marked `deprecated` in this document still work; endpoints
described as **Removed** answer an error body with `code: 410`.

| Kind | Endpoints |
|------|-----------|
| **Removed** (answer `code: 410`) | `/apps/apppause`, `/apps/appunpause`, `/apps/appmonitorstream`, `/apps/startmonitoring`, `/apps/stopmonitoring` |
| **Deleted** (no longer routed) | `/flux/cruxid`, `/flux/adjustcruxid`, `/flux/rebuildhome`, `/explorer/fluxtxs`, `/apps/installtemporarylocalapp`, `POST /apps/fluxshare/upload` |
| **Renamed** | `POST /apps/fluxshare/upload` → `POST /apps/fluxshare/uploadfile`; `/flux/rebuildhome` → `/flux/rebuildui`; `POST /syncthing/system/error/clear` → `GET` |
| **Aliases** | every `/zelid/*` route aliases the matching `/id/*` route; every `/daemon/*zelnode*` route aliases its `*fluxnode*` counterpart; `/flux/zelid` aliases `/flux/id`; `/benchmark/signzelnodetransaction` aliases `/benchmark/signfluxnodetransaction`; `/flux/broadcastmessageto{outgoing,incoming}` both delegate to `/flux/broadcastmessage` |

## Complete Authentication Flow <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/complete-authentication-flow>
Flux API documentation: Complete Authentication Flow.

**Step 1: Get Login Phrase**
```bash
curl -X GET "https://api.runonflux.io/id/loginphrase"
```

**Step 2: Sign the Login Phrase**
- **SSP Wallet**: Use browser extension + mobile app to sign the message
- **ZelCore**: Use the wallet's message signing feature  
- **MetaMask**: Use `personal_sign` method
- **Hardware Wallet**: Sign via hardware device integration

**Step 3: Verify Login** 
```bash
curl -X POST "https://api.runonflux.io/id/verifylogin" \
  -H "Content-Type: application/json" \
  -d '{
    "zelid": "your-wallet-address",
    "loginPhrase": "phrase-from-step-1", 
    "signature": "your-signature-from-step-2"
  }'
```

**Step 4: Use Authentication Header**
```bash
curl -X GET "https://api.runonflux.io/id/loggedsessions" \
  -H "zelidauth: zelid=your-address&signature=your-signature&loginPhrase=your-phrase"
```

## SSP Wallet Integration Guide <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/ssp-wallet-integration-guide>
Flux API documentation: SSP Wallet Integration Guide.

**Browser Extension Setup:**
1. Install SSP Wallet Chrome Extension
2. Install SSP Key mobile app (iOS/Android)
3. Pair devices using QR code
4. Fund wallet with small amount for testing

**Signing Messages with SSP:**
```javascript
// Connect to SSP Wallet
if (window.ssp) {
  const accounts = await window.ssp.request({
    method: 'wallet_requestPermissions',
    params: [{ wallet_accounts: {} }]
  });
  
  // Sign login phrase
  const signature = await window.ssp.request({
    method: 'personal_sign',
    params: [loginPhrase, accounts[0]]
  });
}
```

## MetaMask Integration Guide <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/metamask-integration-guide>
Flux API documentation: MetaMask Integration Guide.

**Connect and Sign:**
```javascript
// Connect MetaMask
const accounts = await ethereum.request({
  method: 'eth_requestAccounts'
});

// Sign login phrase
const signature = await ethereum.request({
  method: 'personal_sign',
  params: [loginPhrase, accounts[0]]
});

// Use Ethereum address as zelid
const zelid = accounts[0];
```

## ZelCore Wallet Integration <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/zelcore-wallet-integration>
Flux API documentation: ZelCore Wallet Integration.

**Deep Link Integration:**
```javascript
// Generate ZelCore deep link for signing
const zelcoreUrl = `zel:?action=sign&message=${encodeURIComponent(loginPhrase)}&icon=https://yourapp.com/icon.png&callback=${encodeURIComponent('https://yourapp.com/auth/callback')}`;

// Open ZelCore for signing
window.location.href = zelcoreUrl;
```

**WebSocket Integration:**
```javascript
// Listen for ZelCore signature via WebSocket
const ws = new WebSocket(`wss://api.runonflux.io/ws/id/${loginPhrase}`);

ws.onmessage = (event) => {
  const authData = JSON.parse(event.data);
  if (authData.status === 'success') {
    // Authentication successful
    console.log('Signed in with ZelID:', authData.data.zelid);
  }
};
```

## WalletConnect v2 Integration <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/walletconnect-v2-integration>
Flux API documentation: WalletConnect v2 Integration.

**Setup WalletConnect:**
```javascript
import { SignClient } from '@walletconnect/sign-client';

const signClient = await SignClient.init({
  projectId: 'your-walletconnect-project-id',
  metadata: {
    name: 'Your Flux App',
    description: 'Flux Network Integration',
    url: 'https://yourapp.com',
    icons: ['https://yourapp.com/logo.png']
  }
});

// Connect to wallet
const { uri, approval } = await signClient.connect({
  requiredNamespaces: {
    eip155: {
      methods: ['personal_sign'],
      chains: ['eip155:1'],
      events: ['chainChanged', 'accountsChanged']
    }
  }
});

// Sign message when connected
const signature = await signClient.request({
  topic: session.topic,
  chainId: 'eip155:1',
  request: {
    method: 'personal_sign',
    params: [loginPhrase, address]
  }
});
```

## Traditional Email Authentication <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/traditional-email-authentication>
Flux API documentation: Traditional Email Authentication.

**Firebase Integration:**
```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Email/password login
const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);

// Get ID token for API authentication
const idToken = await userCredential.user.getIdToken();

// Use token in API calls
fetch('https://api.runonflux.io/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

## Common Integration Issues <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/common-integration-issues>
Flux API documentation: Common Integration Issues.

**Login Phrase Expiration:**
```javascript
// Always check phrase timestamp
const phraseTimestamp = parseInt(loginPhrase.substring(0, 13));
const now = Date.now();
const age = now - phraseTimestamp;

if (age > 15 * 60 * 1000) { // 15 minutes
  throw new Error('Login phrase expired, get a new one');
}
```

**Signature URL Encoding:**
```javascript
// Always URL encode signatures for headers
const encodedSignature = encodeURIComponent(signature);
const authHeader = `zelid=${zelid}&signature=${encodedSignature}&loginPhrase=${loginPhrase}`;
```

**Error Handling:**
```javascript
try {
  const response = await fetch('/api/authenticated-endpoint', {
    headers: { 'zelidauth': authHeader }
  });
  
  if (response.status === 401) {
    // Re-authenticate user
    redirectToLogin();
  }
} catch (error) {
  console.error('API call failed:', error);
}
```

## API Version Information (part 1 of 2) <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/api-version-information>
Flux API documentation: API Version Information.

**Current Version**: 8.18.0

**Version Notes**:
- All endpoints documented in this specification are available in FluxOS **8.18.0**
- This documentation reflects the current stable API implementation and is generated against `ZelBack/src/routes.js` of the [Flux repository](https://github.com/runonflux/flux)
- For the latest changes and updates, refer to the [Flux GitHub repository](https://github.com/runonflux/flux)

**Notable changes since 6.6.x**

## API Version Information (part 2 of 2) <https://docs.runonflux.io/fluxapi/section/flux-api-documentation/api-version-information>
Flux API documentation: API Version Information.

| Area | What changed |
|------|--------------|
| **Long-running operations** | Volume and file operations no longer block the request. They return a `jobId`; poll `GET /apps/operations/{jobId}` and cancel with `DELETE /apps/operations/{jobId}`. |
| **Volume file management** | `POST /apps/moveobject`, `/apps/copyobject`, `/apps/compressobject` and `/apps/extractobject` operate inside an application's persistent volume. |
| **Placement** | `POST /apps/placementfeasibility` answers whether a prospective specification can be placed, and `GET /apps/placementlocations` publishes the live node/fault-domain/tier geography. |
| **Network observability** | `GET /flux/topology`, `/flux/networkhealth`, `/flux/peerhistory`, `/flux/unstablenodes`, `/flux/peers` and the SSE `GET /flux/eventstream`. |
| **Tampering detection** | `GET /apps/tamperingevents` reports containers whose running image no longer matches the registered specification. |
| **ArcaneOS** | `GET /arcane/authchallenge` and `POST /arcane/configsync` for hardware-attested node configuration. Available only on ArcaneOS nodes. |
| **Syncthing** | Metrics, health summary, metrics history and peer sync diagnostics endpoints, plus the full configuration write surface. |
| **Deprecations** | Every `/zelid/*` route is a deprecated alias of the matching `/id/*` route, and every `/daemon/*zelnode*` route a deprecated alias of its `*fluxnode*` counterpart. `/flux/cruxid`, `/flux/adjustcruxid`, `/flux/rebuildhome`, `/explorer/fluxtxs` and `/apps/installtemporarylocalapp` were removed; `POST /apps/fluxshare/upload` is now `POST /a…

## Authentication endpoints <https://docs.runonflux.io/fluxapi/authentication>
FluxOS API Authentication group: 4 endpoints. **Authentication & Authorization Endpoints** Essential API endpoints for secure authentication and authorization with the Flux network. These endpoints handle login phrase generation, message signing verification, and session management for all supported wallet types including SSP Wallet, ZelCore, MetaMask, and WalletConnect integrations. **Key Features:** - Multi-wallet authentication support - Secure login phrase generation - Cryptographic signature verification - Session token management - 5-tier permission system integration
- GET /id/loginphrase - Obtain login phrase (public)
- POST /id/verifylogin - Login into Flux (public)
- POST /id/providesign - Provide Signature (public)
- POST /id/logoutspecificsession - Logs out a specific session

## ID endpoints (part 1 of 2) <https://docs.runonflux.io/fluxapi/id>
FluxOS API ID group: 20 endpoints. **Identity & User Management** Comprehensive identity management endpoints that handle user authentication, authorization levels, and identity verification across multiple blockchain addresses (Bitcoin P2PKH, Ethereum, ZelID). These endpoints manage user sessions, permissions, and access control throughout the Flux ecosystem. **Supported Address Types:** - Bitcoin P2PKH addresses - Ethereum addresses - ZelID addresses - Multi-signature addresses
- GET /id/emergencyphrase - Obtain emergency login phrase (public)
- GET /id/loggedsessions - Obtain all logged sessions of ZelID.
- GET /id/logoutcurrentsession - Logs out current session
- GET /id/logoutallsessions - Logs out all sessions
- GET /id/loggedusers - Gets information about logged users
- GET /id/activeloginphrases - Lists active login phrases
- GET /id/logoutallusers - Logs out all users
- POST /id/checkprivilege - Checks the privilege level of user (public)
- GET /zelid/loginphrase - Obtain login phrase (deprecated) (public)
- GET /zelid/emergencyphrase - Obtain emergency login phrase (deprecated) (public)
- GET /zelid/loggedsessions - Obtain all logged sessions of a FluxID (deprecated)
- GET /zelid/loggedusers - Gets information about logged users (deprecated)
- GET /zelid/activeloginphrases - Lists active login phrases (deprecated)
- GET /zelid/logoutcurrentsession - Logs out current session (deprecated)
- GET /zelid/logoutallsessions - Logs out all sessions (deprecated)
- GET /zelid/logoutallusers - Logs out all users (deprecated)
- POST /zelid/verifylogin - Login into Flux (deprecated) (public)

## ID endpoints (part 2 of 2) <https://docs.runonflux.io/fluxapi/id>
FluxOS API ID group: 20 endpoints.
- POST /zelid/providesign - Provide signature (deprecated) (public)
- POST /zelid/checkprivilege - Checks the privilege level of a user (deprecated) (public)
- POST /zelid/logoutspecificsession - Logs out a specific session (deprecated)

## Daemon endpoints (part 1 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints. **Flux Daemon Operations** Core blockchain daemon endpoints for interacting with the underlying Flux blockchain node. These endpoints provide access to blockchain data, wallet operations, mining information, network statistics, and node management functions. Essential for node operators and developers building blockchain-integrated applications. **Core Functions:** - Blockchain state queries - Transaction management - Wallet operations - Network information - Mining and staking operations
- GET /daemon/help - RPC list (public)
- GET /daemon/getinfo - Flux daemon info (public)
- GET /daemon/getfluxnodestatus - Flux node status (public)
- GET /daemon/listfluxnodes - Flux node list (public)
- GET /daemon/viewdeterministicfluxnodelist - Deterministic FluxNode list (public)
- GET /daemon/getfluxnodecount - Flux node count (public)
- GET /daemon/getdoslist - FluxNode DOS list (public)
- GET /daemon/getstartlist - FluxNode start list (public)
- GET /daemon/fluxnodecurrentwinner - Current list of winners (public)
- GET /daemon/getbestblockhash - Block hash of tip on longest chain (public)
- GET /daemon/getblock - Get block data (public)
- GET /daemon/getblockchaininfo - Blockchain info (public)
- GET /daemon/getblockcount - Current block count (public)
- GET /daemon/getblockdeltas - Get block deltas data (public)
- GET /daemon/getblockhash - Get block's hash (public)
- GET /daemon/getblockheader - Block header info (public)
- GET /daemon/getchaintips - List of known chain tips (public)
- GET /daemon/getdifficulty - Proof of work difficulty (public)
- GET /daemon/getmempoolinfo - Memory pool info (public)

## Daemon endpoints (part 2 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- GET /daemon/getrawmempool - Transaction ids in memory pool (public)
- GET /daemon/gettxout - Transaction IDs in memory pool (public)
- GET /daemon/gettxoutproof - Hex-encoded proof of transaction (public)
- GET /daemon/gettxoutsetinfo - Unspent transaction output set info (public)
- GET /daemon/verifytxoutproof - Verifies a proof (public)
- GET /daemon/getspentinfo - Return spent info (public)
- POST /daemon/getspentinfo - Return spent info, POST (public)
- GET /daemon/getblocksubsidy - Block reward (public)
- GET /daemon/getblocktemplate - Data to construct a block (public)
- GET /daemon/getlocalsolps - Average solutions per second (public)
- GET /daemon/getmininginfo - Mining related info (public)
- GET /daemon/getnetworkhashps - Estimated network solutions (public)
- GET /daemon/getnetworksolps - Estimated network solutions (public)
- GET /daemon/getconnectioncount - Connection count (public)
- GET /daemon/getdeprecationinfo - Deprecation info (public)
- GET /daemon/getnettotals - Network traffic info (public)
- GET /daemon/getnetworkinfo - Info regarding P2P network (public)
- GET /daemon/getpeerinfo - Peer info (public)
- GET /daemon/listbanned - Ban list (public)
- GET /daemon/createrawtransaction - Create raw transaction (GET) (public)
- POST /daemon/createrawtransaction - Create hex-encoded raw transaction (public)
- GET /daemon/decoderawtransaction - Decoded info of the hex-encoded transaction (public)
- POST /daemon/decoderawtransaction - Decoded info of the hex-encoded transaction (public)
- GET /daemon/decodescript - Decode hex script (public)
- POST /daemon/decodescript - Decode hex script (public)

## Daemon endpoints (part 3 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- GET /daemon/getrawtransaction - Get raw transaction data (public)
- GET /daemon/fundrawtransaction - Add inputs to a transaction (public)
- POST /daemon/fundrawtransaction - Add inputs to a transaction (public)
- GET /daemon/sendrawtransaction - Send raw transaction (public)
- POST /daemon/sendrawtransaction - Send raw transaction (public)
- GET /daemon/createmultisig - Create multi-sig address (public)
- POST /daemon/createmultisig - Create multi-sig address (public)
- GET /daemon/estimatefee - Estimate fee nblocks (public)
- GET /daemon/estimatepriority - Estimate priority nblocks (public)
- GET /daemon/validateaddress - Info of the Flux address (public)
- GET /daemon/verifymessage - Verify a message (public)
- POST /daemon/verifymessage - Verify a message (public)
- GET /daemon/gettransaction - Information about in-wallet transaction (public)
- GET /daemon/zvalidateaddress - Information about given z address (public)
- GET /daemon/getbenchmarks - Benchmark results (public)
- GET /daemon/getbenchstatus - Bench status (public)
- GET /daemon/getblockhashes - Get block hashes (public)
- POST /daemon/getblockhashes - Get block hashes (POST) (public)
- GET /daemon/getaddresstxids - Get address transaction IDs (public)
- POST /daemon/getaddresstxids - Get address transaction IDs (POST) (public)
- GET /daemon/getaddressbalance - Get address balance (public)
- POST /daemon/getaddressbalance - Get address balance (POST) (public)
- GET /daemon/getaddressdeltas - Get address deltas (public)
- POST /daemon/getaddressdeltas - Get address deltas (POST) (public)
- GET /daemon/getaddressutxos - Get address UTXOs (public)

## Daemon endpoints (part 4 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- POST /daemon/getaddressutxos - Get address UTXOs (POST) (public)
- GET /daemon/getaddressmempool - Get address mempool transactions (public)
- POST /daemon/getaddressmempool - Get address mempool (POST) (public)
- GET /daemon/sendfrom - Send from account
- POST /daemon/sendfrom - Send from account (POST)
- GET /daemon/submitblock - Submit block
- POST /daemon/submitblock - Submit block (POST)
- GET /daemon/zcrawjoinsplit - ZCash raw joinsplit
- POST /daemon/zcrawjoinsplit - ZCash raw joinsplit (POST)
- GET /daemon/zcrawreceive - ZCash raw receive
- POST /daemon/zcrawreceive - ZCash raw receive (POST)
- GET /daemon/prioritisetransaction - Priortise a transaction
- GET /daemon/reindex - Reindex Flux daemon
- GET /daemon/stop - Stop Flux daemon
- GET /daemon/createfluxnodekey - Create fluxnode private key
- GET /daemon/listfluxnodeconf - The fluxnode conf file
- GET /daemon/getfluxnodeoutputs - Fluxnode transaction outputs
- GET /daemon/startfluxnode - Start FluxNode commmand
- GET /daemon/startdeterministicfluxnode - Start fluxnode command
- GET /daemon/verifychain - Verify blockchain data
- GET /daemon/addnode - Add, remove, or try to connect a node
- GET /daemon/clearbanned - Clear banned IP's
- GET /daemon/disconnectnode - Disconnect a node
- GET /daemon/getaddednodeinfo - Info of added node/nodes
- GET /daemon/setban - Add or remove a IP from banned list
- GET /daemon/signrawtransaction - Sign raw transaction
- POST /daemon/signrawtransaction - Sign raw transaction
- GET /daemon/addmultisigaddress - Add multisig address to the wallet
- POST /daemon/addmultisigaddress - Add multisig address to the wallet

## Daemon endpoints (part 5 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- GET /daemon/backupwallet - Backup wallet to destination file
- GET /daemon/dumpprivkey - Get private key of a t-addr
- GET /daemon/getbalance - Total balance of wallet
- GET /daemon/getnewaddress - Get new address
- GET /daemon/getrawchangeaddress - Get new change address
- GET /daemon/getreceivedbyaddress - Total received by the address
- GET /daemon/getunconfirmedbalance - Get total unconfirmed balance
- GET /daemon/getwalletinfo - Get various info of the wallet
- GET /daemon/importaddress - Import address to watch
- GET /daemon/importprivkey - Import private key to the wallet
- GET /daemon/importwallet - Import private keys from the dump file
- GET /daemon/keypoolrefill - Refill keypool
- GET /daemon/listaddressgroupings - A list of addresses that have been used and known to the public
- GET /daemon/listlockunspent - List of unspendable outputs
- GET /daemon/listreceivedbyaddress - List of balances
- GET /daemon/listsinceblock - List of transactions since block (blockhash)
- GET /daemon/listtransactions - List of recent transactions
- GET /daemon/listunspent - Returns objects of unspent transactions
- GET /daemon/lockunspent - Updates list of temporarily unspendable outputs
- GET /daemon/rescanblockchain - Rescans blockchain for transactions
- GET /daemon/sendmany - Send to many receivers at once
- POST /daemon/sendmany - Send to many receivers at once
- GET /daemon/sendtoaddress - Send Flux to an address
- POST /daemon/sendtoaddress - Send Flux to an address
- GET /daemon/settxfee - Set transaction fee
- GET /daemon/signmessage - Sign a message
- POST /daemon/signmessage - Sign a message

## Daemon endpoints (part 6 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- GET /daemon/zexportkey - Reveal z-addr private key
- GET /daemon/zexportviewingkey - Reveal z-addr viewing key
- GET /daemon/zgetbalance - Returns the balance of a taddr or zaddr
- GET /daemon/zgetmigrationstatus - Returns status info of the sprout to sapling migration
- GET /daemon/zgetnewaddress - Create new shielded address
- GET /daemon/zgetoperationresult - Get operation result
- GET /daemon/zgetoperationstatus - Get operation status
- GET /daemon/zgettotalbalance - Get total balance of wallet
- GET /daemon/zimportkey - Import zaddress private key
- GET /daemon/zimportviewingkey - Import zaddress viewing key
- GET /daemon/zimportwallet - Import wallet from export file
- GET /daemon/zlistaddresses - Get list of all shielded addresses
- GET /daemon/zlistoperationids - Get list of operation ids
- GET /daemon/zlistreceivedbyaddress - List of amounts received by zaddr
- GET /daemon/zlistunspent - List of unspent shielded notes
- GET /daemon/zsendmany - Send multiple transactions
- POST /daemon/zsendmany - Send multiple transactions
- GET /daemon/zsetmigration - Migrate funds to a sapling adress
- GET /daemon/zshieldcoinbase - Shield coinbase
- GET /daemon/start - Start Flux daemon
- GET /daemon/restart - Restart Flux daemon
- GET /daemon/ping - Ping request to measure ping time
- GET /daemon/zcbenchmark - Run benchmark of selected type and samplecount times
- GET /daemon/startbenchmark - Start Benchmark daemon
- GET /daemon/stopbenchmark - Stop Benchmark daemon
- GET /daemon/zcrawkeygen - Generate a zcaddress key pair
- GET /daemon/zcsamplejoinsplit - Perform a sample JoinSplit

## Daemon endpoints (part 7 of 7) <https://docs.runonflux.io/fluxapi/daemon>
FluxOS API Daemon group: 162 endpoints.
- GET /daemon/zmergetoaddress - Merge multiple UTXOs and notes into one address
- GET /daemon/createzelnodekey - Create fluxnode private key (deprecated)
- GET /daemon/getzelnodecount - Flux node count (deprecated) (public)
- GET /daemon/getzelnodeoutputs - Fluxnode transaction outputs (deprecated)
- GET /daemon/getzelnodestatus - Flux node status (deprecated) (public)
- GET /daemon/listzelnodeconf - The fluxnode conf file (deprecated)
- GET /daemon/listzelnodes - Flux node list (deprecated) (public)
- GET /daemon/startdeterministiczelnode - Start fluxnode command (deprecated)
- GET /daemon/startzelnode - Start FluxNode command (deprecated)
- GET /daemon/viewdeterministiczelnodelist - Deterministic FluxNode list (deprecated) (public)

## Benchmark endpoints <https://docs.runonflux.io/fluxapi/benchmark>
FluxOS API Benchmark group: 13 endpoints. **Node Performance & Benchmarking** Endpoints for monitoring and managing Flux node performance benchmarks. These APIs provide access to hardware specifications, performance metrics, benchmark results, and node tier qualification status. Critical for node operators to ensure optimal performance and maintain network participation requirements. **Monitoring Capabilities:** - Hardware specification reporting - Performance benchmark execution - Node tier status verification - Resource utilization metrics - Network connectivity testing
- GET /benchmark/getstatus - Fluxbench status (public)
- GET /benchmark/help - Fluxbench calls (public)
- GET /benchmark/getbenchmarks - Benchmark results (public)
- GET /benchmark/getinfo - Fluxbench status (public)
- GET /benchmark/restartnodebenchmarks - Restart FluxBench daemon
- GET /benchmark/stop - Stop fluxbench daemon
- GET /benchmark/signfluxnodetransaction - Sign FluxNode transaction
- POST /benchmark/signfluxnodetransaction - Sign FluxNode transaction
- GET /benchmark/getstoredbenchmark - Last stored benchmark result (public)
- GET /benchmark/start - Start the benchmark daemon
- GET /benchmark/restart - Restart the benchmark daemon
- GET /benchmark/signzelnodetransaction - Sign a FluxNode transaction (deprecated)
- POST /benchmark/signzelnodetransaction - Sign a FluxNode transaction, POST (deprecated)

## Flux endpoints (part 1 of 4) <https://docs.runonflux.io/fluxapi/flux>
FluxOS API Flux group: 95 endpoints. **Flux Network Operations** Core network endpoints for interacting with the broader Flux decentralized network. These APIs provide access to network statistics, node information, consensus data, and network-wide operations that facilitate the decentralized cloud infrastructure. **Network Services:** - Node discovery and registry - Network consensus information - Global network statistics - Peer-to-peer communication - Distributed coordination
- GET /flux/startdaemon - Starts Flux daemon
- GET /flux/restartdaemon - Restarts Flux daemon
- GET /flux/entermaster - Switch to master branch of FluxOS
- GET /flux/enterdevelopment - Switch to development branch of FluxOS
- GET /flux/reindexdaemon - Reindexes Flux daemon
- GET /flux/updateflux - Updates Flux to the latest version
- GET /flux/hardupdateflux - Perform hard update to the latest version
- GET /flux/updatedaemon - Updates Flux daemon
- GET /flux/updatebenchmark - Updates Benchmark daemon
- GET /flux/daemondebug - Returns with the Flux debug log
- GET /flux/benchmarkdebug - Returns with the Benchmark debug log
- GET /flux/taildaemondebug - Returns last lines of Flux debug log
- GET /flux/tailbenchmarkdebug - Returns last lines of Benchmark debug log
- GET /flux/errorlog - Returns with the Flux error log
- GET /flux/tailerrorlog - Returns last lines of Flux error log
- GET /flux/nodetier - Node Tier (public)
- GET /flux/info - Combined info (public)
- GET /flux/timezone - Flux timezone (public)
- GET /flux/version - Gets version of Flux (public)
- GET /flux/ip - Flux IP (public)
- GET /flux/staticip - Flux static IP status (public)

## Flux endpoints (part 2 of 4) <https://docs.runonflux.io/fluxapi/flux>
FluxOS API Flux group: 95 endpoints.
- GET /flux/geolocation - Geolocation info (public)
- GET /flux/id - Admin's ZelID (public)
- GET /flux/pgp - PGP identity (public)
- GET /flux/kadena - Kadena Info (public)
- GET /flux/dosstate - DOS state (public)
- POST /flux/dosstate - Set the DOS state (test builds only)
- GET /flux/connectedpeers - Gets IP's of connected peers (public)
- GET /flux/connectedpeersinfo - Gets info of connected peers (public)
- GET /flux/incomingconnections - List of incoming connections (public)
- GET /flux/incomingconnectionsinfo - Gets info of incoming connections (public)
- GET /flux/checkfluxavailability - Check availability of Flux (public)
- GET /flux/checkcommunication - Check incoming/outgoing peers (public)
- GET /flux/uptime - FluxOS uptime (public)
- GET /flux/broadcastmessage - Broadcast message to peers
- POST /flux/broadcastmessage - Broadcast message to peers
- GET /flux/broadcastmessagetooutgoing - Broadcast message to outgoing peers
- POST /flux/broadcastmessagetooutgoing - Broadcast message to outgoing peers
- GET /flux/broadcastmessagetoincoming - Broadcast message to incoming peers
- POST /flux/broadcastmessagetoincoming - Broadcast message to incoming peers
- GET /flux/addpeer - Add peer option
- GET /flux/removepeer - Remove peer option
- GET /flux/removeincomingpeer - Remove incoming peer
- GET /flux/allowport - Open port on server
- GET /flux/adjustkadena - Adjust Kadena Account
- GET /flux/startbenchmark - Start Benchmark
- GET /flux/restartbenchmark - Restart Benchmark
- GET /flux/softupdateflux - Soft Update Flux
- GET /flux/softupdatefluxinstall - Install Flux
- GET /flux/warnlog - Warning Log

## Flux endpoints (part 3 of 4) <https://docs.runonflux.io/fluxapi/flux>
FluxOS API Flux group: 95 endpoints.
- GET /flux/debuglog - Debug Log
- GET /flux/infolog - Info Log
- GET /flux/tailwarnlog - Tail Warn Log
- GET /flux/taildebuglog - Tail Debug Log
- GET /flux/tailinfolog - Tail Info Log
- GET /flux/backendfolder - Local Folder Location (public)
- GET /flux/mapport - Map a specified port (UPnP)
- GET /flux/unmapport - Unmap a specified port (UPnP)
- GET /flux/getmap - Show list with mappings (UPnP)
- GET /flux/getip - Show public IP address (UPnP)
- GET /flux/getgateway - Show gateway address (UPnP)
- GET /flux/routerip - To show the current user's Router IP setup. (public)
- GET /flux/adjustrouterip - Update the current routerIP.
- GET /flux/blockedports - Show the current user's blocked ports list. (public)
- POST /flux/adjustblockedports - Update blocked port list.
- GET /flux/blockedrepositories - Show the current user's blocked repositories list. (public)
- POST /flux/adjustblockedrepositories - Update blocked repositories list.
- GET /flux/apiport - Show the current user's Api Port setup in configuration file that is being used by FluxOS. (public)
- GET /flux/adjustapiport - Update Api Port setup in configuration file that is being used by FluxOS.
- GET /flux/marketplaceurl - Show marketplace URL. (public)
- GET /flux/restart - Restart FluxOS.
- GET /flux/systemuptime - Show system uptime. (public)
- GET /flux/nodejsversions - Show nodejs entire versions object. (public)
- GET /flux/fluxids - Get all Flux IDs (public)
- GET /flux/isarcaneos - Check if running on ArcaneOS (public)
- GET /flux/streamchainpreparation - Stream chain preparation (public)
- POST /flux/streamchain - Stream blockchain data (public)

## Flux endpoints (part 4 of 4) <https://docs.runonflux.io/fluxapi/flux>
FluxOS API Flux group: 95 endpoints.
- POST /flux/checkappavailability - Check application availability
- POST /flux/keepupnpportsopen - Keep UPnP ports open
- GET /flux/peers - Connected peers (public)
- GET /flux/unstablenodes - Nodes flagged as unstable (public)
- GET /flux/peerhistory - Peer connection history
- GET /flux/topology - Peer-exchange topology (public)
- GET /flux/networkhealth - Network health and diagnosis history (public)
- GET /flux/clockdrift - Clock drift of this node (public)
- GET /flux/enterpriseappowners - Enterprise application owners (public)
- POST /flux/portsinuse - Ports in use on this node
- GET /flux/addoutgoingpeer - Ask this node to connect back to you (public)
- GET /flux/startdiscovery - Start peer discovery
- GET /flux/currentbranch - Git branch FluxOS is running
- GET /flux/currentcommitid - Git commit FluxOS is running
- GET /flux/rebuildui - Reinstall the FluxOS UI
- GET /flux/eventstream - Server-sent event stream (public)
- GET /flux/testcounters - Internal event counters (test builds only) (public)
- GET /flux/zelid - FluxID of the node operator (deprecated) (public)

## Apps endpoints (part 1 of 4) <https://docs.runonflux.io/fluxapi/apps>
FluxOS API Apps group: 73 endpoints. **Decentralized Application Management** Comprehensive endpoints for deploying, managing, and monitoring decentralized applications (dApps) on the Flux network. These APIs handle the complete application lifecycle from deployment to scaling, including Docker container management, resource allocation, and global distribution across the Flux node network. **Application Services:** - Docker-based app deployment - Application lifecycle management - Resource scaling and allocation - Multi-region distribution - Application marketplace integration - Performance monitoring and analytics
- GET /apps/listrunningapps - list running apps (public)
- GET /apps/listallapps - list all apps (public)
- GET /apps/listappsimages - List of images
- GET /apps/installedapps - installed apps (public)
- GET /apps/availableapps - available apps (public)
- GET /apps/fluxusage - Flux's usage (public)
- GET /apps/appsresources - Flux's usage of resources (public)
- GET /apps/registrationinformation - Registration Info (public)
- GET /apps/temporarymessages - Temporary registration info (public)
- GET /apps/permanentmessages - Permanent registration info (public)
- GET /apps/globalappsspecifications - Global app specs (public)
- GET /apps/appspecifications - Global app specs of app specified (public)
- GET /apps/appowner - App owner's ZelID (public)
- GET /apps/hashes - Application Hash info (public)
- GET /apps/location - Info regarding app location (public)
- GET /apps/locations - List of app locations (public)
- POST /apps/calculateprice - Calculate price of app (public)
- POST /apps/calculatefiatandfluxprice - Calculate price of app (public)

## Apps endpoints (part 2 of 4) <https://docs.runonflux.io/fluxapi/apps>
FluxOS API Apps group: 73 endpoints.
- GET /apps/appstart - Starts app
- GET /apps/appstop - Stops app
- GET /apps/apprestart - Restarts app
- GET /apps/apppause - Pause app
- GET /apps/appunpause - Unpause app
- GET /apps/apptop - List of running processes
- GET /apps/applog - App's log
- GET /apps/appinspect - Info of the app
- GET /apps/appstats - App stats based on resource usage
- GET /apps/appchanges - Container changes
- POST /apps/appexec - Run a command in the container
- GET /apps/appremove - Uninstall application
- GET /apps/createfluxnetwork - Create flux network
- GET /apps/rescanglobalappsinformation - Rescan and update global FluxApps info database
- GET /apps/reindexglobalappsinformation - Reindex appsinformation collection and rebuild
- GET /apps/reindexglobalappslocation - Reindex appslocations collection and rebuild
- POST /apps/checkdockerexistance - Checks Docker Hub for image
- POST /apps/appregister - App registration
- POST /apps/appupdate - App update
- GET /apps/deploymentinformation - Deployment information (public)
- GET /apps/enterprisenodes - List of enterprise nodes (public)
- GET /apps/requestmessage - Request application message hash.
- GET /apps/checkhashes - Request check for missing application message.
- GET /apps/latestspecificationversion - Get latest application specification version (public)
- GET /apps/updatetolatestspecs/{appname} - Update app to latest specifications
- GET /apps/apporiginalowner/{appname} - Get application original owner (public)
- GET /apps/installinglocation/{appname} - Get app installing location (public)
- GET /apps/installinglocations - Get all apps installing locations (public)

## Apps endpoints (part 3 of 4) <https://docs.runonflux.io/fluxapi/apps>
FluxOS API Apps group: 73 endpoints.
- GET /apps/installingerrorslocation/{appname} - Get app installation errors location (public)
- GET /apps/installingerrorslocations - Get all apps installation errors locations (public)
- GET /apps/whitelistedrepositories - Get whitelisted repositories (public)
- POST /apps/verifyappregistrationspecifications - Verify app registration specifications (public)
- POST /apps/verifyappupdatespecifications - Verify app update specifications (public)
- GET /apps/getappspecsusdprice - Get application specifications USD price (public)
- GET /apps/applogpolling/{appname} - Poll application logs
- GET /apps/appmonitorstream/{appname} - Stream application monitoring data
- GET /apps/testappinstall/{appname} - Test application installation
- GET /apps/installapplocally/{appname} - Install application locally
- GET /apps/redeploy/{appname} - Redeploy application
- GET /apps/reconstructhashes - Reconstruct application message hashes
- GET /apps/startmonitoring/{appname} - Start application monitoring
- GET /apps/stopmonitoring/{appname} - Stop application monitoring
- POST /apps/getpublickey - Get public key for app operations
- GET /apps/operations/{jobId} - Poll a long-running operation (public)
- DELETE /apps/operations/{jobId} - Cancel a long-running operation (public)
- POST /apps/placementfeasibility - Ask whether a specification can be placed
- GET /apps/placementlocations - Live placement geography (public)
- GET /apps/heldcomponents - Application components this node holds (public)
- GET /apps/promotedfolders - Syncthing folders promoted on this node (public)

## Apps endpoints (part 4 of 4) <https://docs.runonflux.io/fluxapi/apps>
FluxOS API Apps group: 73 endpoints.
- GET /apps/appcomponentnames - Component names of an application
- GET /apps/messagescount - Count of app messages by owner (public)
- GET /apps/tamperingevents - Runtime tampering events (public)
- GET /apps/appkill - Kill an app
- GET /apps/appmonitor - App monitoring data
- GET /apps/redeploycomponent - Redeploy a single component

## Explorer endpoints <https://docs.runonflux.io/fluxapi/explorer>
FluxOS API Explorer group: 10 endpoints. **Blockchain Explorer Services** Blockchain exploration endpoints providing detailed access to on-chain data, transaction history, address information, and network analytics. These APIs power blockchain explorers and provide developers with comprehensive blockchain data access for building analytics and monitoring applications. **Explorer Features:** - Transaction history and details - Address balance and activity - Block information and statistics - Network-wide analytics - Search and filtering capabilities
- GET /explorer/utxo - View utxo history (public)
- GET /explorer/transactions - View transaction history (public)
- GET /explorer/balance - View balance (public)
- GET /explorer/scannedheight - View scanned block height (public)
- GET /explorer/issynced - Check if explorer is synced (public)
- GET /explorer/reindex - Reindex collection
- GET /explorer/restart - Restart block processing
- GET /explorer/stop - Stops block processing
- GET /explorer/rescan - Rescan explorer
- GET /explorer/fusion/coinbase - Fusion coinbase transactions for an address (deprecated) (public)

## Syncthing endpoints (part 1 of 5) <https://docs.runonflux.io/fluxapi/syncthing>
FluxOS API Syncthing group: 79 endpoints. **Distributed File Synchronization** Endpoints for managing Syncthing-based distributed file synchronization services. These APIs enable secure, decentralized file sharing and synchronization across Flux nodes, providing reliable data distribution and backup capabilities for decentralized applications and user data. **Synchronization Services:** - Peer-to-peer file synchronization - Distributed storage management - Conflict resolution - Encryption and security - Bandwidth optimization
- GET /syncthing/system/error - List of error messages
- POST /syncthing/system/error - Set an error message
- GET /syncthing/system/error/clear - Remove all recent errors
- GET /syncthing/system/version - Syncthing version information (public)
- GET /syncthing/system/upgrade - Checks for a possible upgrade
- POST /syncthing/system/upgrade - Perform an upgrade
- GET /syncthing/system/browse - Returns a list of directories
- GET /syncthing/system/pause - Pause the given device or all devices
- GET /syncthing/system/resume - Resume the given device or all devices
- GET /syncthing/system/restart - Restart Syncthing
- GET /syncthing/system/shutdown - Shutdown Syncthing
- GET /syncthing/system/reset - Erase the current index database and restart Syncthing
- GET /syncthing/system/status - Status of Syncthing (public)
- GET /syncthing/system/paths - Returns the path locations
- GET /syncthing/system/connections - Returns the list of configured devices and some metadata associated with them (public)
- GET /syncthing/system/discovery - Returns/Add local discovery cache
- GET /syncthing/system/debug - Returns the set of debug facilities.

## Syncthing endpoints (part 2 of 5) <https://docs.runonflux.io/fluxapi/syncthing>
FluxOS API Syncthing group: 79 endpoints.
- GET /syncthing/system/log - Returns the list of recent log entries
- GET /syncthing/system/logtxt - Returns the list of recent log entries as text
- GET /syncthing/system/ping - Ping pong tester call (public)
- GET /syncthing/config - Returns config
- POST /syncthing/config - Replace the entire Syncthing configuration
- GET /syncthing/config/devices - Returns device config section (public)
- POST /syncthing/config/devices - Replace the device config section
- GET /syncthing/config/folders - Returns folder config section (public)
- POST /syncthing/config/folders - Replace folder config section
- GET /syncthing/config/defaults/folder - Returns a template folder configuration (public)
- POST /syncthing/config/defaults/folder - Replace the default folder config
- GET /syncthing/config/defaults/device - Returns a template device configuration (public)
- POST /syncthing/config/defaults/device - Replace the default device config
- GET /syncthing/config/defaults/ignores - Returns an object with a single lines attribute (public)
- POST /syncthing/config/defaults/ignores - Replace the default ignore patterns
- GET /syncthing/config/options - Returns the respective object (public)
- POST /syncthing/config/options - Replace the options config section
- GET /syncthing/config/gui - Returns the respective object of gui config
- POST /syncthing/config/gui - Replaces the entire gui object in config
- GET /syncthing/config/ldap - Returns the respective object (public)
- POST /syncthing/config/ldap - Replaces the entire ldap config object
- GET /syncthing/config/restart-required - Status of restart required (public)

## Syncthing endpoints (part 3 of 5) <https://docs.runonflux.io/fluxapi/syncthing>
FluxOS API Syncthing group: 79 endpoints.
- GET /syncthing/stats/device - Returns general statistics about devices (public)
- GET /syncthing/stats/folder - Returns general statistics about folder (public)
- GET /syncthing/cluster/pending/devices - Lists remote devices which have tried to connect (public)
- POST /syncthing/cluster/pending/devices - Remove records about a pending remote device which tried to connect
- GET /syncthing/cluster/pending/folders - Lists folders which remote devices have offered to us, but are not yet shared from our instance to them (public)
- POST /syncthing/cluster/pending/folders - Remove records about a pending folder announced from a remote device
- GET /syncthing/folder/errors - Returns the list of errors encountered during scanning or pulling (public)
- GET /syncthing/folder/versions - Returns the list of archived files that could be recovered (public)
- POST /syncthing/folder/versions - Restore versioned files in a folder
- GET /syncthing/db/browse - Returns the directory tree of the global model (public)
- GET /syncthing/db/completion - Returns the completion percentage and byte / item counts (public)
- GET /syncthing/db/ignores - Returns the content of the .stignore as the ignore field (public)
- POST /syncthing/db/ignores - Updates the content of the .stignore
- GET /syncthing/db/localchanged - Returns the list of files which were changed locally in a receive-only folder (public)
- GET /syncthing/db/need - Returns lists of files which are needed by this device in order for it to become in sync (public)

## Syncthing endpoints (part 4 of 5) <https://docs.runonflux.io/fluxapi/syncthing>
FluxOS API Syncthing group: 79 endpoints.
- GET /syncthing/db/remoteneed - Returns the list of files which are needed by that remote device in order for it to become in sync with the shared folder (public)
- GET /syncthing/db/status - Returns information about the current status of a folder (public)
- POST /syncthing/db/scan - Request immediate scan
- POST /syncthing/db/revert - Request revert of a receive only folder
- POST /syncthing/db/prio - Moves the file to the top of the download queue
- POST /syncthing/db/override - Request override of a send only folder
- GET /syncthing/events - Returns events
- GET /syncthing/events/disk - Returns events
- GET /syncthing/svc/report - Returns the data sent in the anonymous usage report (public)
- GET /syncthing/svc/random/string - Returns a strong random generated string
- GET /syncthing/svc - Verifies and formats a device ID. (public)
- GET /syncthing/debug/httpmetrics - Returns statistics about each served REST API endpoint
- GET /syncthing/debug/peercompletion - Summarizes the completion percentage for each remote device
- GET /syncthing/debug/cpuprof - Used to capture a profile of what Syncthing is doing on the CPU
- GET /syncthing/debug/heapprof - Used to capture a profile of what Syncthing is doing with the heap memory
- GET /syncthing/debug/support - Collects information about the running instance for troubleshooting purposes
- GET /syncthing/debug/file - Shows diagnostics about a certain file in a shared folder
- GET /syncthing/deviceid - Display deviceid (public)
- GET /syncthing/meta - Display metadata information (public)
- GET /syncthing/health - Check health status (public)

## Syncthing endpoints (part 5 of 5) <https://docs.runonflux.io/fluxapi/syncthing>
FluxOS API Syncthing group: 79 endpoints.
- GET /syncthing/metrics - Full Syncthing metrics
- GET /syncthing/metrics/health - Syncthing health summary
- GET /syncthing/metrics/history - Syncthing metrics history
- GET /syncthing/peer/diagnostics - Peer sync diagnostics
- GET /syncthing/db/file - Database entry for a single file (public)

## Fluxshare endpoints <https://docs.runonflux.io/fluxapi/fluxshare>
FluxOS API Fluxshare group: 13 endpoints. **Decentralized File Sharing** Advanced file sharing and storage endpoints built on the Flux decentralized network. FluxShare provides secure, distributed file storage with redundancy, encryption, and global accessibility. Ideal for building decentralized storage applications and content distribution networks. **Storage Features:** - Distributed file storage - Redundancy and fault tolerance - End-to-end encryption - Global content distribution - Access control and sharing permissions
- GET /apps/fluxshare/getfile - Share files
- GET /apps/fluxshare/getfolder - FluxShare - Get folder content
- GET /apps/fluxshare/createfolder - FluxShare - Create folder
- GET /apps/fluxshare/removefile - FluxShare - Remove file
- GET /apps/fluxshare/removefolder - FluxShare - Remove folder
- GET /apps/fluxshare/fileexists - FluxShare - File exists
- GET /apps/fluxshare/stats - FluxShare - Stats
- GET /apps/fluxshare/sharefile - FluxShare - Share file
- GET /apps/fluxshare/unsharefile - FluxShare - Unshare file
- GET /apps/fluxshare/sharedfiles - FluxShare - Shared files
- GET /apps/fluxshare/rename - FluxShare - Rename file
- GET /apps/fluxshare/downloadfolder - FluxShare - Download folder
- POST /apps/fluxshare/uploadfile - Upload a file to FluxShare

## Backup/Restore endpoints <https://docs.runonflux.io/fluxapi/backuprestore>
FluxOS API Backup/Restore group: 7 endpoints. **Application Backup & Recovery** Comprehensive backup and disaster recovery endpoints for Flux applications and data. These APIs provide automated backup creation, version management, and restoration capabilities to ensure data integrity and business continuity for decentralized applications running on the Flux network. **Backup Services:** - Automated backup scheduling - Version control and history - Cross-region replication - Point-in-time recovery - Disaster recovery orchestration
- GET /backup/getvolumedataofcomponent - Get volume data of a component
- GET /backup/getremotefilesize - Get size of a remote file. **AppOwnerAbove**
- GET /backup/getlocalbackuplist - Get the list of local backups based on the provided appname
- GET /backup/removebackupfile - Remove a backup file.
- GET /backup/downloadlocalfile - Download a local backup file
- POST /apps/appendbackuptask - Append backup task to an application
- POST /apps/appendrestoretask - Append restore task to an application

## Volume Browser endpoints <https://docs.runonflux.io/fluxapi/volume-browser>
FluxOS API Volume Browser group: 11 endpoints. **Persistent Storage Management** Advanced volume and persistent storage management endpoints for containerized applications. These APIs provide comprehensive file system operations, storage allocation, and data management capabilities for applications requiring persistent data storage across the distributed Flux network. **Storage Management:** - Volume provisioning and management - File system operations - Storage quota enforcement - Data migration and replication - Performance optimization
- GET /apps/getfolderinfo - Get a list of files with their details for all files.
- GET /apps/createfolder - Create folder.
- GET /apps/renameobject - Rename file/folder
- GET /apps/removeobject - Remove file/folder
- GET /apps/downloadfile - Download file
- GET /apps/downloadfolder - Download folder as gzip file
- POST /apps/moveobject - Move a file or folder within an app volume
- POST /apps/copyobject - Copy a file or folder within an app volume
- POST /apps/compressobject - Compress a file or folder into an archive
- POST /apps/extractobject - Extract an archive within an app volume
- GET /apps/fileoperationimage/{imageid} - Serve a container image to a peer node (public)

## IOUtils endpoints <https://docs.runonflux.io/fluxapi/ioutils>
FluxOS API IOUtils group: 1 endpoints. **File System Operations & Utilities** Low-level file system operation endpoints providing essential I/O utilities for application development and system administration. These APIs offer direct file manipulation, directory management, and system utilities required for advanced application deployment and management on Flux nodes. **I/O Operations:** - File and directory management - Permission and ownership control - Data transfer utilities - System resource monitoring - Batch operation support
- POST /ioutils/fileupload - Upload file

## ArcaneOS endpoints <https://docs.runonflux.io/fluxapi/arcaneos>
FluxOS API ArcaneOS group: 2 endpoints. **Hardened Node Operating System** Endpoints exposed only by nodes running ArcaneOS, the hardened FluxOS appliance image. They cover attested configuration synchronisation, where the node's identity keys are held by the operating system rather than by FluxOS. Every other node answers these routes with `501 Not Implemented`. **ArcaneOS Capabilities:** - Hardware-backed key custody - Challenge/response configuration sync via `flux-configd` - Watchdog-managed CloudUI - HTTPS-only endpoints
- GET /arcane/authchallenge - Request a configuration challenge (public)
- POST /arcane/configsync - Synchronise node configuration (public)

## Payments endpoints <https://docs.runonflux.io/fluxapi/payments>
FluxOS API Payments group: 2 endpoints. **Wallet Payment Flows** Endpoints backing wallet-driven payment flows: minting a short-lived payment request id, and verifying the callback a wallet sends once the transaction is broadcast. **Payment Services:** - Payment request minting - Transaction callback verification - Multi-chain payment support
- GET /payment/paymentrequest - Create a payment request (public)
- POST /payment/verifypayment - Verify a payment callback (public)

## Obtain login phrase (GET /id/loginphrase) <https://docs.runonflux.io/fluxapi/authentication/loginphrase>

Obtain valid Login Phrase for signing into Flux. Login Phrase is at least 40 characters, first 13 characters is server timestamp and is valid for 15 minutes. **Public**

FluxOS API endpoint GET /id/loginphrase (operationId loginPhrase, Authentication). Public, no login.
Responses: 200 OK.

## Obtain emergency login phrase (GET /id/emergencyphrase) <https://docs.runonflux.io/fluxapi/id/emergencyloginphrase>

Obtain emergency Login Phrase for signing into Flux. **Public**

FluxOS API endpoint GET /id/emergencyphrase (operationId emergencyLoginPhrase, ID). Public, no login.
Responses: 200 OK.

## Login into Flux (POST /id/verifylogin) <https://docs.runonflux.io/fluxapi/authentication/verifylogin>

Login into Flux by submitting correct ZelID, login phrase and signature. Note that to get the signature of the signed message you would need to do the signing on Zelcore or your BTC wallet or your ETH wallet. If success status response is returned, we can use the supplied data(zelid, loginPhrase, signature) as zelauth header as part of api calls that require a user to be logged in. Additionally it is possible to listen for a response on websocket. ws://{Flux_IP}:16127/ws/id/{loginPhrase}. **Public**

FluxOS API endpoint POST /id/verifylogin (operationId verifyLogin, Authentication). Public, no login.
Request body (text/plain): loginPhrase (string), zelid (string), signature (string) - ZelID login object
Responses: 200 OK; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Provide Signature (POST /id/providesign) <https://docs.runonflux.io/fluxapi/authentication/providesign>

Provide requested signature from signed message to return data. **Public**

FluxOS API endpoint POST /id/providesign (operationId provideSign, Authentication). Public, no login.
Request body (text/plain): address (string), message (string), signature (string)
Responses: 200 OK.

## Obtain all logged sessions of ZelID. (GET /id/loggedsessions) <https://docs.runonflux.io/fluxapi/id/loggedsessions>

Gets all currently active logged sessions in Flux tied to given ZelID. **User**

FluxOS API endpoint GET /id/loggedsessions (operationId loggedSessions, ID). Requires Flux ID login, privilege User.
Responses: 200 OK.

## Logs out current session (GET /id/logoutcurrentsession) <https://docs.runonflux.io/fluxapi/id/logoutcurrentsession>

This call logs out currently logged session which is determined by the supplied authentication header. **User**

FluxOS API endpoint GET /id/logoutcurrentsession (operationId logoutCurrentSession, ID). Requires Flux ID login, privilege User.
Responses: 200 OK.

## Logs out all sessions (GET /id/logoutallsessions) <https://docs.runonflux.io/fluxapi/id/logoutallsession>

This call logs out all logged sessions which are determined by the supplied authentication header. **User**

FluxOS API endpoint GET /id/logoutallsessions (operationId logoutAllSession, ID). Requires Flux ID login, privilege User.
Responses: 200 OK.

## Gets information about logged users (GET /id/loggedusers) <https://docs.runonflux.io/fluxapi/id/loggedusers>

This call gets basic infromation about currently logged sessions of all users. **Admin**

FluxOS API endpoint GET /id/loggedusers (operationId loggedUsers, ID). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Lists active login phrases (GET /id/activeloginphrases) <https://docs.runonflux.io/fluxapi/id/activeloginphrases>

This call gets a list of login phrases that are currently active (were generated less than 15 minutes ago) - phrases that have been used recently and phrases that can be used to log in.. **Admin**

FluxOS API endpoint GET /id/activeloginphrases (operationId activeLoginPhrases, ID). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Logs out all users (GET /id/logoutallusers) <https://docs.runonflux.io/fluxapi/id/logoutallusers>

This call logs out all logged users (including fluxteam, admins). **Admin**

FluxOS API endpoint GET /id/logoutallusers (operationId logoutAllUsers, ID). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Logs out a specific session (POST /id/logoutspecificsession) <https://docs.runonflux.io/fluxapi/authentication/logoutspecificsession>

Logs out a specific session. Requires the knowledge of a session loginPhrase and so users level is sufficient and user cannot logout another user as he does not know the loginPhrase. Admin can logout any specific session. **User**

FluxOS API endpoint POST /id/logoutspecificsession (operationId logoutSpecificSession, Authentication). Requires Flux ID login, privilege User.
Request body (text/plain): loginPhrase (string) - Object containing loginPhrase
Responses: 200 OK.

## Checks the privilege level of user (POST /id/checkprivilege) <https://docs.runonflux.io/fluxapi/id/checkloggeduser>

Checks the privilege level of the user. The 5 levels are public, user, admin, flux team and app owner. **Public**

FluxOS API endpoint POST /id/checkprivilege (operationId checkLoggedUser, ID). Public, no login.
Request body (text/plain): zelid (string), signature (string) - Object containing privilege level
Responses: 200 OK.

## Starts Flux daemon (GET /flux/startdaemon) <https://docs.runonflux.io/fluxapi/flux/startdaemon>

Tries to start Flux daemon running on the Flux node the call is run against without any extra parameters. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/startdaemon (operationId startdaemon, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Restarts Flux daemon (GET /flux/restartdaemon) <https://docs.runonflux.io/fluxapi/flux/restartdaemon>

Tries to restart Flux daemon running on the Flux node the call is run against. Flux daemon is firstly stopped and then started without any extra parameters. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/restartdaemon (operationId restartdaemon, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Switch to master branch of FluxOS (GET /flux/entermaster) <https://docs.runonflux.io/fluxapi/flux/fluxentermaster>

Tries to switch to master branch of FluxOS. **FluxTeam**

FluxOS API endpoint GET /flux/entermaster (operationId FluxEnterMaster, Flux). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Switch to development branch of FluxOS (GET /flux/enterdevelopment) <https://docs.runonflux.io/fluxapi/flux/fluxenterdevelopment>

Tries to switch to development branch of FluxOS. **FluxTeam**

FluxOS API endpoint GET /flux/enterdevelopment (operationId FluxEnterDevelopment, Flux). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Reindexes Flux daemon (GET /flux/reindexdaemon) <https://docs.runonflux.io/fluxapi/flux/reindexfluxb>

Tries to reindex Flux daemon running on the Flux node the call is run against. Flux daemon is firstly stopped and then started with reindex flag. **Admin**

FluxOS API endpoint GET /flux/reindexdaemon (operationId reindexFluxB, Flux). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Updates Flux to the latest version (GET /flux/updateflux) <https://docs.runonflux.io/fluxapi/flux/updateflux>

Updates Flux to the latest version available according to github master branch. Flux will restart its services after the update. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/updateflux (operationId updateFlux, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Perform hard update to the latest version (GET /flux/hardupdateflux) <https://docs.runonflux.io/fluxapi/flux/hardupdateflux>

Hard updates to latest version by removing node_modules and package-lock.json before executing git reset --hard and git pull. This may resolve any issues that may arise from Flux not being able to update using the `GET /flux/updateflux` call. Flux will restart its services after the update. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/hardupdateflux (operationId hardUpdateFlux, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Updates Flux daemon (GET /flux/updatedaemon) <https://docs.runonflux.io/fluxapi/flux/updatedaemon>

Updates the Flux daemon of Flux node to the latest available version according to official Flux APT repository. Flux daemon is restarted with no extra parameters during this update. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/updatedaemon (operationId updateDaemon, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Updates Benchmark daemon (GET /flux/updatebenchmark) <https://docs.runonflux.io/fluxapi/flux/updatebenchmark>

Updates the Benchmark daemon of Flux node to the latest available version according to official Flux APT repository. Benchmark daemon is restarted with no extra parameters during this update. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/updatebenchmark (operationId updateBenchmark, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns with the Flux debug log (GET /flux/daemondebug) <https://docs.runonflux.io/fluxapi/flux/fluxdebug>

Returns with the debug log located in Flux data directory. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/daemondebug (operationId fluxDebug, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns with the Benchmark debug log (GET /flux/benchmarkdebug) <https://docs.runonflux.io/fluxapi/flux/benchmarkdebuf>

Returns with the debug log located in fluxbenchmark directory. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/benchmarkdebug (operationId benchmarkDebuf, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns last lines of Flux debug log (GET /flux/taildaemondebug) <https://docs.runonflux.io/fluxapi/flux/tailfluxdebug>

Returns last 100 lines known in the Flux debug log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/taildaemondebug (operationId tailFluxDebug, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns last lines of Benchmark debug log (GET /flux/tailbenchmarkdebug) <https://docs.runonflux.io/fluxapi/flux/tailbenchmarkdebug>

Returns last 100 lines known in the Benchmark debug log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/tailbenchmarkdebug (operationId tailBenchmarkDebug, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns with the Flux error log (GET /flux/errorlog) <https://docs.runonflux.io/fluxapi/flux/fluxerrorlog>

Returns with the error log located in flux directory. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/errorlog (operationId fluxErrorLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns last lines of Flux error log (GET /flux/tailerrorlog) <https://docs.runonflux.io/fluxapi/flux/tailfluxerrorlog>

Returns last 100 lines known in the Flux error log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/tailerrorlog (operationId tailFluxErrorLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Node Tier (GET /flux/nodetier) <https://docs.runonflux.io/fluxapi/flux/getnodetier>

This call will display the tier of the node. **Public**

FluxOS API endpoint GET /flux/nodetier (operationId getNodeTier, Flux). Public, no login.
Responses: 200 OK.

## Combined info (GET /flux/info) <https://docs.runonflux.io/fluxapi/flux/getfluxinfo>

Combined info of statuses. **Public**

FluxOS API endpoint GET /flux/info (operationId getFluxInfo, Flux). Public, no login.
Responses: 200 OK.

## Flux timezone (GET /flux/timezone) <https://docs.runonflux.io/fluxapi/flux/getfluxtimezone>

This will return with the timezone of the server. **Public**

FluxOS API endpoint GET /flux/timezone (operationId getFluxTimezone, Flux). Public, no login.
Responses: 200 OK.

## Gets version of Flux (GET /flux/version) <https://docs.runonflux.io/fluxapi/flux/getfluxversion>

Gets version of Flux running on the Flux node the call is run against as it is in package.json. **Public**

FluxOS API endpoint GET /flux/version (operationId getFluxVersion, Flux). Public, no login.
Responses: 200 OK.

## Flux IP (GET /flux/ip) <https://docs.runonflux.io/fluxapi/flux/getfluxip>

This will return with the IP address of the server that Flux is on. **Public**

FluxOS API endpoint GET /flux/ip (operationId getFluxIP, Flux). Public, no login.
Responses: 200 OK.

## Flux static IP status (GET /flux/staticip) <https://docs.runonflux.io/fluxapi/flux/getfluxstaticip>

This will return `true` if FluxNode is running under a known static ip ISP/Org. **Public**

FluxOS API endpoint GET /flux/staticip (operationId getFluxStaticIP, Flux). Public, no login.
Responses: 200 OK.

## Geolocation info (GET /flux/geolocation) <https://docs.runonflux.io/fluxapi/flux/getfluxgeolocation>

This will return geolocation info. **Public**

FluxOS API endpoint GET /flux/geolocation (operationId getFluxGeolocation, Flux). Public, no login.
Responses: 200 OK.

## Admin's ZelID (GET /flux/id) <https://docs.runonflux.io/fluxapi/flux/getfluxid>

This will return with the admin's ZelID. **Public**

FluxOS API endpoint GET /flux/id (operationId getFluxID, Flux). Public, no login.
Responses: 200 OK.

## PGP identity (GET /flux/pgp) <https://docs.runonflux.io/fluxapi/flux/getpgp>

This will return node pgp public key. **Public**

FluxOS API endpoint GET /flux/pgp (operationId getPgp, Flux). Public, no login.
Responses: 200 OK.

## Kadena Info (GET /flux/kadena) <https://docs.runonflux.io/fluxapi/flux/getfluxkadena>

This call will display the user's Kadena address and chain ID. **Public**

FluxOS API endpoint GET /flux/kadena (operationId getFluxKadena, Flux). Public, no login.
Responses: 200 OK.

## DOS state (GET /flux/dosstate) <https://docs.runonflux.io/fluxapi/flux/getdosstate>

This will return with the DOS state that Flux is in from 0 to infinity and if it reaches 10 it gets banned. **Public**

FluxOS API endpoint GET /flux/dosstate (operationId getDOSState, Flux). Public, no login.
Responses: 200 OK.

## Set the DOS state (test builds only) (POST /flux/dosstate) <https://docs.runonflux.io/fluxapi/flux/setdosstate>

Sets the node's DOS state directly. **Available only on nodes started with `testEventStream` enabled** — every other node answers `404`. Exists so the event stream can be exercised deterministically in testing. **FluxTeam**

FluxOS API endpoint POST /flux/dosstate (operationId setDOSState, Flux). Requires Flux ID login, privilege FluxTeam.
Request body (application/json): dosState (number), dosMessage (string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 404 Not available — this node was not started with test event s….

## Gets IP's of connected peers (GET /flux/connectedpeers) <https://docs.runonflux.io/fluxapi/flux/connectedpeers>

Gets list of IP addresses of outgoing connected peers. **Public**

FluxOS API endpoint GET /flux/connectedpeers (operationId connectedPeers, Flux). Public, no login.
Responses: 200 OK.

## Gets info of connected peers (GET /flux/connectedpeersinfo) <https://docs.runonflux.io/fluxapi/flux/connectedpeersinfo>

Gets list of ip addresses and rtt of the outgoing connected peers. **Public**

FluxOS API endpoint GET /flux/connectedpeersinfo (operationId connectedPeersInfo, Flux). Public, no login.
Responses: 200 OK.

## List of incoming connections (GET /flux/incomingconnections) <https://docs.runonflux.io/fluxapi/flux/incomingconnections>

Gets list of IP addresses of incoming connected peers. **Public**

FluxOS API endpoint GET /flux/incomingconnections (operationId incomingConnections, Flux). Public, no login.
Responses: 200 OK.

## Gets info of incoming connections (GET /flux/incomingconnectionsinfo) <https://docs.runonflux.io/fluxapi/flux/incomingconnectionsinfo>

Gets list of ip addresses and rtt of incoming connections. **Public**

FluxOS API endpoint GET /flux/incomingconnectionsinfo (operationId incomingConnectionsInfo, Flux). Public, no login.
Responses: 200 OK.

## Check availability of Flux (GET /flux/checkfluxavailability) <https://docs.runonflux.io/fluxapi/flux/checkfluxavailability>

Check if Flux is reachable and available using IP of the Flux's server. **Public**

FluxOS API endpoint GET /flux/checkfluxavailability (operationId checkFluxAvailability, Flux). Public, no login.
Parameters:
- ip (query, string, required): Ip address
- port (query, string): API port of the node being checked; the default FluxOS port when omitted
Responses: 200 OK.

## Check incoming/outgoing peers (GET /flux/checkcommunication) <https://docs.runonflux.io/fluxapi/flux/iscommunicationestablished>

Check if there is enough incoming/outgoing peers. **Public**

FluxOS API endpoint GET /flux/checkcommunication (operationId isCommunicationEstablished, Flux). Public, no login.
Responses: 200 OK.

## FluxOS uptime (GET /flux/uptime) <https://docs.runonflux.io/fluxapi/flux/fluxuptime>

Return FluxOS uptime in seconds. **Public**

FluxOS API endpoint GET /flux/uptime (operationId FluxUptime, Flux). Public, no login.
Responses: 200 OK.

## Broadcast message to peers (GET /flux/broadcastmessage) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagefromuser>

Broadcast data message to peers that are connected. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/broadcastmessage (operationId broadcastMessageFromUser, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- data (query, string, required): The message
Responses: 200 OK.

## Broadcast message to peers (POST /flux/broadcastmessage) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagefromuserpost>

Broadcast data message to peers that are connected. **AdminAndFluxTeam**

FluxOS API endpoint POST /flux/broadcastmessage (operationId broadcastMessageFromUserPost, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): data (string)
Responses: 200 OK.

## Broadcast message to outgoing peers (GET /flux/broadcastmessagetooutgoing) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagetooutgoingfromuser>

**Deprecated.** Delegates to the same handler as `/flux/broadcastmessage`, which broadcasts to every peer rather than only outgoing ones; use that endpoint instead. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/broadcastmessagetooutgoing (operationId broadcastMessageToOutgoingFromUser, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- data (query, string, required): The message
Responses: 200 OK.

## Broadcast message to outgoing peers (POST /flux/broadcastmessagetooutgoing) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagetooutgoingfromuserpost>

**Deprecated.** Delegates to the same handler as `/flux/broadcastmessage`, which broadcasts to every peer rather than only outgoing ones; use that endpoint instead. **AdminAndFluxTeam**

FluxOS API endpoint POST /flux/broadcastmessagetooutgoing (operationId broadcastMessageToOutgoingFromUserPost, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): data (string)
Responses: 200 OK.

## Broadcast message to incoming peers (GET /flux/broadcastmessagetoincoming) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagetoincomingfromuser>

**Deprecated.** Delegates to the same handler as `/flux/broadcastmessage`, which broadcasts to every peer rather than only incoming ones; use that endpoint instead. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/broadcastmessagetoincoming (operationId broadcastMessageToIncomingFromUser, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- data (query, string, required): The message
Responses: 200 OK.

## Broadcast message to incoming peers (POST /flux/broadcastmessagetoincoming) <https://docs.runonflux.io/fluxapi/flux/broadcastmessagetoincomingfromuserpost>

**Deprecated.** Delegates to the same handler as `/flux/broadcastmessage`, which broadcasts to every peer rather than only incoming ones; use that endpoint instead. **AdminAndFluxTeam**

FluxOS API endpoint POST /flux/broadcastmessagetoincoming (operationId broadcastMessageToIncomingFromUserPost, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): data (string)
Responses: 200 OK.

## Add peer option (GET /flux/addpeer) <https://docs.runonflux.io/fluxapi/flux/addpeer>

This call gives option to add peers to outgoing connections. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/addpeer (operationId addPeer, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- ip (query, string, required): Ip of peer to add
Responses: 200 OK.

## Remove peer option (GET /flux/removepeer) <https://docs.runonflux.io/fluxapi/flux/removepeer>

This call does exact opposite of add and removes/drops a outgoing connected peer. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/removepeer (operationId removePeer, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- ip (query, string, required): Ip of peer to remove
Responses: 200 OK.

## Remove incoming peer (GET /flux/removeincomingpeer) <https://docs.runonflux.io/fluxapi/flux/removeincomingpeer>

Remove a incoming connected peer. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/removeincomingpeer (operationId removeIncomingPeer, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- ip (query, string, required): Ip of peer to remove
Responses: 200 OK.

## Open port on server (GET /flux/allowport) <https://docs.runonflux.io/fluxapi/flux/allowportapi>

This will open a port on the server and adding it to the firewall rules. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/allowport (operationId allowPortApi, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- port (query, integer, required): Port number to open
Responses: 200 OK.

## Adjust Kadena Account (GET /flux/adjustkadena) <https://docs.runonflux.io/fluxapi/flux/adjustkadenaaccount>

Essentially rebuilds flux - use with caution! **Admin**

FluxOS API endpoint GET /flux/adjustkadena (operationId adjustKadenaAccount, Flux). Requires Flux ID login, privilege Admin.
Parameters:
- account (query, string, required): Kadena Account
- chainid (query, string, required): Kadena ChainID
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Start Benchmark (GET /flux/startbenchmark) <https://docs.runonflux.io/fluxapi/flux/fluxstartbenchmark>

This call will start the benchmark which tests the hardware specifications and performance. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/startbenchmark (operationId fluxstartBenchmark, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Restart Benchmark (GET /flux/restartbenchmark) <https://docs.runonflux.io/fluxapi/flux/fluxrestartbenchmark>

This call will restart the benchmark which tests the hardware specifications and performance. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/restartbenchmark (operationId fluxrestartbenchmark, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Soft Update Flux (GET /flux/softupdateflux) <https://docs.runonflux.io/fluxapi/flux/softupdateflux>

This call will perform a soft update of Flux. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/softupdateflux (operationId softUpdateFlux, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Install Flux (GET /flux/softupdatefluxinstall) <https://docs.runonflux.io/fluxapi/flux/softupdatefluxinstall>

This call will install Flux. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/softupdatefluxinstall (operationId softUpdateFluxInstall, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Warning Log (GET /flux/warnlog) <https://docs.runonflux.io/fluxapi/flux/fluxwarnlog>

This call returns the Flux warning log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/warnlog (operationId fluxWarnLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Debug Log (GET /flux/debuglog) <https://docs.runonflux.io/fluxapi/flux/fluxdebuglog>

This call returns the Flux debug log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/debuglog (operationId fluxDebugLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Info Log (GET /flux/infolog) <https://docs.runonflux.io/fluxapi/flux/fluxinfolog>

This call returns the Flux info log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/infolog (operationId fluxInfoLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Tail Warn Log (GET /flux/tailwarnlog) <https://docs.runonflux.io/fluxapi/flux/tailfluxwarnlog>

This call returns the Flux tail warn log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/tailwarnlog (operationId tailFluxWarnLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Tail Debug Log (GET /flux/taildebuglog) <https://docs.runonflux.io/fluxapi/flux/tailfluxdebuglog>

This call returns the Flux tail debug log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/taildebuglog (operationId tailFluxDebugLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Tail Info Log (GET /flux/tailinfolog) <https://docs.runonflux.io/fluxapi/flux/tailfluxinfolog>

This call returns the Flux tail info log. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/tailinfolog (operationId tailFluxInfoLog, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Local Folder Location (GET /flux/backendfolder) <https://docs.runonflux.io/fluxapi/flux/fluxbackendfolder>

Returns the FluxOS backend folder on this node. **Reachable only from the node's own local network** — the route is gated on the caller's address, not on a signature, so no `zelidauth` header is required and one does not help from outside. **Public** (local network only)

FluxOS API endpoint GET /flux/backendfolder (operationId fluxBackendFolder, Flux). Public, no login.
Responses: 200 OK.

## Map a specified port (UPnP) (GET /flux/mapport) <https://docs.runonflux.io/fluxapi/flux/fluxmapport>

This call map a specified port (UPnP). **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/mapport (operationId fluxMapport, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- port (query, integer, required): Port number
Responses: 200 OK.

## Unmap a specified port (UPnP) (GET /flux/unmapport) <https://docs.runonflux.io/fluxapi/flux/fluxunmapport>

This call unmap a specified port (UPnP). **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/unmapport (operationId fluxUnmapport, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- port (query, integer, required): Port number
Responses: 200 OK.

## Show list with mappings (UPnP) (GET /flux/getmap) <https://docs.runonflux.io/fluxapi/flux/fluxgetmap>

This call show message with mappings (UPnP). **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/getmap (operationId fluxGetMap, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Show public IP address (UPnP) (GET /flux/getip) <https://docs.runonflux.io/fluxapi/flux/fluxgetip>

This call show public IP address (UPnP). **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/getip (operationId fluxGetip, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Show gateway address (UPnP) (GET /flux/getgateway) <https://docs.runonflux.io/fluxapi/flux/fluxgetgateway>

This call show a message with gateway address (UPnP). **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/getgateway (operationId fluxGetGateway, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## To show the current user's Router IP setup. (GET /flux/routerip) <https://docs.runonflux.io/fluxapi/flux/fluxrouterip>

To show the current user's Router IP setup in configuration file that is being used with FluxO. **Public**

FluxOS API endpoint GET /flux/routerip (operationId fluxRouterip, Flux). Public, no login.
Responses: 200 OK.

## Update the current routerIP. (GET /flux/adjustrouterip) <https://docs.runonflux.io/fluxapi/flux/fluxadjustrouterip>

Update the current routerIP that is being used with FluxOS. **Admin**

FluxOS API endpoint GET /flux/adjustrouterip (operationId fluxAdjustrouterip, Flux). Requires Flux ID login, privilege Admin.
Parameters:
- routerip (query, string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Show the current user's blocked ports list. (GET /flux/blockedports) <https://docs.runonflux.io/fluxapi/flux/fluxblockedports>

Show the current user's blocked ports list. **Public**

FluxOS API endpoint GET /flux/blockedports (operationId fluxBlockedports, Flux). Public, no login.
Responses: 200 OK.

## Update blocked port list. (POST /flux/adjustblockedports) <https://docs.runonflux.io/fluxapi/flux/fluxadjustblockedports>

Update the current blocked port list that is being used by FluxOS. **AdminAndFluxTeam**

FluxOS API endpoint POST /flux/adjustblockedports (operationId fluxAdjustblockedports, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): blockedPorts (array)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Show the current user's blocked repositories list. (GET /flux/blockedrepositories) <https://docs.runonflux.io/fluxapi/flux/fluxblockedrepositories>

Show the current user's blocked repositories list. **Public**

FluxOS API endpoint GET /flux/blockedrepositories (operationId fluxBlockedrepositories, Flux). Public, no login.
Responses: 200 OK.

## Update blocked repositories list. (POST /flux/adjustblockedrepositories) <https://docs.runonflux.io/fluxapi/flux/fluxadjustblockedrepositories>

Update the current blocked repositories list that is being used by FluxOS. **AdminAndFluxTeam**

FluxOS API endpoint POST /flux/adjustblockedrepositories (operationId fluxAdjustblockedrepositories, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): blockedRepositories (array)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Show the current user's Api Port setup in configuration file that is being used by FluxOS. (GET /flux/apiport) <https://docs.runonflux.io/fluxapi/flux/fluxapiport>

Show the current user's Api Port. **Public**

FluxOS API endpoint GET /flux/apiport (operationId fluxApiport, Flux). Public, no login.
Responses: 200 OK.

## Update Api Port setup in configuration file that is being used by FluxOS. (GET /flux/adjustapiport) <https://docs.runonflux.io/fluxapi/flux/fluxadjustapiport>

Update the API port in the node configuration. **Admin**

FluxOS API endpoint GET /flux/adjustapiport (operationId fluxAdjustapiport, Flux). Requires Flux ID login, privilege Admin.
Parameters:
- apiport (query, number)
Responses: 200 OK.

## Show marketplace URL. (GET /flux/marketplaceurl) <https://docs.runonflux.io/fluxapi/flux/fluxmarketplaceurl>

Show marketplace URL based on current development flag setup in configuration file that is being used with FluxOS. **Public**

FluxOS API endpoint GET /flux/marketplaceurl (operationId fluxMarketplaceurl, Flux). Public, no login.
Responses: 200 OK.

## Restart FluxOS. (GET /flux/restart) <https://docs.runonflux.io/fluxapi/flux/fluxrestart>

Restart FluxOS. **Admin**

FluxOS API endpoint GET /flux/restart (operationId fluxRestart, Flux). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Show system uptime. (GET /flux/systemuptime) <https://docs.runonflux.io/fluxapi/flux/fluxsystemuptime>

Show system uptime in ms. **Public**

FluxOS API endpoint GET /flux/systemuptime (operationId fluxSystemuptime, Flux). Public, no login.
Responses: 200 OK.

## Show nodejs entire versions object. (GET /flux/nodejsversions) <https://docs.runonflux.io/fluxapi/flux/fluxnodejsversions>

Show nodejs entire versions object. **Public**

FluxOS API endpoint GET /flux/nodejsversions (operationId fluxNodejsversions, Flux). Public, no login.
Responses: 200 OK.

## Get all Flux IDs (GET /flux/fluxids) <https://docs.runonflux.io/fluxapi/flux/getfluxids>

Get list of all Flux IDs associated with this node. **Public**

FluxOS API endpoint GET /flux/fluxids (operationId getFluxIds, Flux). Public, no login.
Responses: 200 OK.

## Check if running on ArcaneOS (GET /flux/isarcaneos) <https://docs.runonflux.io/fluxapi/flux/isarcaneos>

Check if the node is running on ArcaneOS (specialized Flux operating system). **Public**

FluxOS API endpoint GET /flux/isarcaneos (operationId isArcaneOs, Flux). Public, no login.
Responses: 200 OK.

## Stream chain preparation (GET /flux/streamchainpreparation) <https://docs.runonflux.io/fluxapi/flux/streamchainpreparation>

Prepares this node to stream its blockchain to another node on the same local network. **Reachable only from the node's own local network** — the caller is identified by its socket address, so no `zelidauth` header is required. Answers `422` when streaming is disabled for failing the minimum throughput criteria, and `503` while another stream is already in progress. **Public** (local network only)

FluxOS API endpoint GET /flux/streamchainpreparation (operationId streamChainPreparation, Flux). Public, no login.
Responses: 200 OK.

## Stream blockchain data (POST /flux/streamchain) <https://docs.runonflux.io/fluxapi/flux/streamchain>

Streams this node's blockchain data to another node on the same local network. **Reachable only from the node's own local network** — the caller is identified by its socket address, so no `zelidauth` header is required. **Public** (local network only)

FluxOS API endpoint POST /flux/streamchain (operationId streamChain, Flux). Public, no login.
Request body (application/json): targetNode* (string), startHeight (integer), endHeight (integer)
Responses: 200 OK.

## Check application availability (POST /flux/checkappavailability) <https://docs.runonflux.io/fluxapi/flux/checkappavailability>

Check if a specific application is available and accessible. **FluxTeam**

FluxOS API endpoint POST /flux/checkappavailability (operationId checkAppAvailability, Flux). Requires Flux ID login, privilege FluxTeam.
Request body (application/json): appname* (string), ip (string), port (integer)
Responses: 200 OK.

## Keep UPnP ports open (POST /flux/keepupnpportsopen) <https://docs.runonflux.io/fluxapi/flux/keepupnpportsopen>

Maintain UPnP port mappings to keep them open. **FluxTeam**

FluxOS API endpoint POST /flux/keepupnpportsopen (operationId keepUPNPPortsOpen, Flux). Requires Flux ID login, privilege FluxTeam.
Request body (application/json): ports* (array)
Responses: 200 OK.

## Get a list of files with their details for all files. (GET /apps/getfolderinfo) <https://docs.runonflux.io/fluxapi/volume-browser/fluxgetfolderinfo>

Get a list of files with their details for all files. **AppOwnerAbove**

FluxOS API endpoint GET /apps/getfolderinfo (operationId fluxGetfolderinfo, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- folder (query, string)
Responses: 200 OK.

## Create folder. (GET /apps/createfolder) <https://docs.runonflux.io/fluxapi/volume-browser/fluxcreatefolder>

Create folder inside app volume. **AppOwnerAbove**

FluxOS API endpoint GET /apps/createfolder (operationId fluxCreatefolder, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- folder (query, string, required)
Responses: 200 OK.

## Rename file/folder (GET /apps/renameobject) <https://docs.runonflux.io/fluxapi/volume-browser/fluxrenameobject>

Rename file/folder. **AppOwnerAbove**

FluxOS API endpoint GET /apps/renameobject (operationId fluxRenameobject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- oldpath (query, string, required): old path name inside volume with file/folder name
- newname (query, string, required): new full path name inside volume with file/folder name
Responses: 200 OK.

## Remove file/folder (GET /apps/removeobject) <https://docs.runonflux.io/fluxapi/volume-browser/fluxremoveobject>

Remove file/folder. **AppOwnerAbove**

FluxOS API endpoint GET /apps/removeobject (operationId fluxRemoveobject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- object (query, string, required): path name inside volume with file/folder name
Responses: 200 OK.

## Download file (GET /apps/downloadfile) <https://docs.runonflux.io/fluxapi/volume-browser/fluxdownloadfile>

Download file. **AppOwnerAbove**

FluxOS API endpoint GET /apps/downloadfile (operationId fluxDownloadFile, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- file (query, string, required): full path inside volume to file
Responses: 200 OK.

## Download folder as gzip file (GET /apps/downloadfolder) <https://docs.runonflux.io/fluxapi/volume-browser/fluxdownloadfolder>

Download folder as gzip file. **AppOwnerAbove**

FluxOS API endpoint GET /apps/downloadfolder (operationId fluxDownloadFolder, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required)
- component (query, string, required)
- folder (query, string, required): full path inside volume to folder
Responses: 200 OK.

## Get volume data of a component (GET /backup/getvolumedataofcomponent) <https://docs.runonflux.io/fluxapi/backuprestore/fluxgetvolumedataofcomponent>

Get volume data of a component. **AppOwnerAbove**

FluxOS API endpoint GET /backup/getvolumedataofcomponent (operationId fluxGetvolumedataofcomponent, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name of the application
- component (query, string, required): Component of application
- multiplier (query, string): Multiplier value (B, KB, MB, GB, TB)
- decimal (query, number): Decimal value
- fields (query, string, required): Fields to include, possibls mount, size, used, available, capacity, filesystem separate with coma
Responses: 200 OK.

## Get size of a remote file. **AppOwnerAbove** (GET /backup/getremotefilesize) <https://docs.runonflux.io/fluxapi/backuprestore/fluxgetremotefilesize>

Get size of a remote file. **AppOwnerAbove**

FluxOS API endpoint GET /backup/getremotefilesize (operationId fluxGetremotefilesize, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- fileurl (query, string, required): Remote URL
- multiplier (query, string): Multiplier value (B, KB, MB, GB, TB)
- decimal (query, number): Decimal value
- number (query, boolean): return only number
- appname (query, string): Application name
Responses: 200 OK.

## Get the list of local backups based on the provided appname (GET /backup/getlocalbackuplist) <https://docs.runonflux.io/fluxapi/backuprestore/fluxgetlocalbackuplist>

Get the list of local backups based on the provided appname. **AppOwnerAbove**

FluxOS API endpoint GET /backup/getlocalbackuplist (operationId fluxGetlocalbackuplist, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- path (query, string, required): Full path
- multiplier (query, string): Multiplier value (B, KB, MB, GB, TB)
- decimal (query, number): Decimal value
- number (query, boolean): return only number
- appname (query, string): Application name
Responses: 200 OK.

## Remove a backup file. (GET /backup/removebackupfile) <https://docs.runonflux.io/fluxapi/backuprestore/fluxremovebackupfile>

Remove a backup file.**AppOwnerAbove**

FluxOS API endpoint GET /backup/removebackupfile (operationId fluxRemovebackupfile, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- filepath (query, string, required): Full path
- appname (query, string, required): Application name
Responses: 200 OK.

## Download a local backup file (GET /backup/downloadlocalfile) <https://docs.runonflux.io/fluxapi/backuprestore/fluxdownloadlocalfile>

Download a local backup file. **AppOwnerAbove**

FluxOS API endpoint GET /backup/downloadlocalfile (operationId fluxDownloadlocalfile, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- filepath (query, string, required): Full path
- appname (query, string, required): Application name
Responses: 200 OK.

## Append backup task to an application (POST /apps/appendbackuptask) <https://docs.runonflux.io/fluxapi/backuprestore/fluxappendbackuptask>

Append backup task to an application. **AppOwnerAbove**

FluxOS API endpoint POST /apps/appendbackuptask (operationId fluxAppendbackuptask, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname (string), backup (array)
Responses: 200 OK.

## Append restore task to an application (POST /apps/appendrestoretask) <https://docs.runonflux.io/fluxapi/backuprestore/fluxappendrestoretask>

Append restore task to an application. **AppOwnerAbove**

FluxOS API endpoint POST /apps/appendrestoretask (operationId fluxAppendrestoretask, Backup/Restore). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname (string), backup (array)
Responses: 200 OK.

## Upload file (POST /ioutils/fileupload) <https://docs.runonflux.io/fluxapi/ioutils/fileupload>

Uploads a file to the specified location. **AppOwnerAbove**

FluxOS API endpoint POST /ioutils/fileupload (operationId fileUpload, IOUtils). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- type (query, string, required): Type of upload (backup or volume)
- appname (query, string, required): Name of the application
- component (query, string, required): Component of application
- folder (query, string): Full path inside volume to the folder
- filename (query, string): Name of the file to be uploaded. If not provided, the file will be uploaded with its original name.
Request body (multipart/form-data): file (string)
Responses: 200 OK.

## RPC list (GET /daemon/help) <https://docs.runonflux.io/fluxapi/daemon/help>

Gets list of RPC for the Flux daemon or if command query is used it will respond with the help info for that specified call. **Public**

FluxOS API endpoint GET /daemon/help (operationId help, Daemon). Public, no login.
Parameters:
- command (query, string): Accepts both help/command and ?command=getinfo. If omited, default help will be displayed.
Responses: 200 OK.

## Flux daemon info (GET /daemon/getinfo) <https://docs.runonflux.io/fluxapi/daemon/getinfo>

Returns an object containing various state info for the Flux daemon.

The `balance` field is **redacted for unauthenticated callers** — send a node-operator `zelidauth` header to receive it. Everything else is public. **Public**

FluxOS API endpoint GET /daemon/getinfo (operationId getInfo, Daemon). Public, no login.
Responses: 200 OK; 500 Internal server error; 503 Daemon unavailable.

## Flux node status (GET /daemon/getfluxnodestatus) <https://docs.runonflux.io/fluxapi/daemon/getfluxnodestatus>

Returns an object containing various state of the Flux node. **Public**

FluxOS API endpoint GET /daemon/getfluxnodestatus (operationId getFluxNodeStatus, Daemon). Public, no login.
Responses: 200 OK.

## Flux node list (GET /daemon/listfluxnodes) <https://docs.runonflux.io/fluxapi/daemon/listfluxnodes>

Gets a ranked list of Flux nodes. **Public**

FluxOS API endpoint GET /daemon/listfluxnodes (operationId listFluxNodes, Daemon). Public, no login.
Parameters:
- filter (query, string): Filter the list by FluxNode public key, payment address or collateral `txid:index`
Responses: 200 OK.

## Deterministic FluxNode list (GET /daemon/viewdeterministicfluxnodelist) <https://docs.runonflux.io/fluxapi/daemon/viewdeterministicfluxnodelist>

View deterministic list of FluxNodes by rank. **Public**

FluxOS API endpoint GET /daemon/viewdeterministicfluxnodelist (operationId viewDeterministicFluxNodeList, Daemon). Public, no login.
Parameters:
- filter (query, string): Accepts both viewdeterministicfluxnodelist/filter and ?filter=193.188.15.238. Filter query will filter list by ,txhash, payment address, ip, or pubkey. If ommi…
Responses: 200 OK.

## Flux node count (GET /daemon/getfluxnodecount) <https://docs.runonflux.io/fluxapi/daemon/getfluxnodecount>

Returns a count of FluxNodes and enabled FluxNodes categorized by tiers. **Public**

FluxOS API endpoint GET /daemon/getfluxnodecount (operationId getFluxNodeCount, Daemon). Public, no login.
Responses: 200 OK.

## FluxNode DOS list (GET /daemon/getdoslist) <https://docs.runonflux.io/fluxapi/daemon/getdoslist>

Get a list of all fluxnodes in the DOS list. **Public**

FluxOS API endpoint GET /daemon/getdoslist (operationId getDOSList, Daemon). Public, no login.
Responses: 200 OK.

## FluxNode start list (GET /daemon/getstartlist) <https://docs.runonflux.io/fluxapi/daemon/getstartlist>

Get a list of all Fluxnodes in the start list. **Public**

FluxOS API endpoint GET /daemon/getstartlist (operationId getStartList, Daemon). Public, no login.
Responses: 200 OK.

## Current list of winners (GET /daemon/fluxnodecurrentwinner) <https://docs.runonflux.io/fluxapi/daemon/fluxnodecurrentwinner>

Gets a list of current FluxNode winners. **Public**

FluxOS API endpoint GET /daemon/fluxnodecurrentwinner (operationId FluxNodeCurrentWinner, Daemon). Public, no login.
Responses: 200 OK.

## Block hash of tip on longest chain (GET /daemon/getbestblockhash) <https://docs.runonflux.io/fluxapi/daemon/getbestblockhash>

Returns the hash of the best (tip) block in the longest block chain. **Public**

FluxOS API endpoint GET /daemon/getbestblockhash (operationId getBestBlockHash, Daemon). Public, no login.
Responses: 200 OK.

## Get block data (GET /daemon/getblock) <https://docs.runonflux.io/fluxapi/daemon/getblock>

Gets block data using block height or block hash you specify to get info for with verbosity option. **Public**

FluxOS API endpoint GET /daemon/getblock (operationId getBlock, Daemon). Public, no login.
Parameters:
- hashheight (query, integer, required): Block hash or height
- verbosity (query, integer): If verbosity is 0, returns a string that is serialized, hex-encoded data for the block. If verbosity is 1, returns an Object with information about the block. …
Responses: 200 OK.

## Blockchain info (GET /daemon/getblockchaininfo) <https://docs.runonflux.io/fluxapi/daemon/getblockchaininfo>

Returns an object containing various state info regarding block chain processing. Note that when the chain tip is at the last block before a network upgrade activation, consensus.chaintip != consensus.nextblock. **Public**

FluxOS API endpoint GET /daemon/getblockchaininfo (operationId getBlockchainInfo, Daemon). Public, no login.
Responses: 200 OK.

## Current block count (GET /daemon/getblockcount) <https://docs.runonflux.io/fluxapi/daemon/getblockcount>

Returns the number of blocks in the best valid block chain, i.e. the current block height. **Public**

FluxOS API endpoint GET /daemon/getblockcount (operationId getBlockCount, Daemon). Public, no login.
Responses: 200 OK.

## Get block deltas data (GET /daemon/getblockdeltas) <https://docs.runonflux.io/fluxapi/daemon/getblockdeltas>

Returns data of block deltas. **Public**

FluxOS API endpoint GET /daemon/getblockdeltas (operationId getblockdeltas, Daemon). Public, no login.
Parameters:
- hash (query, string, required): Block hash
Responses: 200 OK.

## Get block's hash (GET /daemon/getblockhash) <https://docs.runonflux.io/fluxapi/daemon/getblockhash>

Returns hash of block in best-block-chain at index provided. **Public**

FluxOS API endpoint GET /daemon/getblockhash (operationId getBlockHash, Daemon). Public, no login.
Parameters:
- index (query, number, required): Block number to get hash of
Responses: 200 OK.

## Block header info (GET /daemon/getblockheader) <https://docs.runonflux.io/fluxapi/daemon/getblockheader>

Returns an Object with information about blockheader. **Public**

FluxOS API endpoint GET /daemon/getblockheader (operationId getBlockHeader, Daemon). Public, no login.
Parameters:
- hash (query, string, required): Block hash to get header info from
- verbose (query, boolean): If verbose is false, returns a string that is serialized, hex-encoded data for blockheader 'hash'. If verbose is true, returns an Object with information about…
Responses: 200 OK.

## List of known chain tips (GET /daemon/getchaintips) <https://docs.runonflux.io/fluxapi/daemon/getchaintips>

Return information about all known tips in the block tree, including the main chain as well as orphaned branches. **Public**

FluxOS API endpoint GET /daemon/getchaintips (operationId getChainTips, Daemon). Public, no login.
Responses: 200 OK.

## Proof of work difficulty (GET /daemon/getdifficulty) <https://docs.runonflux.io/fluxapi/daemon/getdifficulty>

Returns the proof-of-work difficulty as a multiple of the minimum difficulty. **Public**

FluxOS API endpoint GET /daemon/getdifficulty (operationId getDifficulty, Daemon). Public, no login.
Responses: 200 OK.

## Memory pool info (GET /daemon/getmempoolinfo) <https://docs.runonflux.io/fluxapi/daemon/getmempoolinfo>

Returns details on the active state of the TX memory pool. **Public**

FluxOS API endpoint GET /daemon/getmempoolinfo (operationId getMempoolInfo, Daemon). Public, no login.
Responses: 200 OK.

## Transaction ids in memory pool (GET /daemon/getrawmempool) <https://docs.runonflux.io/fluxapi/daemon/getrawmempool>

Returns all transaction ids in memory pool as a json array of string. **Public**

FluxOS API endpoint GET /daemon/getrawmempool (operationId getRawMemPool, Daemon). Public, no login.
Parameters:
- verbose (query, boolean): True for a json object, false for array of transaction ids.
Responses: 200 OK.

## Transaction IDs in memory pool (GET /daemon/gettxout) <https://docs.runonflux.io/fluxapi/daemon/gettxout>

Returns all transaction ids in memory pool as a json array of string. **Public**

FluxOS API endpoint GET /daemon/gettxout (operationId getTxOut, Daemon). Public, no login.
Parameters:
- txid (query, string, required): The transaction id
- n (query, integer, required): Vout value
- includemempool (query, boolean): Whether to include the mempool. Example: - `txid`=`<transaction id>`&`n`=`<vout value>`&`includemempool`=`true`
Responses: 200 OK.

## Hex-encoded proof of transaction (GET /daemon/gettxoutproof) <https://docs.runonflux.io/fluxapi/daemon/gettxoutproof>

Returns a hex-encoded proof that "txid" was included in a block. **Public**

FluxOS API endpoint GET /daemon/gettxoutproof (operationId getTxOutProof, Daemon). Public, no login.
Parameters:
- txids (query, string, required): The transaction id or comma separated list of txids
- blockhash (query, string): If specified, looks for txid in the block with this hash
Responses: 200 OK.

## Unspent transaction output set info (GET /daemon/gettxoutsetinfo) <https://docs.runonflux.io/fluxapi/daemon/gettxoutsetinfo>

Returns statistics about the unspent transaction output set. **Public**

FluxOS API endpoint GET /daemon/gettxoutsetinfo (operationId getTxOutSetInfo, Daemon). Public, no login.
Responses: 200 OK.

## Verifies a proof (GET /daemon/verifytxoutproof) <https://docs.runonflux.io/fluxapi/daemon/verifytxoutproof>

Verifies that a proof points to a transaction in a block, returning the transaction it commits to and throwing an RPC error if the block is not in our best chain. **Public**

FluxOS API endpoint GET /daemon/verifytxoutproof (operationId verifyTxOutProof, Daemon). Public, no login.
Parameters:
- proof (query, string, required): The hex-encoded proof generated by gettxoutproof
Responses: 200 OK.

## Return spent info (GET /daemon/getspentinfo) <https://docs.runonflux.io/fluxapi/daemon/getspentinfo>

Return spent info. Transaction ID and index required as parameters. **Public**

FluxOS API endpoint GET /daemon/getspentinfo (operationId Getspentinfo, Daemon). Public, no login.
Parameters:
- txid (query, string, required): The transaction id
- index (query, integer, required): index
Responses: 200 OK.

## Return spent info, POST (POST /daemon/getspentinfo) <https://docs.runonflux.io/fluxapi/daemon/getspentinfopost>

Return spent info, with the transaction id and output index sent in the request body. **Public**

FluxOS API endpoint POST /daemon/getspentinfo (operationId GetspentinfoPost, Daemon). Public, no login.
Request body (application/json): txid (string), index (integer)
Responses: 200 OK.

## Block reward (GET /daemon/getblocksubsidy) <https://docs.runonflux.io/fluxapi/daemon/getblocksubsidy>

Returns block subsidy reward, taking into account the mining slow start of block at index provided. **Public**

FluxOS API endpoint GET /daemon/getblocksubsidy (operationId getBlockSubsidy, Daemon). Public, no login.
Parameters:
- height (query, string): The block height. If not provided, defaults to the current height of the chain.
Responses: 200 OK.

## Data to construct a block (GET /daemon/getblocktemplate) <https://docs.runonflux.io/fluxapi/daemon/getblocktemplate>

It returns data needed to construct a block to work on. **Public**

FluxOS API endpoint GET /daemon/getblocktemplate (operationId getBlockTemplate, Daemon). Public, no login.
Parameters:
- jsonrequestobject (query, object): If the request parameters include a 'mode' key, that is used to explicitly select between the default template request or a proposal. This must be set to "temp…
Responses: 200 OK.

## Average solutions per second (GET /daemon/getlocalsolps) <https://docs.runonflux.io/fluxapi/daemon/getlocalsolps>

Returns the average local solutions per second since this node was started. **Public**

FluxOS API endpoint GET /daemon/getlocalsolps (operationId getLocalSolPs, Daemon). Public, no login.
Responses: 200 OK.

## Mining related info (GET /daemon/getmininginfo) <https://docs.runonflux.io/fluxapi/daemon/getmininginfo>

Returns a json object containing mining-related information. **Public**

FluxOS API endpoint GET /daemon/getmininginfo (operationId getMiningInfo, Daemon). Public, no login.
Responses: 200 OK.

## Estimated network solutions (GET /daemon/getnetworkhashps) <https://docs.runonflux.io/fluxapi/daemon/getnetworkhashps>

Returns the estimated network solutions per second based on the last n blocks. **Public**

FluxOS API endpoint GET /daemon/getnetworkhashps (operationId getNetworkHashPs, Daemon). Public, no login.
Parameters:
- blocks (query, integer): The number of blocks, or -1 for blocks over difficulty averaging window.
- height (query, integer): To estimate at the time of the given height.
Responses: 200 OK.

## Estimated network solutions (GET /daemon/getnetworksolps) <https://docs.runonflux.io/fluxapi/daemon/getnetworksolps>

Returns the estimated network solutions per second based on the last n blocks. **Public**

FluxOS API endpoint GET /daemon/getnetworksolps (operationId getNetworkSolPs, Daemon). Public, no login.
Parameters:
- blocks (query, integer): The number of blocks, or -1 for blocks over difficulty averaging window.
- height (query, integer): To estimate at the time of the given height.
Responses: 200 OK.

## Connection count (GET /daemon/getconnectioncount) <https://docs.runonflux.io/fluxapi/daemon/getconnectioncount>

The peer connection count. **Public**

FluxOS API endpoint GET /daemon/getconnectioncount (operationId getConnectionCount, Daemon). Public, no login.
Responses: 200 OK.

## Deprecation info (GET /daemon/getdeprecationinfo) <https://docs.runonflux.io/fluxapi/daemon/getdeprecationinfo>

Returns an object containing current version and deprecation block height. Applicable only on mainnet. **Public**

FluxOS API endpoint GET /daemon/getdeprecationinfo (operationId getDeprecationInfo, Daemon). Public, no login.
Responses: 200 OK.

## Network traffic info (GET /daemon/getnettotals) <https://docs.runonflux.io/fluxapi/daemon/getnettotals>

Returns information about network traffic, including bytes in, bytes out, and current time. **Public**

FluxOS API endpoint GET /daemon/getnettotals (operationId getNetTotals, Daemon). Public, no login.
Responses: 200 OK.

## Info regarding P2P network (GET /daemon/getnetworkinfo) <https://docs.runonflux.io/fluxapi/daemon/getnetworkinfo>

Returns an object containing various state info regarding P2P networking. **Public**

FluxOS API endpoint GET /daemon/getnetworkinfo (operationId getNetworkInfo, Daemon). Public, no login.
Responses: 200 OK.

## Peer info (GET /daemon/getpeerinfo) <https://docs.runonflux.io/fluxapi/daemon/getpeerinfo>

Returns data about each connected network node as a json array of objects. **Public**

FluxOS API endpoint GET /daemon/getpeerinfo (operationId getPeerInfo, Daemon). Public, no login.
Responses: 200 OK.

## Ban list (GET /daemon/listbanned) <https://docs.runonflux.io/fluxapi/daemon/listbanned>

List all banned IPs/Subnets. **Public**

FluxOS API endpoint GET /daemon/listbanned (operationId listBanned, Daemon). Public, no login.
Responses: 200 OK.

## Create raw transaction (GET) (GET /daemon/createrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/createrawtransaction>

Create a raw transaction using path parameters. **Public**

FluxOS API endpoint GET /daemon/createrawtransaction (operationId createRawTransaction, Daemon). Public, no login.
Parameters:
- transactions (query, string, required): JSON string of transaction inputs
- addresses (query, string, required): JSON string of output addresses and amounts
- locktime (query, integer): Transaction locktime
- expiryheight (query, integer): Transaction expiry height
Responses: 200 OK.

## Create hex-encoded raw transaction (POST /daemon/createrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/createrawtransactionpost>

Create a transaction spending the given inputs and sending to the given addresses. Returns hex-encoded raw transaction. Note that the transaction's inputs are not signed, and it is not stored in the wallet or transmitted to the network. **Public**

FluxOS API endpoint POST /daemon/createrawtransaction (operationId createRawTransactionPost, Daemon). Public, no login.
Request body (text/plain): transactions (array), addresses (object), locktime (integer), expiryheight (string)
Responses: 200 OK.

## Decoded info of the hex-encoded transaction (GET /daemon/decoderawtransaction) <https://docs.runonflux.io/fluxapi/daemon/decoderawtransaction>

Return a JSON object representing the serialized, hex-encoded transaction. **Public**

FluxOS API endpoint GET /daemon/decoderawtransaction (operationId decodeRawTransaction, Daemon). Public, no login.
Parameters:
- hexstring (query, string, required): Hex-encoded transaction
Responses: 200 OK.

## Decoded info of the hex-encoded transaction (POST /daemon/decoderawtransaction) <https://docs.runonflux.io/fluxapi/daemon/decoderawtransactionpost>

Return a JSON object representing the serialized, hex-encoded transaction. **Public**

FluxOS API endpoint POST /daemon/decoderawtransaction (operationId decodeRawTransactionPost, Daemon). Public, no login.
Request body (text/plain): hexstring (string)
Responses: 200 OK.

## Decode hex script (GET /daemon/decodescript) <https://docs.runonflux.io/fluxapi/daemon/decodescript>

Decode a hex-encoded script. **Public**

FluxOS API endpoint GET /daemon/decodescript (operationId decodeScript, Daemon). Public, no login.
Parameters:
- hex (query, string, required): Hex-encoded transaction
Responses: 200 OK.

## Decode hex script (POST /daemon/decodescript) <https://docs.runonflux.io/fluxapi/daemon/decodescriptpost>

Decode a hex-encoded script. **Public**

FluxOS API endpoint POST /daemon/decodescript (operationId decodeScriptPost, Daemon). Public, no login.
Request body (text/plain): hex (string)
Responses: 200 OK.

## Get raw transaction data (GET /daemon/getrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/getrawtransaction>

Gets raw transaction data from the txid, if verbose=0 then only hex data of transaction is shown, if verbose=1 then it will return with object of info of txid. **Public**

FluxOS API endpoint GET /daemon/getrawtransaction (operationId getRawTransaction, Daemon). Public, no login.
Parameters:
- txid (query, string, required): Txid to get raw tx data from
- verbose (query, number): If verbose is not set or at 0 only hex-encoded data for the txid will return but if set at 1 it will return an object with info of the txid.
Responses: 200 OK.

## Add inputs to a transaction (GET /daemon/fundrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/fundrawtransaction>

Add inputs to a transaction until it has enough in value to meet its out value. This will not modify existing inputs, and will add one change output to the outputs. Note that inputs which were signed may need to be resigned after completion since in/outputs have been added. The inputs added will not be signed, use signrawtransaction for that. **Public**

FluxOS API endpoint GET /daemon/fundrawtransaction (operationId fundRawTransaction, Daemon). Public, no login.
Parameters:
- hexstring (query, string, required): Hex string of raw transaction
Responses: 200 OK.

## Add inputs to a transaction (POST /daemon/fundrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/fundrawtransactionpost>

Add inputs to a transaction until it has enough in value to meet its out value. This will not modify existing inputs, and will add one change output to the outputs. Note that inputs which were signed may need to be resigned after completion since in/outputs have been added. The inputs added will not be signed, use signrawtransaction for that. **Public**

FluxOS API endpoint POST /daemon/fundrawtransaction (operationId fundRawTransactionPost, Daemon). Public, no login.
Request body (text/plain): hex (string)
Responses: 200 OK.

## Send raw transaction (GET /daemon/sendrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/sendrawtransaction>

Submits raw transaction (serialized, hex-encoded) to local node and network. Also see createrawtransaction and signrawtransaction calls. **Public**

FluxOS API endpoint GET /daemon/sendrawtransaction (operationId sendRawTransaction, Daemon). Public, no login.
Parameters:
- hexstring (query, string, required): The hex string of the raw transaction
- allowhighfees (query, boolean): Allow high fees. - `hexstring`=`<Hex string of raw tx>`&`allowhighfees`=`true`
Responses: 200 OK.

## Send raw transaction (POST /daemon/sendrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/sendrawtransactionpost>

Submits raw transaction (serialized, hex-encoded) to local node and network. Also see createrawtransaction and signrawtransaction calls. **Public**

FluxOS API endpoint POST /daemon/sendrawtransaction (operationId sendRawTransactionPost, Daemon). Public, no login.
Request body (text/plain): hexstring (string), allowhighfees (boolean)
Responses: 200 OK.

## Create multi-sig address (GET /daemon/createmultisig) <https://docs.runonflux.io/fluxapi/daemon/createmultisig>

Creates a multi-signature address with n signature of n keys required. **Public**

FluxOS API endpoint GET /daemon/createmultisig (operationId createMultiSig, Daemon). Public, no login.
Parameters:
- n (query, integer, required): The number of required signatures out of the n keys or addresses. Followed by Flux addresses in array of strings.
- keys (query, array, required): A json array of keys which are Flux addresses or hex-encoded public keys. Example: - `["t1XcXfRFSnSeYmf2mbsMHzHbV8Qo5Zhk817","t1RAxsCaeeqB2XbZqvYU87uTMo9K2RtcA…
Responses: 200 OK.

## Create multi-sig address (POST /daemon/createmultisig) <https://docs.runonflux.io/fluxapi/daemon/createmultisigpost>

Creates a multi-signature address with n signature of n keys required. **Public**

FluxOS API endpoint POST /daemon/createmultisig (operationId createMultiSigPost, Daemon). Public, no login.
Request body (text/plain): n (integer), keys (array)
Responses: 200 OK.

## Estimate fee nblocks (GET /daemon/estimatefee) <https://docs.runonflux.io/fluxapi/daemon/estimatefee>

Estimates the approximate fee per kilobyte needed for a transaction to begin confirmation within nblocks blocks. **Public**

FluxOS API endpoint GET /daemon/estimatefee (operationId estimateFee, Daemon). Public, no login.
Parameters:
- nblocks (query, integer, required): Number of nblocks
Responses: 200 OK.

## Estimate priority nblocks (GET /daemon/estimatepriority) <https://docs.runonflux.io/fluxapi/daemon/estimatepriority>

Estimates the approximate priority a zero-fee transaction needs to begin confirmation within nblocks blocks. **Public**

FluxOS API endpoint GET /daemon/estimatepriority (operationId estimatePriority, Daemon). Public, no login.
Parameters:
- nblocks (query, integer, required): Number of nblocks
Responses: 200 OK.

## Info of the Flux address (GET /daemon/validateaddress) <https://docs.runonflux.io/fluxapi/daemon/validateaddress>

Return information about the given Flux address.

The `ismine` and `iswatchonly` fields are **redacted for unauthenticated callers** — they describe this node's wallet, so a node-operator `zelidauth` header is required to receive them. **Public**

FluxOS API endpoint GET /daemon/validateaddress (operationId validateAddress, Daemon). Public, no login.
Parameters:
- fluxaddress (query, string, required): Flux address to validate
Responses: 200 OK.

## Verify a message (GET /daemon/verifymessage) <https://docs.runonflux.io/fluxapi/daemon/verifymessage>

Verify a signed message. **Public**

FluxOS API endpoint GET /daemon/verifymessage (operationId verifyMessage, Daemon). Public, no login.
Parameters:
- fluxaddress (query, string, required): The Flux address to use for the signature
- signature (query, string, required): The signature provided by the signer in base 64 encoding
- message (query, string, required): The message that was signed
Responses: 200 OK.

## Verify a message (POST /daemon/verifymessage) <https://docs.runonflux.io/fluxapi/daemon/verifymessagepost>

Verify a signed message. **Public**

FluxOS API endpoint POST /daemon/verifymessage (operationId verifyMessagePost, Daemon). Public, no login.
Request body (text/plain): fluxaddress (string), signature (string), message (string)
Responses: 200 OK.

## Information about in-wallet transaction (GET /daemon/gettransaction) <https://docs.runonflux.io/fluxapi/daemon/gettransaction>

Get detailed information about in-wallet transaction. **Public**

FluxOS API endpoint GET /daemon/gettransaction (operationId getTransaction, Daemon). Public, no login.
Parameters:
- txid (query, string, required): The transaction id
- includewatchonly (query, boolean): Whether to include watchonly addresses in balance calculation and details. Example: - `txid`=`<transaction id>`&`includewatchonly`=`true`
Responses: 200 OK.

## Information about given z address (GET /daemon/zvalidateaddress) <https://docs.runonflux.io/fluxapi/daemon/zvalidateaddress>

Return information about the given z address. **Public**

FluxOS API endpoint GET /daemon/zvalidateaddress (operationId zValidateAddress, Daemon). Public, no login.
Parameters:
- zaddr (query, string, required): The z address to validate
Responses: 200 OK.

## Benchmark results (GET /daemon/getbenchmarks) <https://docs.runonflux.io/fluxapi/daemon/getbenchmarks>

Return most recent benchmark results. **Public**

FluxOS API endpoint GET /daemon/getbenchmarks (operationId getBenchmarks, Daemon). Public, no login.
Responses: 200 OK.

## Bench status (GET /daemon/getbenchstatus) <https://docs.runonflux.io/fluxapi/daemon/getbenchstatus>

This will return the status of the node, what fluxbenchd determined the tier the server could pass for, and if Flux backend is connected. If any one of these return a negative result the FluxNode will fail to confirm. **Public**

FluxOS API endpoint GET /daemon/getbenchstatus (operationId getBenchStatus, Daemon). Public, no login.
Responses: 200 OK.

## Get block hashes (GET /daemon/getblockhashes) <https://docs.runonflux.io/fluxapi/daemon/getblockhashes>

Returns array of block hashes for given height range. **Public**

FluxOS API endpoint GET /daemon/getblockhashes (operationId getBlockHashes, Daemon). Public, no login.
Parameters:
- high (query, integer): Ending block height
- low (query, integer): Starting block height
- noOrphans (query, boolean): Exclude orphan blocks. Note the camel-case spelling — the daemon reads `noOrphans`, not `noorphans`.
- logicalTimes (query, boolean): Include logical times. Note the camel-case spelling — the daemon reads `logicalTimes`, not `logicaltimes`.
Responses: 200 OK.

## Get block hashes (POST) (POST /daemon/getblockhashes) <https://docs.runonflux.io/fluxapi/daemon/getblockhashespost>

Returns array of block hashes for given height range. **Public**

FluxOS API endpoint POST /daemon/getblockhashes (operationId getBlockHashesPost, Daemon). Public, no login.
Request body (application/json): high (integer), low (integer), noorphans (boolean), logicaltimes (boolean)
Responses: 200 OK.

## Get address transaction IDs (GET /daemon/getaddresstxids) <https://docs.runonflux.io/fluxapi/daemon/getsingleaddressstxids>

Get all transaction IDs for a specific address. **Public**

FluxOS API endpoint GET /daemon/getaddresstxids (operationId getSingleAddresssTxids, Daemon). Public, no login.
Parameters:
- address (query, string, required): Flux address to query
- start (query, integer): Starting block height
- end (query, integer): Ending block height
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address transaction IDs (POST) (POST /daemon/getaddresstxids) <https://docs.runonflux.io/fluxapi/daemon/getaddresstxids>

Get all transaction IDs for multiple addresses. **Public**

FluxOS API endpoint POST /daemon/getaddresstxids (operationId getAddressTxids, Daemon). Public, no login.
Request body (application/json): addresses (array), start (integer), end (integer)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address balance (GET /daemon/getaddressbalance) <https://docs.runonflux.io/fluxapi/daemon/getsingleaddressbalance>

Get balance for a specific address. **Public**

FluxOS API endpoint GET /daemon/getaddressbalance (operationId getSingleAddressBalance, Daemon). Public, no login.
Parameters:
- address (query, string, required): Flux address to query
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address balance (POST) (POST /daemon/getaddressbalance) <https://docs.runonflux.io/fluxapi/daemon/getaddressbalance>

Get balance for multiple addresses. **Public**

FluxOS API endpoint POST /daemon/getaddressbalance (operationId getAddressBalance, Daemon). Public, no login.
Request body (application/json): addresses (array)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address deltas (GET /daemon/getaddressdeltas) <https://docs.runonflux.io/fluxapi/daemon/getsingleaddressdeltas>

Get balance changes (deltas) for a specific address. **Public**

FluxOS API endpoint GET /daemon/getaddressdeltas (operationId getSingleAddressDeltas, Daemon). Public, no login.
Parameters:
- address (query, string, required): Flux address to query
- start (query, integer): Starting block height
- end (query, integer): Ending block height
- chaininfo (query, boolean): Include chain information
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address deltas (POST) (POST /daemon/getaddressdeltas) <https://docs.runonflux.io/fluxapi/daemon/getaddressdeltas>

Get balance changes for multiple addresses. **Public**

FluxOS API endpoint POST /daemon/getaddressdeltas (operationId getAddressDeltas, Daemon). Public, no login.
Request body (application/json): addresses (array), start (integer), end (integer), chaininfo (boolean)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address UTXOs (GET /daemon/getaddressutxos) <https://docs.runonflux.io/fluxapi/daemon/getsingleaddressutxos>

Get unspent transaction outputs for a specific address. **Public**

FluxOS API endpoint GET /daemon/getaddressutxos (operationId getSingleAddressUtxos, Daemon). Public, no login.
Parameters:
- address (query, string, required): Flux address to query
- chaininfo (query, boolean): Include chain information
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address UTXOs (POST) (POST /daemon/getaddressutxos) <https://docs.runonflux.io/fluxapi/daemon/getaddressutxos>

Get UTXOs for multiple addresses. **Public**

FluxOS API endpoint POST /daemon/getaddressutxos (operationId getAddressUtxos, Daemon). Public, no login.
Request body (application/json): addresses (array), chaininfo (boolean)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address mempool transactions (GET /daemon/getaddressmempool) <https://docs.runonflux.io/fluxapi/daemon/getsingleaddressmempool>

Get mempool transactions for a specific address. **Public**

FluxOS API endpoint GET /daemon/getaddressmempool (operationId getSingleAddressMempool, Daemon). Public, no login.
Parameters:
- address (query, string, required): Flux address to query
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Get address mempool (POST) (POST /daemon/getaddressmempool) <https://docs.runonflux.io/fluxapi/daemon/getaddressmempool>

Get mempool transactions for multiple addresses. **Public**

FluxOS API endpoint POST /daemon/getaddressmempool (operationId getAddressMempool, Daemon). Public, no login.
Request body (application/json): addresses (array)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Send from account (GET /daemon/sendfrom) <https://docs.runonflux.io/fluxapi/daemon/sendfrom>

Send Flux from a specific account to an address. **Admin**

FluxOS API endpoint GET /daemon/sendfrom (operationId sendFrom, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- tofluxaddress (query, string, required): Destination Flux address
- amount (query, number, required): Amount to send
- minconf (query, integer): Minimum confirmations
- comment (query, string): Transaction comment
- commentto (query, string): Comment for recipient
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Send from account (POST) (POST /daemon/sendfrom) <https://docs.runonflux.io/fluxapi/daemon/sendfrompost>

Send Flux from account using POST method. **Admin**

FluxOS API endpoint POST /daemon/sendfrom (operationId sendFromPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (application/json): tofluxaddress* (string), amount* (number), minconf (integer), comment (string), commentto (string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Submit block (GET /daemon/submitblock) <https://docs.runonflux.io/fluxapi/daemon/submitblock>

Submit a block to the network. **User**

FluxOS API endpoint GET /daemon/submitblock (operationId submitBlock, Daemon). Requires Flux ID login, privilege User.
Parameters:
- hexdata (query, string, required): Block data in hex format
- jsonparametersobject (query, string): Optional JSON parameters
Responses: 200 OK.

## Submit block (POST) (POST /daemon/submitblock) <https://docs.runonflux.io/fluxapi/daemon/submitblockpost>

Submit a block using POST method. **User**

FluxOS API endpoint POST /daemon/submitblock (operationId submitBlockPost, Daemon). Requires Flux ID login, privilege User.
Request body (application/json): hexdata* (string), jsonparametersobject (string)
Responses: 200 OK.

## ZCash raw joinsplit (GET /daemon/zcrawjoinsplit) <https://docs.runonflux.io/fluxapi/daemon/zcrawjoinsplit>

Create a raw joinsplit transaction. **Admin**

FluxOS API endpoint GET /daemon/zcrawjoinsplit (operationId zcRawJoinSplit, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- rawtx (query, string, required): Raw transaction hex
- inputs (query, string, required): JSON string of inputs
- outputs (query, string, required): JSON string of outputs
- vpubold (query, number, required): Public input value
- vpubnew (query, number, required): Public output value
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## ZCash raw joinsplit (POST) (POST /daemon/zcrawjoinsplit) <https://docs.runonflux.io/fluxapi/daemon/zcrawjoinsplitpost>

Create raw joinsplit using POST method. **Admin**

FluxOS API endpoint POST /daemon/zcrawjoinsplit (operationId zcRawJoinSplitPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (application/json): rawtx* (string), inputs* (string), outputs* (string), vpubold* (number), vpubnew* (number)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## ZCash raw receive (GET /daemon/zcrawreceive) <https://docs.runonflux.io/fluxapi/daemon/zcrawreceive>

Decrypt and return information about a note. **Admin**

FluxOS API endpoint GET /daemon/zcrawreceive (operationId zcRawReceive, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- zcsecretkey (query, string, required): Secret key for decryption
- encryptednote (query, string, required): Encrypted note hex
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## ZCash raw receive (POST) (POST /daemon/zcrawreceive) <https://docs.runonflux.io/fluxapi/daemon/zcrawreceivepost>

Decrypt note using POST method. **Admin**

FluxOS API endpoint POST /daemon/zcrawreceive (operationId zcRawReceivePost, Daemon). Requires Flux ID login, privilege Admin.
Request body (application/json): zcsecretkey* (string), encryptednote* (string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Priortise a transaction (GET /daemon/prioritisetransaction) <https://docs.runonflux.io/fluxapi/daemon/prioritisetransaction>

Accepts the transaction into mined blocks at a higher (or lower) priority. **User**

FluxOS API endpoint GET /daemon/prioritisetransaction (operationId prioritiseTransaction, Daemon). Requires Flux ID login, privilege User.
Parameters:
- txid (query, string, required): The transaction id
- prioritydelta (query, integer, required): The priority to add or subtract. The transaction selection algorithm considers the tx as it would have a higher priority. (priority of a transaction is calcula…
- feedelta (query, integer, required): The fee value (in satoshis) to add (or subtract, if negative). The fee is not actually paid, only the algorithm for selecting transactions into a block conside…
Responses: 200 OK.

## Reindex Flux daemon (GET /daemon/reindex) <https://docs.runonflux.io/fluxapi/daemon/reindexflux>

Tries to reindex Flux daemon running on the FluxNode the call is run against. Flux daemon is firstly stopped and then started with reindex flag. **Admin**

FluxOS API endpoint GET /daemon/reindex (operationId reindexFlux, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Stop Flux daemon (GET /daemon/stop) <https://docs.runonflux.io/fluxapi/daemon/stop>

This will stop the Flux daemon from running. **Admin**

FluxOS API endpoint GET /daemon/stop (operationId stop, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Create fluxnode private key (GET /daemon/createfluxnodekey) <https://docs.runonflux.io/fluxapi/daemon/createfluxnodekey>

Create a new fluxnode private key. **Admin**

FluxOS API endpoint GET /daemon/createfluxnodekey (operationId createFluxNodeKey, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## The fluxnode conf file (GET /daemon/listfluxnodeconf) <https://docs.runonflux.io/fluxapi/daemon/listfluxnodeconf>

View fluxnode conf file in JSON format, this will return empty for most unless running a hot wallet. **Admin**

FluxOS API endpoint GET /daemon/listfluxnodeconf (operationId listFluxNodeConf, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- filter (query, string): Filter the configuration entries returned
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Fluxnode transaction outputs (GET /daemon/getfluxnodeoutputs) <https://docs.runonflux.io/fluxapi/daemon/getfluxnodeoutputs>

Print all fluxnode transaction outputs. **Admin**

FluxOS API endpoint GET /daemon/getfluxnodeoutputs (operationId getFluxNodeOutputs, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Start FluxNode commmand (GET /daemon/startfluxnode) <https://docs.runonflux.io/fluxapi/daemon/startfluxnode>

Attempts to start one or more FluxNode. This call will only work if running a hot FluxNode which is highly not recommended. It is a control wallet function so basically your wallet containing the collateral funds. **Admin**

FluxOS API endpoint GET /daemon/startfluxnode (operationId startFluxNode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- set (query, string, required): Specify which set of FluxNode(s) to start.
- lockwallet (query, boolean, required): Lock wallet after completion. Example: - `set`=`<alias>`&`lockwallet`=`false`
- alias (query, string, required): FluxNode alias. Required if using 'alias' as the set.
Responses: 200 OK.

## Start fluxnode command (GET /daemon/startdeterministicfluxnode) <https://docs.runonflux.io/fluxapi/daemon/startdeterministicfluxnode>

Attempts to start one fluxnode. Same as the `/daemon/startfluxnode` call this call will only work if running a hot FluxNode which is highly not recommended. It is a control wallet function so basically your wallet containing the collateral funds.  **Admin**

FluxOS API endpoint GET /daemon/startdeterministicfluxnode (operationId startDeterministicFluxNode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- alias (query, string, required): Node name or alias.
- lockwallet (query, boolean, required): Lock wallet after completion. Example: - `alias`=`<alias`&`lockwallet`=`false`
Responses: 200 OK.

## Verify blockchain data (GET /daemon/verifychain) <https://docs.runonflux.io/fluxapi/daemon/verifychain>

Verifies blockchain database. **Admin**

FluxOS API endpoint GET /daemon/verifychain (operationId verifyChain, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- checklevel (query, integer): How thorough the block verification is. Example: - `checklevel`=`1`
- numblocks (query, integer): The number of blocks to check
Responses: 200 OK.

## Add, remove, or try to connect a node (GET /daemon/addnode) <https://docs.runonflux.io/fluxapi/daemon/addnode>

Attempts to add or remove a node from the addnode list. Or try a connection to a node once. **Admin**

FluxOS API endpoint GET /daemon/addnode (operationId addNode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- node (query, string, required): The node's ip:port (see `/daemon/getpeerinfo` for nodes)
- command (query, string, required): Use 'add' to add a node to the list, 'remove' to remove a node from the list, 'onetry' to try a connection to the node once. Example: - `node`=`<ip:port>`&`com…
Responses: 200 OK.

## Clear banned IP's (GET /daemon/clearbanned) <https://docs.runonflux.io/fluxapi/daemon/clearbanned>

Clear all banned IP's. **Admin**

FluxOS API endpoint GET /daemon/clearbanned (operationId clearBanned, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Disconnect a node (GET /daemon/disconnectnode) <https://docs.runonflux.io/fluxapi/daemon/disconnectnode>

Immediately disconnects from the specified node. **Admin**

FluxOS API endpoint GET /daemon/disconnectnode (operationId disconnectNode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- node (query, string, required): The node's ip:port
Responses: 200 OK.

## Info of added node/nodes (GET /daemon/getaddednodeinfo) <https://docs.runonflux.io/fluxapi/daemon/getaddednodeinfo>

Returns information about the given added node, or all added nodes(note that onetry addnodes are not listed here). If dns is false, only a list of added nodes will be provided, otherwise connected information will also be available. **Admin**

FluxOS API endpoint GET /daemon/getaddednodeinfo (operationId getAddedNodeInfo, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- dns (query, boolean, required): If false, only a list of added nodes will be provided, otherwise connected information will also be available.
- node (query, string): The node ip:port
Responses: 200 OK.

## Add or remove a IP from banned list (GET /daemon/setban) <https://docs.runonflux.io/fluxapi/daemon/setban>

Attempts add or remove a IP/Subnet from the banned list. **Admin**

FluxOS API endpoint GET /daemon/setban (operationId setBan, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- ip (query, string, required): The IP/Subnet (see getpeerinfo for nodes ip) with a optional netmask (default is /32 = single ip)
- command (query, string, required): Use 'add' to add a IP/Subnet to the list, 'remove' to remove a IP/Subnet from the list
- bantime (query, integer): Time in seconds how long (or until when if absolute is set) the ip is banned (0 or empty means using the default time of 24h which can also be overwritten by t…
- absolute (query, boolean): If set, the bantime must be a absolute timestamp in seconds since epoch (Jan 1 1970 GMT) Example: - `ip`=`<ipaddress>`&`command`=`<add/remove>`&`bantime`=`1590…
Responses: 200 OK.

## Sign raw transaction (GET /daemon/signrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/signrawtransaction>

Sign inputs for raw transaction (serialized, hex-encoded). The second optional argument (may be null) is an array of previous transaction outputs that this transaction depends on but may not yet be in the block chain. The third optional argument (may be null) is an array of base58-encoded private keys that, if given, will be the only keys used to sign the transaction. **Admin**

FluxOS API endpoint GET /daemon/signrawtransaction (operationId signRawTransaction, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- hexstring (query, string, required): Hex string of raw transaction
- prevtxs (query, array): An json array of previous dependent transaction outputs (json array of json objects, or null if none provided). List of objects key/value pairs in order: - `tx…
- privatekeys (query, array): A json array of base58-encoded private keys for signing (json array of strings, or null if none provided).
- sighashtype (query, string): The signature hash type. Must be one of the available values listed.
- branchid (query, string): The hex representation of the consensus branch id to sign with. This can be used to force signing with consensus rules that are ahead of the node's current hei…
Responses: 200 OK.

## Sign raw transaction (POST /daemon/signrawtransaction) <https://docs.runonflux.io/fluxapi/daemon/signrawtransactionpost>

Sign inputs for raw transaction (serialized, hex-encoded). The second optional argument (may be null) is an array of previous transaction outputs that this transaction depends on but may not yet be in the block chain. The third optional argument (may be null) is an array of base58-encoded private keys that, if given, will be the only keys used to sign the transaction. **Admin**

FluxOS API endpoint POST /daemon/signrawtransaction (operationId signRawTransactionPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): hexstring (string), prevtxs (array), privatekeys (array), sighashtype (string), branchid (string)
Responses: 200 OK.

## Add multisig address to the wallet (GET /daemon/addmultisigaddress) <https://docs.runonflux.io/fluxapi/daemon/addmultisigaddress>

Add a nrequired-to-sign multisignature address to the wallet. Each key is a Flux address or hex-encoded public key. **Admin**

FluxOS API endpoint GET /daemon/addmultisigaddress (operationId addmultisigaddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- n (query, integer, required): The number of required signatures out of the n keys or addresses
- keysobject (query, array, required): A json array of Flux addresses or hex-encoded public keys. Example: - `keysobject`=`[<"address">, <"address">]`
Responses: 200 OK.

## Add multisig address to the wallet (POST /daemon/addmultisigaddress) <https://docs.runonflux.io/fluxapi/daemon/addmultisigaddresspost>

Add a nrequired-to-sign multisignature address to the wallet. Each key is a Flux address or hex-encoded public key. **Admin**

FluxOS API endpoint POST /daemon/addmultisigaddress (operationId addMultiSigAddressPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): n (string), keysobject (array)
Responses: 200 OK.

## Backup wallet to destination file (GET /daemon/backupwallet) <https://docs.runonflux.io/fluxapi/daemon/backupwallet>

Safely copies wallet.dat to destination filename. **Admin**

FluxOS API endpoint GET /daemon/backupwallet (operationId backupWallet, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- destination (query, string, required): The destination filename, saved in the directory set by -exportdir option
Responses: 200 OK.

## Get private key of a t-addr (GET /daemon/dumpprivkey) <https://docs.runonflux.io/fluxapi/daemon/dumpprivkey>

Reveals the private key corresponding to t-addr. **Admin**

FluxOS API endpoint GET /daemon/dumpprivkey (operationId dumpPrivKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- taddr (query, string, required): The transparent address for the private key
Responses: 200 OK.

## Total balance of wallet (GET /daemon/getbalance) <https://docs.runonflux.io/fluxapi/daemon/getbalance>

Returns the server's total available balance. **Admin**

FluxOS API endpoint GET /daemon/getbalance (operationId getBalance, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- minconf (query, integer): Only include transactions confirmed at least this many times
- includewatchonly (query, boolean): Also include balance in watchonly addresses. Example: - `includewatchonly`=`true`
Responses: 200 OK.

## Get new address (GET /daemon/getnewaddress) <https://docs.runonflux.io/fluxapi/daemon/getnewaddress>

Returns a new Flux address for receiving payments. **Admin**

FluxOS API endpoint GET /daemon/getnewaddress (operationId getNewAddress, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Get new change address (GET /daemon/getrawchangeaddress) <https://docs.runonflux.io/fluxapi/daemon/getrawchangeaddress>

Returns a new Flux address, for receiving change. This is for use with raw transactions, NOT normal use. **Admin**

FluxOS API endpoint GET /daemon/getrawchangeaddress (operationId getRawChangeAddress, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Total received by the address (GET /daemon/getreceivedbyaddress) <https://docs.runonflux.io/fluxapi/daemon/getreceivedbyaddress>

Returns the total amount received by the given Flux address in transactions with at least minconf confirmations. **Admin**

FluxOS API endpoint GET /daemon/getreceivedbyaddress (operationId getReceivedByAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fluxaddress (query, string, required): The Flux address for transactions
- minconf (query, integer): Only include transactions confirmed at least this many times
Responses: 200 OK.

## Get total unconfirmed balance (GET /daemon/getunconfirmedbalance) <https://docs.runonflux.io/fluxapi/daemon/getunconfirmedbalance>

Returns the server's total unconfirmed balance. **Admin**

FluxOS API endpoint GET /daemon/getunconfirmedbalance (operationId getUnconfirmedBalance, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Get various info of the wallet (GET /daemon/getwalletinfo) <https://docs.runonflux.io/fluxapi/daemon/getwalletinfo>

Returns an object containing various wallet state info. **Admin**

FluxOS API endpoint GET /daemon/getwalletinfo (operationId getWalletInfo, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Import address to watch (GET /daemon/importaddress) <https://docs.runonflux.io/fluxapi/daemon/importaddress>

Adds an address or script (in hex) that can be watched as if it were in your wallet but cannot be used to spend. **Admin**

FluxOS API endpoint GET /daemon/importaddress (operationId importAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- address (query, string, required): The Flux address
- label (query, string): Optional label
- rescan (query, boolean): Rescan the wallet for transactions (This call can take some time to complete if rescan is true)
Responses: 200 OK.

## Import private key to the wallet (GET /daemon/importprivkey) <https://docs.runonflux.io/fluxapi/daemon/importprivkey>

Adds a private key (as returned by dumpprivkey) to your wallet. **Admin**

FluxOS API endpoint GET /daemon/importprivkey (operationId importPrivKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fluxprivkey (query, string, required): The private key
- label (query, string): Optional label
- rescan (query, boolean): Rescan the wallet for transactions (This call can take some time to complete if rescan is true)
Responses: 200 OK.

## Import private keys from the dump file (GET /daemon/importwallet) <https://docs.runonflux.io/fluxapi/daemon/importwallet>

Imports taddr keys from a wallet dump file. **Admin**

FluxOS API endpoint GET /daemon/importwallet (operationId importWallet, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- filename (query, string, required): The name of backup
Responses: 200 OK.

## Refill keypool (GET /daemon/keypoolrefill) <https://docs.runonflux.io/fluxapi/daemon/keypoolrefill>

Fills the keypool with more keys. Rarely used as not many will come close to using more than it comes with by default. **Admin**

FluxOS API endpoint GET /daemon/keypoolrefill (operationId keyPoolRefill, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- newsize (query, integer, required): The new keypool size
Responses: 200 OK.

## A list of addresses that have been used and known to the public (GET /daemon/listaddressgroupings) <https://docs.runonflux.io/fluxapi/daemon/listaddressgroupings>

Lists groups of addresses which have had their common ownership made public by common use as inputs or as the resulting change in past transactions. **Admin**

FluxOS API endpoint GET /daemon/listaddressgroupings (operationId listAddressGroupings, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## List of unspendable outputs (GET /daemon/listlockunspent) <https://docs.runonflux.io/fluxapi/daemon/listlockunspent>

Returns list of temporarily unspendable outputs. **Admin**

FluxOS API endpoint GET /daemon/listlockunspent (operationId listLockUnspent, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## List of balances (GET /daemon/listreceivedbyaddress) <https://docs.runonflux.io/fluxapi/daemon/listreceivedbyaddress>

List balances by receiving address. **Admin**

FluxOS API endpoint GET /daemon/listreceivedbyaddress (operationId listReceivedByAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- minconf (query, integer): The minimum number of confirmations before payments are included
- includeempty (query, boolean): Whether to include addresses that haven't received any payments
- includewatchonly (query, boolean): Whether to include watchonly addresses
Responses: 200 OK.

## List of transactions since block (blockhash) (GET /daemon/listsinceblock) <https://docs.runonflux.io/fluxapi/daemon/listsinceblock>

Get all transactions in blocks since block [blockhash], or all transactions if omitted. **Admin**

FluxOS API endpoint GET /daemon/listsinceblock (operationId listSinceBlock, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- blockhash (query, string): The block hash to list transactions since
- targetconfirmations (query, integer): The confirmations required, must be 1 or more
- includewatchonly (query, boolean): Whether to include watchonly addresses
Responses: 200 OK.

## List of recent transactions (GET /daemon/listtransactions) <https://docs.runonflux.io/fluxapi/daemon/listtransactions>

Returns up to count most recent transactions skipping the first from transactions for account 'account'. **Admin**

FluxOS API endpoint GET /daemon/listtransactions (operationId listTransactions, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- count (query, integer): The number of transactions to return
- from (query, integer): The number of transactions to skip
- includewatchonly (query, boolean): Whether to include watchonly addresses
Responses: 200 OK.

## Returns objects of unspent transactions (GET /daemon/listunspent) <https://docs.runonflux.io/fluxapi/daemon/listunspent>

Returns array of unspent transaction outputs with between minconf and maxconf (inclusive) confirmations. Optionally filter to only include txouts paid to specified addresses. Results are an array of Objects, each of which has: (txid, vout, scriptPubKey, amount, confirmations). **Admin**

FluxOS API endpoint GET /daemon/listunspent (operationId listUnspent, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- minconf (query, integer): The minimum confirmations to filter
- maxconf (query, integer): The maximum confirmations to filter
- addresses (query, array): A json array of Flux addresses to filter. Examples: - `addresses`=`["taadr", "taddr"]` - `addresses`=`<taadr>`&`addresses`=`<addr>` If filtering a single addre…
Responses: 200 OK.

## Updates list of temporarily unspendable outputs (GET /daemon/lockunspent) <https://docs.runonflux.io/fluxapi/daemon/lockunspent>

Temporarily lock (unlock=false) or unlock (unlock=true) specified transaction outputs. A locked transaction output will not be chosen by automatic coin selection, when spending Flux. Locks are stored in memory only. Nodes start with zero locked outputs, and the locked output list is always cleared (by virtue of process exit) when a node stops or fails. **Admin**

FluxOS API endpoint GET /daemon/lockunspent (operationId lockUnspent, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- unlock (query, boolean, required): Whether to unlock (true) or lock (false) the specified transactions
- transactions (query, array, required): Each transaction the txid and vout key/value pair is both required. - `txid`:`<transaction id>` - `vout`:`<output index>` Url encoded example: - `unlock`=`<tru…
Responses: 200 OK.

## Rescans blockchain for transactions (GET /daemon/rescanblockchain) <https://docs.runonflux.io/fluxapi/daemon/rescanblockchain>

Rescans the blockchain looking for transactions that belong to this wallet. **Admin**

FluxOS API endpoint GET /daemon/rescanblockchain (operationId rescanBlockchain, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- startheight (query, integer): Block height to start rescan from
Responses: 200 OK.

## Send to many receivers at once (GET /daemon/sendmany) <https://docs.runonflux.io/fluxapi/daemon/sendmany>

Send to many receivers. Amounts are decimal numbers with at most 8 digits of precision. **Admin**

FluxOS API endpoint GET /daemon/sendmany (operationId sendMany, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- amounts (query, object, required): A json object with addresses and amounts. The Flux address is the key, the numeric amount in FLUX is the value.
- minconf (query, number): Only use the balance confirmed at least this many times
- comment (query, string): A comment used to store what the transaction is for. This is not part of the transaction, just kept in your wallet.
- substractfeefromamount (query, array): Subtract the transaction fee equally from the output amounts.
Responses: 200 OK.

## Send to many receivers at once (POST /daemon/sendmany) <https://docs.runonflux.io/fluxapi/daemon/sendmanypost>

Send to many receivers. Amounts are decimal numbers with at most 8 digits of precision. **Admin**

FluxOS API endpoint POST /daemon/sendmany (operationId sendManyPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): amounts (object), minconf (integer), comment (string), substractfeefromamount (array)
Responses: 200 OK.

## Send Flux to an address (GET /daemon/sendtoaddress) <https://docs.runonflux.io/fluxapi/daemon/sendtoaddress>

Send an amount to a given address. **Admin**

FluxOS API endpoint GET /daemon/sendtoaddress (operationId sendToAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fluxaddress (query, string, required)
- amount (query, number, required): The amount in FLUX to send
- comment (query, string): A comment used to store what the transaction is for. This is not part of the transaction, just kept in your wallet.
- commentto (query, string): A comment to store the name of the person or organization to which you're sending the transaction. This is not part of the transaction, just kept in your walle…
- substractfeefromamount (query, boolean): The fee will be deducted from the amount being sent if set to true and the recipient will receive less Flux than you enter in the amount field.
Responses: 200 OK.

## Send Flux to an address (POST /daemon/sendtoaddress) <https://docs.runonflux.io/fluxapi/daemon/sendtoaddresspost>

Send an amount to a given address. **Admin**

FluxOS API endpoint POST /daemon/sendtoaddress (operationId sendToAddressPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): fluxaddress (string), amount (number), comment (string), commentto (string), substractfeefromamount (boolean)
Responses: 200 OK.

## Set transaction fee (GET /daemon/settxfee) <https://docs.runonflux.io/fluxapi/daemon/settxfee>

This will restart the Flux daemon. **Admin**

FluxOS API endpoint GET /daemon/settxfee (operationId setTxFee, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- amount (query, number, required): The transaction fee in FLUX/kB rounded to the nearest 0.00000001
Responses: 200 OK.

## Sign a message (GET /daemon/signmessage) <https://docs.runonflux.io/fluxapi/daemon/signmessage>

Sign a message with the private key of a t-addr. **Admin**

FluxOS API endpoint GET /daemon/signmessage (operationId signMessage, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- taddr (query, string, required): The transparent address to use for the private key
- message (query, string, required): The message to create a signature of
Responses: 200 OK.

## Sign a message (POST /daemon/signmessage) <https://docs.runonflux.io/fluxapi/daemon/signmessagepost>

Sign a message with the private key of a t-addr. **Admin**

FluxOS API endpoint POST /daemon/signmessage (operationId signMessagePost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): taddr (string), message (string)
Responses: 200 OK.

## Reveal z-addr private key (GET /daemon/zexportkey) <https://docs.runonflux.io/fluxapi/daemon/zexportkey>

Reveals the zkey corresponding to zaddr. **Admin**

FluxOS API endpoint GET /daemon/zexportkey (operationId zExportKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- zaddr (query, string, required): The zaddr for the private key
Responses: 200 OK.

## Reveal z-addr viewing key (GET /daemon/zexportviewingkey) <https://docs.runonflux.io/fluxapi/daemon/zexportviewingkey>

Reveals the viewing key corresponding to zaddr. Only works with sprout zaddr's. **Admin**

FluxOS API endpoint GET /daemon/zexportviewingkey (operationId zExportViewingKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- zaddr (query, string, required): The zaddr for the private key
Responses: 200 OK.

## Returns the balance of a taddr or zaddr (GET /daemon/zgetbalance) <https://docs.runonflux.io/fluxapi/daemon/zgetbalance>

Returns the balance of a taddr or zaddr belonging to the node's wallet. CAUTION If the wallet has only an incoming viewing key for this address, then spends cannot be detected, and so the returned balance may be larger than the actual balance. **Admin**

FluxOS API endpoint GET /daemon/zgetbalance (operationId zGetBalance, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- address (query, string, required): Flux address
- minconf (query, integer): Only include transactions confirmed at least this many times
Responses: 200 OK.

## Returns status info of the sprout to sapling migration (GET /daemon/zgetmigrationstatus) <https://docs.runonflux.io/fluxapi/daemon/zgetmigrationstatus>

Returns information about the status of the Sprout to Sapling migration. Note that a transaction is defined as finalized if it has at least ten confirmations. Also, it is possible that manually created transactions involving this wallet will be included in the result. **Admin**

FluxOS API endpoint GET /daemon/zgetmigrationstatus (operationId zGetMigrationStatus, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Create new shielded address (GET /daemon/zgetnewaddress) <https://docs.runonflux.io/fluxapi/daemon/zgetnewaddress>

Returns a new shielded address for receiving payments. **Admin**

FluxOS API endpoint GET /daemon/zgetnewaddress (operationId zGetNewAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- type (query, string): The type of z-address. Example: - `type`=`sapling`
Responses: 200 OK.

## Get operation result (GET /daemon/zgetoperationresult) <https://docs.runonflux.io/fluxapi/daemon/zgetoperationresult>

Retrieve the result and status of an operation which has finished, and then remove the operation from memory. **Admin**

FluxOS API endpoint GET /daemon/zgetoperationresult (operationId zGetOperationResult, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- operationid (query, array): List of operation ids. If not provided, examine all operations known to the node. Example: - `operationid`=`["opid-6869eaa7-722f-4991-9a6e-fd6b4c388755"]`
Responses: 200 OK.

## Get operation status (GET /daemon/zgetoperationstatus) <https://docs.runonflux.io/fluxapi/daemon/zgetoperationstatus>

Get operation status and any associated result or error data.  The operation will remain in memory. **Admin**

FluxOS API endpoint GET /daemon/zgetoperationstatus (operationId zGetOperationStatus, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- operationid (query, array): List of operation ids. If not provided, examine all operations known to the node. Example: - `operationid`=`["opid-bdf41571-3a20-4a00-bbf2-d4e9ddbb3375"]`
Responses: 200 OK.

## Get total balance of wallet (GET /daemon/zgettotalbalance) <https://docs.runonflux.io/fluxapi/daemon/zgettotalbalance>

Return the total value of funds stored in the node's wallet. **Admin**

FluxOS API endpoint GET /daemon/zgettotalbalance (operationId zGetTotalBalance, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- minconf (query, integer): Only include private and transparent transactions confirmed at least this many times
- includewatchonly (query, boolean): Also include balance in watchonly addresses
Responses: 200 OK.

## Import zaddress private key (GET /daemon/zimportkey) <https://docs.runonflux.io/fluxapi/daemon/zimportkey>

Adds a zkey to your wallet. **Admin**

FluxOS API endpoint GET /daemon/zimportkey (operationId zImportKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- zkey (query, string, required): The zkey
- rescan (query, string): Rescan the wallet for transactions. Example: - `zkey`=`<z private key>`&`rescan`=`yes`
- startheight (query, integer): Block height to start rescan from
Responses: 200 OK.

## Import zaddress viewing key (GET /daemon/zimportviewingkey) <https://docs.runonflux.io/fluxapi/daemon/zimportviewingkey>

Adds a viewing key to your wallet. **Admin**

FluxOS API endpoint GET /daemon/zimportviewingkey (operationId zImportViewingKey, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- vkey (query, string, required): The viewing key
- rescan (query, string): Rescan the wallet for transactions. E.g. ?vkey=...&rescan=yes
- startheight (query, integer): Block height to start rescan from
Responses: 200 OK.

## Import wallet from export file (GET /daemon/zimportwallet) <https://docs.runonflux.io/fluxapi/daemon/zimportwallet>

Imports taddr and zaddr keys from a wallet export file. **Admin**

FluxOS API endpoint GET /daemon/zimportwallet (operationId zImportWallet, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- filename (query, string, required): The wallet file
Responses: 200 OK.

## Get list of all shielded addresses (GET /daemon/zlistaddresses) <https://docs.runonflux.io/fluxapi/daemon/zlistaddresses>

Returns the list of Sprout and Sapling shielded addresses belonging to the wallet. **Admin**

FluxOS API endpoint GET /daemon/zlistaddresses (operationId zListAddresses, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- includewatchonly (query, boolean): Also include watchonly addresses
Responses: 200 OK.

## Get list of operation ids (GET /daemon/zlistoperationids) <https://docs.runonflux.io/fluxapi/daemon/zlistoperationids>

Returns the list of operation ids currently known to the wallet. **Admin**

FluxOS API endpoint GET /daemon/zlistoperationids (operationId zListOperationIds, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## List of amounts received by zaddr (GET /daemon/zlistreceivedbyaddress) <https://docs.runonflux.io/fluxapi/daemon/zlistreceivedbyaddress>

Return a list of amounts received by a zaddr belonging to the node's wallet. **Admin**

FluxOS API endpoint GET /daemon/zlistreceivedbyaddress (operationId zListReceivedByAddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- address (query, string, required): The shielded address
- minconf (query, integer): Only include transactions confirmed at least this many times
Responses: 200 OK.

## List of unspent shielded notes (GET /daemon/zlistunspent) <https://docs.runonflux.io/fluxapi/daemon/zlistunspent>

Returns array of unspent shielded notes with between minconf and maxconf (inclusive) confirmations. **Admin**

FluxOS API endpoint GET /daemon/zlistunspent (operationId zListUnspent, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- minconf (query, integer): The minimum confirmations to filter
- maxconf (query, integer): The maximum confirmations to filter
- includewatchonly (query, boolean): Also include watchonly addresses
- addresses (query, array): Array of zaddrs (both Sprout and Sapling) to filter on. Duplicate addresses not allowed. Example: - `addresses`=`["za1kqwgkln5azfnnzfps0vc44ucwynstxk9k79z6nunw…
Responses: 200 OK.

## Send multiple transactions (GET /daemon/zsendmany) <https://docs.runonflux.io/fluxapi/daemon/zsendmany>

Send multiple times. Amounts are decimal numbers with at most 8 digits of precision. Change generated from a taddr flows to a new taddr address, while change generated from a zaddr returns to itself. When sending coinbase UTXOs to a zaddr, change is not allowed. The entire value of the UTXO(s) must be consumed. Before Acadia (Sapling) activates, the maximum number of zaddr outputs is 54 due to transaction size limits. **Admin**

FluxOS API endpoint GET /daemon/zsendmany (operationId zSendMany, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fromaddress (query, string, required): The taddr or zaddr to send the funds from
- amounts (query, array, required): An array of json objects representing the amounts to send. Key/value pairs in order: - `address`: `<receiving address>` - `amount`: `<flux amount>` Url encoded…
- minconf (query, integer): Only use funds confirmed at least this many times
- fee (query, number): The fee amount to attach to this transaction
Responses: 200 OK.

## Send multiple transactions (POST /daemon/zsendmany) <https://docs.runonflux.io/fluxapi/daemon/zsendmanypost>

Send multiple times. Amounts are decimal numbers with at most 8 digits of precision. Change generated from a taddr flows to a new taddr address, while change generated from a zaddr returns to itself. When sending coinbase UTXOs to a zaddr, change is not allowed. The entire value of the UTXO(s) must be consumed. Before Acadia (Sapling) activates, the maximum number of zaddr outputs is 54 due to transaction size limits. **Admin**

FluxOS API endpoint POST /daemon/zsendmany (operationId zSendManyPost, Daemon). Requires Flux ID login, privilege Admin.
Request body (text/plain): fromaddress (string), amounts (array), minconf (integer), fee (number)
Responses: 200 OK.

## Migrate funds to a sapling adress (GET /daemon/zsetmigration) <https://docs.runonflux.io/fluxapi/daemon/zsetmigration>

When enabled the Sprout to Sapling migration will attempt to migrate all funds from this wallet’s sprout addresses to either the address for sapling account 0 or the address specified by the parameter '-migrationdestaddress'. This migration is designed to minimize information leakage. As a result for wallets with a significant sprout balance, this process may take several weeks. The migration works by sending, up to 5, as many transactions as possible whenever the blockchain reaches a height equal to 499 modulo 500. The transaction amounts are picked according to the random distribution specified in ZIP 308. The migration will end once the wallet’s sprout balance is below 0.01 FLUX. **Admin**

FluxOS API endpoint GET /daemon/zsetmigration (operationId zSetMigration, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- enabled (query, boolean, required): True or false to enable or disable respectively
Responses: 200 OK.

## Shield coinbase (GET /daemon/zshieldcoinbase) <https://docs.runonflux.io/fluxapi/daemon/zshieldcoinbase>

Shield transparent coinbase funds by sending to a shielded zaddr. This is an asynchronous operation and utxos selected for shielding will be locked. If there is an error, they are unlocked.  The RPC call listlockunspent can be used to return a list of locked utxos.  The number of coinbase utxos selected for shielding can be limited by the caller. If the limit parameter is set to zero, and Overwinter is not yet active, the -mempooltxinputlimit option will determine the number of uxtos. Any limit is constrained by the consensus rule defining a maximum transaction size of 100000 bytes before Acadia (Sapling,) and 2000000 bytes once Acadia (Sapling) activates.. **Admin**

FluxOS API endpoint GET /daemon/zshieldcoinbase (operationId zShieldCoinBase, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fromaddress (query, string, required): The address is a taddr or "*" for all taddrs belonging to the wallet
- toaddress (query, string, required): Zaddr to shield funds to
- fee (query, number): The fee amount to attach to this transaction
- limit (query, integer): Limit on the maximum number of utxos to shield. Set to 0 to use node option -mempooltxinputlimit (before Overwinter), or as many as will fit in the transaction…
Responses: 200 OK.

## Start Flux daemon (GET /daemon/start) <https://docs.runonflux.io/fluxapi/daemon/startdaemonb>

Tries to start Flux daemon running on the FluxNode the call is run against without any extra parameters. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/start (operationId startdaemonB, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Restart Flux daemon (GET /daemon/restart) <https://docs.runonflux.io/fluxapi/daemon/restartdaemonb>

Tries to restart Flux daemon running on the FluxNode the call is run against. Flux daemon is firstly stopped and then started without any extra parameters. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/restart (operationId restartdaemonB, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Ping request to measure ping time (GET /daemon/ping) <https://docs.runonflux.io/fluxapi/daemon/ping>

Requests that a ping be sent to all other nodes, to measure ping time. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/ping (operationId ping, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Run benchmark of selected type and samplecount times (GET /daemon/zcbenchmark) <https://docs.runonflux.io/fluxapi/daemon/zcbenchmark>

Runs a benchmark of the selected type and samplecount times, returning the running times of each sample. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/zcbenchmark (operationId zcBenchmark, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- benchmarktype (query, string, required): Type of benchmark. Listed is just some of the benchmark types.
- samplecount (query, integer, required): Number of samples
Responses: 200 OK.

## Start Benchmark daemon (GET /daemon/startbenchmark) <https://docs.runonflux.io/fluxapi/daemon/daemonstartbenchmark>

Start Benchmark daemon. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/startbenchmark (operationId daemonstartbenchmark, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Stop Benchmark daemon (GET /daemon/stopbenchmark) <https://docs.runonflux.io/fluxapi/daemon/stopbenchmark>

Stop Benchmark daemon. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/stopbenchmark (operationId stopbenchmark, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Fluxbench status (GET /benchmark/getstatus) <https://docs.runonflux.io/fluxapi/benchmark/getstatus>

This will return the status of the node, what FluxBenchd determined the tier the server could pass for, and if Flux backend is connected. If any one of these return a negative result the FluxNode will fail to confirm. **Public**

FluxOS API endpoint GET /benchmark/getstatus (operationId getStatus, Benchmark). Public, no login.
Responses: 200 OK.

## Fluxbench calls (GET /benchmark/help) <https://docs.runonflux.io/fluxapi/benchmark/benchmarkhelp>

This will return with a list of calls for FluxBench. **Public**

FluxOS API endpoint GET /benchmark/help (operationId benchmarkHelp, Benchmark). Public, no login.
Parameters:
- command (query, string): Show help for this benchmark command only; the full command list when omitted
Responses: 200 OK.

## Benchmark results (GET /benchmark/getbenchmarks) <https://docs.runonflux.io/fluxapi/benchmark/getbenchmarksbenchmark>

Return most recent benchmark results. **Public**

FluxOS API endpoint GET /benchmark/getbenchmarks (operationId getBenchmarksBenchmark, Benchmark). Public, no login.
Responses: 200 OK.

## Fluxbench status (GET /benchmark/getinfo) <https://docs.runonflux.io/fluxapi/benchmark/benchmarkgetinfo>

This will return with the fluxbench status of the fluxnode. **Public**

FluxOS API endpoint GET /benchmark/getinfo (operationId benchmarkGetInfo, Benchmark). Public, no login.
Responses: 200 OK.

## Restart FluxBench daemon (GET /benchmark/restartnodebenchmarks) <https://docs.runonflux.io/fluxapi/benchmark/restartnodebenchmarks>

This will restart the FluxBench daemon and start bench process. **AdminAndFluxTeam**

FluxOS API endpoint GET /benchmark/restartnodebenchmarks (operationId restartNodeBenchmarks, Benchmark). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Stop fluxbench daemon (GET /benchmark/stop) <https://docs.runonflux.io/fluxapi/benchmark/stopbenchmarkaemon>

This will stop the fluxbench daemon. **Admin**

FluxOS API endpoint GET /benchmark/stop (operationId stopbenchmarkaemon, Benchmark). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## Sign FluxNode transaction (GET /benchmark/signfluxnodetransaction) <https://docs.runonflux.io/fluxapi/benchmark/signfluxnodetransaction>

Command to get FluxBenchd to sign a FluxNode broadcast. **Admin**

FluxOS API endpoint GET /benchmark/signfluxnodetransaction (operationId signFluxNodeTransaction, Benchmark). Requires Flux ID login, privilege Admin.
Parameters:
- hexstring (query, string, required): The hex encoded fluxnode broadcast message
Responses: 200 OK.

## Sign FluxNode transaction (POST /benchmark/signfluxnodetransaction) <https://docs.runonflux.io/fluxapi/benchmark/signfluxnodetransactionpost>

Command to get FluxBenchd to sign a FluxNode broadcast. **Admin**

FluxOS API endpoint POST /benchmark/signfluxnodetransaction (operationId signFluxNodeTransactionPost, Benchmark). Requires Flux ID login, privilege Admin.
Request body (text/plain): hexstring (string)
Responses: 200 OK.

## List of error messages (GET /syncthing/system/error) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemerrorget>

Get list with error message. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/error (operationId fluxSyncthingSystemErrorGET, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- message (query, string): When given, the call **registers** this text as a new Syncthing error instead of listing recent ones
Responses: 200 OK.

## Set an error message (POST /syncthing/system/error) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemerrorpost>

Post with an error message in the body (plain text) to register a new error. The new error will be displayed on any active GUI clients. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/system/error (operationId fluxSyncthingSystemErrorPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (text/plain): string
Responses: 200 OK.

## Remove all recent errors (GET /syncthing/system/error/clear) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemerrorclear>

Clears the Syncthing recent-error list on this node. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/error/clear (operationId fluxSyncthingSystemErrorClear, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Syncthing version information (GET /syncthing/system/version) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemversion>

Returns the current Syncthing version information. **Public**

FluxOS API endpoint GET /syncthing/system/version (operationId fluxSyncthingSystemVersion, Syncthing). Public, no login.
Responses: 200 OK.

## Checks for a possible upgrade (GET /syncthing/system/upgrade) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingupgradeget>

Checks for a possible upgrade and returns an object describing the newest version and upgrade possibility. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/upgrade (operationId fluxSyncthingUpgradeGET, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Perform an upgrade (POST /syncthing/system/upgrade) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingupgradepost>

Perform an upgrade to the newest released version and restart. Does nothing if there is no newer version than currently running. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/system/upgrade (operationId fluxSyncthingUpgradePOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns a list of directories (GET /syncthing/system/browse) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytembrowse>

Returns a list of directories matching the path given by the optional parameter *current*. The path can use patterns as described in Go’s filepath package. A ‘*’ will always be appended to the given path (e.g. /tmp/ matches all its subdirectories). If the option *current* is not given, filesystem root paths are returned. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/browse (operationId fluxSyncthingSysytemBrowse, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- current (query, string): Path name.
Responses: 200 OK.

## Pause the given device or all devices (GET /syncthing/system/pause) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytempause>

Pause the given device or all devices. Takes the optional parameter device (device ID). When omitted, pauses all devices. Returns status 200 and no content upon success, or status 500 and a plain text error on failure. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/pause (operationId fluxSyncthingSysytemPause, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- device (query, string): Device ID (optional).
Responses: 200 OK.

## Resume the given device or all devices (GET /syncthing/system/resume) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemresume>

Resume the given device or all devices. Takes the optional parameter device (device ID). When omitted, pauses all devices. Returns status 200 and no content upon success, or status 500 and a plain text error on failure. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/resume (operationId fluxSyncthingSysytemResume, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- device (query, string): Device ID (optional).
Responses: 200 OK.

## Restart Syncthing (GET /syncthing/system/restart) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemrestart>

Immediately restart Syncthing. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/restart (operationId fluxSyncthingSystemRestart, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Shutdown Syncthing (GET /syncthing/system/shutdown) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemshutdown>

Immediately shutdown Syncthing. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/shutdown (operationId fluxSyncthingSystemShutdown, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Erase the current index database and restart Syncthing (GET /syncthing/system/reset) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemreset>

Erase the current index database and restart Syncthing. With no query parameters, the entire database is erased from disk. By specifying the folder parameter with a valid folder ID, only information for that folder will be erased. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/reset (operationId fluxSyncthingSystemReset, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- folder (query, string): Folder ID (optional) <br><br>**Caution** See ***--reset-database*** for .stfolder creation side-effect and caution regarding mountpoints.
Responses: 200 OK.

## Status of Syncthing (GET /syncthing/system/status) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsystemstatus>

Returns information about current system status and resource usage. The CPU percent value has been deprecated from the API and will always report 0. **Public**

FluxOS API endpoint GET /syncthing/system/status (operationId fluxSyncthingSystemStatus, Syncthing). Public, no login.
Responses: 200 OK.

## Returns the path locations (GET /syncthing/system/paths) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytempath>

Returns the path locations used internally for storing configuration, database, and others. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/paths (operationId fluxSyncthingSysytemPath, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Returns the list of configured devices and some metadata associated with them (GET /syncthing/system/connections) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemconnections>

Returns the list of configured devices and some metadata associated with them. The list also contains the local device itself as not connected. The connection types are TCP (Client), TCP (Server), Relay (Client) and Relay (Server). **Public**

FluxOS API endpoint GET /syncthing/system/connections (operationId fluxSyncthingSysytemConnections, Syncthing). Public, no login.
Responses: 200 OK.

## Returns/Add local discovery cache (GET /syncthing/system/discovery) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemdiscovery>

Returns the contents of the local discovery cache. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/discovery (operationId fluxSyncthingSysytemDiscovery, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- device (query, string): DeviceID
- addr (query, string): Addres with port
Responses: 200 OK.

## Returns the set of debug facilities. (GET /syncthing/system/debug) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemdebug>

Returns the set of debug facilities and which of them are currently enabled. Enables or disables debugging for specified facilities. Give one or both of enable and disable query parameters, with comma separated facility names. To disable debugging of the beacon and discovery packages, and enable it for config and db. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/debug (operationId fluxSyncthingSysytemDebug, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- disable (query, string): List of facilities to disable (optional).
- enable (query, string): List of facilities to enable (optional).
Responses: 200 OK.

## Returns the list of recent log entries (GET /syncthing/system/log) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemlog>

Returns the list of recent log entries. The optional `since` parameter limits the results to message newer than the given timestamp in ***RFC 3339*** format. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/log (operationId fluxSyncthingSysytemLog, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- since (query, string): Timestamp in ***RFC 3339*** format (optional).
Responses: 200 OK.

## Returns the list of recent log entries as text (GET /syncthing/system/logtxt) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemlogtxt>

Returns the list of recent log entries as text. The optional `since` parameter limits the results to message newer than the given timestamp in ***RFC 3339*** format. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/system/logtxt (operationId fluxSyncthingSysytemLogTxt, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- since (query, string): Timestamp in ***RFC 3339*** format (optional).
Responses: 200 OK.

## Ping pong tester call (GET /syncthing/system/ping) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsysytemping>

Return ```{"ping": "pong"}``` object. **Public**

FluxOS API endpoint GET /syncthing/system/ping (operationId fluxSyncthingSysytemPing, Syncthing). Public, no login.
Responses: 200 OK.

## Returns config (GET /syncthing/config) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfig>

Returns the entire config. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/config (operationId fluxSyncthingConfig, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Replace the entire Syncthing configuration (POST /syncthing/config) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigpost>

Replaces this node&#39;s whole Syncthing configuration with the object sent in `config`. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config (operationId fluxSyncthingConfigPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns device config section (GET /syncthing/config/devices) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdevices>

Returns all devices as an array. Returns the device for the given ID. **Public**

FluxOS API endpoint GET /syncthing/config/devices (operationId fluxSyncthingConfigDevices, Syncthing). Public, no login.
Parameters:
- id (query, string): DeviceID
Responses: 200 OK.

## Replace the device config section (POST /syncthing/config/devices) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdevicespost>

Replaces the Syncthing device configuration section. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/devices (operationId fluxSyncthingConfigDevicesPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns folder config section (GET /syncthing/config/folders) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigfoldersget>

Returns all folders as an array. Returns the folders for the given ID. **Public**

FluxOS API endpoint GET /syncthing/config/folders (operationId fluxSyncthingConfigFoldersGET, Syncthing). Public, no login.
Parameters:
- id (query, string): FolderID
Responses: 200 OK.

## Replace folder config section (POST /syncthing/config/folders) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigfolderspost>

Replace folder config section. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/folders (operationId fluxSyncthingConfigFoldersPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): object
Responses: 200 OK.

## Returns a template folder configuration (GET /syncthing/config/defaults/folder) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdefaultsfolder>

Returns a template folder configuration object with all default values, which only needs a unique ID to be applied. **Public**

FluxOS API endpoint GET /syncthing/config/defaults/folder (operationId fluxSyncthingConfigDefaultsFolder, Syncthing). Public, no login.
Responses: 200 OK.

## Replace the default folder config (POST /syncthing/config/defaults/folder) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdefaultsfolderpost>

Replaces the template Syncthing applies to newly created folders. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/defaults/folder (operationId fluxSyncthingConfigDefaultsFolderPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns a template device configuration (GET /syncthing/config/defaults/device) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdefaultsdevice>

Returns a template device configuration object with all default values, which only needs a unique ID to be applied. **Public**

FluxOS API endpoint GET /syncthing/config/defaults/device (operationId fluxSyncthingConfigDefaultsDevice, Syncthing). Public, no login.
Responses: 200 OK.

## Replace the default device config (POST /syncthing/config/defaults/device) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdefaultsdevicepost>

Replaces the template Syncthing applies to newly added devices. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/defaults/device (operationId fluxSyncthingConfigDefaultsDevicePOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns an object with a single lines attribute (GET /syncthing/config/defaults/ignores) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigignores>

Returns an object with a single lines attribute listing ignore patterns to be used by default on folders, as an array of single-line strings. **Public**

FluxOS API endpoint GET /syncthing/config/defaults/ignores (operationId fluxSyncthingConfigIgnores, Syncthing). Public, no login.
Responses: 200 OK.

## Replace the default ignore patterns (POST /syncthing/config/defaults/ignores) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigdefaultsignorespost>

Replaces the ignore patterns applied to newly created folders. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/defaults/ignores (operationId fluxSyncthingConfigDefaultsIgnoresPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns the respective object (GET /syncthing/config/options) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigoptions>

GET returns the respective object, PUT replaces the entire object and PATCH replaces only the given child objects. **Public**

FluxOS API endpoint GET /syncthing/config/options (operationId fluxSyncthingConfigOptions, Syncthing). Public, no login.
Responses: 200 OK.

## Replace the options config section (POST /syncthing/config/options) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigoptionspost>

Replaces the Syncthing options configuration section. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/options (operationId fluxSyncthingConfigOptionsPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns the respective object of gui config (GET /syncthing/config/gui) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigguiget>

GET returns the respective object, PUT replaces the entire object and PATCH replaces only the given child objects. **FluxTeam**

FluxOS API endpoint GET /syncthing/config/gui (operationId fluxSyncthingConfigGuiGet, Syncthing). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK.

## Replaces the entire gui object in config (POST /syncthing/config/gui) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigguipost>

Replaces the entire gui object in config. **FluxTeam**

FluxOS API endpoint POST /syncthing/config/gui (operationId fluxSyncthingConfigGuiPost, Syncthing). Requires Flux ID login, privilege FluxTeam.
Request body (text/plain): config (object)
Responses: 200 OK.

## Returns the respective object (GET /syncthing/config/ldap) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigldapget>

GET returns the respective object, PUT replaces the entire object and PATCH replaces only the given child objects. **Public**

FluxOS API endpoint GET /syncthing/config/ldap (operationId fluxSyncthingConfigLdapGet, Syncthing). Public, no login.
Responses: 200 OK.

## Replaces the entire ldap config object (POST /syncthing/config/ldap) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigldappost>

Replaces the entire ldap config object. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/config/ldap (operationId fluxSyncthingConfigLdapPost, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object)
Responses: 200 OK.

## Status of restart required (GET /syncthing/config/restart-required) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingconfigrestartrequired>

GET returns whether a restart of Syncthing is required for the current config to take effect. **Public**

FluxOS API endpoint GET /syncthing/config/restart-required (operationId fluxSyncthingConfigRestartRequired, Syncthing). Public, no login.
Responses: 200 OK.

## Returns general statistics about devices (GET /syncthing/stats/device) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingstatsdevice>

Returns general statistics about devices. Currently, only contains the time the device was last seen and the last connection duration. **Public**

FluxOS API endpoint GET /syncthing/stats/device (operationId fluxSyncthingStatsDevice, Syncthing). Public, no login.
Responses: 200 OK.

## Returns general statistics about folder (GET /syncthing/stats/folder) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingstatsfolder>

Returns general statistics about folders. Currently contains the last scan time and the last synced file. **Public**

FluxOS API endpoint GET /syncthing/stats/folder (operationId fluxSyncthingStatsFolder, Syncthing). Public, no login.
Responses: 200 OK.

## Lists remote devices which have tried to connect (GET /syncthing/cluster/pending/devices) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingpendingdevice>

Lists remote devices which have tried to connect, but are not yet configured in our instance. **Public**

FluxOS API endpoint GET /syncthing/cluster/pending/devices (operationId fluxSyncthingPendingDevice, Syncthing). Public, no login.
Responses: 200 OK.

## Remove records about a pending remote device which tried to connect (POST /syncthing/cluster/pending/devices) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingpendingdevicespost>

Remove records about a pending remote device which tried to connect. Valid values for the device parameter are those from the corresponding GET /rest/cluster/pending/devices endpoint. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/cluster/pending/devices (operationId fluxSyncthingPendingDevicesPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): device (string)
Responses: 200 OK.

## Lists folders which remote devices have offered to us, but are not yet shared from our instance to them (GET /syncthing/cluster/pending/folders) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingpendingfolders>

Lists folders which remote devices have offered to us, but are not yet shared from our instance to them. Takes the optional ```device``` parameter to only return folders offered by a specific remote device. Other offering devices are also omitted from the result. **Public**

FluxOS API endpoint GET /syncthing/cluster/pending/folders (operationId fluxSyncthingPendingFolders, Syncthing). Public, no login.
Parameters:
- id (query, string): Device ID
Responses: 200 OK.

## Remove records about a pending folder announced from a remote device (POST /syncthing/cluster/pending/folders) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingpendingfolderspost>

Remove records about a pending folder announced from a remote device. Valid values for the folde parameters are those from the corresponding GET /rest/cluster/pending/folders endpoint. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/cluster/pending/folders (operationId fluxSyncthingPendingFoldersPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): folder (string)
Responses: 200 OK.

## Returns the list of errors encountered during scanning or pulling (GET /syncthing/folder/errors) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingfolderserror>

Takes one mandatory parameter, ```folder```, and returns the list of errors encountered during scanning or pulling. **Public**

FluxOS API endpoint GET /syncthing/folder/errors (operationId fluxSyncthingFoldersError, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Returns the list of archived files that could be recovered (GET /syncthing/folder/versions) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingfolderversions>

Takes one mandatory parameter, folder, and returns the list of archived files that could be recovered. How many versions are available depends on the File Versioning configuration. Each entry specifies when the file version was archived as the versionTime, the modTime when it was last modified before being archived, and the size in bytes. **Public**

FluxOS API endpoint GET /syncthing/folder/versions (operationId fluxSyncthingFolderVersions, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Restore versioned files in a folder (POST /syncthing/folder/versions) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingfolderversionspost>

Restores files from a folder&#39;s version archive. `folder` names the folder and `method` selects the HTTP verb Syncthing is asked with (`post` by default). **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/folder/versions (operationId fluxSyncthingFolderVersionsPOST, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): config (object), folder (string), method (string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Returns the directory tree of the global model (GET /syncthing/db/browse) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbbrowse>

Returns the directory tree of the global model. takes one mandatory ```folder``` parameter and two optional parameters ```levels``` and ```prefix```. **Public**

FluxOS API endpoint GET /syncthing/db/browse (operationId fluxSyncthingDbBrowse, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
- levels (query, number): Error level
- prefix (query, string): Prefix
Responses: 200 OK.

## Returns the completion percentage and byte / item counts (GET /syncthing/db/completion) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbcompletion>

Returns the completion percentage (0 to 100) and byte / item counts. Takes optional ```device``` and ```folder``` parameters. **Public**

FluxOS API endpoint GET /syncthing/db/completion (operationId fluxSyncthingDbCompletion, Syncthing). Public, no login.
Parameters:
- folder (query, string): Folder ID
- device (query, string): Device ID
Responses: 200 OK.

## Returns the content of the .stignore as the ignore field (GET /syncthing/db/ignores) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbignores>

Takes one parameter, ```folder```, and returns the content of the .stignore as the ignore field. A second field, expanded, provides a list of strings which represent globbing patterns described by gobwas/glob (based on standard wildcards) that match the patterns in .stignore and all the includes. If appropriate these globs are prepended by the following modifiers ! to negate the glob, (?i) to do case insensitive matching and (?d) to enable removing of ignored files in an otherwise empty directory. **Public**

FluxOS API endpoint GET /syncthing/db/ignores (operationId fluxSyncthingDbIgnores, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Updates the content of the .stignore (POST /syncthing/db/ignores) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbignorespost>

Expects a format similar to the output of GET /rest/db/ignores call, but only containing the ignore field (expanded field should be omitted). It takes one parameter, folder, and either updates the content of the .stignore echoing it back as a response, or returns an error. **FluxTeam**

FluxOS API endpoint POST /syncthing/db/ignores (operationId fluxSyncthingDbIgnoresPOST, Syncthing). Requires Flux ID login, privilege FluxTeam.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Returns the list of files which were changed locally in a receive-only folder (GET /syncthing/db/localchanged) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdblocalchanged>

Takes one mandatory parameter, ```folder```, and returns the list of files which were changed locally in a receive-only folder. Thus they differ from the global state and could be reverted by pulling from remote devices again. **Public**

FluxOS API endpoint GET /syncthing/db/localchanged (operationId fluxSyncthingDbLocalChanged, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Returns lists of files which are needed by this device in order for it to become in sync (GET /syncthing/db/need) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbneed>

Takes one mandatory parameter, folder, and returns lists of files which are needed by this device in order for it to become in sync. **Public**

FluxOS API endpoint GET /syncthing/db/need (operationId fluxSyncthingDbNeed, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Returns the list of files which are needed by that remote device in order for it to become in sync with the shared folder (GET /syncthing/db/remoteneed) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbremoteneed>

Takes the mandatory parameters ```folder``` and ```device```, and returns the list of files which are needed by that remote device in order for it to become in sync with the shared folder. **Public**

FluxOS API endpoint GET /syncthing/db/remoteneed (operationId fluxSyncthingDbRemoteneed, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
- device (query, string, required): Device ID
Responses: 200 OK.

## Returns information about the current status of a folder (GET /syncthing/db/status) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbstatus>

Returns information about the current status of a folder. Parameters ```folder```, the ID of a folder. **Public**

FluxOS API endpoint GET /syncthing/db/status (operationId fluxSyncthingDbStatus, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder ID
Responses: 200 OK.

## Request immediate scan (POST /syncthing/db/scan) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbscan>

Request immediate scan. Takes the optional parameters ```folder``` (folder ID). **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/db/scan (operationId fluxSyncthingDbScan, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): folder (string)
Responses: 200 OK.

## Request revert of a receive only folder (POST /syncthing/db/revert) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbrevert>

Request revert of a receive only folder. Reverting a folder means to undo all local changes. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/db/revert (operationId fluxSyncthingDbRevert, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): folder (string)
Responses: 200 OK.

## Moves the file to the top of the download queue (POST /syncthing/db/prio) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbprio>

Moves the file to the top of the download queue ```folder``` and ```file``` params are mandatory. **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/db/prio (operationId fluxSyncthingDbPrio, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): folder (string), file (string)
Responses: 200 OK.

## Request override of a send only folder (POST /syncthing/db/override) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdboverride>

Request override of a send only folder. Override means to make the local version latest, overriding changes made on other devices. This API call does nothing if the folder is not a send only folder. Takes the mandatory parameter ```folder``` (folder ID). **AdminAndFluxTeam**

FluxOS API endpoint POST /syncthing/db/override (operationId fluxSyncthingDbOverride, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): folder (string)
Responses: 200 OK.

## Returns events (GET /syncthing/events) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingevents>

To filter the event list, in effect creating a specific subscription for only the desired event types, add a parameter events=EventTypeA,EventTypeB,... where the event types are any of the Event Types. If no filter is specified, all events except LocalChangeDetected and RemoteChangeDetected are included. The optional parameter since=`lastSeenID` sets the ID of the last event you've already seen. Syncthing returns a JSON enc…`lastSeenID`, the HTTP call blocks and waits for new events to happen before returning. By d…`seconds`. To receive only a limited number of events, add the limit=`n` parameter with a suitable value for n and only the last n events will be returned. This can be used to catch up with the latest event ID after a disconnection. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/events (operationId fluxSyncthingEvents, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- events (query, string, required): Event Type
- since (query, string): Show events since specyfic time
- limit (query, number): Parameter with a suitable value for n and only the last n events will be returned
- timeout (query, number): The time out duration
Responses: 200 OK.

## Returns events (GET /syncthing/events/disk) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingeventsdisk>

To filter the event list, in effect creating a specific subscription for only the desired event types, add a parameter events=EventTypeA,EventTypeB,... where the event types are any of the Event Types. If no filter is specified, all events except LocalChangeDetected and RemoteChangeDetected are included. The optional parameter since=`lastSeenID` sets the ID of the last event you've already seen. Syncthing returns a JSON enc…`lastSeenID`, the HTTP call blocks and waits for new events to happen before returning. By d…`seconds`. To receive only a limited number of events, add the limit=`n` parameter with a suitable value for n and only the last n events will be returned. This can be used to catch up with the latest event ID after a disconnection. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/events/disk (operationId fluxSyncthingEventsDisk, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- events (query, string, required): Event Type
- since (query, string): Show events since specyfic time
- limit (query, number): Parameter with a suitable value for n and only the last n events will be returned
- timeout (query, number): The time out duration
Responses: 200 OK.

## Returns the data sent in the anonymous usage report (GET /syncthing/svc/report) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsvcreport>

Returns the data sent in the anonymous usage report. **Public**

FluxOS API endpoint GET /syncthing/svc/report (operationId fluxSyncthingSvcReport, Syncthing). Public, no login.
Responses: 200 OK.

## Returns a strong random generated string (GET /syncthing/svc/random/string) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsvcrandom>

Returns a strong random generated string (alphanumeric) of the specified length. Takes the ``length`` parameter. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/svc/random/string (operationId fluxSyncthingSvcRandom, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- length (query, number): String length
Responses: 200 OK.

## Verifies and formats a device ID. (GET /syncthing/svc) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingsvc>

Verifies and formats a device ID. Accepts all currently valid formats (52 or 56 characters with or without separators, upper or lower case, with trivial substitutions). Takes one parameter, id, and returns either a valid device ID in modern format, or an error. **Public**

FluxOS API endpoint GET /syncthing/svc (operationId fluxSyncthingSvc, Syncthing). Public, no login.
Parameters:
- id (query, string): DeviceID
Responses: 200 OK.

## Returns statistics about each served REST API endpoint (GET /syncthing/debug/httpmetrics) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebughttpmetrics>

Returns statistics about each served REST API endpoint, to diagnose how much time was spent generating the responses. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/httpmetrics (operationId fluxSyncthingDebugHttpmetrics, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Summarizes the completion percentage for each remote device (GET /syncthing/debug/peercompletion) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebugpeercompletion>

Summarizes the completion percentage for each remote device. Returns an object with device IDs as keys and an integer percentage as values. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/peercompletion (operationId fluxSyncthingDebugpeercompletion, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Used to capture a profile of what Syncthing is doing on the CPU (GET /syncthing/debug/cpuprof) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebugcpuprof>

The profiling starts when the page is requested and takes 30 seconds. During this time it will seem like nothing is happening and the browser is just waiting, hung, or “spinning”. Don’t worry - leave it be and have patience. Once done the profiling will result in a download called something like syncthing-cpu-windows-amd64-v0.14.4-112233.pprof. This is the file to keep and send in, without modifying the file name as it tells us information necessary to interpret it. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/cpuprof (operationId fluxSyncthingDebugCpuprof, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Used to capture a profile of what Syncthing is doing with the heap memory (GET /syncthing/debug/heapprof) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebugheapprof>

The profiling will result in a download called something like syncthing-heap-windows-amd64-v0.14.4-112233.pprof. This is the file to keep and send in, without modifying the file name as it tells us information necessary to interpret it. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/heapprof (operationId fluxSyncthingDebugHeapprof, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Collects information about the running instance for troubleshooting purposes (GET /syncthing/debug/support) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebugsupport>

Returns a “support bundle” as a zipped archive, which should be sent to the developers after verifying it contains no sensitive personal information. Credentials for the web GUI and the API key are automatically redacted already. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/support (operationId fluxSyncthingDebugSupport, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Shows diagnostics about a certain file in a shared folder (GET /syncthing/debug/file) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdebugfile>

Shows diagnostics about a certain file in a shared folder. Takes the folder (folder ID) and file (folder relative path) parameters. **AdminAndFluxTeam**

FluxOS API endpoint GET /syncthing/debug/file (operationId fluxSyncthingDebugFile, Syncthing). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- folder (query, string, required): folder ID
- file (query, string, required): folder relative path
Responses: 200 OK.

## Display deviceid (GET /syncthing/deviceid) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdeviceid>

Returns deviceid. **Public**

FluxOS API endpoint GET /syncthing/deviceid (operationId fluxSyncthingDeviceID, Syncthing). Public, no login.
Responses: 200 OK.

## Display metadata information (GET /syncthing/meta) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingmeta>

Returns metadata variable. **Public**

FluxOS API endpoint GET /syncthing/meta (operationId fluxSyncthingMeta, Syncthing). Public, no login.
Responses: 200 OK.

## Check health status (GET /syncthing/health) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthinghealth>

Returns health status object. **Public**

FluxOS API endpoint GET /syncthing/health (operationId fluxSyncthingHealth, Syncthing). Public, no login.
Responses: 200 OK.

## Share files (GET /apps/fluxshare/getfile) <https://docs.runonflux.io/fluxapi/fluxshare/fluxsharefile>

Call to retrieve share file. **Admin**

FluxOS API endpoint GET /apps/fluxshare/getfile (operationId fluxShareFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- file (query, string, required): File name of share file to view or download. Can be nested in additional folder.
- token (query, string, required): token
Responses: 200 Share file to view/download.

## FluxShare - Get folder content (GET /apps/fluxshare/getfolder) <https://docs.runonflux.io/fluxapi/fluxshare/getfolder>

Call to get content of folder in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/getfolder (operationId GetFolder, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- folder (query, string, required): The name of the folder that content will be display
Responses: 200 OK.

## FluxShare - Create folder (GET /apps/fluxshare/createfolder) <https://docs.runonflux.io/fluxapi/fluxshare/createfolder>

Call to create folder in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/createfolder (operationId CreateFolder, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- folder (query, string, required): The name of the folder that will be created in fluxshare
Responses: 200 OK.

## FluxShare - Remove file (GET /apps/fluxshare/removefile) <https://docs.runonflux.io/fluxapi/fluxshare/removefile>

Call to remove file from fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/removefile (operationId RemoveFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- file (query, string, required): The name of the file that will be removed in fluxshare
Responses: 200 OK.

## FluxShare - Remove folder (GET /apps/fluxshare/removefolder) <https://docs.runonflux.io/fluxapi/fluxshare/removefolder>

Call to remove folder from fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/removefolder (operationId RemoveFolder, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- folder (query, string, required): The name of the folder that will be removed in fluxshare
Responses: 200 OK.

## FluxShare - File exists (GET /apps/fluxshare/fileexists) <https://docs.runonflux.io/fluxapi/fluxshare/fileexists>

Call to check if file exist. **Admin**

FluxOS API endpoint GET /apps/fluxshare/fileexists (operationId FileExists, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- file (query, string, required): File name to check if exists
Responses: 200 OK.

## FluxShare - Stats (GET /apps/fluxshare/stats) <https://docs.runonflux.io/fluxapi/fluxshare/stats>

Call to check stats of fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/stats (operationId Stats, Fluxshare). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## FluxShare - Share file (GET /apps/fluxshare/sharefile) <https://docs.runonflux.io/fluxapi/fluxshare/sharefile>

Call to share file in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/sharefile (operationId ShareFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- file (query, string, required): File name that will be share
Responses: 200 OK.

## FluxShare - Unshare file (GET /apps/fluxshare/unsharefile) <https://docs.runonflux.io/fluxapi/fluxshare/unsharefile>

Call to unshare file in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/unsharefile (operationId UnshareFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- file (query, string, required): File name that will be unshare
Responses: 200 OK.

## FluxShare - Shared files (GET /apps/fluxshare/sharedfiles) <https://docs.runonflux.io/fluxapi/fluxshare/sharedfiles>

Call to display shared files. **Admin**

FluxOS API endpoint GET /apps/fluxshare/sharedfiles (operationId SharedFiles, Fluxshare). Requires Flux ID login, privilege Admin.
Responses: 200 OK.

## FluxShare - Rename file (GET /apps/fluxshare/rename) <https://docs.runonflux.io/fluxapi/fluxshare/renamefile>

Call to rename file in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/rename (operationId RenameFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- oldpath (query, string, required): Path to file
- newname (query, string, required): New name for file
Responses: 200 OK.

## FluxShare - Download folder (GET /apps/fluxshare/downloadfolder) <https://docs.runonflux.io/fluxapi/fluxshare/fluxdownloadfolder>

Call to download content of folder in fluxshare. **Admin**

FluxOS API endpoint GET /apps/fluxshare/downloadfolder (operationId FluxDownloadFolder, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- folder (query, string, required): The name of the folder
Responses: 200 Share file to view/download.

## list running apps (GET /apps/listrunningapps) <https://docs.runonflux.io/fluxapi/apps/listrunningapps>

List and info of running apps. **Public**

FluxOS API endpoint GET /apps/listrunningapps (operationId listRunningApps, Apps). Public, no login.
Responses: 200 OK.

## list all apps (GET /apps/listallapps) <https://docs.runonflux.io/fluxapi/apps/listallapps>

List and info of all apps. **Public**

FluxOS API endpoint GET /apps/listallapps (operationId listAllApps, Apps). Public, no login.
Responses: 200 OK.

## List of images (GET /apps/listappsimages) <https://docs.runonflux.io/fluxapi/apps/listappsimages>

List of apps images installed. **FluxTeam**

FluxOS API endpoint GET /apps/listappsimages (operationId listAppsImages, Apps). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK.

## installed apps (GET /apps/installedapps) <https://docs.runonflux.io/fluxapi/apps/installedapps>

Info of installed apps. **Public**

FluxOS API endpoint GET /apps/installedapps (operationId installedApps, Apps). Public, no login.
Parameters:
- appname (query, string): Restrict the listing to one application
Responses: 200 OK.

## available apps (GET /apps/availableapps) <https://docs.runonflux.io/fluxapi/apps/availableapps>

Info of available apps. **Public**

FluxOS API endpoint GET /apps/availableapps (operationId availableApps, Apps). Public, no login.
Responses: 200 OK.

## Flux's usage (GET /apps/fluxusage) <https://docs.runonflux.io/fluxapi/apps/fluxusage>

Will return amount of cpu resource flux is using. **Public**

FluxOS API endpoint GET /apps/fluxusage (operationId FluxUsage, Apps). Public, no login.
Responses: 200 OK.

## Flux's usage of resources (GET /apps/appsresources) <https://docs.runonflux.io/fluxapi/apps/appsresources>

Will return data of resource flux is using. **Public**

FluxOS API endpoint GET /apps/appsresources (operationId appsResources, Apps). Public, no login.
Responses: 200 OK.

## Registration Info (GET /apps/registrationinformation) <https://docs.runonflux.io/fluxapi/apps/registrationinformation>

Apps registration info. **Public**

FluxOS API endpoint GET /apps/registrationinformation (operationId registrationInformation, Apps). Public, no login.
Responses: 200 OK.

## Temporary registration info (GET /apps/temporarymessages) <https://docs.runonflux.io/fluxapi/apps/getappstemporarymessages>

Temporary registration info that will expire after 1 hour. **Public**

FluxOS API endpoint GET /apps/temporarymessages (operationId getAppsTemporaryMessages, Apps). Public, no login.
Parameters:
- hash (query, string): Aplication hash
Responses: 200 OK.

## Permanent registration info (GET /apps/permanentmessages) <https://docs.runonflux.io/fluxapi/apps/getappspermanentmessages>

Registration info of apps that have been stored to the database. **Public**

FluxOS API endpoint GET /apps/permanentmessages (operationId getAppsPermanentMessages, Apps). Public, no login.
Parameters:
- hash (query, string): Application hash
- owner (query, string): Application ZelID
- appname (query, string): Application name
Responses: 200 OK.

## Global app specs (GET /apps/globalappsspecifications) <https://docs.runonflux.io/fluxapi/apps/getglobalappsspecifications>

List of global app specifications. **Public**

FluxOS API endpoint GET /apps/globalappsspecifications (operationId getGlobalAppsSpecifications, Apps). Public, no login.
Parameters:
- hash (query, string): Filter by the application message hash
- owner (query, string): Filter by owner FluxID
- appname (query, string): Filter by application name
Responses: 200 OK.

## Global app specs of app specified (GET /apps/appspecifications) <https://docs.runonflux.io/fluxapi/apps/getapplicationspecificationapi>

Returns the specifications of the queried application.

For an **enterprise application** (specification version 8 or above with `enterprise` set) the `compose` and `contacts` fields are returned empty unless `decrypt` is requested, which additionally requires the application owner's authentication and an `enterprise-key` header. **Public** (decrypted view: **AppOwner**)

FluxOS API endpoint GET /apps/appspecifications (operationId getApplicationSpecificationAPI, Apps). Public, no login.
Parameters:
- appname (query, string, required): Appname
- decrypt (query, boolean): Return the decrypted `compose` and `contacts` of an enterprise application. Requires the owner's authentication and an `enterprise-key` header.
Responses: 200 OK.

## App owner's ZelID (GET /apps/appowner) <https://docs.runonflux.io/fluxapi/apps/getapplicationownerapi>

This will return the ZelID of the owner of the app specified. **Public**

FluxOS API endpoint GET /apps/appowner (operationId getApplicationOwnerAPI, Apps). Public, no login.
Parameters:
- appname (query, string, required): Appname
Responses: 200 OK.

## Application Hash info (GET /apps/hashes) <https://docs.runonflux.io/fluxapi/apps/getapphashes>

Get list of app hashes and related info. **Public**

FluxOS API endpoint GET /apps/hashes (operationId getAppHashes, Apps). Public, no login.
Responses: 200 OK.

## Info regarding app location (GET /apps/location) <https://docs.runonflux.io/fluxapi/apps/getappslocation>

This will return data regarding the location of app specified. **Public**

FluxOS API endpoint GET /apps/location (operationId getAppsLocation, Apps). Public, no login.
Parameters:
- appname (query, string, required): Appname
Responses: 200 OK.

## List of app locations (GET /apps/locations) <https://docs.runonflux.io/fluxapi/apps/getappslocations>

This will return a list of known apps on the network and it's locations data. **Public**

FluxOS API endpoint GET /apps/locations (operationId getAppsLocations, Apps). Public, no login.
Responses: 200 OK.

## Calculate price of app (POST /apps/calculateprice) <https://docs.runonflux.io/fluxapi/apps/getappprice>

**DEPRECATED**: To get app price. Should be used getAppFiatAndFluxPrice method instead. Calculate price by sending request with specs required for app you are registering. **Public**
Note: If tiered value is set to true you will also need to add the following key/value pairs
- `cpubasic: <n value of cpu core>`, `cpusuper: <n value of cpu core>`, `cpubamf: <n value of cpu core>`, `rambasic: <n value in mb>`, `ramsuper: <n value in mb>`, `rambamf: <n value in mb>`, `hddbasic: <n value in gb>`, `hddsuper: <n value in gb>`, `hddbamf: <n value in gb>`

FluxOS API endpoint POST /apps/calculateprice (operationId getAppPrice, Apps). Public, no login.
Request body (text/plain): version (integer), name (string), description (string), owner (string), compose (array), instances (integer), contacts (array), geolocation (array), expire (integer), nodes (array), staticip (boolean)
Responses: 200 OK.

## Calculate price of app (POST /apps/calculatefiatandfluxprice) <https://docs.runonflux.io/fluxapi/apps/getapppricenew>

Calculate price by sending request with specs required for app you are registering. **Public**
Note: If tiered value is set to true you will also need to add the following key/value pairs
- `cpubasic: <n value of cpu core>`, `cpusuper: <n value of cpu core>`, `cpubamf: <n value of cpu core>`, `rambasic: <n value in mb>`, `ramsuper: <n value in mb>`, `rambamf: <n value in mb>`, `hddbasic: <n value in gb>`, `hddsuper: <n value in gb>`, `hddbamf: <n value in gb>`

FluxOS API endpoint POST /apps/calculatefiatandfluxprice (operationId getAppPriceNew, Apps). Public, no login.
Request body (text/plain): version (integer), name (string), description (string), owner (string), compose (array), instances (integer), contacts (array), geolocation (array), expire (integer), nodes (array), staticip (boolean)
Responses: 200 OK.

## Starts app (GET /apps/appstart) <https://docs.runonflux.io/fluxapi/apps/appstart>

This will start the fluxapp. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appstart (operationId AppStart, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
- global (query, boolean): Apply on every node the application runs on, rather than only this one
Responses: 200 OK.

## Stops app (GET /apps/appstop) <https://docs.runonflux.io/fluxapi/apps/appstop>

This will stop the Flux application. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appstop (operationId AppStop, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
- global (query, boolean): Apply on every node the application runs on, rather than only this one
Responses: 200 OK.

## Restarts app (GET /apps/apprestart) <https://docs.runonflux.io/fluxapi/apps/apprestart>

This will restart the Flux application. **AppOwnerAbove**

FluxOS API endpoint GET /apps/apprestart (operationId AppRestart, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
- global (query, boolean): Apply on every node the application runs on, rather than only this one
Responses: 200 OK.

## Pause app (GET /apps/apppause) <https://docs.runonflux.io/fluxapi/apps/appsapppause>

**Removed.** Pausing applications is no longer supported and this endpoint always answers **HTTP 200** with `status: error` and `data.code: 410` — `Pausing applications is no longer supported. Use appstop to stop an application.` Use `GET /apps/appstop` instead. When `appname` is given the caller is still authorised before the refusal is returned. **AppOwnerAbove**

FluxOS API endpoint GET /apps/apppause (operationId appsAppPause, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
Responses: 200 OK.

## Unpause app (GET /apps/appunpause) <https://docs.runonflux.io/fluxapi/apps/appunpause>

**Removed.** Pausing applications is no longer supported and this endpoint always answers **HTTP 200** with `status: error` and `data.code: 410`. Use `GET /apps/appstart` to start a stopped application. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appunpause (operationId AppUnpause, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
Responses: 200 OK.

## List of running processes (GET /apps/apptop) <https://docs.runonflux.io/fluxapi/apps/apptop>

Display the running processes of a container. **AppOwnerAbove**

FluxOS API endpoint GET /apps/apptop (operationId AppTop, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
Responses: 200 OK.

## App's log (GET /apps/applog) <https://docs.runonflux.io/fluxapi/apps/applogs>

This will fetch the logs of a fluxapp. **AppOwnerAbove**

FluxOS API endpoint GET /apps/applog (operationId AppLogs, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
- lines (query, string, required)
Responses: 200 OK.

## Info of the app (GET /apps/appinspect) <https://docs.runonflux.io/fluxapi/apps/appinspect>

Displays detailed info of the container. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appinspect (operationId AppInspect, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name/Id of app
Responses: 200 OK.

## App stats based on resource usage (GET /apps/appstats) <https://docs.runonflux.io/fluxapi/apps/appstats>

Returns containers resource usage. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appstats (operationId AppStats, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): App name
Responses: 200 OK.

## Container changes (GET /apps/appchanges) <https://docs.runonflux.io/fluxapi/apps/appchanges>

Data of changes made to container. If no changes it will return a null response which is usually the case. **AppOwnerAbove**

Kind values:
- `0 = Modified`
- `1 = Added`
- `2 = Deleted`

FluxOS API endpoint GET /apps/appchanges (operationId AppChanges, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): App name
Responses: 200 OK.

## Run a command in the container (POST /apps/appexec) <https://docs.runonflux.io/fluxapi/apps/appexec>

Run new commands inside running containers. **AppOwnerAbove**

FluxOS API endpoint POST /apps/appexec (operationId AppExec, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Request body (text/plain): appname (string), cmd (array), env (array)
Responses: 200 OK.

## Uninstall application (GET /apps/appremove) <https://docs.runonflux.io/fluxapi/apps/appremove>

This will stop, clean data, close port, and remove the container. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appremove (operationId Appremove, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Name of the app
- force (query, boolean): Defaults to false. If true, forces removal without checking if the app exists.
- global (query, boolean): Defaults to false (local removal). If true, removes the app from all nodes in the network.
Responses: 200 OK.

## Create flux network (GET /apps/createfluxnetwork) <https://docs.runonflux.io/fluxapi/apps/createfluxnetwork>

This will create flux network if none is detected. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/createfluxnetwork (operationId createFluxNetwork, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Rescan and update global FluxApps info database (GET /apps/rescanglobalappsinformation) <https://docs.runonflux.io/fluxapi/apps/rescanglobalappsinformationapi>

Rescans global apps permanent messages since selected blockheight and updates global apps information database. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/rescanglobalappsinformation (operationId rescanGlobalAppsInformationAPI, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- blockheight (query, integer, required): Block height to rescan from
- removelastinformation (query, boolean): If set to true then before the actual rescan happens all global information specifications will be removed.
Responses: 200 OK.

## Reindex appsinformation collection and rebuild (GET /apps/reindexglobalappsinformation) <https://docs.runonflux.io/fluxapi/apps/reindexglobalappsinformationapi>

This will drop appslocations collection, recreate indexes, and rebuild incoming messages. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/reindexglobalappsinformation (operationId reindexGlobalAppsInformationAPI, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Reindex appslocations collection and rebuild (GET /apps/reindexglobalappslocation) <https://docs.runonflux.io/fluxapi/apps/reindexglobalappslocationapi>

Function that drops information about running apps and rebuilds indexes. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/reindexglobalappslocation (operationId reindexGlobalAppsLocationAPI, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Checks Docker Hub for image (POST /apps/checkdockerexistance) <https://docs.runonflux.io/fluxapi/apps/checkdockeraccessibility>

This will check Docker Hub and verify image is available. **User**

FluxOS API endpoint POST /apps/checkdockerexistance (operationId checkDockerAccessibility, Apps). Requires Flux ID login, privilege User.
Request body (text/plain): repotag (string)
Responses: 200 OK.

## App registration (POST /apps/appregister) <https://docs.runonflux.io/fluxapi/apps/appregister>

Registers a new application on Flux: submits its signed specification for the network to deploy. **User**

Note: Signature is following message signed in the format shown below
- `this.updatetype + this.version + JSON.stringify(fluxAppSpecFormatted) + this.timestamp`

Example:
- `fluxappregister1{"version":7,"name":"blockbookneurai","description":"Blockbook f…`

FluxOS API endpoint POST /apps/appregister (operationId Appregister, Apps). Requires Flux ID login, privilege User.
Request body (text/plain): type (string), version (integer), appSpecifications (object), timestamp (integer), signature (object)
Responses: 200 OK; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 403 Insufficient funds or permission denied; 409 App already exists; 500 Internal server error; 503 Service temporarily unavailable.

## App update (POST /apps/appupdate) <https://docs.runonflux.io/fluxapi/apps/updateappglobalyapi>

This call is to provide required info to update app on Flux. **User**

Note: Signature is following message signed in the format shown below
- `this.updatetype + this.version + JSON.stringify(fluxAppSpecFormatted) + this.timestamp`

Example:
- `fluxappupdate1{"version":7,"name":"blockbookneurai","description":"Blockbook for…`

FluxOS API endpoint POST /apps/appupdate (operationId updateAppGlobalyApi, Apps). Requires Flux ID login, privilege User.
Request body (text/plain): appSpecifications (object), timestamp (integer), signature (object), type (string), version (integer)
Responses: 200 OK.

## Deployment information (GET /apps/deploymentinformation) <https://docs.runonflux.io/fluxapi/apps/getdeploymentinformatio>

This will return deployment information. **Public**

FluxOS API endpoint GET /apps/deploymentinformation (operationId getDeploymentInformatio, Apps). Public, no login.
Responses: 200 OK.

## List of enterprise nodes (GET /apps/enterprisenodes) <https://docs.runonflux.io/fluxapi/apps/getenterprisenodes>

This will return a list of enterprise nodes. **Public**

FluxOS API endpoint GET /apps/enterprisenodes (operationId getEnterpriseNodes, Apps). Public, no login.
Responses: 200 OK.

## Request application message hash. (GET /apps/requestmessage) <https://docs.runonflux.io/fluxapi/apps/getrequestmessage>

This will request application message hash. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/requestmessage (operationId getRequestmessage, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- hash (query, string, required): Application hash
Responses: 200 OK.

## Request check for missing application message. (GET /apps/checkhashes) <https://docs.runonflux.io/fluxapi/apps/getcheckhashes>

This will tigger check for misssing application messages. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/checkhashes (operationId getCheckhashes, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Get latest application specification version (GET /apps/latestspecificationversion) <https://docs.runonflux.io/fluxapi/apps/getlatestapplicationspecificationapi>

Get the latest version of application specifications available. **Public**

FluxOS API endpoint GET /apps/latestspecificationversion (operationId getLatestApplicationSpecificationAPI, Apps). Public, no login.
Responses: 200 OK.

## Update app to latest specifications (GET /apps/updatetolatestspecs/{appname}) <https://docs.runonflux.io/fluxapi/apps/updateapplicationspecificationapi>

Rewrites the application's stored specification into the latest specification format. For an enterprise application an `enterprise-key` header is mandatory. Refused while the daemon is not synced. **AppOwner**

FluxOS API endpoint GET /apps/updatetolatestspecs/{appname} (operationId updateApplicationSpecificationAPI, Apps). Requires Flux ID login, privilege AppOwner.
Parameters:
- appname (path, string, required): Name of the application to update
Responses: 200 OK.

## Get application original owner (GET /apps/apporiginalowner/{appname}) <https://docs.runonflux.io/fluxapi/apps/getapplicationoriginalowner>

Get the original owner of a specific application. **Public**

FluxOS API endpoint GET /apps/apporiginalowner/{appname} (operationId getApplicationOriginalOwner, Apps). Public, no login.
Parameters:
- appname (path, string): Name of the application
Responses: 200 OK.

## Get app installing location (GET /apps/installinglocation/{appname}) <https://docs.runonflux.io/fluxapi/apps/getappinstallinglocation>

Get the location where a specific app is currently being installed. **Public**

FluxOS API endpoint GET /apps/installinglocation/{appname} (operationId getAppInstallingLocation, Apps). Public, no login.
Parameters:
- appname (path, string): Name of the application
Responses: 200 OK.

## Get all apps installing locations (GET /apps/installinglocations) <https://docs.runonflux.io/fluxapi/apps/getappsinstallinglocations>

Get locations where all apps are currently being installed. **Public**

FluxOS API endpoint GET /apps/installinglocations (operationId getAppsInstallingLocations, Apps). Public, no login.
Responses: 200 OK.

## Get app installation errors location (GET /apps/installingerrorslocation/{appname}) <https://docs.runonflux.io/fluxapi/apps/getappinstallingerrorslocation>

Get the location where a specific app had installation errors. **Public**

FluxOS API endpoint GET /apps/installingerrorslocation/{appname} (operationId getAppInstallingErrorsLocation, Apps). Public, no login.
Parameters:
- appname (path, string): Name of the application
Responses: 200 OK.

## Get all apps installation errors locations (GET /apps/installingerrorslocations) <https://docs.runonflux.io/fluxapi/apps/getappsinstallingerrorslocations>

Get locations where all apps had installation errors. **Public**

FluxOS API endpoint GET /apps/installingerrorslocations (operationId getAppsInstallingErrorsLocations, Apps). Public, no login.
Responses: 200 OK.

## Get whitelisted repositories (GET /apps/whitelistedrepositories) <https://docs.runonflux.io/fluxapi/apps/whitelistedrepositories>

Get list of whitelisted Docker repositories for app deployment. **Public**

FluxOS API endpoint GET /apps/whitelistedrepositories (operationId whitelistedRepositories, Apps). Public, no login.
Responses: 200 OK.

## Verify app registration specifications (POST /apps/verifyappregistrationspecifications) <https://docs.runonflux.io/fluxapi/apps/verifyappregistrationparameters>

Verify and format application registration specifications. **Public**

FluxOS API endpoint POST /apps/verifyappregistrationspecifications (operationId verifyAppRegistrationParameters, Apps). Public, no login.
Request body (application/json): appname* (string), version (integer), description* (string), owner* (string), port* (integer), containerPort* (integer), cpu* (number), ram* (integer), hdd* (integer), tiered (boolean), cpubasic (number), rambasic (integer)
Responses: 200 OK.

## Verify app update specifications (POST /apps/verifyappupdatespecifications) <https://docs.runonflux.io/fluxapi/apps/verifyappupdateparameters>

Verify and format application update specifications. **Public**

FluxOS API endpoint POST /apps/verifyappupdatespecifications (operationId verifyAppUpdateParameters, Apps). Public, no login.
Request body (application/json): appname* (string), version* (integer), description (string), port (integer), containerPort (integer), cpu (number), ram (integer), hdd (integer), repotag (string), enviromentParameters (array), commands (array), domains (array)
Responses: 200 OK.

## Get application specifications USD price (GET /apps/getappspecsusdprice) <https://docs.runonflux.io/fluxapi/apps/getappspecsusdprice>

Get the USD price for application specifications and resource usage. **Public**

FluxOS API endpoint GET /apps/getappspecsusdprice (operationId getAppSpecsUSDPrice, Apps). Public, no login.
Responses: 200 OK.

## Poll application logs (GET /apps/applogpolling/{appname}) <https://docs.runonflux.io/fluxapi/apps/applogpolling>

Poll application logs with real-time updates. **AppOwnerAbove**

FluxOS API endpoint GET /apps/applogpolling/{appname} (operationId appLogPolling, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (path, string, required): Name of the application
- lines (query, integer): Number of log lines to return
- since (query, string): Return logs since timestamp
- lineCount (query, string): Alias of `lines`; a line count or `all`
- cursor (query, string): Opaque cursor from a previous response; resumes where that poll stopped
Responses: 200 OK.

## Stream application monitoring data (GET /apps/appmonitorstream/{appname}) <https://docs.runonflux.io/fluxapi/apps/appmonitorstream>

**Removed.** Streaming monitoring data is no longer supported and this endpoint always answers **HTTP 200** with `status: error` and `data.code: 410`. Read stored samples with `GET /apps/appmonitor` instead. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appmonitorstream/{appname} (operationId appMonitorStream, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (path, string, required): Name of the application
Responses: 200 OK - Server-Sent Events stream.

## Test application installation (GET /apps/testappinstall/{appname}) <https://docs.runonflux.io/fluxapi/apps/testappinstall>

Test if an application can be installed without actually installing it. **User**

FluxOS API endpoint GET /apps/testappinstall/{appname} (operationId testAppInstall, Apps). Requires Flux ID login, privilege User.
Parameters:
- appname (path, string, required): Name of the application to test
Responses: 200 OK.

## Install application locally (GET /apps/installapplocally/{appname}) <https://docs.runonflux.io/fluxapi/apps/installapplocally>

Installs a specific application locally on this node. The response is **streamed**: a sequence of JSON objects is written as the install progresses — image pull progress, volume creation, container start — and the connection closes when the install finishes or fails. A failure after the stream has started is written into the stream rather than signalled by the HTTP status, so read the objects rather than the status code.

The owner may install an application whose specification is already known to the network; installing from a temporary (unregistered) message additionally requires the Flux Team. Refused while another application on this node is undergoing an operation. **User**

FluxOS API endpoint GET /apps/installapplocally/{appname} (operationId installAppLocally, Apps). Requires Flux ID login, privilege User.
Parameters:
- appname (path, string, required): Name of the application to install
Responses: 200 Stream of installation progress objects; 401 Authentication failed or insufficient privileges.

## Redeploy application (GET /apps/redeploy/{appname}) <https://docs.runonflux.io/fluxapi/apps/redeployapi>

Redeploy an existing application. **AppOwnerAbove**

FluxOS API endpoint GET /apps/redeploy/{appname} (operationId redeployAPI, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (path, string, required): Name of the application to redeploy
- force (query, boolean): Force redeployment even if running
- global (query, boolean): Redeploy globally across network
Responses: 200 OK.

## Reconstruct application message hashes (GET /apps/reconstructhashes) <https://docs.runonflux.io/fluxapi/apps/reconstructappmessageshashcollectionapi>

Reconstruct the application message hash collection. **AdminAndFluxTeam**

FluxOS API endpoint GET /apps/reconstructhashes (operationId reconstructAppMessagesHashCollectionAPI, Apps). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Start application monitoring (GET /apps/startmonitoring/{appname}) <https://docs.runonflux.io/fluxapi/apps/startappmonitoringapi>

**Removed.** Monitoring is no longer started or stopped per application — this endpoint always answers **HTTP 200** with `status: error` and `data.code: 410`. Monitoring runs for every installed application; read it with `GET /apps/appmonitor`. **AppOwnerAbove**

FluxOS API endpoint GET /apps/startmonitoring/{appname} (operationId startAppMonitoringAPI, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (path, string, required): Name of the application to monitor
Responses: 200 OK.

## Stop application monitoring (GET /apps/stopmonitoring/{appname}) <https://docs.runonflux.io/fluxapi/apps/stopappmonitoringapi>

**Removed.** Monitoring is no longer started or stopped per application — this endpoint always answers **HTTP 200** with `status: error` and `data.code: 410`. **AppOwnerAbove**

FluxOS API endpoint GET /apps/stopmonitoring/{appname} (operationId stopAppMonitoringAPI, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (path, string, required): Name of the application
- deletedata (query, boolean): Whether to delete monitoring data
Responses: 200 OK.

## Get public key for app operations (POST /apps/getpublickey) <https://docs.runonflux.io/fluxapi/apps/getpublickey>

Get the public key used for application operations. **User**

FluxOS API endpoint POST /apps/getpublickey (operationId getPublicKey, Apps). Requires Flux ID login, privilege User.
Request body (application/json): message (string), signature (string)
Responses: 200 OK.

## View utxo history (GET /explorer/utxo) <https://docs.runonflux.io/fluxapi/explorer/explorergetaddressutxos>

View unspent transaction outputs of selected address. **Public**

FluxOS API endpoint GET /explorer/utxo (operationId explorerGetAddressUtxos, Explorer). Public, no login.
Parameters:
- address (query, string, required): Flux address to look up utxo's
Responses: 200 OK.

## View transaction history (GET /explorer/transactions) <https://docs.runonflux.io/fluxapi/explorer/getaddresstransactions>

View transaction history of selected address. **Public**

FluxOS API endpoint GET /explorer/transactions (operationId getAddressTransactions, Explorer). Public, no login.
Parameters:
- address (query, string, required): Flux address to look up tx history
Responses: 200 OK.

## View balance (GET /explorer/balance) <https://docs.runonflux.io/fluxapi/explorer/explorergetaddressbalance>

View balance of selected address. **Public**

FluxOS API endpoint GET /explorer/balance (operationId explorerGetAddressBalance, Explorer). Public, no login.
Parameters:
- address (query, string, required): Flux address to look up balance
Responses: 200 OK.

## View scanned block height (GET /explorer/scannedheight) <https://docs.runonflux.io/fluxapi/explorer/getscannedheight>

View scanned block height on the explorer that it has synced. **Public**

FluxOS API endpoint GET /explorer/scannedheight (operationId getScannedHeight, Explorer). Public, no login.
Responses: 200 OK.

## Check if explorer is synced (GET /explorer/issynced) <https://docs.runonflux.io/fluxapi/explorer/isexplorersynced>

Check if the explorer is fully synchronized with the blockchain. **Public**

FluxOS API endpoint GET /explorer/issynced (operationId isExplorerSynced, Explorer). Public, no login.
Responses: 200 OK.

## Reindex collection (GET /explorer/reindex) <https://docs.runonflux.io/fluxapi/explorer/reindexexplorer>

Drop Flux collection and recreate it. **AdminAndFluxTeam**

FluxOS API endpoint GET /explorer/reindex (operationId reindexExplorer, Explorer). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Restart block processing (GET /explorer/restart) <https://docs.runonflux.io/fluxapi/explorer/restartblockprocessing>

Restarts Flux collection. **AdminAndFluxTeam**

FluxOS API endpoint GET /explorer/restart (operationId restartBlockProcessing, Explorer). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Stops block processing (GET /explorer/stop) <https://docs.runonflux.io/fluxapi/explorer/stopblockprocessing>

Stops Flux collection. **AdminAndFluxTeam**

FluxOS API endpoint GET /explorer/stop (operationId stopBlockProcessing, Explorer). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK.

## Rescan explorer (GET /explorer/rescan) <https://docs.runonflux.io/fluxapi/explorer/rescanexplorer>

Rescan explorer from selected block height. **AdminAndFluxTeam**

FluxOS API endpoint GET /explorer/rescan (operationId rescanExplorer, Explorer). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- blockheight (query, integer, required): Block height to start rescan from
Responses: 200 OK.

## Poll a long-running operation (GET /apps/operations/{jobId}) <https://docs.runonflux.io/fluxapi/apps/getoperation>

The single status resource for every long-running operation a node accepts. Endpoints that start work (the volume file operations, for example) answer `202 Accepted` with a `jobId`, a `Location` header pointing here and an `Operation-Id` header; this endpoint owns the polling contract.

A running operation answers `200` with a non-terminal body and a `Retry-After` header. **Completion is read from the `status` field, never inferred from the HTTP code** — a failed operation is still a successful poll. Terminal statuses are `Succeeded`, `Failed`, `Canceled` and `Evicted` (the node took the work away — neither the caller's request nor their input was at fault).

Unknown, expired and not-yours are one answer (`404`): a `jobId` must not tell a caller whether someone else has an operation running. Operation…`jobId` itself as the capability. **Public** (the `jobId` is the capability)

FluxOS API endpoint GET /apps/operations/{jobId} (operationId getOperation, Apps). Public, no login.
Parameters:
- jobId (path, string, required): Operation id, as returned by the endpoint that started the work
- sinceSeq (query, integer): How far through an operation's line-numbered output the caller has already read. Anything that is not a non-negative whole number is treated as no cursor at al…
Responses: 200 Operation state; 400 Input validation failed; 404 Operation not found, expired, or not readable by this caller; 500 Internal server error.

## Cancel a long-running operation (DELETE /apps/operations/{jobId}) <https://docs.runonflux.io/fluxapi/apps/canceloperation>

Requests cancellation of an operation. **Best effort, and said so plainly**: the flag is raised here and the worker stops at its next checkpoint, so `status` stays `Running` until it does. Poll `GET /apps/operations/{jobId}` for the terminal state. **Public** (the `jobId` is the capability)

FluxOS API endpoint DELETE /apps/operations/{jobId} (operationId cancelOperation, Apps). Public, no login.
Parameters:
- jobId (path, string, required): Operation id
Responses: 200 Cancellation requested; 404 Operation not found; 500 Internal server error.

## Move a file or folder within an app volume (POST /apps/moveobject) <https://docs.runonflux.io/fluxapi/volume-browser/moveappsobject>

Moves `source` to `destination` inside the application's persistent volume. Both operands are resolved relative to the volume root; a path that escapes it is refused.

Answers `202 Accepted` with a `jobId` — poll `GET /apps/operations/{jobId}`. A move is registered as a job like the other three because paste is one gesture in a file browser: cut-paste returning a result while copy-paste returned a job would put two response shapes inside a single user action. **AppOwnerAbove**

FluxOS API endpoint POST /apps/moveobject (operationId moveAppsObject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname* (string), component (string), source* (string), destination* (string), overwrite (boolean)
Responses: 202 The work was accepted and is running. Poll the `statusUrl` …; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Copy a file or folder within an app volume (POST /apps/copyobject) <https://docs.runonflux.io/fluxapi/volume-browser/copyappsobject>

Copies `source` to `destination` inside the application's persistent volume, preserving ownership, timestamps and symlinks. The volume's free space is checked against the measured size of the source before the copy starts, and the ceiling is enforced against what actually lands.

A directory copied onto an existing directory overlays it rather than replacing it wholesale; a file over a file is replaced, and a file over a directory is refused. Answers `202 Accepted` with a `jobId` — poll `GET /apps/operations/{jobId}`. **AppOwnerAbove**

FluxOS API endpoint POST /apps/copyobject (operationId copyAppsObject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname* (string), component (string), source* (string), destination* (string), overwrite (boolean)
Responses: 202 The work was accepted and is running. Poll the `statusUrl` …; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Compress a file or folder into an archive (POST /apps/compressobject) <https://docs.runonflux.io/fluxapi/volume-browser/compressappsobject>

Creates an archive of `source` at `destination` inside the application's persistent volume. The destination extension chooses the format and must be one of `.zip`, `.tar.gz` or `.tgz`; anything else is refused.

An archive holds the source's *contents* at its top level, so extracting it to a destination reproduces the source under that name — compress then extract returns what went in. Answers `202 Accepted` with a `jobId` — poll `GET /apps/operations/{jobId}`. **AppOwnerAbove**

FluxOS API endpoint POST /apps/compressobject (operationId compressAppsObject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname* (string), component (string), source* (string), destination* (string), overwrite (boolean)
Responses: 202 The work was accepted and is running. Poll the `statusUrl` …; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Extract an archive within an app volume (POST /apps/extractobject) <https://docs.runonflux.io/fluxapi/volume-browser/extractappsobject>

Extracts the archive at `source` to `destination` inside the application's persistent volume. The source is accepted by extension rather than by sniffing its content — `.zip`, `.tar.gz` or `.tgz` — so a caller who names what they uploaded cannot have it interpreted as something else.

How much an extraction will write cannot be measured up front, so the volume's remaining capacity is the only bound: on a full volume the request is refused outright rather than expressed as a limit nothing enforces. Answers `202 Accepted` with a `jobId` — poll `GET /apps/operations/{jobId}`. **AppOwnerAbove**

FluxOS API endpoint POST /apps/extractobject (operationId extractAppsObject, Volume Browser). Requires Flux ID login, privilege AppOwnerAbove.
Request body (application/json): appname* (string), component (string), source* (string), destination* (string), overwrite (boolean)
Responses: 202 The work was accepted and is running. Poll the `statusUrl` …; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Serve a container image to a peer node (GET /apps/fileoperationimage/{imageid}) <https://docs.runonflux.io/fluxapi/volume-browser/serveimagetopeer>

Node-to-node transfer of a container image this node already holds, used when a peer is installing the same application. The caller is identified by its remote address rather than by a forwarded header, and the requested `imageid` is *compared* against the images this node expects to hold — never used to look…`403`/`404` respectively. **Public** (peer nodes only)

FluxOS API endpoint GET /apps/fileoperationimage/{imageid} (operationId serveImageToPeer, Volume Browser). Public, no login.
Parameters:
- imageid (path, string, required): The image id as the *calling* node's daemon files it, which need not be what this node's daemon calls it
Responses: 200 Image stream; 400 Remote address could not be determined; 403 Caller is not a node entitled to this image; 404 This node does not hold the requested image.

## Ask whether a specification can be placed (POST /apps/placementfeasibility) <https://docs.runonflux.io/fluxapi/apps/placementfeasibility>

Answers whether a prospective application specification can reach its instance count on the network as it stands right now, and with how much provider diversity. Send the specification you are about to register.

`category` is the availability promise the network can make:
- `impossible` — fewer eligible nodes than instances. Every
  approximation counts *toward* eligibility, so the shortfall is proven
  and registration will reject the spec.

- `constrained` — the instance count is reachable, but a synced app's
  instances outnumber the available fault domains, so some instances must
  share a provider. Deliverable, with less resiliency than the instance
  count implies; registration warns.

- `ok` — the requested count and diversity are both deliverable.

Returns `503` while the node list or the IP location table is still filling in, rather than answering from a partial view. **User**

FluxOS API endpoint POST /apps/placementfeasibility (operationId placementFeasibility, Apps). Requires Flux ID login, privilege User.
Request body (application/json): object
Responses: 200 OK; 400 Input validation failed; 401 Authentication failed or insufficient privileges; 503 Service temporarily unavailable.

## Live placement geography (GET /apps/placementlocations) <https://docs.runonflux.io/fluxapi/apps/placementlocations>

Node, fault-domain and tier counts per continent and country, taken from this node's own IP location table in one pass over the confirmed node list. Nodes the table cannot resolve are counted in `unresolved` rather than guessed at.

Returns `503` while the node list is still filling in, and reports `tableAvailable: false` when the location table itself is absent — the tree *is* the product here, so its absence is unavailability rather than an empty answer. Query parameters are rejected. **Public**

FluxOS API endpoint GET /apps/placementlocations (operationId placementLocations, Apps). Public, no login.
Responses: 200 OK; 503 Service temporarily unavailable.

## Application components this node holds (GET /apps/heldcomponents) <https://docs.runonflux.io/fluxapi/apps/heldcomponents>

Every application component this node holds — the union of the containers running right now, the identifiers the reconciler has committed to, and the components an operator has explicitly stopped. A component that is stopped is still held.

Asked by peers during placement, so the answer is served from state the node already keeps rather than by reading Docker per request. Query parameters are rejected. **Public**

FluxOS API endpoint GET /apps/heldcomponents (operationId heldComponents, Apps). Public, no login.
Responses: 200 OK.

## Syncthing folders promoted on this node (GET /apps/promotedfolders) <https://docs.runonflux.io/fluxapi/apps/promotedfolders>

The Syncthing folder ids this node has promoted to `sendreceive` — the folders it holds the writable copy of. Asked by a peer before it promotes a folder of its own.

`ready` is `false` until the Syncthing monitor has completed its first pass; the `folders` list is empty until then and must not be read as "this node has promoted nothing". Query parameters are rejected. **Public**

FluxOS API endpoint GET /apps/promotedfolders (operationId promotedFolders, Apps). Public, no login.
Responses: 200 OK.

## Component names of an application (GET /apps/appcomponentnames) <https://docs.runonflux.io/fluxapi/apps/getapplicationcomponentnames>

The component names of a registered application, with its total resources. Restricted to the Flux Team rather than the owner: an owner reads the specification itself and has no use for this, and the node operator is not a party to a customer's app at all. **FluxTeam**

FluxOS API endpoint GET /apps/appcomponentnames (operationId getApplicationComponentNames, Apps). Requires Flux ID login, privilege FluxTeam.
Parameters:
- appname (query, string, required): Application name
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Count of app messages by owner (GET /apps/messagescount) <https://docs.runonflux.io/fluxapi/apps/getappsmessagescount>

How many global application messages carry the given owner. **Public**

FluxOS API endpoint GET /apps/messagescount (operationId getAppsMessagesCount, Apps). Public, no login.
Parameters:
- appowner (query, string, required): Owner FluxID
Responses: 200 OK.

## Runtime tampering events (GET /apps/tamperingevents) <https://docs.runonflux.io/fluxapi/apps/gettamperingevents>

Containers on this node whose running image no longer matches the image of the registered specification, most recently seen first. Reported per application when `appname` is given, otherwise across every application on the node. **Public**

FluxOS API endpoint GET /apps/tamperingevents (operationId getTamperingEvents, Apps). Public, no login.
Parameters:
- appname (query, string): Restrict to one application
- limit (query, integer): Maximum events to return; clamped to the service maximum
Responses: 200 OK.

## Kill an app (GET /apps/appkill) <https://docs.runonflux.io/fluxapi/apps/appkill>

Stops the application's containers with a kill signal rather than a graceful stop. A kill is a stop that carries a signal, so it is recorded as the same desired state with a mode — the reconciler applies it where it stops the container. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appkill (operationId appKill, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Application or component name
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## App monitoring data (GET /apps/appmonitor) <https://docs.runonflux.io/fluxapi/apps/appmonitor>

Stored CPU, memory, network and disk samples for an application on this node. **AppOwnerAbove**

FluxOS API endpoint GET /apps/appmonitor (operationId appMonitor, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Application or component name
- range (query, string): Time range of samples to return
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Redeploy a single component (GET /apps/redeploycomponent) <https://docs.runonflux.io/fluxapi/apps/redeploycomponent>

Redeploys one component of a composed application on this node without touching its siblings. `appname` is the *application* name and `component` the component name — an `appname` containing an underscore is refused.

With `force`, the redeploy is the hard one: the component's volume is unmounted and removed, so the app's data on this node is gone. Skipped while a restore is running for the application. **AppOwnerAbove**

FluxOS API endpoint GET /apps/redeploycomponent (operationId redeployComponent, Apps). Requires Flux ID login, privilege AppOwnerAbove.
Parameters:
- appname (query, string, required): Application name (not `component_app`)
- component (query, string, required): Component name
- force (query, boolean): Hard redeploy — removes the component's volume and data on this node
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Upload a file to FluxShare (POST /apps/fluxshare/uploadfile) <https://docs.runonflux.io/fluxapi/fluxshare/fluxshareuploadfile>

Uploads one or more files into a FluxShare folder on this node. Replaces the removed `POST /apps/fluxshare/upload`. Individual files are limited to 5&nbsp;GB and the upload is refused when FluxShare storage is full. The `folder` is sanitised against the FluxShare root, so a path that escapes it is refused. **Admin**

FluxOS API endpoint POST /apps/fluxshare/uploadfile (operationId fluxShareUploadFile, Fluxshare). Requires Flux ID login, privilege Admin.
Parameters:
- folder (query, string): Destination folder within FluxShare; the root when omitted
Request body (multipart/form-data): files (array)
Responses: 200 OK; 401 Authentication failed or insufficient privileges; 500 Internal server error.

## Connected peers (GET /flux/peers) <https://docs.runonflux.io/fluxapi/flux/getpeers>

Detailed information about this node's peer connections. Without a filter every peer is returned; `outbound` and `inbound` restrict to one direction, and an `ip:port` returns that single peer. **Public**

FluxOS API endpoint GET /flux/peers (operationId getPeers, Flux). Public, no login.
Parameters:
- filter (query, string): `outbound`, `inbound`, or a specific `ip:port`
Responses: 200 OK; 404 Named peer not found.

## Nodes flagged as unstable (GET /flux/unstablenodes) <https://docs.runonflux.io/fluxapi/flux/getunstablenodes>

Peers this node has seen disconnect five or more times within the tracking window, with the count and the time of the first disconnect. **Public**

FluxOS API endpoint GET /flux/unstablenodes (operationId getUnstableNodes, Flux). Public, no login.
Responses: 200 OK.

## Peer connection history (GET /flux/peerhistory) <https://docs.runonflux.io/fluxapi/flux/getpeerhistory>

Connection and disconnection events from this node's peer history ring buffer, newest first. Every filter is optional and they combine. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/peerhistory (operationId getPeerHistory, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Parameters:
- ip (query, string): IP or IP prefix to match
- code (query, integer): WebSocket close code
- event (query, string): Event type
- limit (query, integer): Most recent N events
- since (query, integer): Unix milliseconds; only events after this moment
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Peer-exchange topology (GET /flux/topology) <https://docs.runonflux.io/fluxapi/flux/gettopology>

What this node's peers have reported about *their* peers: an `outbound`/`inbound` list per reporting node, with the number of reporters and of distinct known peers. **Public**

FluxOS API endpoint GET /flux/topology (operationId getTopology, Flux). Public, no login.
Responses: 200 OK.

## Network health and diagnosis history (GET /flux/networkhealth) <https://docs.runonflux.io/fluxapi/flux/getnetworkhealth>

This node's view of network health: the monitor's current status, whether it considers the network to be in steady state, and its recent diagnosis history. **Public**

FluxOS API endpoint GET /flux/networkhealth (operationId getNetworkHealth, Flux). Public, no login.
Responses: 200 OK.

## Clock drift of this node (GET /flux/clockdrift) <https://docs.runonflux.io/fluxapi/flux/clockdrift>

The node's time offset as reported by its NTP client (`chrony` or `systemd-timesyncd`), with the source that answered and the node's own Unix time in seconds. A node whose clock has drifted is refused by signature-gated peer endpoints, so this is the first thing to check when those return "stale". **Public**

FluxOS API endpoint GET /flux/clockdrift (operationId clockDrift, Flux). Public, no login.
Responses: 200 OK.

## Enterprise application owners (GET /flux/enterpriseappowners) <https://docs.runonflux.io/fluxapi/flux/getenterpriseappowners>

The FluxIDs configured as enterprise application owners. Cached for an hour. **Public**

FluxOS API endpoint GET /flux/enterpriseappowners (operationId getEnterpriseAppOwners, Flux). Public, no login.
Responses: 200 OK.

## Ports in use on this node (POST /flux/portsinuse) <https://docs.runonflux.io/fluxapi/flux/portsinuse>

The ports this node currently has in use, returned **signed** so the caller can attribute the answer to this node.

Two kinds of caller are accepted. A peer node signs its ask with `pubKey`, `signature` and `timestamp`; the timestamp window is checked *before* the signature, so an ask outside it i…`zelidauth` header and send an empty body. **AdminAndFluxTeam** (or a signed peer request)

FluxOS API endpoint POST /flux/portsinuse (operationId portsInUse, Flux). Optional Flux ID login, privilege AdminAndFluxTeam.
Request body (application/json): pubKey (string), signature (string), timestamp (integer)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Ask this node to connect back to you (GET /flux/addoutgoingpeer) <https://docs.runonflux.io/fluxapi/flux/addoutgoingpeer>

Asks this node to open an outgoing connection to the given `ip`. The request is only honoured when it comes *from* that address and the address belongs to a confirmed node, so a node can ask a peer to connect back to it but cannot direct a peer at a third party. Refused while this node is unconfirmed, or when the connection already exists. **Public** (self-attested)

FluxOS API endpoint GET /flux/addoutgoingpeer (operationId addOutgoingPeer, Flux). Public, no login.
Parameters:
- ip (query, string, required): `ip` or `ip:port` — must match the requester's own address
Responses: 200 OK.

## Start peer discovery (GET /flux/startdiscovery) <https://docs.runonflux.io/fluxapi/flux/startdiscovery>

Starts this node's peer discovery loop. **FluxTeam**

FluxOS API endpoint GET /flux/startdiscovery (operationId startDiscovery, Flux). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Git branch FluxOS is running (GET /flux/currentbranch) <https://docs.runonflux.io/fluxapi/flux/getcurrentbranch>

The branch of the FluxOS working tree on this node. **FluxTeam**

FluxOS API endpoint GET /flux/currentbranch (operationId getCurrentBranch, Flux). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Git commit FluxOS is running (GET /flux/currentcommitid) <https://docs.runonflux.io/fluxapi/flux/getcurrentcommitid>

The commit id of the FluxOS working tree on this node. **FluxTeam**

FluxOS API endpoint GET /flux/currentcommitid (operationId getCurrentCommitId, Flux). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Reinstall the FluxOS UI (GET /flux/rebuildui) <https://docs.runonflux.io/fluxapi/flux/rebuildui>

Fetches the published CloudUI release again and reinstalls it, unconditionally — the periodic check stands down when the installed hash already matches the release, and a UI that is damaged rather than out of date matches all the same. Repairing one is what this is for.

Refused on ArcaneOS, where the watchdog owns CloudUI; the refusal names the component to ask instead. Replaces the removed `/flux/rebuildhome`. **AdminAndFluxTeam**

FluxOS API endpoint GET /flux/rebuildui (operationId rebuildUi, Flux). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Server-sent event stream (GET /flux/eventstream) <https://docs.runonflux.io/fluxapi/flux/eventstream>

A `text/event-stream` of FluxOS events. Each event carries a monotonic `id`; send it back in the `Last-Event-ID` header to resume.

A resuming consumer that fell behind the retention ring is told so *before* it is handed the survivors: a `stream:gap` event names `afterId`, `oldestRetainedId` and how many events were `dropped`. Silence here is what turns a dropped event into a timeout somewhere else entirely. A `: keepalive` comment is written every 15 seconds.

Answers `404` on nodes where the event stream is not enabled. **Public**

FluxOS API endpoint GET /flux/eventstream (operationId eventStream, Flux). Public, no login.
Parameters:
- Last-Event-ID (header, integer): Resume after this event id
Responses: 200 Event stream; 404 Event stream not enabled on this node.

## Internal event counters (test builds only) (GET /flux/testcounters) <https://docs.runonflux.io/fluxapi/flux/testcounters>

The internal event counters the event bus keeps. Available only on nodes where the test event stream is enabled; every other node answers `404`. **Public**

FluxOS API endpoint GET /flux/testcounters (operationId testCounters, Flux). Public, no login.
Responses: 200 OK; 404 Test counters not enabled on this node.

## FluxID of the node operator (deprecated) (GET /flux/zelid) <https://docs.runonflux.io/fluxapi/flux/getfluxzelid>

Deprecated alias of `GET /flux/id`. **Public**

FluxOS API endpoint GET /flux/zelid (operationId getFluxZelID, Flux). Public, no login.
Responses: 200 OK.

## Last stored benchmark result (GET /benchmark/getstoredbenchmark) <https://docs.runonflux.io/fluxapi/benchmark/getstoredbenchmark>

The benchmark result this node has stored locally, with the tier it qualified for. Answers an error message when the node has never stored one. Cached for an hour. **Public**

FluxOS API endpoint GET /benchmark/getstoredbenchmark (operationId getStoredBenchmark, Benchmark). Public, no login.
Responses: 200 OK.

## Start the benchmark daemon (GET /benchmark/start) <https://docs.runonflux.io/fluxapi/benchmark/startbenchmarkdaemon>

Starts `fluxbenchd` on the node (falling back to `zelbenchd` on older installs). **AdminAndFluxTeam**

FluxOS API endpoint GET /benchmark/start (operationId startBenchmarkDaemon, Benchmark). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Restart the benchmark daemon (GET /benchmark/restart) <https://docs.runonflux.io/fluxapi/benchmark/restartbenchmarkdaemon>

Restarts the benchmark daemon on the node. **AdminAndFluxTeam**

FluxOS API endpoint GET /benchmark/restart (operationId restartBenchmarkDaemon, Benchmark). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Sign a FluxNode transaction (deprecated) (GET /benchmark/signzelnodetransaction) <https://docs.runonflux.io/fluxapi/benchmark/signzelnodetransactionget>

Deprecated alias of `GET /benchmark/signfluxnodetransaction`. **Admin**

FluxOS API endpoint GET /benchmark/signzelnodetransaction (operationId signZelNodeTransactionGet, Benchmark). Requires Flux ID login, privilege Admin.
Parameters:
- hexstring (query, string, required): Transaction hex string
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Sign a FluxNode transaction, POST (deprecated) (POST /benchmark/signzelnodetransaction) <https://docs.runonflux.io/fluxapi/benchmark/signzelnodetransactionpost>

Deprecated alias of `POST /benchmark/signfluxnodetransaction`. **Admin**

FluxOS API endpoint POST /benchmark/signzelnodetransaction (operationId signZelNodeTransactionPost, Benchmark). Requires Flux ID login, privilege Admin.
Request body (application/json): hexstring (string)
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Request a configuration challenge (GET /arcane/authchallenge) <https://docs.runonflux.io/fluxapi/arcaneos/arcaneauthchallenge>

Issues a one-time challenge bound to the requester's IP address, to be answered by `POST /arcane/configsync`. HTTPS only.

Available **only on ArcaneOS nodes** — every other node answers `501`. A node whose `flux-configd` is not reachable answers `502`, and a requester that has exhausted its challenge allowance answers `429`. **Public**

FluxOS API endpoint GET /arcane/authchallenge (operationId arcaneAuthChallenge, ArcaneOS). Public, no login.
Responses: 200 OK; 400 Requester IP address could not be determined; 429 Challenge limit reached for this requester; 501 Not an ArcaneOS node; 502 `flux-configd` is not available.

## Synchronise node configuration (POST /arcane/configsync) <https://docs.runonflux.io/fluxapi/arcaneos/arcaneconfigsync>

Applies a signed configuration to an ArcaneOS node. Answer a challenge from `GET /arcane/authchallenge` with its encrypted form and a signature over it, alongside the configuration to apply. HTTPS only.

Available **only on ArcaneOS nodes** — every other node answers `501`, and a node whose `flux-configd` is not reachable answers `502`. **Public** (the signed challenge is the credential)

FluxOS API endpoint POST /arcane/configsync (operationId arcaneConfigSync, ArcaneOS). Public, no login.
Request body (application/json): challenge* (string), encryptedChallenge* (string), signature* (string), configData* (object)
Responses: 200 OK; 400 Input validation failed; 501 Not an ArcaneOS node; 502 `flux-configd` is not available.

## Create a payment request (GET /payment/paymentrequest) <https://docs.runonflux.io/fluxapi/payments/paymentrequest>

Mints a payment request id for a wallet payment flow. The id is valid for a limited window, after which it expires and can no longer be verified. **Public**

FluxOS API endpoint GET /payment/paymentrequest (operationId paymentRequest, Payments). Public, no login.
Responses: 200 OK.

## Verify a payment callback (POST /payment/verifypayment) <https://docs.runonflux.io/fluxapi/payments/verifypayment>

Receives and verifies a wallet payment callback against the payment request minted by `GET /payment/paymentrequest`. Accepts the transaction id as either `transaction_id` (as ZelCore sends it) or `txid`, and the payment id either as the `paymentid` query parameter or in the body. **Public**

FluxOS API endpoint POST /payment/verifypayment (operationId verifyPayment, Payments). Public, no login.
Parameters:
- paymentid (query, string): Payment request id, when not sent in the body
Request body (application/json): paymentid (string), transaction_id (string), txid (string), coin (string), chain (string), explorer (string), amount (number), from_address (string), to_address (string)
Responses: 200 OK; 413 Request body too large; 500 Internal server error.

## Full Syncthing metrics (GET /syncthing/metrics) <https://docs.runonflux.io/fluxapi/syncthing/getsyncthingmetrics>

A complete snapshot of this node's Syncthing state — health, system, connections and per-folder figures — collected at request time. **FluxTeam**

FluxOS API endpoint GET /syncthing/metrics (operationId getSyncthingMetrics, Syncthing). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Syncthing health summary (GET /syncthing/metrics/health) <https://docs.runonflux.io/fluxapi/syncthing/getsyncthinghealthsummary>

The condensed form of `GET /syncthing/metrics`: overall health, sync progress and issue list, plus system uptime, connection counts and folder counts. **FluxTeam**

FluxOS API endpoint GET /syncthing/metrics/health (operationId getSyncthingHealthSummary, Syncthing). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Syncthing metrics history (GET /syncthing/metrics/history) <https://docs.runonflux.io/fluxapi/syncthing/getsyncthingmetricshistory>

The most recent metrics snapshots this node has retained, oldest first. **FluxTeam**

FluxOS API endpoint GET /syncthing/metrics/history (operationId getSyncthingMetricsHistory, Syncthing). Requires Flux ID login, privilege FluxTeam.
Parameters:
- limit (query, integer): Most recent N snapshots; the full retained history when omitted
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Peer sync diagnostics (GET /syncthing/peer/diagnostics) <https://docs.runonflux.io/fluxapi/syncthing/getpeersyncdiagnostics>

Per-peer synchronisation diagnostics for the folders this node shares — what each peer is connected as, how far it has got, and where a folder is stalled. **FluxTeam**

FluxOS API endpoint GET /syncthing/peer/diagnostics (operationId getPeerSyncDiagnostics, Syncthing). Requires Flux ID login, privilege FluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Database entry for a single file (GET /syncthing/db/file) <https://docs.runonflux.io/fluxapi/syncthing/fluxsyncthingdbfile>

Syncthing's database record for one file in one folder — its global and local versions and availability. **Public**

FluxOS API endpoint GET /syncthing/db/file (operationId fluxSyncthingDbFile, Syncthing). Public, no login.
Parameters:
- folder (query, string, required): Folder id
- file (query, string, required): Path of the file within the folder
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Fusion coinbase transactions for an address (deprecated) (GET /explorer/fusion/coinbase) <https://docs.runonflux.io/fluxapi/explorer/getaddressfusioncoinbase>

Fusion coinbase transactions belonging to an address. Retained for compatibility with the Fusion mining pool integration and no longer part of the maintained explorer surface. **Public**

FluxOS API endpoint GET /explorer/fusion/coinbase (operationId getAddressFusionCoinbase, Explorer). Public, no login.
Parameters:
- address (query, string, required): Flux transparent address
Responses: 200 OK.

## Generate a zcaddress key pair (GET /daemon/zcrawkeygen) <https://docs.runonflux.io/fluxapi/daemon/zcrawkeygen>

Generates a `zcaddress` and its private key. A raw Zcash JoinSplit primitive, retained from the upstream daemon. **Admin**

FluxOS API endpoint GET /daemon/zcrawkeygen (operationId zcrawkeygen, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Perform a sample JoinSplit (GET /daemon/zcsamplejoinsplit) <https://docs.runonflux.io/fluxapi/daemon/zcsamplejoinsplit>

Performs a sample JoinSplit and returns its proof. Diagnostic only, and slow. **AdminAndFluxTeam**

FluxOS API endpoint GET /daemon/zcsamplejoinsplit (operationId zcsamplejoinsplit, Daemon). Requires Flux ID login, privilege AdminAndFluxTeam.
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Merge multiple UTXOs and notes into one address (GET /daemon/zmergetoaddress) <https://docs.runonflux.io/fluxapi/daemon/zmergetoaddress>

Merges funds from the given transparent and/or shielded source addresses into a single destination address. Asynchronous — the call returns an operation id to be polled with `GET /daemon/zgetoperationstatus`. **Admin**

FluxOS API endpoint GET /daemon/zmergetoaddress (operationId zmergetoaddress, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- fromaddresses (query, string, required): JSON array of source addresses, or one of the special strings `ANY_TADDR`, `ANY_ZADDR`, `ANY_SPROUT`, `ANY_SAPLING`
- toaddress (query, string, required): Destination transparent or shielded address
- fee (query, number): Fee to pay; the daemon default when omitted
- transparentlimit (query, integer): Maximum transparent UTXOs to merge
- shieldedlimit (query, integer): Maximum shielded notes to merge
- memo (query, string): Hex-encoded memo, for a shielded destination
Responses: 200 OK; 401 Authentication failed or insufficient privileges.

## Create fluxnode private key (deprecated) (GET /daemon/createzelnodekey) <https://docs.runonflux.io/fluxapi/daemon/createzelnodekey>

Deprecated alias of `GET /daemon/createfluxnodekey`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /daemon/createzelnodekey (operationId createzelnodekey, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 Identical to `GET /daemon/createfluxnodekey`; 401 Authentication failed or insufficient privileges.

## Flux node count (deprecated) (GET /daemon/getzelnodecount) <https://docs.runonflux.io/fluxapi/daemon/getzelnodecount>

Deprecated alias of `GET /daemon/getfluxnodecount`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /daemon/getzelnodecount (operationId getzelnodecount, Daemon). Public, no login.
Responses: 200 Identical to `GET /daemon/getfluxnodecount`.

## Fluxnode transaction outputs (deprecated) (GET /daemon/getzelnodeoutputs) <https://docs.runonflux.io/fluxapi/daemon/getzelnodeoutputs>

Deprecated alias of `GET /daemon/getfluxnodeoutputs`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /daemon/getzelnodeoutputs (operationId getzelnodeoutputs, Daemon). Requires Flux ID login, privilege Admin.
Responses: 200 Identical to `GET /daemon/getfluxnodeoutputs`; 401 Authentication failed or insufficient privileges.

## Flux node status (deprecated) (GET /daemon/getzelnodestatus) <https://docs.runonflux.io/fluxapi/daemon/getzelnodestatus>

Deprecated alias of `GET /daemon/getfluxnodestatus`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /daemon/getzelnodestatus (operationId getzelnodestatus, Daemon). Public, no login.
Responses: 200 Identical to `GET /daemon/getfluxnodestatus`.

## The fluxnode conf file (deprecated) (GET /daemon/listzelnodeconf) <https://docs.runonflux.io/fluxapi/daemon/listzelnodeconf>

Deprecated alias of `GET /daemon/listfluxnodeconf`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /daemon/listzelnodeconf (operationId listzelnodeconf, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- filter (query, string): Filter the list
Responses: 200 Identical to `GET /daemon/listfluxnodeconf`; 401 Authentication failed or insufficient privileges.

## Flux node list (deprecated) (GET /daemon/listzelnodes) <https://docs.runonflux.io/fluxapi/daemon/listzelnodes>

Deprecated alias of `GET /daemon/listfluxnodes`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /daemon/listzelnodes (operationId listzelnodes, Daemon). Public, no login.
Parameters:
- filter (query, string): Filter the list
Responses: 200 Identical to `GET /daemon/listfluxnodes`.

## Start fluxnode command (deprecated) (GET /daemon/startdeterministiczelnode) <https://docs.runonflux.io/fluxapi/daemon/startdeterministiczelnode>

Deprecated alias of `GET /daemon/startdeterministicfluxnode`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /daemon/startdeterministiczelnode (operationId startdeterministiczelnode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- alias (query, string): FluxNode alias
- lockwallet (query, boolean): Lock the wallet afterwards
Responses: 200 Identical to `GET /daemon/startdeterministicfluxnode`; 401 Authentication failed or insufficient privileges.

## Start FluxNode command (deprecated) (GET /daemon/startzelnode) <https://docs.runonflux.io/fluxapi/daemon/startzelnode>

Deprecated alias of `GET /daemon/startfluxnode`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /daemon/startzelnode (operationId startzelnode, Daemon). Requires Flux ID login, privilege Admin.
Parameters:
- set (query, boolean): Start all FluxNodes in the configuration
- lockwallet (query, boolean): Lock the wallet afterwards
- alias (query, string): FluxNode alias
Responses: 200 Identical to `GET /daemon/startfluxnode`; 401 Authentication failed or insufficient privileges.

## Deterministic FluxNode list (deprecated) (GET /daemon/viewdeterministiczelnodelist) <https://docs.runonflux.io/fluxapi/daemon/viewdeterministiczelnodelist>

Deprecated alias of `GET /daemon/viewdeterministicfluxnodelist`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /daemon/viewdeterministiczelnodelist (operationId viewdeterministiczelnodelist, Daemon). Public, no login.
Parameters:
- filter (query, string): Filter the list
Responses: 200 Identical to `GET /daemon/viewdeterministicfluxnodelist`.

## Obtain login phrase (deprecated) (GET /zelid/loginphrase) <https://docs.runonflux.io/fluxapi/id/zelidloginphrase>

Deprecated alias of `GET /id/loginphrase`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /zelid/loginphrase (operationId zelidLoginPhrase, ID). Public, no login.
Responses: 200 Identical to `GET /id/loginphrase`.

## Obtain emergency login phrase (deprecated) (GET /zelid/emergencyphrase) <https://docs.runonflux.io/fluxapi/id/zelidemergencyphrase>

Deprecated alias of `GET /id/emergencyphrase`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint GET /zelid/emergencyphrase (operationId zelidEmergencyPhrase, ID). Public, no login.
Responses: 200 Identical to `GET /id/emergencyphrase`.

## Obtain all logged sessions of a FluxID (deprecated) (GET /zelid/loggedsessions) <https://docs.runonflux.io/fluxapi/id/zelidloggedsessions>

Deprecated alias of `GET /id/loggedsessions`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **User**

FluxOS API endpoint GET /zelid/loggedsessions (operationId zelidLoggedSessions, ID). Requires Flux ID login, privilege User.
Responses: 200 Identical to `GET /id/loggedsessions`; 401 Authentication failed or insufficient privileges.

## Gets information about logged users (deprecated) (GET /zelid/loggedusers) <https://docs.runonflux.io/fluxapi/id/zelidloggedusers>

Deprecated alias of `GET /id/loggedusers`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /zelid/loggedusers (operationId zelidLoggedUsers, ID). Requires Flux ID login, privilege Admin.
Responses: 200 Identical to `GET /id/loggedusers`; 401 Authentication failed or insufficient privileges.

## Lists active login phrases (deprecated) (GET /zelid/activeloginphrases) <https://docs.runonflux.io/fluxapi/id/zelidactiveloginphrases>

Deprecated alias of `GET /id/activeloginphrases`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /zelid/activeloginphrases (operationId zelidActiveLoginPhrases, ID). Requires Flux ID login, privilege Admin.
Responses: 200 Identical to `GET /id/activeloginphrases`; 401 Authentication failed or insufficient privileges.

## Logs out current session (deprecated) (GET /zelid/logoutcurrentsession) <https://docs.runonflux.io/fluxapi/id/zelidlogoutcurrentsession>

Deprecated alias of `GET /id/logoutcurrentsession`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **User**

FluxOS API endpoint GET /zelid/logoutcurrentsession (operationId zelidLogoutCurrentSession, ID). Requires Flux ID login, privilege User.
Responses: 200 Identical to `GET /id/logoutcurrentsession`; 401 Authentication failed or insufficient privileges.

## Logs out all sessions (deprecated) (GET /zelid/logoutallsessions) <https://docs.runonflux.io/fluxapi/id/zelidlogoutallsessions>

Deprecated alias of `GET /id/logoutallsessions`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **User**

FluxOS API endpoint GET /zelid/logoutallsessions (operationId zelidLogoutAllSessions, ID). Requires Flux ID login, privilege User.
Responses: 200 Identical to `GET /id/logoutallsessions`; 401 Authentication failed or insufficient privileges.

## Logs out all users (deprecated) (GET /zelid/logoutallusers) <https://docs.runonflux.io/fluxapi/id/zelidlogoutallusers>

Deprecated alias of `GET /id/logoutallusers`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Admin**

FluxOS API endpoint GET /zelid/logoutallusers (operationId zelidLogoutAllUsers, ID). Requires Flux ID login, privilege Admin.
Responses: 200 Identical to `GET /id/logoutallusers`; 401 Authentication failed or insufficient privileges.

## Login into Flux (deprecated) (POST /zelid/verifylogin) <https://docs.runonflux.io/fluxapi/id/zelidverifylogin>

Deprecated alias of `POST /id/verifylogin`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint POST /zelid/verifylogin (operationId zelidVerifyLogin, ID). Public, no login.
Request body (application/json): object
Responses: 200 Identical to `POST /id/verifylogin`.

## Provide signature (deprecated) (POST /zelid/providesign) <https://docs.runonflux.io/fluxapi/id/zelidprovidesign>

Deprecated alias of `POST /id/providesign`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint POST /zelid/providesign (operationId zelidProvideSign, ID). Public, no login.
Request body (application/json): object
Responses: 200 Identical to `POST /id/providesign`.

## Checks the privilege level of a user (deprecated) (POST /zelid/checkprivilege) <https://docs.runonflux.io/fluxapi/id/zelidcheckprivilege>

Deprecated alias of `POST /id/checkprivilege`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **Public**

FluxOS API endpoint POST /zelid/checkprivilege (operationId zelidCheckPrivilege, ID). Public, no login.
Request body (application/json): object
Responses: 200 Identical to `POST /id/checkprivilege`; 401 Authentication failed or insufficient privileges.

## Logs out a specific session (deprecated) (POST /zelid/logoutspecificsession) <https://docs.runonflux.io/fluxapi/id/zelidlogoutspecificsession>

Deprecated alias of `POST /id/logoutspecificsession`, kept for callers written against the pre-rebrand vocabulary. Identical behaviour and identical response; use the canonical endpoint in new code. **User**

FluxOS API endpoint POST /zelid/logoutspecificsession (operationId zelidLogoutSpecificSession, ID). Requires Flux ID login, privilege User.
Request body (application/json): object
Responses: 200 Identical to `POST /id/logoutspecificsession`; 401 Authentication failed or insufficient privileges.
