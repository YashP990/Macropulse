# Author: Kevin Ngo, 4/11/26

from datetime import datetime, timezone
from flask import Blueprint, jsonify, make_response, request
from services.data_fetcher import get_stock_history_dict, get_ticker_info_raw, get_ticker_fundamentals, get_ticker_news
from strategies.signal_aggregator import get_aggregated_signal
import re

# Kevin Ngo, 4/11/26 - Stock API routes for Macropulse backend
# Handles stock info + historical price data with validation and safe responses

stock_bp = Blueprint("stock", __name__)

# Kevin Ngo, 4/11/26 - Allowed time ranges for historical stock data
VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}

# Kevin Ngo, 4/11/26 - Short user-friendly aliases mapped to valid API periods
PERIOD_ALIASES = {
    "1m": "1mo",
    "3m": "3mo",
    "6m": "6mo",
    "12m": "1y",
}

# Kevin Ngo, 4/11/26 - Regex pattern to validate stock symbols
SYMBOL_PATTERN = re.compile(r"^[A-Z0-9.\-^=]{1,15}$")

# Yash Patel, 06/01/2026
# Defines similar stock matching limits and the stock comparison universe.
SIMILAR_CONFIDENCE_WINDOW = 5
SIMILAR_STOCK_LIMIT = 3
SIMILAR_STOCK_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "V", "JNJ", "WMT", "PG", "UNH", "XOM", "HD",
    "MA", "LLY", "AVGO", "ABBV", "PFE", "MRK", "COST", "BAC",
    "KO", "PEP", "TMO", "ABT", "CSCO", "ACN", "MCD",
    "DHR", "NKE", "INTC", "AMD", "ORCL",
]


def _normalize_symbol(symbol):
    # Kevin Ngo, 4/11/26 - Clean and standardize stock symbol input
    normalized = (symbol or "").strip().upper().replace(" ", "")

    # Kevin Ngo, 4/11/26 - Convert dot notation to hyphen format if needed
    if "." in normalized and "-" not in normalized:
        normalized = normalized.replace(".", "-")

    return normalized


def _normalize_period(raw_period):
    # Kevin Ngo, 4/11/26 - Normalize user input for time period
    period = (raw_period or "1y").strip().lower()

    # Kevin Ngo, 4/11/26 - Convert aliases into valid API values
    period = PERIOD_ALIASES.get(period, period)

    return period


def _response(payload, status=200, cache_seconds=None):
    # Kevin Ngo, 4/11/26 - Standard API response wrapper with security headers
    response = make_response(jsonify(payload), status)

    response.headers["X-Content-Type-Options"] = "nosniff"

    response.headers["Cache-Control"] = (
        f"public, max-age={cache_seconds}"
        if cache_seconds is not None
        else "no-store"
    )

    return response


def _error(message, status=400, **extra):
    # Kevin Ngo, 4/11/26 - Standard error response format
    payload = {"error": message, **extra}
    return _response(payload, status=status, cache_seconds=0)


def _request_meta(symbol, period=None):
    # Kevin Ngo, 4/11/26 - Adds request metadata for debugging/tracking
    meta = {
        "symbol": symbol,
        "requestedAt": datetime.now(timezone.utc).isoformat(),
    }

    if period is not None:
        meta["period"] = period

    return meta


@stock_bp.route("/stock/<symbol>")
def stock_info(symbol):
    # Kevin Ngo, 4/11/26 - Fetch and return stock info for a symbol
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol:
        return _error("Stock symbol is required.")

    if not SYMBOL_PATTERN.fullmatch(normalized_symbol):
        return _error(
            f"Invalid stock symbol '{symbol}'. Use letters, numbers, '.', '-', '^', or '='.",
            status=400,
        )

    try:
        data = get_ticker_info_raw(normalized_symbol)
    except Exception:
        return _error(
            f"Unable to load stock data for '{normalized_symbol}'. Please try again.",
            status=502,
            meta=_request_meta(normalized_symbol),
        )

    if data is None:
        return _error(
            f"Stock '{normalized_symbol}' not found",
            status=404,
            meta=_request_meta(normalized_symbol),
        )

    payload = dict(data)
    payload["meta"] = _request_meta(normalized_symbol)

    return _response(payload, status=200, cache_seconds=60)


