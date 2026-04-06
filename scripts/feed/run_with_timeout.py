#!/usr/bin/env python3
"""
Run a command with a timeout. Used by run_feed_maintenance.sh so no step can hang forever.
Usage: python3 run_with_timeout.py SECONDS -- COMMAND [ARGS...]
Exit code: same as command, or 124 if timeout (same as GNU timeout).
"""
import subprocess
import sys

def main():
    # Usage: run_with_timeout.py SECONDS -- COMMAND [ARGS...]
    if "--" not in sys.argv or len(sys.argv) < 4:
        print("Usage: run_with_timeout.py SECONDS -- COMMAND [ARGS...]", file=sys.stderr)
        sys.exit(125)
    idx = sys.argv.index("--")
    timeout_arg = sys.argv[1]
    cmd = sys.argv[idx + 1:]
    if not cmd:
        print("Usage: run_with_timeout.py SECONDS -- COMMAND [ARGS...]", file=sys.stderr)
        sys.exit(125)
    try:
        timeout_sec = int(timeout_arg)
    except ValueError:
        print("SECONDS must be an integer", file=sys.stderr)
        sys.exit(125)
    try:
        r = subprocess.run(cmd, timeout=timeout_sec)
        sys.exit(r.returncode)
    except subprocess.TimeoutExpired:
        print(f"\n[run_with_timeout] Step timed out after {timeout_sec}s; continuing to next step.", file=sys.stderr)
        sys.exit(124)

if __name__ == "__main__":
    main()
