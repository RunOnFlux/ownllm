# Flux Marketplace apps (curated one-click presets in Flux Cloud > Marketplace)

Each marketplace app is a ready-made specification: pick it, fill in its parameters if it has any, and pay. Prices are USD per month for the preset size and instance count; the same app can also be deployed manually with different resources.

## HelloWorldParams <https://cloud.runonflux.com/marketplace>
HelloWorldParams is a Hosting app on the Flux marketplace: A simple hello world app with parameterized content. Preset price $0.99 per month for 3 instances (instance count is fixed for this app). Total resources 0.1 cores, 100 MB RAM, 1 GB storage across 1 component.
- Component helloworldparams: image jeffvaderflux/helloworld_params:latest; 0.1 cores, 100 MB RAM, 1 GB; ports 37185 (container 80); data path /tmp. Parameters the user fills in: PAGE_TITLE (The title of the page); PAGE_CONTENT (The content of the page).

## FoldingAtFluxCloud <https://cloud.runonflux.com/marketplace>
FoldingAtFluxCloud is a Productivity app on the Flux marketplace: PoUW at Flux layer 2 network. Folding@home is a project focused on disease research. Client Visit was disabled, to check Run On Flux team stats go to https://stats.foldingathome.org/team/262156. Preset price $2.99 per month for 3 instances. Total resources 1 cores, 700 MB RAM, 3 GB storage across 1 component.
- Component FoldingAtHome: image yurinnick/folding-at-home:latest; 1 cores, 700 MB RAM, 3 GB; ports 35555 (container 7396); data path /config. Parameters the user fills in: USER (Type the username that you want to be folding to).

## PresearchNodeLegacy <https://cloud.runonflux.com/marketplace>
PresearchNodeLegacy is a Blockchain app on the Flux marketplace: Host your Presearch Node Legacy on the Flux Cloud. PresearchNodeLegacy on Flux Network works with 'GrandFather' Nodes but with auto staking limitations when Nodes disconnect. Preset price $1.69 per month for 3 instances (instance count is fixed for this app). Total resources 0.3 cores, 300 MB RAM, 2 GB storage across 1 component.
- Component node: image presearch/node:latest; 0.3 cores, 300 MB RAM, 2 GB; ports 39000 (container 38253); data path /app/node. Parameters the user fills in: REGISTRATION_CODE (Your node registration code).

## PresearchNode <https://cloud.runonflux.com/marketplace>
PresearchNode is a Blockchain app on the Flux marketplace: Host your Presearch Node on the Flux Cloud. PresearchNode on Flux Network uses FluxStorage to build Private Keys and works without auto staking limitations when Nodes disconnect, doesn't work with 'Grandfather' nodes. Preset price $1.69 per month for 3 instances (instance count is fixed for this app). Total resources 0.3 cores, 300 MB RAM, 2 GB storage across 1 component.
- Component node: image presearch/node:latest; 0.3 cores, 300 MB RAM, 2 GB; ports 39000 (container 38253); data path /app/node. Parameters the user fills in: REGISTRATION_CODE (Your node registration code); DESCRIPTION (Optional description for your node).

## Streamr <https://cloud.runonflux.com/marketplace>
Streamr is a Blockchain app on the Flux marketplace: Host your Streamr 1.0 Mainnet on the Flux Cloud 1-month plan. Preset price $10.99 per month for 3 instances. Total resources 3 cores, 4000 MB RAM, 10 GB storage across 1 component.
- Component streamrnode: image streamr/node:latest; 3 cores, 4000 MB RAM, 10 GB; ports 32200 (container 32200); data path /tmp.

## IronFishNode <https://cloud.runonflux.com/marketplace>
IronFishNode is a Blockchain app on the Flux marketplace: An IronFish Full Node. Preset price $11.00 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 50 GB storage across 1 component.
- Component ironfishnode: image runonflux/iron-fish:latest; 4 cores, 8000 MB RAM, 50 GB; ports 39010 (container 9033); data path /root/.ironfish.

## FiroMN <https://cloud.runonflux.com/marketplace>
FiroMN is a Masternode app on the Flux marketplace: Host your(s) Firo Masternode(s) on the Flux Cloud. Preset price $8.99 per month for 3 instances. Total resources 1 cores, 2000 MB RAM, 12 GB storage across 1 component.
- Component node: image runonflux/fironode:latest; 1 cores, 2000 MB RAM, 12 GB; ports 8168 (container 8168); data path /root/.firo.

## PIVXMN <https://cloud.runonflux.com/marketplace>
PIVXMN is a Masternode app on the Flux marketplace: Host your PIVX Masternode on the Flux Cloud. Preset price $5.99 per month for 3 instances. Total resources 1 cores, 2500 MB RAM, 50 GB storage across 1 component.
- Component node: image runonflux/pivxnode:latest; 1 cores, 2500 MB RAM, 50 GB; ports 51472 (container 51472); data path /root/.pivx. Parameters the user fills in: KEY (The key of your masternode).

## DashMN <https://cloud.runonflux.com/marketplace>
DashMN is a Masternode app on the Flux marketplace: Host your Dash Node on the Flux Network. Preset price $3.50 per month for 3 instances. Total resources 1 cores, 2000 MB RAM, 50 GB storage across 1 component.
- Component node: image runonflux/dashnode:latest; 1 cores, 2000 MB RAM, 50 GB; ports 37500 (container 9999); data path /root/.dashcore. Parameters the user fills in: KEY (The key of your masternode).

