# Author: Kevin Ngo, 5/24/26 - persistent SQLite watchlist management system
# Stores user watchlists in a database so stock symbols remain saved
# across backend restarts and future application sessions.

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
        )
=======
# Kevin Ngo, 5/24/26 - default fallback user ID used when
# no authenticated user session is provided
DEFAULT_USER_ID = "default"


def _normalize_symbol(symbol):
    # Kevin Ngo, 5/24/26 - standardizes stock symbol formatting
    # removes extra whitespace and converts symbols to uppercase

    return str(symbol).upper().strip()


def _normalize_user_id(user_id):
    # Kevin Ngo, 5/24/26 - ensures consistent formatting
    # for stored and queried user IDs

    return str(user_id).strip()


def _create_timestamp():
    # Kevin Ngo, 5/24/26 - generates standardized UTC timestamps
    # for database watchlist records

    return datetime.now(timezone.utc).isoformat()


def get_watchlist(user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - retrieves all stored watchlist symbols
    # for a specific user ordered by oldest to newest

    normalized_user_id = _normalize_user_id(user_id)

    # Kevin Ngo, 5/24/26 - open SQLite database connection
    conn = get_db()

    # Kevin Ngo, 5/24/26 - query all symbols belonging to the user
    rows = conn.execute(
        """
        SELECT symbol
        FROM watchlist
        WHERE user_id = ?
        ORDER BY added_at ASC
        """,
        (normalized_user_id,),
    ).fetchall()

    # Kevin Ngo, 5/24/26 - safely close database connection
    conn.close()

    # Kevin Ngo, 5/24/26 - return symbol list only
    return [row["symbol"] for row in rows]


def add_to_watchlist(symbol, user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - adds a stock symbol to the user's watchlist
    # duplicate entries are automatically ignored by SQLite

    normalized_symbol = _normalize_symbol(symbol)
    normalized_user_id = _normalize_user_id(user_id)

    # Kevin Ngo, 5/24/26 - open database connection
    conn = get_db()

    # Kevin Ngo, 5/24/26 - insert watchlist record safely
    with conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO watchlist
            (symbol, user_id, added_at)
            VALUES (?, ?, ?)
            """,
            (
                normalized_symbol,
                normalized_user_id,
                _create_timestamp(),
            ),
        )

    # Kevin Ngo, 5/24/26 - close database connection
    conn.close()


def remove_from_watchlist(symbol, user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - removes a stock symbol
    # from the selected user's watchlist

    normalized_symbol = _normalize_symbol(symbol)
    normalized_user_id = _normalize_user_id(user_id)

    # Kevin Ngo, 5/24/26 - open database connection
    conn = get_db()

    # Kevin Ngo, 5/24/26 - remove matching watchlist record
    with conn:
        conn.execute(
            """
            DELETE FROM watchlist
            WHERE symbol = ?
            AND user_id = ?
            """,
            (
                normalized_symbol,
                normalized_user_id,
            ),
        )

    # Kevin Ngo, 5/24/26 - close database connection
    conn.close()


def is_in_watchlist(symbol, user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - checks whether a stock symbol
    # already exists in the user's watchlist

    normalized_symbol = _normalize_symbol(symbol)
    normalized_user_id = _normalize_user_id(user_id)

    conn = get_db()

    result = conn.execute(
        """
        SELECT 1
        FROM watchlist
        WHERE symbol = ?
        AND user_id = ?
        LIMIT 1
        """,
        (
            normalized_symbol,
            normalized_user_id,
        ),
    ).fetchone()

    conn.close()

    # Kevin Ngo, 5/24/26 - returns True if symbol exists
    return result is not None


def get_watchlist_count(user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - returns total number of saved
    # watchlist symbols for a specific user

    normalized_user_id = _normalize_user_id(user_id)

    conn = get_db()

    result = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM watchlist
        WHERE user_id = ?
        """,
        (normalized_user_id,),
    ).fetchone()

    conn.close()

    return result["total"]


def clear_watchlist(user_id=DEFAULT_USER_ID):
    # Kevin Ngo, 5/24/26 - removes all saved watchlist entries
    # for a selected user account

    normalized_user_id = _normalize_user_id(user_id)

    conn = get_db()

    with conn:
        conn.execute(
            """
            DELETE FROM watchlist
            WHERE user_id = ?
            """,
            (normalized_user_id,),
        )

    conn.close()
