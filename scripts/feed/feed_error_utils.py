#!/usr/bin/env python3
"""
Shared helpers for feed scripts: format HTTP/HTTPS errors with clear context
so you know which step (discover, metadata, play_by_play, player_stats, shot_charts)
and which resource (date, game_id, action_num) failed and what the error means.
"""


def _http_status_meaning(status_code):
    """Return a short human-readable meaning for common HTTP status codes."""
    meanings = {
        400: "Bad Request — check parameters (e.g. game_id/date format)",
        401: "Unauthorized — API may require auth or token",
        403: "Forbidden — often rate limit or IP block from NBA API",
        404: "Not Found — game/endpoint may not exist or not yet available",
        429: "Too Many Requests — rate limited; wait and retry",
        500: "Internal Server Error — NBA API/server issue; retry later",
        502: "Bad Gateway — upstream NBA API temporarily down",
        503: "Service Unavailable — NBA API overloaded or in maintenance",
        504: "Gateway Timeout — request took too long; retry",
    }
    return meanings.get(status_code, f"HTTP {status_code}")


def format_http_error(step_description, e, include_raw=True):
    """
    Build a single log line that explains an HTTP/HTTPS error in context.

    step_description: e.g. "discover games for 2026-03-01", "metadata for game 0022500869",
                      "play-by-play for game 0022500869", "VideoEventsAsset game 0022500869 action 42"
    e: the exception (HTTPError, SSLError, Timeout, ConnectionError, etc.)
    include_raw: if True, append the raw exception message in parentheses

    Returns a string suitable for print() or logging.
    """
    err_type = type(e).__name__
    raw = str(e).strip()
    if not raw:
        raw = "(no message)"

    # requests / urllib3
    status_code = None
    url = None
    try:
        if hasattr(e, "response") and e.response is not None:
            status_code = getattr(e.response, "status_code", None)
            url = getattr(e.response, "url", None)
            if url is not None:
                url = str(url)
    except Exception:
        pass

    parts = [f"[{step_description}]"]

    if status_code is not None:
        meaning = _http_status_meaning(status_code)
        parts.append(f"HTTP {status_code}: {meaning}")
        if url:
            parts.append(f"(url: {url})")
    elif "ssl" in err_type.lower() or "ssl" in raw.lower() or "certificate" in raw.lower():
        parts.append(
            "HTTPS/SSL error — certificate or TLS issue; "
            "could be network proxy, wrong host, or NBA API certificate problem."
        )
    elif "timeout" in raw.lower() or "timed out" in raw.lower() or "Timeout" in err_type:
        parts.append(
            "Timeout — request took too long; NBA API may be slow or overloaded. "
            "Retry later or set NBA_API_TIMEOUT=300; feed default is 300s (5 min)."
        )
    elif "connection" in raw.lower() or "Connection" in err_type or "connectionpool" in raw.lower():
        parts.append(
            "Connection error — could not reach NBA API (network down, DNS, or server not responding)."
        )
    elif "reset" in raw.lower() or "refused" in raw.lower():
        parts.append(
            "Connection reset or refused — NBA API closed the connection or is not accepting requests."
        )
    else:
        parts.append(f"{err_type}: {raw[:200]}")

    if include_raw and raw and raw not in " ".join(parts):
        parts.append(f"Raw: {raw[:150]}")

    return " ".join(parts)


def log_http_error(step_description, e, include_raw=True):
    """Print a formatted HTTP/HTTPS error with context (step + meaning)."""
    print(format_http_error(step_description, e, include_raw=include_raw))


def is_retryable_request_error(e):
    """True if the error is usually transient (timeout, connection, rate limit, 5xx)."""
    err_type = type(e).__name__
    raw = str(e).lower()
    if "timeout" in raw or "timed out" in raw or "timeout" in err_type.lower():
        return True
    if "connection" in raw or "connection" in err_type or "connectionpool" in raw:
        return True
    if "reset" in raw or "refused" in raw:
        return True
    try:
        if hasattr(e, "response") and e.response is not None:
            code = getattr(e.response, "status_code", None)
            if code in (429, 500, 502, 503, 504):
                return True
    except Exception:
        pass
    return False
