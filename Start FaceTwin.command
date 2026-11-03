#!/bin/bash
# Double-click to start FaceTwin on this Mac, then it opens in your browser.
cd "$(dirname "$0")"
PORT=8080
# stop an older copy that may still be running
if lsof -ti tcp:$PORT >/dev/null 2>&1; then lsof -ti tcp:$PORT | xargs kill 2>/dev/null; sleep 1; fi
echo ""
echo "  FaceTwin is starting at http://localhost:$PORT"
echo "  Keep this window open while you demo. Close it to stop."
echo ""
( sleep 2; open "http://localhost:$PORT/?tester=1" ) &
python3 server.py
