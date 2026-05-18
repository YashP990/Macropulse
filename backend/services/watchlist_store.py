# Mubashir - US-D: Migrated from in-memory dict to SQLite — same function signatures, persistent across restarts.

from datetime import datetime, timezone
from services.db import get_db


def get_watchlist(user_id="default"):
    conn = get_db()
    rows = conn.execute(
        "SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY added_at ASC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [r["symbol"] for r in rows]


def add_to_watchlist(symbol, user_id="default"):
    symbol = str(symbol).upper().strip()
    conn = get_db()
    with conn:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (symbol, user_id, added_at) VALUES (?, ?, ?)",
            (symbol, user_id, datetime.now(timezone.utc).isoformat()),
        )
    conn.close()


def remove_from_watchlist(symbol, user_id="default"):
    symbol = str(symbol).upper().strip()
    conn = get_db()
    with conn:
        conn.execute(
            "DELETE FROM watchlist WHERE symbol = ? AND user_id = ?",
            (symbol, user_id),
        )
    conn.close()