## RavenNode <https://cloud.runonflux.com/marketplace>
RavenNode is a Blockchain app on the Flux marketplace: Host your Ravencoin Node on the Flux Network. Preset price $5.99 per month for 3 instances. Total resources 2 cores, 1500 MB RAM, 69 GB storage across 1 component.
- Component node: image dramirezrt/ravencoin-core-server:latest; 2 cores, 1500 MB RAM, 69 GB; ports 38080, 38767, 31413 (container 38080, 38767, 31413); data path /kingofthenorth. Parameters the user fills in: UACOMMENT (Let the community reward you for hosting this Raven Node or use it as a Placeholder).

## ChainwebNode <https://cloud.runonflux.com/marketplace>
ChainwebNode is a Blockchain app on the Flux marketplace: Host your Kadena Chainweb Node on the Flux Network. Preset price $28.40 per month for 3 instances. Total resources 4 cores, 12000 MB RAM, 820 GB storage across 1 component.
- Component kadenachainwebnode: image runonflux/kadena-chainweb-node:latest; 4 cores, 12000 MB RAM, 820 GB; ports 31350, 31351 (container 31350, 31351); data path /data.

## NeoxaNode <https://cloud.runonflux.com/marketplace>
NeoxaNode is a Blockchain app on the Flux marketplace: Host your Neoxa Node on the Flux Network. Preset price $5.99 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 22 GB storage across 1 component.
- Component neoxanode: image neoxa/full-node:latest; 2 cores, 4000 MB RAM, 22 GB; ports 31000 (container 8788); data path /home/neoxa/.neoxa.

## KusamaNode <https://cloud.runonflux.com/marketplace>
KusamaNode is a Blockchain app on the Flux marketplace: Host your Kusama Node on the Flux Network. Preset price $2.50 per month for 3 instances. Total resources 0.8 cores, 1800 MB RAM, 20 GB storage across 1 component.
- Component kusamanode: image runonflux/polkadot-docker:latest; 0.8 cores, 1800 MB RAM, 20 GB; ports 33204, 33205, 33206 (container 30333, 9933, 9944); data path /chaindata.

## DesoNode <https://cloud.runonflux.com/marketplace>
DesoNode is a Blockchain app on the Flux marketplace: Host your Deso backend Node on the Flux Network. Preset price $27.99 per month for 3 instances. Total resources 5 cores, 24000 MB RAM, 400 GB storage across 1 component.
- Component desonode: image honsontran/deso-backend:stable; 5 cores, 24000 MB RAM, 400 GB; ports 33445, 33444 (container 33445, 33444); data path /db.

## DogecoinNode <https://cloud.runonflux.com/marketplace>
DogecoinNode is a Blockchain app on the Flux marketplace: Host your Dogecoin Full Node on the Flux Network. Preset price $5.00 per month for 3 instances. Total resources 1 cores, 3000 MB RAM, 100 GB storage across 1 component.
- Component dogenode: image bigmandave/doge-node:latest; 1 cores, 3000 MB RAM, 100 GB; ports 34203 (container 22556); data path /etc/doge/.

## Sushiswap <https://cloud.runonflux.com/marketplace>
Sushiswap is a Front-end app on the Flux marketplace: Host your Sushiswap Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component sushiswapui: image runonflux/sushiswap-interface:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35000 (container 3000); data path /tmp.

## Yearn <https://cloud.runonflux.com/marketplace>
Yearn is a Front-end app on the Flux marketplace: Host your Yearn Finance Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component yearnui: image runonflux/yearn-finance-v3:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35001 (container 80); data path /tmp.

## Gmx <https://cloud.runonflux.com/marketplace>
Gmx is a Front-end app on the Flux marketplace: Host your GMX.io Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component gmxui: image runonflux/gmx-interface:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35002 (container 3000); data path /tmp.

## Dopex <https://cloud.runonflux.com/marketplace>
Dopex is a Front-end app on the Flux marketplace: Host your Dopex.io Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component dopexui: image runonflux/dopex-site:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35003 (container 3000); data path /tmp.

## Pangolin <https://cloud.runonflux.com/marketplace>
Pangolin is a Front-end app on the Flux marketplace: Host your Pangolin Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component pangolinui: image runonflux/pangolindex-interface:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35003 (container 3000); data path /tmp.

## Liquity <https://cloud.runonflux.com/marketplace>
Liquity is a Front-end app on the Flux marketplace: Host your Liquity Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component liquityui: image liquity/dev-frontend:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35004 (container 80); data path /tmp.

## Balancer <https://cloud.runonflux.com/marketplace>
Balancer is a Front-end app on the Flux marketplace: Host your Balancer Finance Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component balancerui: image balancerfi/frontend-v2:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35005 (container 80); data path r:/app. Parameters the user fills in: INFURA_PROJECT_ID (Your Infura API Key. Keep in mind that this value will be public); ALCHEMY_KEY (Your Alchemy API Key. Keep in mind that this value will be public); BLOCKNATIVE_DAPP_ID (Your Blocknative API Key. Keep in mind that this value will be public).

