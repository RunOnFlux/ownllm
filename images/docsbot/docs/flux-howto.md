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
