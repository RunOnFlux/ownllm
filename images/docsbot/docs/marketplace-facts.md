# Flux Marketplace apps (from the live marketplace catalogue)

Generated from api.marketplace.runonflux.io. Each marketplace app is a ready-made specification: pick it, fill in its parameters if it has any, and pay. Prices are USD per month at the preset size and instance count. Deploy these at exactly the listed image, resources, instance count and containerData; the sync flag on containerData is part of the specification, not decoration.

A containerData starting with `g:` means primary/standby: only one instance runs and the others keep a synchronised copy of that directory, which is why a game server is sold on several instances. Extra instances are standby copies of one world, not extra players.

## Apps offered at several sizes <https://cloud.runonflux.com/marketplace>

**Enshrouded** (image `jktuned/enshrouded-server:latest`, containerData `g:/opt/enshrouded/server/savegame`, 3 instances):

| template | CPU | RAM | disk | USD/month |
|---|---|---|---|---|
| Enshrouded4Slots | 2 | 4 GB | 50 GB | $9.99 |
| Enshrouded8Slots | 3 | 6 GB | 60 GB | $14.99 |
| Enshrouded16Slots | 4 | 8 GB | 65 GB | $19.99 |

**KaspaNode** (image `kaspanet/rusty-kaspad:latest`, containerData `/app/data`, 3 instances):

| template | CPU | RAM | disk | USD/month |
|---|---|---|---|---|
| KaspaNode16GB | 8 | 16 GB | 256 GB | $27.2 |
| KaspaTestnet16GB | 8 | 16 GB | 256 GB | $27.2 |
| KaspaNode24GB | 8 | 24 GB | 256 GB | $31.2 |
| KaspaTestnet24GB | 8 | 24 GB | 256 GB | $31.2 |

**Minecraft** (image `itzg/minecraft-server:latest`, containerData `g:/data`, 3 instances):

| template | CPU | RAM | disk | USD/month |
|---|---|---|---|---|
| Minecraft1GB | 1.4 | 1 GB | 15 GB | $2.99 |
| Minecraft2GB | 1.5 | 2 GB | 20 GB | $4.99 |
| MinecraftServer | 1.5 | 2 GB | 40 GB | $1 |
| Minecraft5GB | 2 | 5 GB | 30 GB | $9.99 |
| Minecraft9GB | 2 | 9 GB | 60 GB | $14.99 |
| Minecraft16GB | 2 | 16 GB | 75 GB | $24.99 |
| Minecraft32GB | 2 | 32 GB | 100 GB | $44.99 |
| Minecraft48GB | 2 | 48 GB | 150 GB | $69.99 |

**MinecraftBedrock** (image `itzg/minecraft-bedrock-server:latest`, containerData `g:/data`, 3 instances):

| template | CPU | RAM | disk | USD/month |
|---|---|---|---|---|
| MinecraftBedrock1GB | 1.4 | 1 GB | 15 GB | $2.99 |
| MinecraftBedrock2GB | 1.5 | 2 GB | 20 GB | $4.99 |
| MinecraftBedrockServer | 1.5 | 2 GB | 40 GB | $1 |
| MinecraftBedrock5GB | 2 | 5 GB | 30 GB | $9.99 |
| MinecraftBedrock9GB | 2 | 9 GB | 60 GB | $14.99 |
| MinecraftBedrock16GB | 2 | 16 GB | 75 GB | $24.99 |
| MinecraftBedrock32GB | 2 | 32 GB | 100 GB | $44.99 |
| MinecraftBedrock48GB | 2 | 48 GB | 150 GB | $69.99 |

**Palworld** (image `thijsvanloef/palworld-server-docker:latest`, containerData `g:/palworld/Pal/Saved`, 3 instances):

| template | CPU | RAM | disk | USD/month |
|---|---|---|---|---|
| Palworld4Slots | 2 | 5 GB | 12 GB | $7.99 |
| Palworld8Slots | 2.5 | 6300 MB | 15 GB | $12.99 |
| Palworld16Slots | 4 | 10 GB | 20 GB | $17.99 |
| Palworld32Slots | 6 | 14 GB | 35 GB | $24.99 |

## AlephiumNode <https://cloud.runonflux.com/marketplace>
AlephiumNode is a Blockchain app on the Flux marketplace: Host your Alephium Full Node on the Flux Cloud Preset price $5.99 per month for 3 instances. Total resources 0.5 cores, 1000 MB RAM, 130 GB storage across 1 component.
- Component alephiumnode: image `touilleio/alephium-standalone:latest-root`; 0.5 cores, 1000 MB RAM, 130 GB; container ports 39973; containerData `/data`.

## BittensorFN <https://cloud.runonflux.com/marketplace>
BittensorFN is a Blockchain app on the Flux marketplace: Host your Bittensor Full Node on the Flux Cloud Preset price $14.99 per month for 3 instances. Total resources 4.5 cores, 8000 MB RAM, 150 GB storage across 1 component.
- Component bittensorfullnode: image `opentensor/subtensor:latest`; 4.5 cores, 8000 MB RAM, 150 GB; container ports 9944, 30333, 9933; containerData `/tmp`.

## BLOCXMN <https://cloud.runonflux.com/marketplace>
BLOCXMN is a Masternode app on the Flux marketplace: Host your BLOCX Masternode on the Flux Cloud Preset price $6.32 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 10 GB storage across 1 component.
- Component blocxmasternode: image `blocxtech/blocxnode:latest`; 1 cores, 1000 MB RAM, 10 GB; container ports 12972; containerData `/root/.blocx`. Parameters the user fills in: KEY (The key of your masternode).

## Cyberfly <https://cloud.runonflux.com/marketplace>
Cyberfly is a Blockchain app on the Flux marketplace: Host your Cyberfly Mainnet Node on FluxCloud Preset price $1.63 per month for 3 instances. Total resources 1.2 cores, 1200 MB RAM, 7 GB storage across 3 components.
- Component cyberflymqtt: image `cyberfly/cyberfly_mqtt:latest`; 0.1 cores, 100 MB RAM, 1 GB; container ports 1883, 9001; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).
- Component cyberflynode: image `cyberfly/cyberfly_node:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 31001, 31002, 31003, 31006; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: KADENA_ACCOUNT (Your kadena k:address) [optional]; NODE_PRIV_KEY (Your node secret key).
- Component cyberflynodeui: image `cyberfly/cyberfly_node_ui:latest`; 0.1 cores, 100 MB RAM, 1 GB; container ports 80; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## DashNode <https://cloud.runonflux.com/marketplace>
DashNode is a Masternode app on the Flux marketplace: Host your Dash Masternode on the Flux Network (HA: 2 redundant nodes with automatic failover) Preset price $5 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 70 GB storage across 1 component.
- Component node: image `runonflux/dashnode:latest`; 2 cores, 4000 MB RAM, 70 GB; container ports 9999; containerData `/root/.dashcore`. Parameters the user fills in: KEY (Masternode operator BLS private key); PROTXHASH (Your masternode registration hash (proTxHash). Enables automatic on-chain IP updates so the node is never PoSe-banned after a relocation.) [optional].

## DesoNode <https://cloud.runonflux.com/marketplace>
DesoNode is a Blockchain app on the Flux marketplace: Host your Deso backend Node on the Flux Network Preset price $27.99 per month for 3 instances. Total resources 5 cores, 24000 MB RAM, 400 GB storage across 1 component.
- Component desonode: image `honsontran/deso-backend:stable`; 5 cores, 24000 MB RAM, 400 GB; container ports 33445, 33444; containerData `/db`.

## DogecoinNode <https://cloud.runonflux.com/marketplace>
DogecoinNode is a Blockchain app on the Flux marketplace: Host your Dogecoin Full Node on the Flux Network Preset price $5 per month for 3 instances. Total resources 1 cores, 3000 MB RAM, 100 GB storage across 1 component.
- Component dogenode: image `bigmandave/doge-node:latest`; 1 cores, 3000 MB RAM, 100 GB; container ports 22556; containerData `/etc/doge/`.

## DontStarveTogether <https://cloud.runonflux.com/marketplace>
DontStarveTogether is a NewGames app on the Flux marketplace: Brave the monsters of The Constant with up to 6 survivors, always online. Preset price $1 per month for 2 instances. Total resources 1 cores, 1500 MB RAM, 8 GB storage across 1 component.
- Component dstdst: image `wollwolke/dst-dedicated-server:latest`; 1 cores, 1500 MB RAM, 8 GB; container ports 11000, 10999; containerData `g:/data|m:dst_server:/home/dst/dst_server` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: CLUSTER_TOKEN (Your Klei cluster token (get it from accounts.klei.com > Game Servers > Add New Server)); CLUSTER_NAME (Server name shown in the server browser); SHARD_NAME (Shard name (use Master for single-shard servers)) [optional]; MAX_PLAYERS (Maximum players allowed) [optional].

## Dopex <https://cloud.runonflux.com/marketplace>
Dopex is a Front-end app on the Flux marketplace: Host your Dopex.io Frontend on the Flux Cloud Preset price $2.1 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component dopexui: image `runonflux/dopex-site:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 3000; containerData `/tmp`.

