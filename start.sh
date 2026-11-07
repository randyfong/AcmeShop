#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Starting AcmeShop Backend on Port 8080 ==="
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

echo "=== Starting AcmeShop Frontend on Port 3000 ==="
cd client && npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

wait

