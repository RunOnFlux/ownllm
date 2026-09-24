# Flux ecosystem facts (curated from the documentation)

Hand-curated from the Flux, Zelcore, SSP, FluxEdge and FluxCore documentation
and the FluxOS source. Each statement was read in the source linked beside its
heading. Ranked in the facts tier because the underlying pages are long and the
retriever does not reliably surface these answers from them.

## Which wallets can sign a Flux deployment <https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription>

A registration, renewal, update or cancellation becomes a JSON message that is
signed by the owner. Any of these can sign it:

- **Zelcore** (Web3 wallet)
- **SSP Wallet** (Web3 wallet)
- **MetaMask** (Web3 wallet)
- **Flux SSO / email login**, for people who do not run a wallet

After signing, the signature field fills in automatically. Payment links are
valid for **30 minutes**. There is no Flux CLI or Flux desktop app that signs
deployments; the four routes above are the supported ones.

## How to pay for an application <https://docs.runonflux.com/fluxcloud/cost-calculator>

- Methods: **Stripe** (card), **PayPal**, or **FLUX**.
- Paying in FLUX gives a **5% discount**. It is 5%, not 10%.
- FLUX must be sent on **FLUX mainnet**. A parallel asset on Ethereum, BNB Chain
  or another chain is not accepted for application payments.
- Paying from an exchange is discouraged: withdrawals can miss the 30-minute
  payment window, and many exchanges cannot attach the MEMO the payment needs.

## How many components an application can have <https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components>

An application can have **up to 10 components**. The resource limits apply to
the sum of all components: at most **15 CPU cores, 59,000 MB RAM and 820 GB SSD**
across the whole application. Every instance runs the full set of components
together. Inside an application a component is reachable from the others at the
hostname `flux<component>_<appname>`, so a component named `db` in an app named
`shop` answers on `fluxdb_shop`.

## Sync flags on containerData: g, r and s <https://github.com/runonflux/flux/blob/master/docs/multiple-mounts-guide.md>

The primary mount in `containerData` may carry a flag. FluxOS recognises exactly
three (ZelBack/src/services/utils/mountParser.js):

| flag | name | behaviour |
|---|---|---|
| `g:` | primary/standby (master/slave) | One instance serves. The others hold a synchronised copy of the directory and take over if the primary goes away. One authoritative copy, so no write conflicts. |
| `r:` | replicated | Every instance runs and the directory is synchronised between all of them. |
| `s:` | Syncthing folder | Sets the directory up as a Syncthing folder without the primary/standby election. |

A component with **no flag** keeps its data local to each instance. When the
network reschedules that instance onto another node, it starts with an **empty
volume** and the data is gone.

An application whose component uses `g:` is priced at **80% of the normal
rate** (ZelBack/src/services/utils/appSpecHelpers.js multiplies the price by
0.8). The sync flag is a 20% discount.

## Why marketplace game servers run on several instances with g: <https://cloud.runonflux.com/marketplace>

Every game server in the Flux marketplace uses the `g:` flag on its save
directory, for example `g:/data` for Minecraft and `g:/palworld/Pal/Saved` for
Palworld. The Games category deploys them on **3 instances** and the NewGames
category on **2**.

Only one instance runs the game at a time. The other instances are standby
copies holding the synchronised world, so when the node running the server goes
offline another node already has the world and takes over. More instances do
**not** mean more players or separate worlds; player capacity comes from the
size (RAM) of the one instance that runs.

Deploying a game server on **1 instance with no sync flag** is the configuration
that loses the world: the first time that instance is rescheduled, it comes back
empty. It looks cheaper and is the wrong default for anything with a save file.

## FluxNode tiers, collateral and hardware <https://docs.runonflux.com/fluxnodes/what-are-fluxnodes>

| tier | collateral | CPU | RAM | storage | bandwidth |
|---|---|---|---|---|---|
| Cumulus | 1,000 FLUX | 2 cores / 4 threads | 8 GB | 220 GB SSD or NVMe | 25 Mbit/s |
| Nimbus | 12,500 FLUX | 4 cores / 8 threads | 32 GB | 440 GB SSD or NVMe | 50 Mbit/s |
| Stratus | 40,000 FLUX | 8 cores / 16 threads | 64 GB | 880 GB SSD or NVMe | 100 Mbit/s |