## DragonWilds <https://cloud.runonflux.com/marketplace>
DragonWilds is a NewGames app on the Flux marketplace: Host your RuneScape: Dragonwilds server on Flux Cloud for a 1-month plan Preset price $1 per month for 2 instances. Total resources 4 cores, 8000 MB RAM, 40 GB storage across 1 component.
- Component dragonwildsdragonwilds: image `indifferentbroccoli/runescape-dragonwilds-server-docker:latest`; 4 cores, 8000 MB RAM, 40 GB; container ports 27777; containerData `g:/home/steam/server-files` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: OWNER_ID (Your RuneScape: Dragonwilds Player ID (in-game, bottom of the Settings menu). The server will not start without it); SERVER_NAME (Server display name); DEFAULT_WORLD_NAME (World name - players search for this exact name (case sensitive) in the Public tab of the Worlds screen); ADMIN_PASSWORD (Password for in-game Server Management access); WORLD_PASSWORD (Optional join password. Leave empty for a public world) [optional].

## Enshrouded <https://cloud.runonflux.com/marketplace>
Enshrouded is a NewGames app on the Flux marketplace: Host your Enshrouded Game Server on Flux Cloud Preset price $1 per month for 2 instances. Total resources 2 cores, 5000 MB RAM, 40 GB storage across 1 component.
- Component Enshrouded: image `sknnr/enshrouded-dedicated-server:latest`; 2 cores, 5000 MB RAM, 40 GB; container ports 15637, 27015; containerData `g:/home/steam/enshrouded/savegame|f:enshrouded_server.json:/home/steam/enshrouded/enshrouded_server.json` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Enshrouded16Slots <https://cloud.runonflux.com/marketplace>
Enshrouded16Slots is a Games app on the Flux marketplace: Host your Enshrouded 16 slots Game Server on Flux Cloud for a 1-month plan Preset price $19.99 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 65 GB storage across 1 component.
- Component Enshrouded: image `jktuned/enshrouded-server:latest`; 4 cores, 8000 MB RAM, 65 GB; container ports 15636, 15637; containerData `g:/opt/enshrouded/server/savegame` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Enshrouded4Slots <https://cloud.runonflux.com/marketplace>
Enshrouded4Slots is a Games app on the Flux marketplace: Host your Enshrouded 4 slots Game Server on Flux Cloud for a 1-month plan Preset price $9.99 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 50 GB storage across 1 component.
- Component Enshrouded: image `jktuned/enshrouded-server:latest`; 2 cores, 4000 MB RAM, 50 GB; container ports 15636, 15637; containerData `g:/opt/enshrouded/server/savegame` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Enshrouded8Slots <https://cloud.runonflux.com/marketplace>
Enshrouded8Slots is a Games app on the Flux marketplace: Host your Enshrouded 8 slots Game Server on Flux Cloud for a 1-month plan Preset price $14.99 per month for 3 instances. Total resources 3 cores, 6000 MB RAM, 60 GB storage across 1 component.
- Component Enshrouded: image `jktuned/enshrouded-server:latest`; 3 cores, 6000 MB RAM, 60 GB; container ports 15636, 15637; containerData `g:/opt/enshrouded/server/savegame` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Factorio <https://cloud.runonflux.com/marketplace>
Factorio is a NewGames app on the Flux marketplace: factorio server Preset price $1 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component factorio: image `factoriotools/factorio:latest`; 2 cores, 2000 MB RAM, 40 GB; container ports 34197, 27015; containerData `g:/factorio` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## FactorNode <https://cloud.runonflux.com/marketplace>
FactorNode is a Blockchain app on the Flux marketplace: Host your FACTOR blockchain node on FluxCloud Preset price $7.3 per month for 3 instances. Total resources 4 cores, 4000 MB RAM, 20 GB storage across 1 component.
- Component factornode: image `projectfactor/factornode:latest`; 4 cores, 4000 MB RAM, 20 GB; container ports 8333, 30030; containerData `/data`.

## FiroMN <https://cloud.runonflux.com/marketplace>
FiroMN is a Masternode app on the Flux marketplace: Host your(s) Firo Masternode(s) on the Flux Cloud for a 1-month plan Preset price $8.99 per month for 3 instances. Total resources 1 cores, 2000 MB RAM, 12 GB storage across 1 component.
- Component node: image `runonflux/fironode:latest`; 1 cores, 2000 MB RAM, 12 GB; container ports 8168; containerData `/root/.firo`.

