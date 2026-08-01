#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Setting up tikt..."

# Node 22+ is required (server uses Node's built-in SQLite)
if ! command -v node &> /dev/null; then
  echo "Node.js not found — install Node.js 22 or later first" >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js 22 or later is required (found $(node -v))" >&2
  exit 1
fi

# Create .env from .env.example if not present
if [ ! -f "$ROOT/.env" ]; then
  echo "Creating .env from .env.example..."
  cp "$ROOT/.env.example" "$ROOT/.env"
else
  echo ".env already exists, skipping"
fi

if command -v pnpm &> /dev/null; then
  PKG=pnpm
else
  PKG=npm
fi

echo "Installing dependencies with $PKG..."
"$PKG" install

# Initialize the database (schema is created on first import of server/db.js)
echo "Initializing database..."
node -e 'import("./server/db.js").then(() => console.log("db.sqlite ready")).catch((e) => { console.error(e); process.exit(1); })'

echo
echo "Setup complete. Next steps:"
echo "  $PKG run dev      # start the dev server"
echo "  $PKG run build    # build the frontend for production"
echo "  ./start.sh        # run under pm2 (after a build)"