## Osmosis <https://cloud.runonflux.com/marketplace>
Osmosis is a Front-end app on the Flux marketplace: Host your Osmosis Frontend on the Flux Cloud. Preset price $2.10 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 5 GB storage across 1 component.
- Component osmosisui: image osmolabs/osmosis-frontend:latest; 1 cores, 1000 MB RAM, 5 GB; ports 35006 (container 3000); data path /tmp.

## AlephiumNode <https://cloud.runonflux.com/marketplace>
AlephiumNode is a Blockchain app on the Flux marketplace: Host your Alephium Full Node on the Flux Cloud. Preset price $5.99 per month for 3 instances. Total resources 0.5 cores, 1000 MB RAM, 130 GB storage across 1 component.
- Component alephiumnode: image touilleio/alephium-standalone:latest-root; 0.5 cores, 1000 MB RAM, 130 GB; ports 39973 (container 39973); data path /data.

## BlockbookETC <https://cloud.runonflux.com/marketplace>
BlockbookETC is a Blockbook app on the Flux marketplace: Host your Blockbook for Ethereum Classic on the Flux Cloud. Preset price $8.40 per month for 3 instances. Total resources 2 cores, 8000 MB RAM, 70 GB storage across 1 component.
- Component blockbookethereumclassic: image runonflux/blockbook-docker:latest; 2 cores, 8000 MB RAM, 70 GB; ports 34142 (container 9137); data path /root.

## BlockbookFLUX <https://cloud.runonflux.com/marketplace>
BlockbookFLUX is a Blockbook app on the Flux marketplace: Host your Blockbook for Flux on the Flux Cloud. Preset price $9.99 per month for 3 instances. Total resources 3 cores, 8000 MB RAM, 60 GB storage across 1 component.
- Component blockbookflux: image runonflux/blockbook-docker:latest; 3 cores, 8000 MB RAM, 60 GB; ports 34142 (container 9158); data path /root.

## BlockbookLTC <https://cloud.runonflux.com/marketplace>
BlockbookLTC is a Blockbook app on the Flux marketplace: Host your Blockbook for Litecoin on the Flux Cloud. Preset price $8.15 per month for 3 instances. Total resources 2.5 cores, 4000 MB RAM, 120 GB storage across 1 component.
- Component blockbooklitecoin: image runonflux/blockbook-docker:latest; 2.5 cores, 4000 MB RAM, 120 GB; ports 34139 (container 9134); data path /root.

## BlockbookFIRO <https://cloud.runonflux.com/marketplace>
BlockbookFIRO is a Blockbook app on the Flux marketplace: Host your Blockbook for Firo on the Flux Cloud. Preset price $4.80 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component blockbookfiro: image runonflux/blockbook-docker:latest; 2 cores, 2000 MB RAM, 40 GB; ports 34155 (container 9150); data path /root.

## BlockbookGRS <https://cloud.runonflux.com/marketplace>
BlockbookGRS is a Blockbook app on the Flux marketplace: Host your Blockbook for Groestlcoin on the Flux Cloud. Preset price $6.20 per month for 3 instances. Total resources 2 cores, 3000 MB RAM, 85 GB storage across 1 component.
- Component blockbookgroestlcoin: image runonflux/blockbook-docker:latest; 2 cores, 3000 MB RAM, 85 GB; ports 34150 (container 9145); data path /root.

## Owncast <https://cloud.runonflux.com/marketplace>
Owncast is a Productivity app on the Flux marketplace: Streaming and chat platform. Preset price $14.50 per month for 3 instances. Total resources 5 cores, 8000 MB RAM, 150 GB storage across 1 component.
- Component owncast: image gabekangas/owncast:latest; 5 cores, 8000 MB RAM, 150 GB; ports 34673, 34674 (container 8080, 1935); data path r:/owncast.

## Grocy <https://cloud.runonflux.com/marketplace>
Grocy is a Productivity app on the Flux marketplace: Grocy is a web-based self-hosted groceries & household management solution for your home. Preset price $2.21 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 10 GB storage across 1 component.
- Component grocy: image linuxserver/grocy:latest; 1 cores, 1000 MB RAM, 10 GB; ports 36377 (container 80); data path r:/groc.

## Palworld4Slots <https://cloud.runonflux.com/marketplace>
Palworld4Slots is a Games app on the Flux marketplace: Host your Palworld 4 slots Game Server on Flux Cloud. Preset price $7.99 per month for 3 instances. Total resources 2 cores, 5000 MB RAM, 12 GB storage across 1 component.
- Component palworld: image thijsvanloef/palworld-server-docker:latest; 2 cores, 5000 MB RAM, 12 GB; ports 8211, 27015, 25575 (container 8211, 27015, 25575); data path g:/palworld/Pal/Saved.

## Palworld8Slots <https://cloud.runonflux.com/marketplace>
Palworld8Slots is a Games app on the Flux marketplace: Host your Palworld 8 slots Game Server on Flux Cloud. Preset price $12.99 per month for 3 instances. Total resources 2.5 cores, 6300 MB RAM, 15 GB storage across 1 component.
- Component palworld: image thijsvanloef/palworld-server-docker:latest; 2.5 cores, 6300 MB RAM, 15 GB; ports 8211, 27015, 25575 (container 8211, 27015, 25575); data path g:/palworld/Pal/Saved.