## FiveM <https://cloud.runonflux.com/marketplace>
FiveM is a NewGames app on the Flux marketplace: Host your own GTA V FiveM RP server (qbcore/esx/qbox) with txAdmin + MySQL fronted by Flux-Shared-DB (synced across instances). After deploy: open port 40120 for txAdmin and paste your cfxk_* key. DB conn: host=operator port=3307 user=root db=fivem. Preset price $1 per month for 3 instances. Total resources 3.5 cores, 8000 MB RAM, 25 GB storage across 3 components.
- Component fivem: image `spritsail/fivem:latest`; 2 cores, 6000 MB RAM, 15 GB; container ports 30120, 40120; containerData `g:/config|m:txdata:/txData` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).
- Component mariadb: image `mariadb:10.6`; 1 cores, 1000 MB RAM, 5 GB; containerData `/var/lib/mysql`. Parameters the user fills in: MYSQL_ROOT_PASSWORD (MySQL root password. The Flux-Shared-DB Operator and your RP framework (qbcore/esx/qbox) both authenticate with this password. MUST match the value you enter for DB_INIT_PASS on the operator component. Use a strong random password (16+ chars).).
- Component operator: image `runonflux/shared-db:latest`; 0.5 cores, 1000 MB RAM, 5 GB; container ports 3307, 7071, 8008; containerData `s:/app/dumps` (s: set up as a Syncthing folder). Parameters the user fills in: DB_INIT_PASS (Operator's auth password to MySQL. MUST match the value you enter for MYSQL_ROOT_PASSWORD on the mariadb component.).

## FoldingAtFluxCloud <https://cloud.runonflux.com/marketplace>
FoldingAtFluxCloud is a Productivity app on the Flux marketplace: PoUW at Flux layer 2 network. Folding@home is a project focused on disease research. Client Visit was disabled, to check Run On Flux team stats go to https://stats.foldingathome.org/team/262156 Preset price $2.99 per month for 3 instances. Total resources 1 cores, 700 MB RAM, 3 GB storage across 1 component.
- Component FoldingAtHome: image `yurinnick/folding-at-home:latest`; 1 cores, 700 MB RAM, 3 GB; container ports 7396; containerData `/config`. Parameters the user fills in: USER (Type the username that you want to be folding to).

## GarrysMod <https://cloud.runonflux.com/marketplace>
GarrysMod is a NewGames app on the Flux marketplace: Host TTT, DarkRP, Prop Hunt, or any gamemode your community can invent. Preset price $1 per month for 2 instances. Total resources 1.5 cores, 2000 MB RAM, 10 GB storage across 1 component.
- Component garrysmodgarrysmod: image `ich777/steamcmd:garrysmod`; 1.5 cores, 2000 MB RAM, 10 GB; container ports 27015, 27005; containerData `g:/serverdata/serverfiles` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: GAME_PARAMS (Server launch parameters) [optional].

## Gmx <https://cloud.runonflux.com/marketplace>
Gmx is a Front-end app on the Flux marketplace: Host your GMX.io Frontend on the Flux Cloud Preset price $3.16 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component gmxui: image `runonflux/gmx-interface:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 3000; containerData `/tmp`.

## HermesAgent <https://cloud.runonflux.com/marketplace>
HermesAgent is a Productivity app on the Flux marketplace: Deploy Hermes Agent, the self-improving AI agent by Nous Research, on Flux Cloud (4GB RAM). Password-protected dashboard, built-in Tailscale to reach your private network, and bring your own AI provider key (OpenRouter, OpenAI, Anthropic & more). Preset price $4.02 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 20 GB storage across 1 component.
- Component hermes: image `runonflux/hermes-tailscale:latest`; 2 cores, 4000 MB RAM, 20 GB; container ports 8080, 8642; containerData `g:/opt/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DASHBOARD_USERNAME (Username for the Hermes dashboard login (required)); DASHBOARD_PASSWORD (Password for the Hermes dashboard login (required)); API_SERVER_KEY (API key / bearer token for the OpenAI-compatible API server (required). Use this as the API key in external clients such as Open WebUI or scripts.); TAILSCALE_AUTHKEY (Tailscale auth key — lets the agent reach private services on your tailnet (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_HOSTNAME (Hostname for this device on your Tailscale network (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_EXTRA_ARGS (Additional arguments for tailscale up (e.g. --advertise-tags=tag:server) (optional - leave empty to skip Tailscale)) [optional].

## HermesAgentPro <https://cloud.runonflux.com/marketplace>
HermesAgentPro is a Productivity app on the Flux marketplace: Deploy Hermes Agent, the self-improving AI agent by Nous Research, on Flux Cloud — Pro (8GB RAM). Password-protected dashboard, built-in Tailscale to reach your private network, and bring your own AI provider key (OpenRouter, OpenAI, Anthropic & more). Preset price $7.49 per month for 2 instances. Total resources 4 cores, 8000 MB RAM, 80 GB storage across 1 component.
- Component hermes: image `runonflux/hermes-tailscale:latest`; 4 cores, 8000 MB RAM, 80 GB; container ports 8080, 8642; containerData `g:/opt/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DASHBOARD_USERNAME (Username for the Hermes dashboard login (required)); DASHBOARD_PASSWORD (Password for the Hermes dashboard login (required)); API_SERVER_KEY (API key / bearer token for the OpenAI-compatible API server (required). Use this as the API key in external clients such as Open WebUI or scripts.); TAILSCALE_AUTHKEY (Tailscale auth key — lets the agent reach private services on your tailnet (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_HOSTNAME (Hostname for this device on your Tailscale network (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_EXTRA_ARGS (Additional arguments for tailscale up (e.g. --advertise-tags=tag:server) (optional - leave empty to skip Tailscale)) [optional].

## IronFishNode <https://cloud.runonflux.com/marketplace>
IronFishNode is a Blockchain app on the Flux marketplace: An IronFish Full Node Preset price $11 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 50 GB storage across 1 component.
- Component ironfishnode: image `runonflux/iron-fish:latest`; 4 cores, 8000 MB RAM, 50 GB; container ports 9033; containerData `/root/.ironfish`.

## KadenaNode <https://cloud.runonflux.com/marketplace>
KadenaNode is a Blockchain app on the Flux marketplace: Kadena Chainweb Node with compacted database (~44GB). Includes web dashboard for monitoring. Uses snapshots from chainweb-community.org. Suitable for mining and API access. Initial bootstrap ~15 minutes. Preset price $15 per month for 3 instances. Total resources 4 cores, 4000 MB RAM, 80 GB storage across 1 component.
- Component chainweb: image `runonflux/kadena-chainweb-node:fluxcloud-compacted`; 4 cores, 4000 MB RAM, 80 GB; container ports 31350, 31351, 31352; containerData `/data`.

## KaspaNode16GB <https://cloud.runonflux.com/marketplace>
KaspaNode16GB is a Blockchain app on the Flux marketplace: Host your Kaspa Node on FluxCloud with 16GB RAM Preset price $27.2 per month for 3 instances. Total resources 8 cores, 16000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image `kaspanet/rusty-kaspad:latest`; 8 cores, 16000 MB RAM, 256 GB; container ports 15110, 15111, 17110, 18110; containerData `/app/data`.

## KaspaNode24GB <https://cloud.runonflux.com/marketplace>
KaspaNode24GB is a Blockchain app on the Flux marketplace: Host your Kaspa Node on FluxCloud with 24GB RAM Preset price $31.2 per month for 3 instances. Total resources 8 cores, 24000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image `kaspanet/rusty-kaspad:latest`; 8 cores, 24000 MB RAM, 256 GB; container ports 15110, 15111, 17110, 18110; containerData `/app/data`.

## KaspaTestnet16GB <https://cloud.runonflux.com/marketplace>
KaspaTestnet16GB is a Blockchain app on the Flux marketplace: Host your Kaspa Testnet Node on FluxCloud with 16GB RAM Preset price $27.2 per month for 3 instances. Total resources 8 cores, 16000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image `kaspanet/rusty-kaspad:latest`; 8 cores, 16000 MB RAM, 256 GB; container ports 15210, 15211, 17210, 18210; containerData `/app/data`.

## KaspaTestnet24GB <https://cloud.runonflux.com/marketplace>
KaspaTestnet24GB is a Blockchain app on the Flux marketplace: Host your Kaspa Testnet Node on FluxCloud with 24GB RAM Preset price $31.2 per month for 3 instances. Total resources 8 cores, 24000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image `kaspanet/rusty-kaspad:latest`; 8 cores, 24000 MB RAM, 256 GB; container ports 15210, 15211, 17210, 18210; containerData `/app/data`.

## KusamaNode <https://cloud.runonflux.com/marketplace>
KusamaNode is a Blockchain app on the Flux marketplace: Host your Kusama Node on the Flux Network Preset price $2.5 per month for 3 instances. Total resources 0.8 cores, 1800 MB RAM, 20 GB storage across 1 component.
- Component kusamanode: image `runonflux/polkadot-docker:latest`; 0.8 cores, 1800 MB RAM, 20 GB; container ports 30333, 9933, 9944; containerData `/chaindata`.

## Minecraft16GB <https://cloud.runonflux.com/marketplace>
Minecraft16GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 16GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $24.99 per month for 3 instances. Total resources 2 cores, 16000 MB RAM, 75 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 2 cores, 16000 MB RAM, 75 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft1GB <https://cloud.runonflux.com/marketplace>
Minecraft1GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 1GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $2.99 per month for 3 instances. Total resources 1.4 cores, 1000 MB RAM, 15 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 1.4 cores, 1000 MB RAM, 15 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft2GB <https://cloud.runonflux.com/marketplace>
Minecraft2GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 2GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $4.99 per month for 3 instances. Total resources 1.5 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 1.5 cores, 2000 MB RAM, 20 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft32GB <https://cloud.runonflux.com/marketplace>
Minecraft32GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 32GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $44.99 per month for 3 instances. Total resources 2 cores, 32000 MB RAM, 100 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 2 cores, 32000 MB RAM, 100 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft48GB <https://cloud.runonflux.com/marketplace>
Minecraft48GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 48GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $69.99 per month for 3 instances. Total resources 2 cores, 48000 MB RAM, 150 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 2 cores, 48000 MB RAM, 150 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft5GB <https://cloud.runonflux.com/marketplace>
Minecraft5GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 5GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $9.99 per month for 3 instances. Total resources 2 cores, 5000 MB RAM, 30 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 2 cores, 5000 MB RAM, 30 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Minecraft9GB <https://cloud.runonflux.com/marketplace>
Minecraft9GB is a Games app on the Flux marketplace: Host your PUBLIC Java Minecraft 9GB Vanilla Game Server on Flux Cloud for a one month plan Preset price $14.99 per month for 3 instances. Total resources 2 cores, 9000 MB RAM, 60 GB storage across 1 component.
- Component minecraftserver: image `itzg/minecraft-server:latest`; 2 cores, 9000 MB RAM, 60 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock16GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock16GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 16GB Game Server on Flux Cloud for a one month plan Preset price $24.99 per month for 3 instances. Total resources 2 cores, 16000 MB RAM, 75 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 2 cores, 16000 MB RAM, 75 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock1GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock1GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 1GB Game Server on Flux Cloud for a one month plan Preset price $2.99 per month for 3 instances. Total resources 1.4 cores, 1000 MB RAM, 15 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 1.4 cores, 1000 MB RAM, 15 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock2GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock2GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 2GB Game Server on Flux Cloud for a one month plan Preset price $4.99 per month for 3 instances. Total resources 1.5 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 1.5 cores, 2000 MB RAM, 20 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock32GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock32GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 32GB Game Server on Flux Cloud for a one month plan Preset price $44.99 per month for 3 instances. Total resources 2 cores, 32000 MB RAM, 100 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 2 cores, 32000 MB RAM, 100 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock48GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock48GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 48GB Game Server on Flux Cloud for a one month plan Preset price $69.99 per month for 3 instances. Total resources 2 cores, 48000 MB RAM, 150 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 2 cores, 48000 MB RAM, 150 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock5GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock5GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 5GB Game Server on Flux Cloud for a one month plan Preset price $9.99 per month for 3 instances. Total resources 2 cores, 5000 MB RAM, 30 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 2 cores, 5000 MB RAM, 30 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrock9GB <https://cloud.runonflux.com/marketplace>
MinecraftBedrock9GB is a Games app on the Flux marketplace: Host your PUBLIC Minecraft Bedrock 9GB Game Server on Flux Cloud for a one month plan Preset price $14.99 per month for 3 instances. Total resources 2 cores, 9000 MB RAM, 60 GB storage across 1 component.
- Component minecraftbedrockserver: image `itzg/minecraft-bedrock-server:latest`; 2 cores, 9000 MB RAM, 60 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## MinecraftBedrockServer <https://cloud.runonflux.com/marketplace>
MinecraftBedrockServer is a NewGames app on the Flux marketplace:  Preset price $1 per month for 2 instances. Total resources 1.5 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component minecraftbedrock: image `itzg/minecraft-bedrock-server:latest`; 1.5 cores, 2000 MB RAM, 40 GB; container ports 19132; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DIFFICULTY (DIFFICULTY) [optional]; GAMEMODE (GAMEMODE) [optional]; ALLOW_CHEATS (ALLOW_CHEATS) [optional]; ONLINE_MODE (ONLINE_MODE) [optional]; DEFAULT_PLAYER_PERMISSION_LEVEL (DEFAULT_PLAYER_PERMISSION_LEVEL) [optional].

## MinecraftServer <https://cloud.runonflux.com/marketplace>
MinecraftServer is a NewGames app on the Flux marketplace:  Preset price $1 per month for 2 instances. Total resources 1.5 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component minecraft: image `itzg/minecraft-server:latest`; 1.5 cores, 2000 MB RAM, 40 GB; container ports 25565; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: TYPE (Server software, and what it can load. VANILLA is unmodified Minecraft and accepts no mods or plugins. PAPER and PURPUR run plugins (PURPUR is PAPER plus extra gameplay settings). FABRIC, QUILT, FORGE and NEOFORGE run mods: pick the one your mods are built for, they are not interchangeable. Anything other than VANILLA needs at least the 4GB plan.); VERSION (Minecraft version. LATEST auto-updates on restart; any specific version locks the server (required for modded servers). Mojang moved to year-based numbering in 2026: 26.x releases follow the 1.21.x line.) [optional]; DIFFICULTY (DIFFICULTY) [optional]; ENABLE_COMMAND_BLOCK (ENABLE_COMMAND_BLOCK) [optional]; HARDCORE (HARDCORE) [optional]; SPAWN_MONSTERS (SPAWN_MONSTERS) [optional]; MODE (MODE) [optional]; PVP (PVP) [optional].

## N8NPro <https://cloud.runonflux.com/marketplace>
N8NPro is a Productivity app on the Flux marketplace: Self-hosted n8n workflow automation on a high-availability PostgreSQL cluster (auto-failover, 3 nodes) — n8n 4GB + HA PostgreSQL 2GB · 4 CPU · 35GB SSD. Build AI agents and connect 500+ apps. Web UI on port 35678. Preset price $9.87 per month for 3 instances. Total resources 4 cores, 6000 MB RAM, 35 GB storage across 2 components.
- Component n8n: image `n8nio/n8n:latest`; 2.5 cores, 4000 MB RAM, 10 GB; container ports 5678; containerData `g:/home/node/.n8n` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DB_POSTGRESDB_PASSWORD (Database password n8n uses to connect to PostgreSQL. MUST match the value you enter for POSTGRES_SUPERUSER_PASSWORD on the pgcluster component. Use a strong random password (16+ chars). Do not use the $ character.).
- Component pgcluster: image `runonflux/flux-pg-cluster:latest`; 1.5 cores, 2000 MB RAM, 25 GB; container ports 5432, 5433, 8008, 2379, 2380; containerData `/var/lib/postgresql/data|m:etcd:/var/lib/etcd`. Parameters the user fills in: POSTGRES_SUPERUSER_PASSWORD (PostgreSQL superuser password. MUST match the value you enter for DB_POSTGRESDB_PASSWORD on the n8n component. Use a strong random password (16+ chars). Do not use the $ character.); POSTGRES_REPLICATION_PASSWORD (Password PostgreSQL replicas use for streaming replication between your instances. Use a strong random password (16+ chars). Do not use the $ character.); SSL_PASSPHRASE (Passphrase used to generate the SSL certificates that encrypt replication traffic between your instances. Use a strong random passphrase (16+ chars).).

## N8NStandard <https://cloud.runonflux.com/marketplace>
N8NStandard is a Productivity app on the Flux marketplace: Self-hosted n8n workflow automation on a high-availability PostgreSQL cluster (auto-failover, 3 nodes) — n8n 2GB + HA PostgreSQL 1GB · 2.5 CPU · 25GB SSD. Build AI agents and connect 500+ apps. Web UI on port 35678. Preset price $6.24 per month for 3 instances. Total resources 2.5 cores, 3000 MB RAM, 25 GB storage across 2 components.
- Component n8n: image `n8nio/n8n:latest`; 1.5 cores, 2000 MB RAM, 10 GB; container ports 5678; containerData `g:/home/node/.n8n` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DB_POSTGRESDB_PASSWORD (Database password n8n uses to connect to PostgreSQL. MUST match the value you enter for POSTGRES_SUPERUSER_PASSWORD on the pgcluster component. Use a strong random password (16+ chars). Do not use the $ character.).
- Component pgcluster: image `runonflux/flux-pg-cluster:latest`; 1 cores, 1000 MB RAM, 15 GB; container ports 5432, 5433, 8008, 2379, 2380; containerData `/var/lib/postgresql/data|m:etcd:/var/lib/etcd`. Parameters the user fills in: POSTGRES_SUPERUSER_PASSWORD (PostgreSQL superuser password. MUST match the value you enter for DB_POSTGRESDB_PASSWORD on the n8n component. Use a strong random password (16+ chars). Do not use the $ character.); POSTGRES_REPLICATION_PASSWORD (Password PostgreSQL replicas use for streaming replication between your instances. Use a strong random password (16+ chars). Do not use the $ character.); SSL_PASSPHRASE (Passphrase used to generate the SSL certificates that encrypt replication traffic between your instances. Use a strong random passphrase (16+ chars).).

## N8NStarter <https://cloud.runonflux.com/marketplace>
N8NStarter is a Productivity app on the Flux marketplace: Self-hosted n8n workflow automation on a high-availability PostgreSQL cluster (auto-failover, 3 nodes) — n8n 1GB + HA PostgreSQL 1GB · 2 CPU · 15GB SSD. Build AI agents and connect 500+ apps. Web UI on port 35678. Preset price $5.32 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 15 GB storage across 2 components.
- Component n8n: image `n8nio/n8n:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 5678; containerData `g:/home/node/.n8n` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: DB_POSTGRESDB_PASSWORD (Database password n8n uses to connect to PostgreSQL. MUST match the value you enter for POSTGRES_SUPERUSER_PASSWORD on the pgcluster component. Use a strong random password (16+ chars). Do not use the $ character.).
- Component pgcluster: image `runonflux/flux-pg-cluster:latest`; 1 cores, 1000 MB RAM, 10 GB; container ports 5432, 5433, 8008, 2379, 2380; containerData `/var/lib/postgresql/data|m:etcd:/var/lib/etcd`. Parameters the user fills in: POSTGRES_SUPERUSER_PASSWORD (PostgreSQL superuser password. MUST match the value you enter for DB_POSTGRESDB_PASSWORD on the n8n component. Use a strong random password (16+ chars). Do not use the $ character.); POSTGRES_REPLICATION_PASSWORD (Password PostgreSQL replicas use for streaming replication between your instances. Use a strong random password (16+ chars). Do not use the $ character.); SSL_PASSPHRASE (Passphrase used to generate the SSL certificates that encrypt replication traffic between your instances. Use a strong random passphrase (16+ chars).).

## Neoxa <https://cloud.runonflux.com/marketplace>
Neoxa is a Masternode app on the Flux marketplace: Host your Neoxa Masternode on the Flux Cloud Preset price $5 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 40 GB storage across 1 component.
- Component node: image `runonflux/neoxa-node:latest`; 2 cores, 4000 MB RAM, 40 GB; container ports 8788; containerData `/root/.neoxacore`. Parameters the user fills in: KEY (Smartnode operator BLS private key); PROTXHASH (Your smartnode registration hash (proTxHash). Enables automatic on-chain IP updates so the node is never PoSe-banned after a relocation.) [optional].

## NextcloudLite <https://cloud.runonflux.com/marketplace>
NextcloudLite is a Productivity app on the Flux marketplace: Nextcloud Lite — a private cloud sized for one user. Perfect for phone photo backup, personal documents, calendar, and contacts. Powered by the bundled SQLite database. Upgrade to Nextcloud Personal when you need more storage or want to share with family. Preset price $3 per month for 2 instances. Total resources 1 cores, 2000 MB RAM, 25 GB storage across 1 component.
- Component nextcloudlite: image `nextcloud:33-apache`; 1 cores, 2000 MB RAM, 25 GB; container ports 80; containerData `g:/var/www/html` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## NextcloudPersonal <https://cloud.runonflux.com/marketplace>
NextcloudPersonal is a Productivity app on the Flux marketplace: Nextcloud Personal — your own private cloud for up to 5 users. Includes file sync, photo backup, calendar, contacts, and notes. Powered by the bundled SQLite database. Best for households or small teams who need shared storage and collaboration. Preset price $5.02 per month for 2 instances. Total resources 2.5 cores, 4000 MB RAM, 100 GB storage across 1 component.
- Component nextcloudpersonal: image `nextcloud:33-apache`; 2.5 cores, 4000 MB RAM, 100 GB; container ports 80; containerData `g:/var/www/html` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## OpenClaw <https://cloud.runonflux.com/marketplace>
OpenClaw is a Productivity app on the Flux marketplace: OpenClaw is a personal AI assistant you run on your own hardware. Privacy-focused, local-first, with 20+ messaging integrations (WhatsApp, Telegram, Slack, Discord, Signal, Matrix), voice, browser automation and webhooks. Preset price $4.02 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 20 GB storage across 1 component.
- Component OpenClaw: image `runonflux/openclaw-tailscale:latest`; 2 cores, 4000 MB RAM, 20 GB; container ports 18789; containerData `g:/home/node/.openclaw` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: OPENCLAW_GATEWAY_PASSWORD (Password to protect the OpenClaw gateway web UI (required)); TAILSCALE_AUTHKEY (Tailscale auth key for connecting to your tailnet (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_HOSTNAME (Hostname for this device on your Tailscale network (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_EXTRA_ARGS (Additional arguments for tailscale up (e.g. --advertise-tags=tag:server) (optional - leave empty to skip Tailscale)) [optional].

## OpenClawPro <https://cloud.runonflux.com/marketplace>
OpenClawPro is a Productivity app on the Flux marketplace: OpenClaw Pro - higher specs for professional usage. Privacy-focused AI assistant with 20+ messaging integrations, voice, browser automation and webhooks. Preset price $7.49 per month for 2 instances. Total resources 4 cores, 8000 MB RAM, 80 GB storage across 1 component.
- Component OpenClawPro: image `runonflux/openclaw-tailscale:latest`; 4 cores, 8000 MB RAM, 80 GB; container ports 18789; containerData `g:/home/node/.openclaw` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: OPENCLAW_GATEWAY_PASSWORD (Password to protect the OpenClaw gateway web UI (required)); TAILSCALE_AUTHKEY (Tailscale auth key for connecting to your tailnet (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_HOSTNAME (Hostname for this device on your Tailscale network (optional - leave empty to skip Tailscale)) [optional]; TAILSCALE_EXTRA_ARGS (Additional arguments for tailscale up (e.g. --advertise-tags=tag:server) (optional - leave empty to skip Tailscale)) [optional].

## PalWorld <https://cloud.runonflux.com/marketplace>
PalWorld is a NewGames app on the Flux marketplace: Host your Palworld Game Server on Flux Cloud for a 1-month plan Preset price $1 per month for 2 instances. Total resources 2 cores, 5000 MB RAM, 30 GB storage across 1 component.
- Component palworldpalworld: image `runonflux/palworld-server-flux:latest`; 2 cores, 5000 MB RAM, 30 GB; container ports 8211, 27015, 8212; containerData `g:/palworld/Pal/Saved` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: COMMUNITY (List your server in the in-game community server browser) [optional].

## Palworld16Slots <https://cloud.runonflux.com/marketplace>
Palworld16Slots is a Games app on the Flux marketplace: Host your Palworld 16 slots Game Server on Flux Cloud for a 1-month plan Preset price $17.99 per month for 3 instances. Total resources 4 cores, 10000 MB RAM, 20 GB storage across 1 component.
- Component palworld: image `thijsvanloef/palworld-server-docker:latest`; 4 cores, 10000 MB RAM, 20 GB; container ports 8211, 27015, 25575; containerData `g:/palworld/Pal/Saved` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Palworld32Slots <https://cloud.runonflux.com/marketplace>
Palworld32Slots is a Games app on the Flux marketplace: Host your Palworld 32 slots Game Server on Flux Cloud for a 1-month plan Preset price $24.99 per month for 3 instances. Total resources 6 cores, 14000 MB RAM, 35 GB storage across 1 component.
- Component palworld: image `thijsvanloef/palworld-server-docker:latest`; 6 cores, 14000 MB RAM, 35 GB; container ports 8211, 27015, 25575; containerData `g:/palworld/Pal/Saved` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Palworld4Slots <https://cloud.runonflux.com/marketplace>
Palworld4Slots is a Games app on the Flux marketplace: Host your Palworld 4 slots Game Server on Flux Cloud for a 1-month plan Preset price $7.99 per month for 3 instances. Total resources 2 cores, 5000 MB RAM, 12 GB storage across 1 component.
- Component palworld: image `thijsvanloef/palworld-server-docker:latest`; 2 cores, 5000 MB RAM, 12 GB; container ports 8211, 27015, 25575; containerData `g:/palworld/Pal/Saved` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Palworld8Slots <https://cloud.runonflux.com/marketplace>
Palworld8Slots is a Games app on the Flux marketplace: Host your Palworld 8 slots Game Server on Flux Cloud for a 1-month plan Preset price $12.99 per month for 3 instances. Total resources 2.5 cores, 6300 MB RAM, 15 GB storage across 1 component.
- Component palworld: image `thijsvanloef/palworld-server-docker:latest`; 2.5 cores, 6300 MB RAM, 15 GB; container ports 8211, 27015, 25575; containerData `g:/palworld/Pal/Saved` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Pangolin <https://cloud.runonflux.com/marketplace>
Pangolin is a Front-end app on the Flux marketplace: Host your Pangolin Frontend on the Flux Cloud Preset price $2.1 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component pangolinui: image `runonflux/pangolindex-interface:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 3000; containerData `/tmp`.

## PirateCashNode <https://cloud.runonflux.com/marketplace>
PirateCashNode is a Masternode app on the Flux marketplace: Host your PirateCash Masternode on the Flux Network (HA: 2 redundant nodes with automatic failover). Collateral: 10,000 PIRATE. Preset price $5 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 40 GB storage across 1 component.
- Component node: image `runonflux/piratecashnode:latest`; 2 cores, 4000 MB RAM, 40 GB; container ports 63636; containerData `/root/.piratecore`. Parameters the user fills in: KEY (Masternode operator BLS private key); PROTXHASH (Optional. Your masternode registration hash (proTxHash). Enables automatic on-chain IP updates (HA failover) so the node is never PoSe-banned after a relocation.) [optional].

## PIVXMN <https://cloud.runonflux.com/marketplace>
PIVXMN is a Masternode app on the Flux marketplace: Host your PIVX Masternode on the Flux Cloud Preset price $5.99 per month for 3 instances. Total resources 1 cores, 2500 MB RAM, 50 GB storage across 1 component.
- Component node: image `runonflux/pivxnode:latest`; 1 cores, 2500 MB RAM, 50 GB; container ports 51472; containerData `/root/.pivx`. Parameters the user fills in: KEY (The key of your masternode).

## PresearchNode <https://cloud.runonflux.com/marketplace>
PresearchNode is a Blockchain app on the Flux marketplace: Presearch is a Decentralized Search Engine - PresearchNode on Flux Network uses FluxStorage to build Private Keys and works without auto staking limitations when Nodes disconnect, doesn't work with 'Grandfather' nodes. Preset price $1.69 per month for 3 instances (instance count is fixed for this app). Total resources 0.3 cores, 300 MB RAM, 2 GB storage across 1 component.
- Component node: image `presearch/node:latest`; 0.3 cores, 300 MB RAM, 2 GB; container ports 38253; containerData `/app/node`. Parameters the user fills in: REGISTRATION_CODE (Your node registration code); DESCRIPTION (Optional description for your node).

## PresearchNodeLegacy <https://cloud.runonflux.com/marketplace>
PresearchNodeLegacy is a Blockchain app on the Flux marketplace: Presearch is a Decentralized Search Engine - PresearchNodeLegacy on Flux Network works with 'GrandFather' Nodes but with auto staking limitations when Nodes disconnect Preset price $1.69 per month for 3 instances (instance count is fixed for this app). Total resources 0.3 cores, 300 MB RAM, 2 GB storage across 1 component.
- Component node: image `presearch/node:latest`; 0.3 cores, 300 MB RAM, 2 GB; container ports 38253; containerData `/app/node`. Parameters the user fills in: REGISTRATION_CODE (Your node registration code).

## PrivateSimpleXSMP <https://cloud.runonflux.com/marketplace>
PrivateSimpleXSMP is a Hosting app on the Flux marketplace: Host your own PRIVATE (password-protected) SimpleX SMP Server with IP + Onion address. Only clients with your password can register. Preset price $3.06 per month for 2 instances. Total resources 1 cores, 2500 MB RAM, 21 GB storage across 2 components.
- Component smpsimplex: image `runonflux/simplex-smp-server:latest`; 0.9 cores, 2000 MB RAM, 20 GB; container ports 5223; containerData `g:/etc/opt/simplex` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: PASS (Server password. Clients must present this value to register with your SMP relay. Spec is encrypted (isAutoEnterprise) so the value is never exposed on-chain.).
- Component onion: image `wirewrex/hiddenonion:latest`; 0.1 cores, 500 MB RAM, 1 GB; containerData `g:/var/lib/tor` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## ProjectZomboid <https://cloud.runonflux.com/marketplace>
ProjectZomboid is a NewGames app on the Flux marketplace: Keep Knox Country persistent - no resets, no lag, no random hosts dropping out. Preset price $1 per month for 2 instances. Total resources 3 cores, 6000 MB RAM, 20 GB storage across 1 component.
- Component projectzomboid: image `danixu86/project-zomboid-dedicated-server:42.20.0-release`; 3 cores, 6000 MB RAM, 20 GB; container ports 36261, 36262; containerData `g:/home/steam/Zomboid` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVERNAME (Server identifier (no spaces or special characters). Changing it later creates a new world.); DISPLAYNAME (Server name shown in the in-game server browser.); SERVERPRESET (Game difficulty preset (Build 42 sandbox presets)); ADMINPASSWORD (Admin account password. REQUIRED - the server will not start without it. Use a strong password.); PASSWORD (Password players must enter to join the server (leave empty for no join password). Applied after the first restart.) [optional]; ADMINUSERNAME (Admin account username for server management) [optional].

## RaptoreumNode <https://cloud.runonflux.com/marketplace>
RaptoreumNode is a Masternode app on the Flux marketplace: Host your Raptoreum Smartnode on the Flux Network (HA: 2 redundant nodes with automatic failover). Collateral: 1,800,000 RTM. Preset price $5 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 60 GB storage across 1 component.
- Component node: image `runonflux/raptoreumnode:latest`; 2 cores, 4000 MB RAM, 60 GB; container ports 10226; containerData `/raptoreum/.raptoreumcore`. Parameters the user fills in: KEY (Smartnode operator BLS private key); PROTXHASH (Optional. Your smartnode registration hash (proTxHash). Enables automatic on-chain IP updates (HA failover) so the node is never PoSe-banned after a relocation.) [optional].

## RavenNode <https://cloud.runonflux.com/marketplace>
RavenNode is a Blockchain app on the Flux marketplace: Host your Ravencoin Node on the Flux Network Preset price $5.99 per month for 3 instances. Total resources 2 cores, 1500 MB RAM, 69 GB storage across 1 component.
- Component RavenNode: image `dramirezrt/ravencoin-core-server:latest`; 2 cores, 1500 MB RAM, 69 GB; container ports 38080, 38767, 31413; containerData `/kingofthenorth`. Parameters the user fills in: UACOMMENT (Let the community reward you for hosting this Raven Node or use it as a Placeholder).

## RustServer <https://cloud.runonflux.com/marketplace>
RustServer is a NewGames app on the Flux marketplace: Run your own wipe schedule, plugin stack, and community on a dedicated box. Preset price $1 per month for 2 instances. Total resources 2.5 cores, 8000 MB RAM, 15 GB storage across 1 component.
- Component rust: image `pfeiffermax/rust-game-server:latest`; 2.5 cores, 8000 MB RAM, 15 GB; container ports 28015, 28016, 28017, 28082; containerData `g:/srv/rust/server/rust` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVER_HOSTNAME (Server name shown in the Rust server browser); SERVER_DESCRIPTION (Short description shown in the server info panel); RCON_PASSWORD (Password for remote admin access via RCON (port 28016). Use a strong unique value.).

## RustServerOxide <https://cloud.runonflux.com/marketplace>
RustServerOxide is a NewGames app on the Flux marketplace: Carbon pre-installed, with uMod/Oxide plugins supported through Carbon's compatibility layer. Drop your plugin stack into the mounted carbon/plugins folder and tune gather, decay, kits, and more from carbon/configs. Preset price $1 per month for 2 instances. Total resources 2.5 cores, 8000 MB RAM, 15 GB storage across 1 component.
- Component rustoxide: image `runonflux/rust-carbon-server:latest`; 2.5 cores, 8000 MB RAM, 15 GB; container ports 28015, 28016, 28017, 28082; containerData `g:/srv/rust/server/rustcarbon|m:carbon:/srv/rust/carbon` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVER_HOSTNAME (Server name shown in the Rust server browser); SERVER_DESCRIPTION (Short description shown in the server info panel); RCON_PASSWORD (Password for remote admin access via RCON (port 28016). Use a strong unique value.); SERVER_SEED (Map seed. Any number generates a different map; leave the suggested random one or paste a seed you picked on rustmaps.com. You can change it later in Server Settings, which generates a new map.).

## Satisfactory <https://cloud.runonflux.com/marketplace>
Satisfactory is a NewGames app on the Flux marketplace: satisfactory server Preset price $1 per month for 2 instances. Total resources 2 cores, 8000 MB RAM, 60 GB storage across 1 component.
- Component satisfactory: image `wolveix/satisfactory-server:latest`; 2 cores, 8000 MB RAM, 60 GB; container ports 7777, 8888; containerData `g:/config` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## SimpleXSMP <https://cloud.runonflux.com/marketplace>
SimpleXSMP is a Hosting app on the Flux marketplace: Host your own PUBLIC SimpleX SMP Server with IP + Onion address. Federated, decentralized messaging relay for the SimpleX Chat network. Preset price $3.06 per month for 2 instances. Total resources 1 cores, 2500 MB RAM, 21 GB storage across 2 components.
- Component smpsimplex: image `runonflux/simplex-smp-server:latest`; 0.9 cores, 2000 MB RAM, 20 GB; container ports 5223; containerData `g:/etc/opt/simplex` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).
- Component onion: image `wirewrex/hiddenonion:latest`; 0.1 cores, 500 MB RAM, 1 GB; containerData `g:/var/lib/tor` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## SimpleXxFTP <https://cloud.runonflux.com/marketplace>
SimpleXxFTP is a Hosting app on the Flux marketplace: Host your own PUBLIC SimpleX xFTP server with a 40 GB quota. Decentralized, end-to-end-encrypted file relay for the SimpleX Chat network. Preset price $3.06 per month for 2 instances. Total resources 0.9 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component xftpsimplex: image `runonflux/simplex-xftp-server:latest`; 0.9 cores, 2000 MB RAM, 40 GB; container ports 34443; containerData `g:/etc/opt/simplex-xftp` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## StreamrNode <https://cloud.runonflux.com/marketplace>
StreamrNode is a Blockchain app on the Flux marketplace: The Streamr Node, AutoStaker plugin, hosted via Flux Cloud. Adjusting optional environment parameters is done at your own risk. Official Documentation: https://blog.streamr.network/the-autostaker-automated-staking-for-streamr-node-operators/ Preset price $9.7 per month for 3 instances. Total resources 3 cores, 4000 MB RAM, 10 GB storage across 1 component.
- Component streamrnode: image `streamr/node:latest`; 3 cores, 4000 MB RAM, 10 GB; container ports 32200; containerData `/tmp`. Parameters the user fills in: STREAMR__BROKER__PLUGINS__OPERATOR__OPERATOR_CONTRACT_ADDRESS (Operator Contract Address.); STREAMR__BROKER__PLUGINS__AUTOSTAKER__OPERATOR_CONTRACT_ADDRESS (Operator Contract Address.) [optional]; STREAMR__BROKER__CLIENT__AUTH__PRIVATE_KEY (Node Private Key.); STREAMR__BROKER__PLUGINS__AUTOSTAKER__MAX_SPONSORSHIP_COUNT (**OPTIONAL** The integer maxSponsorshipCount controls how many sponsorships the autostaker will stake into at most. The larger the capacity of your operator fleet state is (in terms of node count / CPU / bandwidth) the higher this number can be. Conversely, if your operator fleet is small, this integer should be kept low. The default value is set to 25.) [optional]; STREAMR__BROKER__PLUGINS__AUTOSTAKER__MIN_TRANSACTION_DATA_TOKEN_AMOUNT (**OPTIONAL** The integer minTransactionDataTokenAmount controls the minimum value a transaction must be to be considered for execution. The value is expressed in $DATA tokens. Any transactions falling below this value will be skipped. This is to avoid executing transactions that are too small in value. To choose this value, balance the cost of gas vs. the value gained by staking the amount optimally. (The exception to this config is expired sponsorships, which will always be unstaked from regardless.) The default value is set to 1000.) [optional]; STREAMR__BROKER__PLUGINS__AUTOSTAKER__MAX_ACCEPTABLE_MIN_OPERATOR_COUNT (**OPTIONAL** The integer maxAcceptableMinOperatorCount is used to decide whether to stake into a sponsorship that has a minimum operator count requirement. Such sponsorships only start paying out once the minimum operator count is reached. E.g. if a sponsorship has a minimum operator count of 20, and this is set to 20, the autostaker will stake into it. If it is set to 10, the autostaker will not stake into it. (The check is static and does not consider how many operators may currently already be staked into such a sponsorship.) The default value is set to 50.) [optional]; STREAMR__BROKER__PLUGINS__AUTOSTAKER__RUN_INTERVAL_IN_MS (**OPTIONAL** The integer runIntervalInMs controls how often the autostaker will run its logic. In addition to time-based runs, the autostaker will also run whenever a new sponsorship is created. The default value is set to 3600000, and the value must be >= 300000.) [optional].

## Sushiswap <https://cloud.runonflux.com/marketplace>
Sushiswap is a Front-end app on the Flux marketplace: Host your Sushiswap Frontend on the Flux Cloud Preset price $2.1 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component sushiswapui: image `runonflux/sushiswap-interface:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 3000; containerData `/tmp`.

## Teamspeak <https://cloud.runonflux.com/marketplace>
Teamspeak is a Hosting app on the Flux marketplace: 16 Slot Teamspeak 3 Server. Use crystal clear sound to communicate with your team mates cross-platform with military-grade security, lag-free performance & unparalleled reliability and uptime. Preset price $1.79 per month for 2 instances. Total resources 1 cores, 2000 MB RAM, 10 GB storage across 1 component.
- Component teamspeak: image `teamspeak:latest`; 1 cores, 2000 MB RAM, 10 GB; container ports 9987, 10011, 30033; containerData `g:/var/ts3server/` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Teamspeak6 <https://cloud.runonflux.com/marketplace>
Teamspeak6 is a Hosting app on the Flux marketplace: 32 Slot Teamspeak 6 Server. Use crystal clear sound to communicate with your team mates cross-platform with military-grade security, lag-free performance & unparalleled reliability and uptime. Preset price $3.99 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 40 GB storage across 1 component.
- Component teamspeak6: image `teamspeaksystems/teamspeak6-server:latest`; 2 cores, 4000 MB RAM, 40 GB; container ports 9987, 31001; containerData `g:/var/tsserver` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Terraria <https://cloud.runonflux.com/marketplace>
Terraria is a NewGames app on the Flux marketplace: Keep a persistent 2D sandbox running 24/7 for your whole party. Preset price $1 per month for 2 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component terrariaterraria: image `ryshe/terraria:tshock-latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 7777; containerData `g:/root/.local/share/Terraria/Worlds` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## TimpiCollector <https://cloud.runonflux.com/marketplace>
TimpiCollector is a Blockchain app on the Flux marketplace: Timpi Collectors are decentralized “workers” crawling the web collecting information about websites and their pages. This system remains invisible from front-end services, safeguarding the security of our Collectors. Preset price $3.3 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 1 GB storage across 1 component.
- Component timpicollector: image `timpiltd/timpi-collector:latest`; 2 cores, 2000 MB RAM, 1 GB; container ports 5015; containerData `/opt/timpi`. Parameters the user fills in: GUID (Your GUID).

## TimpiGeocore <https://cloud.runonflux.com/marketplace>
TimpiGeocore is a Blockchain app on the Flux marketplace: Run a GeoCore Node to help power Timpi’s decentralized, location-aware search infrastructure. Fast. Distributed. Privacy-focused. Preset price $3.49 per month for 1 instances. Total resources 4 cores, 8000 MB RAM, 3 GB storage across 1 component.
- Component timpigeocore: image `timpiltd/timpi-geocore:latest`; 4 cores, 8000 MB RAM, 3 GB; container ports 4013; containerData `/var/timpi`. Parameters the user fills in: LOCATION (Enter the country you selected for Geolocation Allowed.) [optional]; GUID (Your Registered GUID).

## Unturned <https://cloud.runonflux.com/marketplace>
Unturned is a NewGames app on the Flux marketplace: Run a zombie-survival sandbox with mods, plugins, and full admin control. Preset price $1 per month for 2 instances. Total resources 1 cores, 2000 MB RAM, 8 GB storage across 1 component.
- Component unturnedunturned: image `ich777/steamcmd:unturned`; 1 cores, 2000 MB RAM, 8 GB; container ports 27015, 27016; containerData `g:/serverdata/serverfiles` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## UptimeKuma <https://cloud.runonflux.com/marketplace>
UptimeKuma is a Productivity app on the Flux marketplace: Uptime Kuma is an easy-to-use self-hosted monitoring tool. Preset price $5.99 per month for 3 instances (instance count is fixed for this app). Total resources 0.5 cores, 800 MB RAM, 10 GB storage across 1 component.
- Component UptimeKuma: image `louislam/uptime-kuma:latest`; 0.5 cores, 800 MB RAM, 10 GB; container ports 3001; containerData `g:/app/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline).

## Valheim <https://cloud.runonflux.com/marketplace>
Valheim is a NewGames app on the Flux marketplace: Sail, build, and slay the bosses of the tenth Viking realm — always online. Preset price $1 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 10 GB storage across 1 component.
- Component valheimvalheim: image `lloesche/valheim-server:latest`; 2 cores, 4000 MB RAM, 10 GB; container ports 2456, 2457, 2458; containerData `g:/config` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVER_NAME (Server name shown in the server browser); WORLD_NAME (Name of the world save file) [optional]; SERVER_PASS (Password required to join the server (min 5 characters)).

## Vaultwarden <https://cloud.runonflux.com/marketplace>
Vaultwarden is a Productivity app on the Flux marketplace: Deploy your own Vaultwarden password manager on Flux Cloud Preset price $2.55 per month for 2 instances. Total resources 1 cores, 500 MB RAM, 10 GB storage across 1 component.
- Component vaultwarden: image `vaultwarden/server:latest`; 1 cores, 500 MB RAM, 10 GB; container ports 80; containerData `g:/data` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: ADMIN_TOKEN (Admin panel token (plain string or Argon2id hash; leave empty to disable admin panel)) [optional].

## VRising <https://cloud.runonflux.com/marketplace>
VRising is a NewGames app on the Flux marketplace: Rise as a vampire lord and keep your castle standing while you sleep. Preset price $1 per month for 2 instances. Total resources 2 cores, 4000 MB RAM, 10 GB storage across 1 component.
- Component vrisingvrising: image `trueosiris/vrising:latest`; 2 cores, 4000 MB RAM, 10 GB; container ports 9876, 9877; containerData `g:/mnt/vrising/persistentdata|m:server:/mnt/vrising/server` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVERNAME (Server name shown in the server browser).

## Windrose <https://cloud.runonflux.com/marketplace>
Windrose is a NewGames app on the Flux marketplace: Sail the skies in this co-op survival adventure — your crew's island, always online. Early Access; requires an AVX2-capable CPU. Preset price $1 per month for 2 instances. Total resources 2 cores, 8000 MB RAM, 35 GB storage across 1 component.
- Component windrosewindrose: image `indifferentbroccoli/windrose-server-docker:latest`; 2 cores, 8000 MB RAM, 35 GB; container ports 7777; containerData `g:/home/steam/server-files` (g: primary/standby: one instance serves and the others hold a synchronised copy of this directory, so the data survives the serving node going offline). Parameters the user fills in: SERVER_NAME (Display name shown in the server list); SERVER_PASSWORD (Optional password to restrict who can join the server) [optional]; USER_SELECTED_REGION (Preferred matchmaking region) [optional].

## Yearn <https://cloud.runonflux.com/marketplace>
Yearn is a Front-end app on the Flux marketplace: Host your Yearn Finance Frontend on the Flux Cloud Preset price $3.16 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component yearnui: image `runonflux/yearn-finance-v3:latest`; 1 cores, 1000 MB RAM, 5 GB; container ports 80; containerData `/tmp`.
