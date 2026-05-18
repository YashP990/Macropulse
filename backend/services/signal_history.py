# Mubashir - US-D: Migrated from in-memory defaultdict to SQLite for persistence across restarts.
# Kevin Ngo's validation helpers (5/17/26) are preserved unchanged.

from datetime import datetime, timezone
from services.db import get_db

MAX_HISTORY_PER_SYMBOL = 50
VALID_SIGNALS = {"BUY", "SELL", "HOLD"}


def _normalize_symbol(symbol):
    return str(symbol).upper().strip()


def _validate_signal(signal):
    signal = str(signal).upper().strip()
    if signal not in VALID_SIGNALS:
        raise ValueError(f"Invalid signal type: {signal}")
    return signal


def _normalize_confidence(confidence):
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.0
    return round(max(0.0, min(confidence, 100.0)), 2)


def _create_signal_entry(signal, confidence):
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "signal": signal,
        "confidence": confidence,
    }


def record_signal(symbol, signal_data):
    normalized_symbol = _normalize_symbol(symbol)
    signal = _validate_signal(signal_data.get("signal", ""))
    confidence = _normalize_confidence(signal_data.get("confidence", 0))
    entry = _create_signal_entry(signal, confidence)

    conn = get_db()
    with conn:
        conn.execute(
            "INSERT INTO signal_history (symbol, signal, confidence, timestamp) VALUES (?, ?, ?, ?)",
            (normalized_symbol, entry["signal"], entry["confidence"], entry["timestamp"]),
        )
        # Keep only the most recent MAX_HISTORY_PER_SYMBOL rows per symbol
        conn.execute("""
            DELETE FROM signal_history
            WHERE symbol = ? AND id NOT IN (
                SELECT id FROM signal_history
                WHERE symbol = ?
                ORDER BY id DESC
                LIMIT ?
            )
        """, (normalized_symbol, normalized_symbol, MAX_HISTORY_PER_SYMBOL))
    conn.close()
    return entry


def get_history(symbol):
    normalized_symbol = _normalize_symbol(symbol)
    conn = get_db()
    rows = conn.execute(
        "SELECT signal, confidence, timestamp FROM signal_history WHERE symbol = ? ORDER BY id ASC",
        (normalized_symbol,),
    ).fetchall()
    conn.close()
    return [{"signal": r["signal"], "confidence": r["confidence"], "timestamp": r["timestamp"]} for r in rows]


def clear_history(symbol=None):
    conn = get_db()
    with conn:
        if symbol is not None:
            conn.execute("DELETE FROM signal_history WHERE symbol = ?", (_normalize_symbol(symbol),))
        else:
            conn.execute("DELETE FROM signal_history")
    conn.close()


def get_total_symbols_tracked():
    conn = get_db()
    count = conn.execute("SELECT COUNT(DISTINCT symbol) FROM signal_history").fetchone()[0]
    conn.close()
    return count


def get_total_signal_count(symbol=None):
    conn = get_db()
    if symbol is not None:
        count = conn.execute(
            "SELECT COUNT(*) FROM signal_history WHERE symbol = ?",
            (_normalize_symbol(symbol),),
        ).fetchone()[0]
    else:
        count = conn.execute("SELECT COUNT(*) FROM signal_history").fetchone()[0]
    conn.close()
    return count