All tiers need a public IP, about 97% uptime, and must pass a benchmark; storage
must be solid state. These are the current (ArcaneOS) requirements. The older
legacy-node guide lists lower RAM (16 GB Nimbus, 32 GB Stratus); the current
figures above supersede it. A Raspberry Pi can run a Cumulus node only.

Running a node (supplying capacity, locking collateral, earning rewards) is the
opposite of deploying an application (renting capacity, paying per month). An
application needs no collateral.

## Progressive Node Rewards <https://docs.runonflux.com/fluxnodes/what-are-fluxnodes>

Progressive Node Rewards go to **ArcaneOS nodes only**. FluxCloud application
revenue is split 80% to ArcaneOS node operators and 20% to the ArcaneOS nodes
actually hosting applications. Legacy (Ubuntu) nodes receive no Progressive Node
Rewards, only block rewards.

## Unlocking FluxNode collateral <https://docs.runonflux.com/fluxnodes/unlocking-fluxnode-collateral>

In Zelcore: **Apps, then FluxNodes**, select the node, click **Delete**. It
usually completes within seconds; there is no waiting period.

- **Do not refresh or leave the FluxNodes screen while it runs.** That re-locks
  the funds and the process must be repeated.
- Afterwards, if the FLUX stays in the same wallet, send an amount that is **not
  equal to the collateral** (for example 999.99 rather than 1,000) to break up
  the exact output so it is not picked up as collateral again by accident.
- Unlocking does not affect the hardware.

## Claiming parallel assets <https://docs.runonflux.com/fluxnodes/claim-parallel-assets>

Parallel assets are node rewards paid on other chains through Parallel Mining.
Ten are active: Kadena, Ethereum, BNB Smart Chain, Tron, Solana, Avalanche,
Ergo, Algorand, Polygon and Base.

- In **Zelcore**: Apps, then **Fusion**, three-dot menu, **Parallel Mining
  Claim**, pick the asset and the mining address, then Claim.
- In **SSP Wallet**: claimed across every chain and swapped via Fusion into
  native FLUX, with one extension signature and one SSP Key approval.
- Each claim costs a network fee. If no mining address appears in the dropdown,
  the claimable balance is below the fee; it is not a bug. Claiming monthly or
  quarterly is recommended.
- Rewards for newly added assets are claimable retroactively.

## Titan node staking <https://docs.runonflux.com/fluxnodes/titan-node-staking>

Titan lets several people stake toward one node. Minimum **50 FLUX**. Lockups of
**3, 6 or 12 months**. Payouts twice a week in **native FLUX only** (no parallel
assets). Redemptions are processed on **Thursdays and Sundays**. The Flux team
runs the hardware on Lumen and OVH; transactions are signed from a multisignature
address. Managed from Zelcore or SSP.

## Private registry images: repoauth <https://github.com/runonflux/flux/blob/master/docs/registry-auth/REPOAUTH_STRING_FORMAT.md>

Registry credentials go in the component's `repoauth` field. It is always a
**string**, never an object. Supplying it makes the application an enterprise
app, whose compose section is encrypted so only ArcaneOS nodes can decrypt it.

- Basic auth: `<username>:<password>` (Docker Hub, GHCR, GitLab, Harbor, any v2 registry)
- AWS ECR: `aws-ecr://region=<region>&accessKeyId=<access key id>&secretAccessKey=<secret access key>`
- Azure ACR: `azure-acr://clientId=<client id>&clientSecret=<client secret>&tenantId=<tenant id>`
- Google GAR: `google-gar://keyFile=<base64 of the service account JSON>`

Cloud tokens are held in memory only and last 12 hours (ECR), 3 hours (ACR) or
60 minutes (GAR). A **public** image needs no repoauth; leave the field out.
Never put credentials in an environment variable: environment parameters are
part of the public specification.

## FluxCloud, FluxEdge and FluxCore are different products <https://docs.runonflux.com/home/flux-ecosystem>

| product | what it is | who uses it |
|---|---|---|
| FluxCloud | deploy Docker applications on the CPU node network, paid per month | people renting capacity |
| FluxNodes | operator machines hosting FluxCloud apps, backed by collateral | people supplying CPU capacity |
| FluxEdge | rent GPUs by the hour (L40, A100, H100, RTX 4090) for training, inference, rendering | people renting GPU capacity |
| FluxCore | desktop app that offers a machine's GPU/CPU to FluxEdge and mines when idle; no collateral | people supplying GPU capacity |

