# Mubashir - US-E: Backtesting engine.
# Slices historical price data into non-overlapping 21-day windows,
# runs each strategy on the slice available at signal time, then checks
# whether the actual price move at day+21 matched the signal direction.

import logging
import time

from services.data_fetcher import get_historical_dataframe
from strategies.momentum import calculate_momentum
from strategies.mean_reversion import calculate_mean_reversion
from strategies.monte_carlo import calculate_monte_carlo
from strategies.factor_model import calculate_factor_model

logger = logging.getLogger(__name__)

_cache = {}
_CACHE_TTL = 3600  # 1 hour

_MIN_WARMUP = 60    # trading days needed to produce a stable signal
_WINDOW_DAYS = 21   # one calendar month of trading days
_MIN_WINDOWS = 10   # require at least this many windows to report results

_STRATEGIES = {
    "momentum": calculate_momentum,
    "mean_reversion": calculate_mean_reversion,
    "monte_carlo": calculate_monte_carlo,
    "factor_model": calculate_factor_model,
}


def run_backtest(symbol, period="2y"):
    symbol = symbol.upper()
    cache_key = f"bt_{symbol}_{period}"
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["ts"]) < _CACHE_TTL:
        return cached["data"]

    try:
        df = get_historical_dataframe(symbol, period=period)
    except Exception:
        logger.exception("Failed to fetch data for backtest: %s", symbol)
        return {"error": "Could not fetch price data"}

    if df is None or len(df) < _MIN_WARMUP + _WINDOW_DAYS * _MIN_WINDOWS:
        return {"insufficient_data": True}

    totals = {name: {"correct": 0, "calls": 0} for name in _STRATEGIES}
    window_count = 0

    for start in range(_MIN_WARMUP, len(df) - _WINDOW_DAYS, _WINDOW_DAYS):
        df_slice = df.iloc[:start]
        end_idx = start + _WINDOW_DAYS - 1

        # Price at signal time and at end of window
        price_at_signal = float(df.iloc[start - 1]["Close"])
        price_at_outcome = float(df.iloc[end_idx]["Close"])
        if price_at_signal == 0:
            continue

        actual_return = (price_at_outcome - price_at_signal) / price_at_signal
        window_count += 1

        for name, func in _STRATEGIES.items():
            try:
                result = func(symbol, df=df_slice)
                if result is None or result["signal"] == "HOLD":
                    continue
                totals[name]["calls"] += 1
                correct = (
                    (result["signal"] == "BUY" and actual_return > 0) or
                    (result["signal"] == "SELL" and actual_return < 0)
                )
                if correct:
                    totals[name]["correct"] += 1
            except Exception:
                logger.debug("Strategy %s failed on window %d for %s", name, start, symbol)

    if window_count < _MIN_WINDOWS:
        return {"insufficient_data": True}

    strategies_out = {}
    for name, stats in totals.items():
        if stats["calls"] > 0:
            strategies_out[name] = {
                "accuracy": round(stats["correct"] / stats["calls"] * 100, 1),
                "correct": stats["correct"],
                "total": stats["calls"],
            }
        else:
            strategies_out[name] = {"accuracy": None, "correct": 0, "total": 0}

    all_correct = sum(s["correct"] for s in totals.values())
    all_calls = sum(s["calls"] for s in totals.values())
    overall = round(all_correct / all_calls * 100, 1) if all_calls > 0 else None

    data = {
        "symbol": symbol,
        "period": period,
        "window_days": _WINDOW_DAYS,
        "total_windows": window_count,
        "overall_accuracy": overall,
        "strategies": strategies_out,
    }

    _cache[cache_key] = {"data": data, "ts": time.time()}
    return data
