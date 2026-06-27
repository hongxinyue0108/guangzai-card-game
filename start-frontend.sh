#!/usr/bin/env bash
cd "$(dirname "$0")/frontend" || exit 1
python3 -m http.server 5173
