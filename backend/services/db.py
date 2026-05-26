import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "macropulse.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS signal_history (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol     TEXT    NOT NULL,
                signal     TEXT    NOT NULL,
                confidence REAL    NOT NULL,
                timestamp  TEXT    NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_signal_history_symbol ON signal_history (symbol)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                symbol   TEXT NOT NULL,
                user_id  TEXT NOT NULL DEFAULT 'default',
                added_at TEXT NOT NULL,
                PRIMARY KEY (symbol, user_id)
            )
        """)
        # Mubashir - US-G: Trading journal. exit_* are NULL while a position is open.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS journal_trades (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol      TEXT    NOT NULL,
                trade_type  TEXT    NOT NULL,
                entry_date  TEXT    NOT NULL,
                entry_price REAL    NOT NULL,
                exit_date   TEXT,
                exit_price  REAL,
                shares      REAL    NOT NULL,
                notes       TEXT    NOT NULL DEFAULT '',
                created_at  TEXT    NOT NULL,
                deleted     INTEGER NOT NULL DEFAULT 0
            )
        """)
    conn.close()
