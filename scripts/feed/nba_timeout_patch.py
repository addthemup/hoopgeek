#!/usr/bin/env python3
"""
Patch nba_api default request timeout so stats.nba.com slow responses don't fail.

Import this module at the start of any feed script that uses nba_api.
Default is 300 seconds (5 min); env NBA_API_TIMEOUT overrides. Lax mode for inconsistent API.
"""

import os
import sys

_NBA_API_TIMEOUT = int(os.environ.get("NBA_API_TIMEOUT", "300"))

try:
    # Patch the same module LeagueGameFinder uses: nba_api.stats.library.http
    from nba_api.stats.library import http as _http_module
    if not hasattr(_http_module, "NBAStatsHTTP"):
        raise AttributeError("NBAStatsHTTP not found on nba_api.stats.library.http")
    _orig_send = _http_module.NBAStatsHTTP.send_api_request

    def _patched_send(self, endpoint, parameters, referer=None, proxy=None, headers=None, timeout=None, raise_exception_on_error=False):
        if timeout is None or (isinstance(timeout, (int, float)) and timeout <= 30):
            timeout = _NBA_API_TIMEOUT
        return _orig_send(
            self, endpoint, parameters,
            referer=referer, proxy=proxy, headers=headers,
            timeout=timeout, raise_exception_on_error=raise_exception_on_error,
        )

    _http_module.NBAStatsHTTP.send_api_request = _patched_send
except Exception as e:
    print(f"Warning: nba_timeout_patch failed (API timeout will stay at 30s): {e}", file=sys.stderr)