## Palworld16Slots <https://cloud.runonflux.com/marketplace>
Palworld16Slots is a Games app on the Flux marketplace: Host your Palworld 16 slots Game Server on Flux Cloud. Preset price $17.99 per month for 3 instances. Total resources 4 cores, 10000 MB RAM, 20 GB storage across 1 component.
- Component palworld: image thijsvanloef/palworld-server-docker:latest; 4 cores, 10000 MB RAM, 20 GB; ports 8211, 27015, 25575 (container 8211, 27015, 25575); data path g:/palworld/Pal/Saved.

## Palworld32Slots <https://cloud.runonflux.com/marketplace>
Palworld32Slots is a Games app on the Flux marketplace: Host your Palworld 32 slots Game Server on Flux Cloud. Preset price $24.99 per month for 3 instances. Total resources 6 cores, 14000 MB RAM, 35 GB storage across 1 component.
- Component palworld: image thijsvanloef/palworld-server-docker:latest; 6 cores, 14000 MB RAM, 35 GB; ports 8211, 27015, 25575 (container 8211, 27015, 25575); data path g:/palworld/Pal/Saved.

## Enshrouded4Slots <https://cloud.runonflux.com/marketplace>
Enshrouded4Slots is a Games app on the Flux marketplace: Host your Enshrouded 4 slots Game Server on Flux Cloud. Preset price $9.99 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 50 GB storage across 1 component.
- Component Enshrouded: image jktuned/enshrouded-server:latest; 2 cores, 4000 MB RAM, 50 GB; ports 15636, 15637 (container 15636, 15637); data path g:/opt/enshrouded/server/savegame.

## Enshrouded8Slots <https://cloud.runonflux.com/marketplace>
Enshrouded8Slots is a Games app on the Flux marketplace: Host your Enshrouded 8 slots Game Server on Flux Cloud. Preset price $14.99 per month for 3 instances. Total resources 3 cores, 6000 MB RAM, 60 GB storage across 1 component.
- Component Enshrouded: image jktuned/enshrouded-server:latest; 3 cores, 6000 MB RAM, 60 GB; ports 15636, 15637 (container 15636, 15637); data path g:/opt/enshrouded/server/savegame.

## Enshrouded16Slots <https://cloud.runonflux.com/marketplace>
Enshrouded16Slots is a Games app on the Flux marketplace: Host your Enshrouded 16 slots Game Server on Flux Cloud. Preset price $19.99 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 65 GB storage across 1 component.
- Component Enshrouded: image jktuned/enshrouded-server:latest; 4 cores, 8000 MB RAM, 65 GB; ports 15636, 15637 (container 15636, 15637); data path g:/opt/enshrouded/server/savegame.

## Whoogle <https://cloud.runonflux.com/marketplace>
Whoogle is a Productivity app on the Flux marketplace: Get Google search results, but without any ads, javascript, AMP links, cookies, or IP address tracking. Preset price $2.21 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 10 GB storage across 1 component.
- Component whoogle: image benbusby/whoogle-search:latest; 1 cores, 1000 MB RAM, 10 GB; ports 35420 (container 5000); data path /app.

## Rustpad <https://cloud.runonflux.com/marketplace>
Rustpad is a Productivity app on the Flux marketplace: Rustpad is an efficient and minimal open-source collaborative text editor. Preset price $NaN per month for 3 instances. Total resources 0.2 cores, 200 MB RAM, 2 GB storage across 1 component.
- Component rustpad: image ekzhang/rustpad:latest; 0.2 cores, 200 MB RAM, 2 GB; ports 38144 (container 3030); data path /tmprustpad.

## Teamspeak <https://cloud.runonflux.com/marketplace>
Teamspeak is a Hosting app on the Flux marketplace: With TeamSpeak there are no centralized servers and no harvesting of personal data. Your chat, your data, your choice. With TeamSpeak, your team rules! Preset price $1.27 per month for 3 instances. Total resources 0.5 cores, 1000 MB RAM, 1 GB storage across 1 component.
- Component teamspeak: image teamspeak:latest; 0.5 cores, 1000 MB RAM, 1 GB; ports 9987, 38896, 38897 (container 9987, 10011, 30033); data path r:/teams.

## BlockbookVIA <https://cloud.runonflux.com/marketplace>
BlockbookVIA is a Blockbook app on the Flux marketplace: Host your Blockbook for Viacoin on the Flux Cloud. Preset price $12.50 per month for 3 instances. Total resources 3 cores, 8000 MB RAM, 200 GB storage across 1 component.
- Component blockbookviacoin: image runonflux/blockbook-docker:latest; 3 cores, 8000 MB RAM, 200 GB; ports 34160 (container 9155); data path /root.

## YaCy <https://cloud.runonflux.com/marketplace>
YaCy is a Productivity app on the Flux marketplace: The YaCy search engine software provides results from a network of independent peers, instead of a central server. It is a distributed network where no single entity decides what to list or order it appears in. Preset price $3.30 per month for 3 instances. Total resources 1 cores, 1200 MB RAM, 60 GB storage across 1 component.
- Component yacy: image luccioman/yacy:latest-alpine; 1 cores, 1200 MB RAM, 60 GB; ports 33437, 33438 (container 8090, 8443); data path /tmpyacy.