@stock_bp.route("/stock/<symbol>/history")
def stock_history(symbol):
    # Kevin Ngo, 4/11/26 - Fetch historical stock price data
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol:
        return _error("Stock symbol is required.")

    if not SYMBOL_PATTERN.fullmatch(normalized_symbol):
        return _error(
            f"Invalid stock symbol '{symbol}'. Use letters, numbers, '.', '-', '^', or '='.",
            status=400,
        )

    period = _normalize_period(request.args.get("period", "1y"))

    if period not in VALID_PERIODS:
        return _error(
            f"Invalid period '{period}'. Use one of: {sorted(VALID_PERIODS)}",
            status=400,
            meta=_request_meta(normalized_symbol, period=period),
        )

    try:
        data = get_stock_history_dict(normalized_symbol, period=period)
    except Exception:
        return _error(
            f"Unable to load price history for '{normalized_symbol}'. Please try again.",
            status=502,
            meta=_request_meta(normalized_symbol, period=period),
        )

    if data is None:
        return _error(
            f"No history found for '{normalized_symbol}'",
            status=404,
            meta=_request_meta(normalized_symbol, period=period),
        )

    history = data.get("history", [])

    payload = {
        "symbol": data.get("symbol", normalized_symbol),
        "history": history,
        "period": period,
        "points": len(history),
        "meta": _request_meta(normalized_symbol, period=period),
    }

    return _response(payload, status=200, cache_seconds=300)

# Yash Patel, 06/01/2026
# Returns stocks with confidence values similar to the selected stock.
@stock_bp.route("/stock/<symbol>/similar")
def similar_stocks(symbol):
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol or not SYMBOL_PATTERN.fullmatch(normalized_symbol):
        return _error(f"Invalid stock symbol '{symbol}'.", status=400)

    current_signal = get_aggregated_signal(normalized_symbol)
    if current_signal is None:
        return _error(
            f"Unable to calculate confidence for '{normalized_symbol}'.",
            status=404,
            meta=_request_meta(normalized_symbol),
        )

    current_confidence = current_signal.get("confidence", 0)
    candidates = []

    for candidate_symbol in SIMILAR_STOCK_UNIVERSE:
        if candidate_symbol == normalized_symbol:
            continue

        try:
            candidate_signal = get_aggregated_signal(candidate_symbol)
            if candidate_signal is None:
                continue

            candidate_confidence = candidate_signal.get("confidence", 0)
            confidence_delta = abs(candidate_confidence - current_confidence)
            if confidence_delta > SIMILAR_CONFIDENCE_WINDOW:
                continue

            info = get_ticker_info_raw(candidate_symbol) or {}
            candidates.append({
                "symbol": candidate_symbol,
                "name": info.get("name") or candidate_symbol,
                "signal": candidate_signal.get("signal", "HOLD"),
                "confidence": candidate_confidence,
                "confidenceDelta": confidence_delta,
            })
        except Exception:
            continue

    candidates.sort(key=lambda item: (item["confidenceDelta"], item["symbol"]))

    payload = {
        "symbol": normalized_symbol,
        "confidence": current_confidence,
        "confidenceWindow": SIMILAR_CONFIDENCE_WINDOW,
        "count": min(len(candidates), SIMILAR_STOCK_LIMIT),
        "results": candidates[:SIMILAR_STOCK_LIMIT],
        "meta": _request_meta(normalized_symbol),
    }

    return _response(payload, status=200, cache_seconds=300)


@stock_bp.route("/stock/<symbol>/fundamentals")
def stock_fundamentals(symbol):
    # Mubashir - US-A: Return enriched fundamentals for the stock detail page
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol or not SYMBOL_PATTERN.fullmatch(normalized_symbol):
        return _error(f"Invalid stock symbol '{symbol}'.", status=400)

    try:
        info = get_ticker_fundamentals(normalized_symbol)
    except Exception:
        return _error(
            f"Unable to load fundamentals for '{normalized_symbol}'.",
            status=502,
            meta=_request_meta(normalized_symbol),
        )

    payload = {
        "symbol": normalized_symbol,
        "trailingEPS": info.get("trailingEps"),
        "forwardEPS": info.get("forwardEps"),
        "analystTargetLow": info.get("targetLowPrice"),
        "analystTargetMedian": info.get("targetMedianPrice"),
        "analystTargetHigh": info.get("targetHighPrice"),
        "analystRecommendation": info.get("recommendationKey"),
        "nextEarningsDate": info.get("earningsTimestamp"),
        "dividendYield": info.get("dividendYield"),
        "revenuePerShare": info.get("revenuePerShare"),
        "profitMargins": info.get("profitMargins"),
        "returnOnEquity": info.get("returnOnEquity"),
        "debtToEquity": info.get("debtToEquity"),
        "meta": _request_meta(normalized_symbol),
    }

    return _response(payload, status=200, cache_seconds=900)


@stock_bp.route("/stock/<symbol>/news")
def stock_news(symbol):
    # Mubashir - US-B: Return recent news articles for the stock detail page
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol or not SYMBOL_PATTERN.fullmatch(normalized_symbol):
        return _error(f"Invalid stock symbol '{symbol}'.", status=400)

    articles = get_ticker_news(normalized_symbol)

    payload = {
        "symbol": normalized_symbol,
        "count": len(articles),
        "articles": articles,
        "meta": _request_meta(normalized_symbol),
    }

    return _response(payload, status=200, cache_seconds=600)
