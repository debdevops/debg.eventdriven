#!/bin/bash
cd "$(dirname "$0")/packages/ui"
echo "Starting frontend on http://localhost:5174..."
npx vite