## BlockbookVTC <https://cloud.runonflux.com/marketplace>
BlockbookVTC is a Blockbook app on the Flux marketplace: Host your Blockbook for Vertcoin on the Flux Cloud. Preset price $6.95 per month for 3 instances. Total resources 2.6 cores, 4500 MB RAM, 40 GB storage across 1 component.
- Component blockbookvertcoin: image runonflux/blockbook-docker:latest; 2.6 cores, 4500 MB RAM, 40 GB; ports 34145 (container 9140); data path /root.

## BlockbookQTUM <https://cloud.runonflux.com/marketplace>
BlockbookQTUM is a Blockbook app on the Flux marketplace: Host your Blockbook for Qtum on the Flux Cloud. Preset price $7.00 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 100 GB storage across 1 component.
- Component blockbookqtum: image runonflux/blockbook-docker:latest; 2 cores, 4000 MB RAM, 100 GB; ports 34193 (container 9188); data path /root.

## Compiler <https://cloud.runonflux.com/marketplace>
Compiler is a Productivity app on the Flux marketplace: Host a Online Compiler for C,C++,JAVA,Python,JavaScript on the Flux Cloud. Preset price $1.85 per month for 3 instances. Total resources 0.5 cores, 2000 MB RAM, 5 GB storage across 1 component.
- Component onlinecompiler: image sidpro/compiler:latest; 0.5 cores, 2000 MB RAM, 5 GB; ports 36001 (container 80); data path /tmp.

## BlockbookDASH <https://cloud.runonflux.com/marketplace>
BlockbookDASH is a Blockbook app on the Flux marketplace: Host your Blockbook for Dash on the Flux Cloud. Preset price $6.70 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 85 GB storage across 1 component.
- Component blockbookdash: image runonflux/blockbook-docker:latest; 2 cores, 4000 MB RAM, 85 GB; ports 35660 (container 9133); data path /root.

## BlockbookDIVI <https://cloud.runonflux.com/marketplace>
BlockbookDIVI is a Blockbook app on the Flux marketplace: Host your Blockbook for Divi on the Flux Cloud. Preset price $6.00 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 50 GB storage across 1 component.
- Component blockbookdivi: image runonflux/blockbook-docker:latest; 2 cores, 4000 MB RAM, 50 GB; ports 35670 (container 9189); data path /root.

## BlockbookDCR <https://cloud.runonflux.com/marketplace>
BlockbookDCR is a Blockbook app on the Flux marketplace: Host your Blockbook for Decred on the Flux Cloud. Preset price $6.00 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 50 GB storage across 1 component.
- Component blockbookdecred: image runonflux/blockbook-docker:latest; 2 cores, 4000 MB RAM, 50 GB; ports 35680 (container 9161); data path /root.

## MeowcoinTestnetNode <https://cloud.runonflux.com/marketplace>
MeowcoinTestnetNode is a Blockchain app on the Flux marketplace: Host your Meowcoin 2.0 Testnet Full Node on the Flux Cloud. Preset price $7.20 per month for 3 instances. Total resources 2 cores, 6000 MB RAM, 60 GB storage across 1 component.
- Component meowcointestnetnode: image zachprice105/meowcointestnet:latest; 2 cores, 6000 MB RAM, 60 GB; ports 4569 (container 4569); data path /root.

## WanchainRPC <https://cloud.runonflux.com/marketplace>
WanchainRPC is a RPC Node app on the Flux marketplace: Host your Wanchain RPC Node on the Flux Cloud. Preset price $14.00 per month for 3 instances. Total resources 2 cores, 8000 MB RAM, 350 GB storage across 1 component.
- Component wanchainrpc: image wanchain/client-go:3.0.0-rpc; 2 cores, 8000 MB RAM, 350 GB; ports 31010, 31011 (container 18545, 17717); data path /root.

## NexaNode <https://cloud.runonflux.com/marketplace>
NexaNode is a Blockchain app on the Flux marketplace: Host your Nexa Node on the Flux Cloud. Preset price $3.80 per month for 3 instances. Total resources 1 cores, 3000 MB RAM, 40 GB storage across 1 component.
- Component nexanode: image bchunlimited/nexa-1.1:ubuntu20.04; 1 cores, 3000 MB RAM, 40 GB; ports 37230, 37231, 37232, 37233 (container 7228, 7227, 7229, 7230); data path /data.

## ElectrumXRXD <https://cloud.runonflux.com/marketplace>
ElectrumXRXD is a Blockchain app on the Flux marketplace: Host your Radiant-ElectrumX on the Flux Cloud. Preset price $5.20 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 10 GB storage across 1 component.
- Component electrumxradiant: image radiantcommunity/electrumx_radiant_node:latest; 2 cores, 4000 MB RAM, 10 GB; ports 38501, 38502, 38503 (container 50010, 50012, 8000); data path /root.

## RadiantNode <https://cloud.runonflux.com/marketplace>
RadiantNode is a Blockchain app on the Flux marketplace: Host your Radiant Node on the Flux Cloud. Preset price $2.35 per month for 3 instances. Total resources 1 cores, 1500 MB RAM, 5 GB storage across 1 component.
- Component radiantnode: image radiantcommunity/radiant-node:latest; 1 cores, 1500 MB RAM, 5 GB; ports 38510, 38511 (container 7332, 7333); data path /root.

## WebsiteScreenshotAPI <https://cloud.runonflux.com/marketplace>
WebsiteScreenshotAPI is a Hosting app on the Flux marketplace: Capture screenshots of websites as a (host it yourself) API. API Instructions: https://github.com/robvanderleek/capture-website-api#usage. Preset price $4.41 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component WebsiteScreenshotAPI: image wirewrex/cwa-flux:latest; 2 cores, 2000 MB RAM, 20 GB; ports 34010 (container 8080); data path /root.

