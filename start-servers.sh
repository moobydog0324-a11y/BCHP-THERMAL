#!/bin/bash

# BCHP-THERMA Server Startup Script for Mac

echo "========================================"
echo "   BCHP-THERMA Server Startup (Mac)"
echo "========================================"
echo ""

# Get current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Add local tools to PATH
export PATH="$DIR/tools/node/bin:$PATH"

echo "[1/3] Checking processes..."
# Kill existing python process on port 5001 if any
PID=$(lsof -t -i:5001)
if [ -n "$PID" ]; then
    echo "      - Killing process on port 5001 (PID: $PID)..."
    kill -9 $PID
fi
echo "      - Done."
echo ""

# Start Flask Server
echo "[2/3] Starting Flask Server..."
if [ -f "python-backend/app.py" ]; then
    cd python-backend
    
    # Check for venv
    if [ ! -d ".venv" ]; then
        echo "      - Creating virtual environment..."
        python3 -m venv .venv
        source .venv/bin/activate
        echo "      - Installing dependencies..."
        pip install -r requirements.txt
    else
        source .venv/bin/activate
    fi
    
    # Start flask in background
    # Using nohup to keep it running
    nohup python app.py > ../flask.log 2>&1 &
    FLASK_PID=$!
    echo "      - Flask Server started (PID: $FLASK_PID)"
    echo "      - Logs: flask.log"
    echo "      - URL: http://localhost:5001"
    
    cd ..
else
    echo "      [ERROR] python-backend/app.py not found!"
    exit 1
fi
echo ""

# Start Next.js Server
echo "[3/3] Starting Next.js Server..."
if command -v node &> /dev/null; then
    if [ -f "package.json" ]; then
        echo "      - Starting Next.js..."
        # Pnpm check
        if command -v pnpm &> /dev/null; then
            nohup pnpm run dev > nextjs.log 2>&1 &
        else
            nohup npm run dev > nextjs.log 2>&1 &
        fi
        NEXT_PID=$!
        echo "      - Next.js Server started (PID: $NEXT_PID)"
        echo "      - Logs: nextjs.log"
        echo "      - URL: http://localhost:3000"
    else
        echo "      [ERROR] package.json not found!"
    fi
else
    echo "      [WARNING] Node.js not found. Skipping Frontend start."
    echo "      Please install Node.js from https://nodejs.org/"
fi

echo ""
echo "========================================"
echo "   Servers Status"
echo "========================================"
echo "Flask API: http://localhost:5001"
if command -v node &> /dev/null; then
    echo "Web App:   http://localhost:3000"
else
    echo "Web App:   NOT STARTED (Install Node.js)"
fi
echo "========================================"
