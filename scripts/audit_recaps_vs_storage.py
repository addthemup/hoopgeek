#!/usr/bin/env python3
"""
Compare game-data bucket *.json objects to published feed_posts (post_type=game_recap).

Env: VITE_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Optional: FEED_GAME_DATA_BUCKET (default game-data), FEED_OBJECT_PREFIX / FEED_JSON_PREFIX (folder under bucket)

  python3 -u scripts/audit_recaps_vs_storage.py
"""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.request

import certifi

_SSL = ssl.create_default_context(cafile=certifi.where())
GAME_ID_JSON = re.compile(r"^(\d{10})\.json$")


def _base_key() -> tuple[str, str]:
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        print("Need SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    return base, key


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def list_all_json_game_ids(base: str, key: str, bucket: str, prefix: str) -> set[str]:
    """List all objects under prefix; collect 10-digit .json at this level (non-recursive)."""
    ids: set[str] = set()
    offset = 0
    page = 1000
    while True:
        body = json.dumps(
            {
                "prefix": prefix,
                "limit": page,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            }
        ).encode()
        url = f"{base}/storage/v1/object/list/{bucket}"
        req = urllib.request.Request(url, data=body, headers=_headers(key), method="POST")
        with urllib.request.urlopen(req, timeout=120, context=_SSL) as resp:
            chunk = json.loads(resp.read().decode())
        if not isinstance(chunk, list):
            raise RuntimeError(f"Unexpected list response: {chunk!r}")
        for item in chunk:
            name = item.get("name") or ""
            m = GAME_ID_JSON.match(name)
            if m:
                ids.add(m.group(1))
            # storage "folders" have id: null — ignore
        if len(chunk) < page:
            break
        offset += page
    return ids


def list_published_recap_game_ids(base: str, key: str) -> set[str]:
    ids: set[str] = set()
    offset = 0
    page = 1000
    while True:
        q = (
            f"select=game_id&post_type=eq.game_recap&status=eq.published"
            f"&limit={page}&offset={offset}"
        )
        url = f"{base}/rest/v1/feed_posts?{q}"
        req = urllib.request.Request(url, headers=_headers(key), method="GET")
        with urllib.request.urlopen(req, timeout=120, context=_SSL) as resp:
            rows = json.loads(resp.read().decode())
        for r in rows:
            gid = r.get("game_id")
            if gid:
                ids.add(str(gid))
        if len(rows) < page:
            break
        offset += page
    return ids


def main() -> None:
    base, key = _base_key()
    bucket = os.environ.get("FEED_GAME_DATA_BUCKET", "game-data")
    prefix = (
        os.environ.get("FEED_OBJECT_PREFIX") or os.environ.get("FEED_JSON_PREFIX") or ""
    ).strip().strip("/")

    pfx = repr(prefix) if prefix else "(root)"
    print(f"Bucket: {bucket!r}  prefix: {pfx}")
    in_storage = list_all_json_game_ids(base, key, bucket, prefix)
    with_recap = list_published_recap_game_ids(base, key)

    missing_recap = sorted(in_storage - with_recap)
    extra_recap = sorted(with_recap - in_storage)

    print(f"JSON game files in bucket (this prefix): {len(in_storage)}")
    print(f"Published game_recap rows (distinct game_id): {len(with_recap)}")
    print(f"JSON in bucket but NO published recap: {len(missing_recap)}")
    print(f"Recap in DB but NO matching JSON in bucket (this prefix): {len(extra_recap)}")

    if missing_recap:
        print("\nFirst 80 game_ids missing recaps (have JSON):")
        print(", ".join(missing_recap[:80]))
        if len(missing_recap) > 80:
            print(f"... and {len(missing_recap) - 80} more")

    if extra_recap and len(extra_recap) <= 40:
        print("\nRecaps without JSON at this prefix (sample):")
        print(", ".join(extra_recap[:40]))


if __name__ == "__main__":
    main()