FluxCloud applications run on CPU nodes; there is no GPU attached. GPU work goes
to FluxEdge.

## FluxEdge billing <https://docs.runonflux.com/fluxedge/faqs/billing-and-payments>

- Pay-as-you-go, drawn from a prepaid balance in real time.
- **Deposits are non-refundable and non-withdrawable.** Deposit what you plan to use.
- Deposit by PayPal, Stripe card, FLUX or voucher; depositing FLUX earns a 5% bonus.
- A project is a Kubernetes pod on a leased machine; you pay per machine, not per project.
- Local storage persists only for the lease; it is lost on stop, relaunch or migration.
- Project specs cannot be changed after deployment; logs are deleted after 10 days.

## FluxCore for providers <https://docs.runonflux.com/fluxcore/overview>

- Windows 10/11 or Ubuntu 22.04 (not Ubuntu Minimal).
- Linux install: `bash -i <(curl -s https://download.fluxcore.ai/setup.sh)`; the UI is then at `http://<local-ip>:18180`.
- Install the NVIDIA driver and both CUDA packages **before** FluxCore, or GPU benchmarks fall back to CPU and a full reinstall is needed.
- Providers **cannot set their own price**; it is computed from the hardware and reliability.
- A reboot or outage during a lease stops it, lowers reliability, and forfeits **20%** of that lease's rewards; the machine has 5 minutes to return before it is removed from the cluster.
- The Machine ID password cannot be recovered if lost; the machine must be reinstalled.

## SSP Wallet: lost a device <https://sspwallet.io/en/academy/security/recovering-ssp-when-you-lose-your-phone>

SSP is a 2-of-2 multisignature wallet: the SSP Wallet browser extension holds
one key and the SSP Key phone app holds a second; both must sign.

- **Phone lost, extension still working:** install SSP Key on a new phone, choose
  restore, start recovery from the extension, scan the QR. No seed phrase needed.
- **Computer lost, phone still working:** the phone anchors the restore.
- **Both lost:** restore from the two seed phrases on a trusted device.
- There are **two separate seed phrases**, one per device. One wallet pairs with
  exactly one SSP Key. There is no cloud backup.

Funds are not lost when one device is lost. Documentation: docs.sspwallet.io.

## Zelcore accounts and recovery <https://zelcore.io/legacy-login-deprecated>

- New accounts use a BIP44 seed phrase of 12, 18 or 24 words (24 recommended)
  plus an **EasyLogin** password for signing in on that device.
- A forgotten EasyLogin password is recovered by restoring from the seed phrase.
- A lost seed phrase cannot be recovered by anyone. Zelcore holds no keys.
- Legacy username/password login is deprecated; migration to BIP44 is manual.

## Managing a deployed application <https://docs.runonflux.com/fluxcloud/applications/management/manage-app/control>

- **Soft reinstall** recreates the container and **keeps** persistent data.
- **Hard reinstall** **wipes** persistent data. It is not recoverable.
- An **update** cannot add new components, but can change resources, images,
  ports, instances, contacts, and the `owner` field (which transfers the app).
- The renewal toggle on an update is **on by default**: it adds the selected
  period on top of the remaining term.
- **Cancel** is immediate and irreversible: the app is removed and its data is
  lost unless backed up. The remaining term is forfeited.
- Backups are written from the Backup and Restore tab to FluxDrive, a remote URL
  or a download.

## Official Flux channels <https://docs.runonflux.com/resources/socials>

Discord `discord.com/invite/runonflux`, X `x.com/RunOnFlux`, Telegram
`t.me/runonflux`, LinkedIn `linkedin.com/company/influxtechnologies`.
Documentation is at docs.runonflux.com. There is no official status page listed
in the documentation.

## Sites that are not Flux <https://docs.runonflux.com/home/flux-ecosystem>

The Flux AI product is at **ai.runonflux.com**. The site fluxai.io is not a
Flux / InFlux Technologies property. SSP Wallet's domains are sspwallet.io and
sspwallet.com; there is no sspwallet.online.
