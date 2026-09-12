#!/bin/sh
# The shim is the supervisor: it spawns both llama-servers, respawns one that
# exits and restarts one whose /health stays down (see shim.js). Flux only
# sets Cmd, never Entrypoint, so this script is the entrypoint and the spec's
# commands stay empty.
export BIN=/opt/bitnet/bin
export LD_LIBRARY_PATH=$BIN
exec node /opt/bitnet/shim.js
