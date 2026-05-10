# Author: Kevin Ngo, 5/9/26 - in-memory signal history system for tracking BUY/SELL/HOLD recommendations over time

from collections import defaultdict
from datetime import datetime, timezone

# Kevin Ngo, 5/9/26 - stores signal history in format: {"AAPL": [entry1, entry2, ...]}
_history = defaultdict(list)

# Kevin Ngo, 5/9/26 - maximum number of stored history entries per stock symbol
MAX_HISTORY_PER_SYMBOL = 50

# Kevin Ngo, 5/9/26 - valid recommendation types to ensure clean and consistent data
VALID_SIGNALS = {"BUY", "SELL", "HOLD"}


def record_signal(symbol, signal_data):
    # Kevin Ngo, 5/9/26 - records a new trading signal for a given stock symbol
    # Kevin Ngo, 5/9/26 - each entry includes UTC timestamp, signal type, and confidence score

    # Kevin Ngo, 5/9/26 - normalize stock symbol formatting
    symbol = symbol.upper().strip()

    # Kevin Ngo, 5/9/26 - safely extract signal values from input dictionary
    signal = str(signal_data.get("signal", "")).upper()
    confidence = signal_data.get("confidence", 0)

    # Kevin Ngo, 5/9/26 - validate signal type to ensure only allowed values are stored
    if signal not in VALID_SIGNALS:
        raise ValueError(f"Invalid signal type: {signal}")

    # Kevin Ngo, 5/9/26 - convert confidence to numeric value safely
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.0

    # Kevin Ngo, 5/9/26 - clamp confidence between 0 and 100 for consistency
    confidence = max(0.0, min(confidence, 100.0))

    # Kevin Ngo, 5/9/26 - create standardized signal history entry
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "signal": signal,
        "confidence": round(confidence, 2),
    }

    # Kevin Ngo, 5/9/26 - store entry in symbol history
    _history[symbol].append(entry)

    # Kevin Ngo, 5/9/26 - enforce memory limit per symbol
    if len(_history[symbol]) > MAX_HISTORY_PER_SYMBOL:
        _history[symbol] = _history[symbol][-MAX_HISTORY_PER_SYMBOL:]

    # Kevin Ngo, 5/9/26 - return entry for debugging or API response usage
    return entry


def get_history(symbol):
    # Kevin Ngo, 5/9/26 - retrieves signal history for a stock symbol
    # Kevin Ngo, 5/9/26 - returns history in chronological order (oldest to newest)

    # Kevin Ngo, 5/9/26 - normalize input symbol
    symbol = symbol.upper().strip()

    # Kevin Ngo, 5/9/26 - return a safe copy of stored history
    return list(_history.get(symbol, []))


def clear_history(symbol=None):
    # Kevin Ngo, 5/9/26 - clears stored signal history
    # Kevin Ngo, 5/9/26 - if symbol is provided, clears only that stock's history
    # Kevin Ngo, 5/9/26 - if no symbol is provided, clears all stored history

    if symbol:
        symbol = symbol.upper().strip()
        _history.pop(symbol, None)
    else:
        _history.clear()
