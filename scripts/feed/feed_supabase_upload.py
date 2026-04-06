#!/usr/bin/env python3
"""
Upload scraped feed game JSON to Supabase Storage (game-data bucket).

Objects live at the bucket root: {game_id}.json (bucket name: game-data).
Optional FEED_OBJECT_PREFIX (e.g. "feed") if you use a subfolder.

Requires:
  VITE_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Optional:
  FEED_GAME_DATA_BUCKET — default "game-data"
  FEED_OBJECT_PREFIX — default "" (root); set to "feed" for feed/0022501002.json
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple

GAME_DATA_BUCKET_DEFAULT = "game-data"


def _supabase_env() -> Tuple[Optional[str], Optional[str]]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    return url, key


def is_supabase_upload_configured() -> bool:
    u, k = _supabase_env()
    return bool(u and k)


def upload_feed_game_json(game_id: str, game_data: Dict[str, Any]) -> None:
    """
    Upload game JSON to Storage. Raises on failure (caller may catch and log).

    Object path: {game_id}.json at bucket root, or {FEED_OBJECT_PREFIX}/{game_id}.json if set.
    """
    url, key = _supabase_env()
    if not url or not key:
        raise RuntimeError("Supabase URL or SUPABASE_SERVICE_ROLE_KEY not set")

    bucket = os.environ.get("FEED_GAME_DATA_BUCKET", GAME_DATA_BUCKET_DEFAULT)
    prefix = os.environ.get("FEED_OBJECT_PREFIX", "").strip().strip("/")
    object_path = f"{prefix}/{game_id}.json" if prefix else f"{game_id}.json"
    payload = json.dumps(game_data, indent=2).encode("utf-8")

    from supabase import create_client

    client = create_client(url, key)
    client.storage.from_(bucket).upload(
        object_path,
        payload,
        file_options={
            "content-type": "application/json; charset=utf-8",
            "upsert": "true",
        },
    )
