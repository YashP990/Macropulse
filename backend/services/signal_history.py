# Author: Kevin Ngo, 5/17/26 - enhanced in-memory signal history system
# Tracks BUY/SELL/HOLD trading recommendations with validation,
# normalization, confidence formatting, and memory-safe storage.

from collections import defaultdict
from datetime import datetime, timezone


# Kevin Ngo, 5/17/26 - stores signal history grouped by stock symbol
# Example format:
# {
#     "AAPL": [entry1, entry2],
#     "TSLA": [entry1]
# }
_history = defaultdict(list)


# Kevin Ngo, 5/17/26 - maximum number of stored history records per symbol
MAX_HISTORY_PER_SYMBOL = 50


# Kevin Ngo, 5/17/26 - valid recommendation types accepted by the system
VALID_SIGNALS = {"BUY", "SELL", "HOLD"}


def _normalize_symbol(symbol):
    # Kevin Ngo, 5/17/26 - standardizes stock symbol formatting
    # Removes extra spaces and converts to uppercase
    return str(symbol).upper().strip()


def _validate_signal(signal):
    # Kevin Ngo, 5/17/26 - validates signal type before storage
    signal = str(signal).upper().strip()

    if signal not in VALID_SIGNALS:
        raise ValueError(f"Invalid signal type: {signal}")

    return signal


def _normalize_confidence(confidence):
    # Kevin Ngo, 5/17/26 - safely converts confidence values to float
    # Defaults invalid values to 0.0

    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.0

    # Kevin Ngo, 5/17/26 - ensures confidence remains between 0 and 100
    confidence = max(0.0, min(confidence, 100.0))

    return round(confidence, 2)


def _create_signal_entry(signal, confidence):
    # Kevin Ngo, 5/17/26 - creates a standardized history entry structure

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "signal": signal,
        "confidence": confidence,
    }


def _trim_history(symbol):
    # Kevin Ngo, 5/17/26 - limits stored history size to prevent
    # excessive memory usage during long runtime sessions

    if len(_history[symbol]) > MAX_HISTORY_PER_SYMBOL:
        _history[symbol] = _history[symbol][-MAX_HISTORY_PER_SYMBOL:]


def record_signal(symbol, signal_data):
    # Kevin Ngo, 5/17/26 - records a new trading recommendation
    # for a stock symbol into the in-memory history system

    # Kevin Ngo, 5/17/26 - normalize and validate incoming data
    normalized_symbol = _normalize_symbol(symbol)

    signal = _validate_signal(
        signal_data.get("signal", "")
    )

    confidence = _normalize_confidence(
        signal_data.get("confidence", 0)
    )

    # Kevin Ngo, 5/17/26 - create standardized history entry
    entry = _create_signal_entry(signal, confidence)

    # Kevin Ngo, 5/17/26 - append entry to stored symbol history
    _history[normalized_symbol].append(entry)

    # Kevin Ngo, 5/17/26 - enforce maximum history storage limit
    _trim_history(normalized_symbol)

    # Kevin Ngo, 5/17/26 - return created entry for debugging
    # or API response handling
    return entry


def get_history(symbol):
    # Kevin Ngo, 5/17/26 - retrieves stored signal history
    # in chronological order from oldest to newest

    normalized_symbol = _normalize_symbol(symbol)

    # Kevin Ngo, 5/17/26 - returns copy of history to prevent
    # external modification of internal storage
    return list(_history.get(normalized_symbol, []))


def clear_history(symbol=None):
    # Kevin Ngo, 5/17/26 - clears stored signal history data

    # Kevin Ngo, 5/17/26 - clears history for a specific symbol
    if symbol is not None:
        normalized_symbol = _normalize_symbol(symbol)
        _history.pop(normalized_symbol, None)
        return

    # Kevin Ngo, 5/17/26 - clears all stored history entries
    _history.clear()


def get_total_symbols_tracked():
    # Kevin Ngo, 5/17/26 - returns total number of symbols
    # currently stored in the history system

    return len(_history)


def get_total_signal_count(symbol=None):
    # Kevin Ngo, 5/17/26 - returns total stored signal entries

    # Kevin Ngo, 5/17/26 - count signals for one symbol
    if symbol is not None:
        normalized_symbol = _normalize_symbol(symbol)
        return len(_history.get(normalized_symbol, []))

    # Kevin Ngo, 5/17/26 - count all signals across all symbols
    return sum(len(entries) for entries in _history.values())
