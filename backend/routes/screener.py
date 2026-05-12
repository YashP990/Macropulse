# Mubashir - US-C: Stock screener endpoint — runs signals on a 35-stock universe
# and returns results ranked by confidence.

import time
from flask import Blueprint, jsonify
from services.limiter import limiter
from strategies.signal_aggregator import get_aggregated_signal
from services.data_fetcher import get_ticker_info_raw

screener_bp = Blueprint("screener", __name__)

UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "V", "JNJ", "WMT", "PG", "UNH", "XOM", "HD",
    "MA", "LLY", "AVGO", "ABBV", "PFE", "MRK", "COST", "BAC",
    "KO", "PEP", "TMO", "ABT", "CSCO", "ACN", "MCD",
    "DHR", "NKE", "INTC", "AMD", "ORCL",
]


@screener_bp.route("/screener")
@limiter.limit("10 per minute")
def run_screener():
    # Mubashir - US-C: Run aggregated signals for all universe stocks and rank by confidence
    results = []

    for i, symbol in enumerate(UNIVERSE):
        # Throttle: 300ms between stocks to avoid Yahoo Finance 429s
        if i > 0:
            time.sleep(0.3)
        try:
            signal_data = get_aggregated_signal(symbol)
            if signal_data is None:
                continue

            price_info = get_ticker_info_raw(symbol) or {}

            results.append({
                "symbol": symbol,
                "price": price_info.get("price"),
                "change": price_info.get("change"),
                "changePercent": price_info.get("changePercent"),
                "signal": signal_data.get("signal", "HOLD"),
                "confidence": signal_data.get("confidence", 0),
                "breakdown": {
                    name: {
                        "signal": s.get("signal", "N/A"),
                        "score": s.get("score", 0),
                    }
                    for name, s in signal_data.get("breakdown", {}).items()
                },
            })
        except Exception:
            continue

    results.sort(key=lambda x: x["confidence"], reverse=True)

    return jsonify({
        "count": len(results),
        "universe_size": len(UNIVERSE),
        "results": results,
    }), 200
