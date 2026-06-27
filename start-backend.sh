#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
HOST=0.0.0.0 node backend/server.js
