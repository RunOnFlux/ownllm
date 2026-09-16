# What runs on Flux (aggregate of the live application catalog)

The Flux network currently hosts about 1520 registered applications with 1225 containers in total. Most apps run 2 instances (505 apps with 2, 449 apps with 3, 406 apps with 1, 30 apps with 6); 863 pin a geolocation. 443 are enterprise apps with encrypted specifications.

## Most common images and their typical sizes <https://cloud.runonflux.com/apps/globalapps>
Typical means the median of what people deploy; a single instance can be smaller or larger.
- runonflux/orbit: 240 deployments; typically 0.5 cores, 1000 MB RAM, 5 GB storage, 1 instances, container port 9001, 3000, 2053.
- runonflux/palworld-server-flux: 215 deployments; typically 4 cores, 12000 MB RAM, 35 GB storage, 2 instances, container port 8211, 27015, 8212.
- presearch/node: 63 deployments; typically 0.3 cores, 300 MB RAM, 2 GB storage, 3 instances, container port 38253.
- itzg/minecraft-server: 55 deployments; typically 2 cores, 8000 MB RAM, 50 GB storage, 2 instances, container port 25565, 24454.
- mysql: 40 deployments; typically 0.7 cores, 1000 MB RAM, 3 GB storage, 3 instances (usually part of a multi-component app).
- runonflux/shared-db: 40 deployments; typically 0.5 cores, 700 MB RAM, 3 GB storage, 3 instances, container port 3307, 7071, 8008 (usually part of a multi-component app).
- thijsvanloef/palworld-server-docker: 38 deployments; typically 4 cores, 12000 MB RAM, 35 GB storage, 2 instances, container port 8211, 27015, 8212.
- runonflux/wp-nginx: 30 deployments; typically 0.8 cores, 1000 MB RAM, 17 GB storage, 3 instances, container port 80, 443, 2222 (usually part of a multi-component app).
- yurinnick/folding-at-home: 25 deployments; typically 1 cores, 700 MB RAM, 3 GB storage, 100 instances, container port 7396.
- ghcr.io/runonflux/cumulusvpn-gateway: 23 deployments; typically 1 cores, 1000 MB RAM, 5 GB storage, 6 instances, container port 51820, 51821.
- kaspanet/rusty-kaspad: 18 deployments; typically 8 cores, 24000 MB RAM, 256 GB storage, 3 instances, container port 15110, 15111, 17110.
- runonflux/blockbook-docker: 18 deployments; typically 3.5 cores, 10000 MB RAM, 180 GB storage, 5 instances, container port 1337, 9131, 9130.
- wirewrex/hiddenonion: 17 deployments; typically 1 cores, 1000 MB RAM, 1 GB storage, 3 instances (usually part of a multi-component app).
- simplexchat/smp-server: 14 deployments; typically 1 cores, 1000 MB RAM, 1 GB storage, 3 instances, container port 5223 (usually part of a multi-component app).
- littlestache/cors-anywhere: 13 deployments; typically 0.1 cores, 100 MB RAM, 1 GB storage, 3 instances, container port 8080.
- wirewrex/nginx-hns: 12 deployments; typically 0.5 cores, 500 MB RAM, 1 GB storage, 3 instances, container port 443, 80 (usually part of a multi-component app).
- sknnr/enshrouded-dedicated-server: 12 deployments; typically 3 cores, 6000 MB RAM, 60 GB storage, 3 instances, container port 15637, 27015.
- teammakdi/makdi: 10 deployments; typically 4 cores, 4000 MB RAM, 2 GB storage, 3 instances, container port 8080.
- itzg/minecraft-bedrock-server: 9 deployments; typically 1.5 cores, 2000 MB RAM, 40 GB storage, 2 instances, container port 19132.
- wirewrex/flux-dns-fdm: 8 deployments; typically 0.1 cores, 100 MB RAM, 1 GB storage, 3 instances (usually part of a multi-component app).
- redis: 7 deployments; typically 1 cores, 1000 MB RAM, 5 GB storage, 3 instances (usually part of a multi-component app).
- indifferentbroccoli/windrose-server-docker: 7 deployments; typically 2 cores, 12000 MB RAM, 35 GB storage, 2 instances, container port 7777.
- siomiz/softethervpn: 6 deployments; typically 1 cores, 2000 MB RAM, 1 GB storage, 75 instances, container port 5555, 443, 1194.
- timpiltd/timpi-collector: 6 deployments; typically 2 cores, 2000 MB RAM, 20 GB storage, 3 instances, container port 5015.
- sandmanshiri/ssh: 4 deployments; typically 0.1 cores, 100 MB RAM, 2 GB storage, 6 instances, container port 2222, 9090 (usually part of a multi-component app).
- sandmanshiri/shadowsocks: 4 deployments; typically 0.1 cores, 300 MB RAM, 2 GB storage, 6 instances, container port 8388, 9091, 1080 (usually part of a multi-component app).
- sandmanshiri/vless: 4 deployments; typically 0.1 cores, 100 MB RAM, 2 GB storage, 6 instances, container port 443, 9092 (usually part of a multi-component app).
- sandmanshiri/trojan: 4 deployments; typically 0.1 cores, 100 MB RAM, 2 GB storage, 6 instances, container port 8443, 9093 (usually part of a multi-component app).
- sandmanshiri/outline: 4 deployments; typically 0.1 cores, 100 MB RAM, 2 GB storage, 6 instances, container port 9443, 9094 (usually part of a multi-component app).
- sandmanshiri/http-proxy: 4 deployments; typically 0.1 cores, 100 MB RAM, 2 GB storage, 6 instances, container port 3128, 9095 (usually part of a multi-component app).
- mvertes/alpine-mongo: 4 deployments; typically 1 cores, 2000 MB RAM, 45 GB storage, 20 instances (usually part of a multi-component app).
- distributivenetwork/dcp-worker: 4 deployments; typically 4 cores, 7000 MB RAM, 5 GB storage, 1 instances, container port 9000.
- vlakam/socks5-server: 4 deployments; typically 0.1 cores, 100 MB RAM, 1 GB storage, 4 instances, container port 1080.
- owncloud/server: 4 deployments; typically 2 cores, 4000 MB RAM, 20 GB storage, 5 instances, container port 8080 (usually part of a multi-component app).
- wolveix/satisfactory-server: 4 deployments; typically 2 cores, 8000 MB RAM, 60 GB storage, 3 instances, container port 7777, 8888.
- travelping/nettools: 3 deployments; typically 0.1 cores, 100 MB RAM, 1 GB storage, 3 instances, container port 35855, 37663, 31922 (usually part of a multi-component app).
- postgres: 3 deployments; typically 2 cores, 2000 MB RAM, 40 GB storage, 3 instances (usually part of a multi-component app).
- ruimarinho/bitcoin-core: 3 deployments; typically 3 cores, 9000 MB RAM, 160 GB storage, 12 instances, container port 8332, 8333, 38332.
- ghost: 3 deployments; typically 2 cores, 2000 MB RAM, 20 GB storage, 3 instances, container port 2368 (usually part of a multi-component app).
- busybox: 3 deployments; typically 0.5 cores, 1000 MB RAM, 1 GB storage, 3 instances, container port 34040, 32660, 32279 (usually part of a multi-component app).