## Ipify <https://cloud.runonflux.com/marketplace>
Ipify is a Hosting app on the Flux marketplace: A Simple Public IP Address API. Preset price $1.07 per month for 3 instances. Total resources 0.5 cores, 600 MB RAM, 1 GB storage across 1 component.
- Component ipify: image wirewrex/ipify-api:latest; 0.5 cores, 600 MB RAM, 1 GB; ports 34010 (container 3000); data path /tmp.

## Nostr <https://cloud.runonflux.com/marketplace>
Nostr is a Hosting app on the Flux marketplace: A Nostr Relay hosted on the Flux Cloud. Preset price $2.21 per month for 3 instances. Total resources 1 cores, 1000 MB RAM, 10 GB storage across 1 component.
- Component nostrrelay: image wirewrex/nostr-rs-relay:custom; 1 cores, 1000 MB RAM, 10 GB; ports 34428 (container 8080); data path /db. Parameters the user fills in: NAME (Add a custom name to your Nostr Relay); DESCRIPTION (Add a description to your Nostr Relay); RELAY_URL (If you want to add your custom domain to this Relay please do so.); CONTACT (Add your Email address for people to reach out to you, this is optional!); PUB_KEY (Insert your Nostr Public Key, you can generate one with a Nostr client like https://branle.netlify.app/).

## BitgertRPC <https://cloud.runonflux.com/marketplace>
BitgertRPC is a RPC Node app on the Flux marketplace: Host your Bitgert RPC Node on the Flux Cloud. Preset price $14.00 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 200 GB storage across 1 component.
- Component bitgertrpc: image bitgert/brise-node-flux:latest; 4 cores, 8000 MB RAM, 200 GB; ports 32300, 32301 (container 3545, 40605); data path /root.

## CeloRPC <https://cloud.runonflux.com/marketplace>
CeloRPC is a RPC Node app on the Flux marketplace: Host your Celo RPC Node on the Flux Cloud. Preset price $16.50 per month for 3 instances. Total resources 4 cores, 9000 MB RAM, 300 GB storage across 1 component.
- Component celorpc: image runonflux/celo-blockchain:latest; 4 cores, 9000 MB RAM, 300 GB; ports 35000, 35001, 35002 (container 8545, 8546, 30303); data path /root/.celo.

## FuseRPC <https://cloud.runonflux.com/marketplace>
FuseRPC is a RPC Node app on the Flux marketplace: Host your Fuse RPC Node on the Flux Cloud. Preset price $9.00 per month for 3 instances. Total resources 2 cores, 8000 MB RAM, 100 GB storage across 1 component.
- Component fuserpc: image fusenet/node:latest; 2 cores, 8000 MB RAM, 100 GB; ports 38545, 38303, 38456 (container 8545, 30300, 8546); data path /data.

## AstarRPC <https://cloud.runonflux.com/marketplace>
AstarRPC is a RPC Node app on the Flux marketplace: Host your Astar RPC Node on the Flux Cloud. Preset price $32.00 per month for 3 instances. Total resources 8 cores, 16000 MB RAM, 600 GB storage across 1 component.
- Component astarrpc: image runonflux/astar-node:latest; 8 cores, 16000 MB RAM, 600 GB; ports 36011, 36012, 36013 (container 9944, 30333, 30334); data path /root.

## NeuraiNode <https://cloud.runonflux.com/marketplace>
NeuraiNode is a Blockchain app on the Flux marketplace: Host your Neurai Fullnode via Flux Cloud. Preset price $4.41 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component neurainode: image neuraiproject/neurai-node:latest; 2 cores, 2000 MB RAM, 20 GB; ports 36735, 36736 (container 19001, 19000); data path /data.

## ElectrumxXNA <https://cloud.runonflux.com/marketplace>
ElectrumxXNA is a Blockchain app on the Flux marketplace: Host your Neurai-ElectrumX via Flux Cloud. Preset price $8.60 per month for 3 instances. Total resources 4 cores, 4000 MB RAM, 30 GB storage across 1 component.
- Component electrumxneurai: image neuraiproject/electrumx-node:latest; 4 cores, 4000 MB RAM, 30 GB; ports 36740, 36741, 36742, 36743 (container 19000, 19011, 19012, 8000); data path /root.

## BlockbookXNA <https://cloud.runonflux.com/marketplace>
BlockbookXNA is a Blockbook app on the Flux marketplace: Host your Blockbook for Neurai on the Flux Cloud. Preset price $7.05 per month for 3 instances. Total resources 2.5 cores, 5000 MB RAM, 40 GB storage across 1 component.
- Component blockbookneurai: image runonflux/blockbook-docker:latest; 2.5 cores, 5000 MB RAM, 40 GB; ports 34149, 31450 (container 9168, 1337); data path /root.

## BLOCXMN <https://cloud.runonflux.com/marketplace>
BLOCXMN is a Masternode app on the Flux marketplace: Host your BLOCX Masternode on the Flux Cloud. Preset price $6.32 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 16 GB storage across 1 component.
- Component blocxmasternode: image blocxtech/blocxmasternode:latest; 2 cores, 2000 MB RAM, 16 GB; ports 12972 (container 12972); data path /root/.blocx.

## NeoxaMN <https://cloud.runonflux.com/marketplace>
NeoxaMN is a Masternode app on the Flux marketplace: Host your(s) Neoxa Masternode(s) on the Flux Cloud. Preset price $6.49 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component neoxamasternode: image runonflux/neoxa-node:latest; 2 cores, 2000 MB RAM, 20 GB; ports 8788 (container 8788); data path /root/.neoxacore.

## CelestiaLN <https://cloud.runonflux.com/marketplace>
CelestiaLN is a Blockchain app on the Flux marketplace: Host your Celestia Light Node on the Flux Cloud. Preset price $3.50 per month for 3 instances. Total resources 1 cores, 2000 MB RAM, 50 GB storage across 1 component.
- Component celestialightnode: image runonflux/celestia-node:latest; 1 cores, 2000 MB RAM, 50 GB; ports 26658, 2121, 9090 (container 26658, 2121, 9090); data path /home/celestia/.celestia-light.

## BittensorFN <https://cloud.runonflux.com/marketplace>
BittensorFN is a Blockchain app on the Flux marketplace: Host your Bittensor Full Node on the Flux Cloud. Preset price $14.99 per month for 3 instances. Total resources 4.5 cores, 8000 MB RAM, 150 GB storage across 1 component.
- Component bittensorfullnode: image opentensor/subtensor:latest; 4.5 cores, 8000 MB RAM, 150 GB; ports 9944, 30333, 9933 (container 9944, 30333, 9933); data path /tmp.

## Minecraft2GB <https://cloud.runonflux.com/marketplace>
Minecraft2GB is a Games app on the Flux marketplace: Host your Vanilla Java Minecraft 2GB of Ram Game Server on Flux Cloud. Preset price $2.49 per month for 3 instances. Total resources 1.5 cores, 2000 MB RAM, 20 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 1.5 cores, 2000 MB RAM, 20 GB; ports 25565 (container 25565); data path g:/data.

## Minecraft4GB <https://cloud.runonflux.com/marketplace>
Minecraft4GB is a Games app on the Flux marketplace: Host your Java Minecraft 4GB of Ram Game Server on Flux Cloud. Preset price $3.99 per month for 3 instances. Total resources 2 cores, 4000 MB RAM, 30 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 2 cores, 4000 MB RAM, 30 GB; ports 25565 (container 25565); data path g:/data.

## Minecraft8GB <https://cloud.runonflux.com/marketplace>
Minecraft8GB is a Games app on the Flux marketplace: Host your Java Minecraft 8GB of Ram Game Server on Flux Cloud. Preset price $5.99 per month for 3 instances. Total resources 2 cores, 8000 MB RAM, 60 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 2 cores, 8000 MB RAM, 60 GB; ports 25565 (container 25565); data path g:/data.

## Minecraft16GB <https://cloud.runonflux.com/marketplace>
Minecraft16GB is a Games app on the Flux marketplace: Host your Java Minecraft 16GB of Ram Game Server on Flux Cloud. Preset price $8.99 per month for 3 instances. Total resources 2 cores, 16000 MB RAM, 75 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 2 cores, 16000 MB RAM, 75 GB; ports 25565 (container 25565); data path g:/data.

## Minecraft32GB <https://cloud.runonflux.com/marketplace>
Minecraft32GB is a Games app on the Flux marketplace: Host your Java Minecraft 32GB of Ram Game Server on Flux Cloud. Preset price $16.99 per month for 3 instances. Total resources 2 cores, 32000 MB RAM, 100 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 2 cores, 32000 MB RAM, 100 GB; ports 25565 (container 25565); data path g:/data.

## Minecraft48GB <https://cloud.runonflux.com/marketplace>
Minecraft48GB is a Games app on the Flux marketplace: Host your Java Minecraft 48GB of Ram Game Server on Flux Cloud. Preset price $23.99 per month for 3 instances. Total resources 2 cores, 48000 MB RAM, 150 GB storage across 1 component.
- Component minecraftserver: image itzg/minecraft-server:latest; 2 cores, 48000 MB RAM, 150 GB; ports 25565 (container 25565); data path g:/data.

## Cyberfly <https://cloud.runonflux.com/marketplace>
Cyberfly is a Blockchain app on the Flux marketplace: Host your Cyberfly mainnet Node on the Flux Cloud. Preset price $2.97 per month for 3 instances. Total resources 1.2000000000000002 cores, 1200 MB RAM, 7 GB storage across 3 components.
- Component cyberflymqtt: image cyberfly/cyberfly_mqtt:latest; 0.1 cores, 100 MB RAM, 1 GB; ports 31004, 31005 (container 1883, 9001); data path g:/data.
- Component cyberflynode: image cyberfly/cyberfly_node:latest; 1 cores, 1000 MB RAM, 5 GB; ports 31001, 31002, 31003, 31006 (container 31001, 31002, 31003, 31006); data path g:/data. Parameters the user fills in: KADENA_ACCOUNT (Your kadena k:address); NODE_PRIV_KEY (Your node secret key).
- Component cyberflynodeui: image cyberfly/cyberfly_node_ui:latest; 0.1 cores, 100 MB RAM, 1 GB; ports 31000 (container 80); data path g:/data.

## PrivateSimpleXSMP <https://cloud.runonflux.com/marketplace>
PrivateSimpleXSMP is a Hosting app on the Flux marketplace: Host your PRIVATE (password protected) Simplex SMP Server with IP + Onion Address. Preset price $5.99 per month for 3 instances. Total resources 1 cores, 2500 MB RAM, 21 GB storage across 2 components.
- Component smpsimplex: image runonflux/simplex-smp-server:latest; 0.9 cores, 2000 MB RAM, 20 GB; ports 5223 (container 5223); data path /etc/opt/simplex.
- Component onion: image wirewrex/hiddenonion:latest; 0.1 cores, 500 MB RAM, 1 GB; ports none (container none); data path /var/lib/tor.

## SimpleXSMP <https://cloud.runonflux.com/marketplace>
SimpleXSMP is a Hosting app on the Flux marketplace: Host your PUBLIC SimpleX SMP Server with IP + Onion Address. Preset price $5.99 per month for 3 instances. Total resources 1 cores, 2500 MB RAM, 21 GB storage across 2 components.
- Component smpsimplex: image runonflux/simplex-smp-server:latest; 0.9 cores, 2000 MB RAM, 20 GB; ports 5223 (container 5223); data path /etc/opt/simplex.
- Component onion: image wirewrex/hiddenonion:latest; 0.1 cores, 500 MB RAM, 1 GB; ports none (container none); data path /var/lib/tor.

## SimpleXxFTP <https://cloud.runonflux.com/marketplace>
SimpleXxFTP is a Hosting app on the Flux marketplace: Host your PUBLIC Simplex xFTP 40GB Quota Server. Preset price $5.99 per month for 3 instances. Total resources 0.9 cores, 2000 MB RAM, 40 GB storage across 1 component.
- Component xftpsimplex: image runonflux/simplex-xftp-server:latest; 0.9 cores, 2000 MB RAM, 40 GB; ports 34443 (container 34443); data path /etc/opt/simplex-xftp.

## TimpiCollector <https://cloud.runonflux.com/marketplace>
TimpiCollector is a Blockchain app on the Flux marketplace: Host your Timpi Collector Node on FluxCloud. Preset price $4.85 per month for 3 instances. Total resources 2 cores, 2000 MB RAM, 1 GB storage across 1 component.
- Component timpicollector: image timpiltd/timpi-collector:latest; 2 cores, 2000 MB RAM, 1 GB; ports 5015 (container 5015); data path /opt/timpi.

## TimpiGeocore <https://cloud.runonflux.com/marketplace>
TimpiGeocore is a Blockchain app on the Flux marketplace: Host your Timpi Geocore Node on FluxCloud. Preset price $10.85 per month for 3 instances. Total resources 4 cores, 8000 MB RAM, 3 GB storage across 1 component.
- Component timpigeocore: image timpiltd/timpi-geocore:latest; 4 cores, 8000 MB RAM, 3 GB; ports 4100 (container 4100); data path /var/timpi. Parameters the user fills in: GUID (Your Registered GUID).

## KaspaNode16GB <https://cloud.runonflux.com/marketplace>
KaspaNode16GB is a Blockchain app on the Flux marketplace: Host your Kaspa Node on FluxCloud with 16GB RAM. Preset price $27.20 per month for 3 instances. Total resources 8 cores, 16000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image kaspanet/rusty-kaspad:latest; 8 cores, 16000 MB RAM, 256 GB; ports 15110, 15111, 17110, 18110 (container 15110, 15111, 17110, 18110); data path /app/data. Parameters the user fills in: ADDRESS (Your Kaspa address for the Nacho Kat NFT giveaway.).

## KaspaNode24GB <https://cloud.runonflux.com/marketplace>
KaspaNode24GB is a Blockchain app on the Flux marketplace: Host your Kaspa Node on FluxCloud with 24GB RAM. Preset price $31.20 per month for 3 instances. Total resources 8 cores, 24000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image kaspanet/rusty-kaspad:latest; 8 cores, 24000 MB RAM, 256 GB; ports 15110, 15111, 17110, 18110 (container 15110, 15111, 17110, 18110); data path /app/data. Parameters the user fills in: ADDRESS (Your Kaspa address for the Nacho Kat NFT giveaway.).

## KaspaTestnet16GB <https://cloud.runonflux.com/marketplace>
KaspaTestnet16GB is a Blockchain app on the Flux marketplace: Host your Kaspa Testnet Node on FluxCloud with 16GB RAM. Preset price $27.20 per month for 3 instances. Total resources 8 cores, 16000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image kaspanet/rusty-kaspad:latest; 8 cores, 16000 MB RAM, 256 GB; ports 15210, 15211, 17210, 18210 (container 15210, 15211, 17210, 18210); data path /app/data.

## KaspaTestnet24GB <https://cloud.runonflux.com/marketplace>
KaspaTestnet24GB is a Blockchain app on the Flux marketplace: Host your Kaspa Testnet Node on FluxCloud with 24GB RAM. Preset price $31.20 per month for 3 instances. Total resources 8 cores, 24000 MB RAM, 256 GB storage across 1 component.
- Component kaspad: image kaspanet/rusty-kaspad:latest; 8 cores, 24000 MB RAM, 256 GB; ports 15210, 15211, 17210, 18210 (container 15210, 15211, 17210, 18210); data path /app/data.
