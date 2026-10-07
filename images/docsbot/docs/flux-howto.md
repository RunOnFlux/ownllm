# Flux how-to sheet (curated, pinned into every answer)

## Deploy an application on Flux <https://docs.runonflux.com/fluxcloud/register-new-app>
1. Open Flux Cloud (https://cloud.runonflux.com), sign in with your Flux ID (Zelcore, SSP Wallet, MetaMask or WalletConnect) and choose **Register New App**.
2. Pick a deployment method:
   - **Deploy with Docker** - you supply a container image from a public registry (or a private one as an enterprise app). Tabs: General (name, description, contact, instances, period), Geolocation, Priority Nodes, Components (image, ports, environment, cpu/ram/hdd per component), Review.
   - **Deploy with Git** - Flux-Orbit builds and runs your app straight from a Git repository (Node.js, Python, Go, Rust, PHP, .NET, Java and more); see the Deploy with Git guide.
3. Fill the General tab: app name (3+ characters, letters and digits only), description (10+ characters), instances (1 to 100), subscription period (1 week to 1 year, prepaid).
4. Set the components: each needs cpu (multiples of 0.1, up to 15 per app), ram (multiples of 100 MB, up to 59,000 MB per app), hdd (whole GB, up to 820 GB per app), ports and any environment variables. The image must be 5 GB or smaller.
5. Review the quote, sign the specification with your Flux ID and pay. The app is scheduled to matching nodes and usually runs within minutes at https://<appname>.app.runonflux.io (each port also gets https://<appname>_<port>.app.runonflux.io).
6. Optional: point your own domain at the app with a CNAME (Custom Domain Setup); update the app later from Flux Cloud (an update is priced on the difference for the remaining period).
You do NOT need to run a FluxNode to deploy an application.

## Update, renew or cancel a running application <https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription>
1. Open Flux Cloud, go to **Applications → Management**, pick the app under **My Active Apps** and click **Manage**.
2. Open the **Subscription** tab. **Renew** extends the period; **Update** lets you change the image tag, environment, ports, cpu/ram/hdd, instances or owner (you cannot add new components); **Cancel** stops the app.
3. For an update: edit the fields, decide whether the **Renewal** toggle should also add time (on by default), review the quote, sign with your Flux ID and pay. An update is priced on the difference for the remaining period, so a same-size update costs little.
4. To redeploy the same specification with the latest image (no spec change), use the **Control** tab (Manage App → Control) and choose **Soft Reinstall** (pulls the latest image, keeps persistent data) or **Restart Application** on the selected instance. **Hard Reinstall** wipes the app's data.

## Run a FluxNode <https://docs.runonflux.com/fluxnodes/what-are-fluxnodes>
Tiers (collateral / minimum hardware): Cumulus 1,000 FLUX, 2 cores/4 threads, 8 GB RAM, 220 GB SSD; Nimbus 12,500 FLUX, 4 cores/8 threads, 32 GB RAM, 440 GB SSD; Stratus 40,000 FLUX, 8 cores/16 threads, 64 GB RAM, 880 GB SSD. All need a public IP, 25/50/100 Mbit/s and ~97% uptime. Steps: lock the collateral in a wallet you control (Zelcore or SSP), install FluxOS on the server (ArcaneOS is the current recommended installation), start the node from the wallet. Smaller stakes can join through Titan Node staking (minimum 50 FLUX); managed-service providers run the server for you while you keep custody.

## What it costs <https://docs.runonflux.com/fluxcloud/cost-calculator>
Application price = declared cpu, ram and hdd per component x instances x period; Flux Cloud shows the exact quote before you sign. Extras: static IP $0.40, enterprise $0.80 plus $0.40 per enterprise port. Prices are shown in USD and payable in FLUX; there is a cost calculator on the docs site.

## Where things are <https://docs.runonflux.com/>
Flux Cloud: https://cloud.runonflux.com - docs: https://docs.runonflux.com - node dashboard and rewards: https://cloud.runonflux.com/dashboards - API: https://api.runonflux.io - support: https://docs.runonflux.com/resources/socials

## What SSP Wallet is <https://sspwallet.io>
SSP Wallet is a true two-factor, self-custody crypto wallet, and it is fully open source.
- **Two devices, two keys:** the SSP Wallet browser extension holds one private key and the SSP Key app on your phone holds a second one.
- **2-of-2 multisignature:** every transaction is built in the extension and must be signed by both keys, so one stolen or lost device cannot move funds.
- Each device has its own seed phrase; there is no cloud backup. Losing one device does not lose the funds (see "SSP Wallet: lost a device").
- SSP Wallet can sign Flux Cloud deployments, like Zelcore and MetaMask. Documentation: docs.sspwallet.io.

## What Zelcore is <https://zelcore.io>
Zelcore is a non-custodial (self-custody) multi-asset wallet from InFlux Technologies, the company behind Flux, available on the web (zelcore.io), on Windows, macOS and Linux, and on Android and iOS.
- It holds many coins and accounts from a single seed phrase, and lets you own, trade and manage digital assets.
- In the Flux ecosystem it signs Flux Cloud deployments, manages FluxNode collateral, claims Parallel Assets and stakes FLUX on Titan.
- Zelcore holds no keys: a lost seed phrase cannot be recovered by anyone (see "Zelcore accounts and recovery").

## Flux AI models and the LLM API <https://llm.runonflux.com>
Flux runs its own LLM API, fully decentralized on Flux nodes, at https://llm.runonflux.com. It is OpenAI-compatible: point any OpenAI client, agent framework or tool (for example an agent that takes an OpenAI provider) at the base URL https://llm.runonflux.com/v1 with a Flux API key, and call /v1/chat/completions; GET /v1/models lists what is available. The Ollama API (/api/chat) works too.
- Models served: fluxai:tiny (FluxAI, Flux's own fine-tuned model, best at deploying on Flux), gpt-oss:20b, qwen3:8b, gemma4:12b, granite4:tiny-h, granite4.2:3b, qwen3.5:2b, qwen3.5:0.8b and bitnet-2b-4t.
- The front page at llm.runonflux.com has a rate-limited demo key to try it; for regular use ask the Flux team for your own key.
- It runs on CPU nodes, so answers take seconds rather than milliseconds.

## Deploy a Next.js or Node.js website <https://docs.runonflux.io/fluxcloud/deploy-with-git>
For a Next.js, React, Vue or other Node.js site you do not need to build a Docker image: use **Deploy with Git** in Flux Cloud. Flux-Orbit builds and runs the app straight from your Git repository (Node.js, Python, Go, Rust, PHP, .NET, Java and more). Point your own domain at the app with a CNAME (Custom Domain Setup). If you already have a container image, Deploy with Docker works as well.

## WordPress on Flux Cloud <https://cloud.runonflux.com/templates/wordpress>
Use the WordPress template in Flux Cloud (cloud.runonflux.com/templates/wordpress). It deploys the official wordpress:6-apache image with a mariadb:11 database component; the site files live in /var/www/html and the database in /var/lib/mysql. Set your own database password in the form before you sign.

## VPN servers (WireGuard, OpenVPN) on Flux <https://github.com/runonflux/flux/blob/master/ZelBack/src/services/dockerService.js>
Flux apps run as containers without extra Linux capabilities and without a TUN device, so a VPN server that creates its own network interface - WireGuard, OpenVPN, Tailscale or Headscale exit nodes - cannot run on Flux. App ports do carry both TCP and UDP.
To reach machines on your own network through Flux, run a reverse-tunnel server instead, which uses ordinary ports and needs no TUN device - for example **frp** (frps) or **chisel**: the server runs on Flux, the client runs on your home machine and connects out to it, and your local services are reachable through the Flux app's ports.
