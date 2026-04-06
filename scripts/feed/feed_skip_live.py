"""
Load the set of game IDs to skip because they are still live (from NBA live scoreboard).
run_feed_nightly.sh writes FEED_DIR/.skip_live_game_ids (one game_id per line) before each round.
"""

from pathlib import Path

FEED_DIR = Path(__file__).resolve().parent
SKIP_FILE = FEED_DIR / ".skip_live_game_ids"


def load_skip_live_game_ids():
    """Return set of game_id strings to skip (still in progress). Empty set if file missing or unreadable."""
    if not SKIP_FILE.exists():
        return set()
    try:
        with open(SKIP_FILE, "r") as f:
            return {line.strip() for line in f if line.strip()}
    except Exception:
        return set()
