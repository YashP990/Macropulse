# Author: Kevin Ngo, 4/25/26
# Mubashir - US-0: Removed global yfinance availability flag and all mock fallbacks.
# Real data only — if yfinance fails the caller gets an exception and the route returns an HTTP error.
# Added get_historical_dataframe (returns DataFrame for strategies),
# get_stock_history_dict (returns serializable dict for API routes),
# and get_ticker_fundamentals (full info dict for factor_model and fundamentals endpoint).

import os
import time
import logging
import requests
import math

import yfinance as yf

logger = logging.getLogger(__name__)

_cache = {}
_DEFAULT_TTL = int(os.environ.get("CACHE_TTL", 300))
_REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", 10))

# Shared session with browser-like headers to reduce Yahoo Finance 429s
_session = requests.Session()
_session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})


def _cache_get(key, ttl=_DEFAULT_TTL):
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < ttl:
            return data
        del _cache[key]
    return None


def _cache_set(key, data):
    _cache[key] = (time.time(), data)


def _is_rate_limited(exc):
    msg = str(exc).lower()
    return "429" in msg or "too many requests" in msg


def _yf_ticker(symbol):
    """Return a yfinance Ticker using the shared session."""
    t = yf.Ticker(symbol)
    t.session = _session
    return t


def _safe_float(value):
    try:
        number = float(value)
        if math.isfinite(number):
            return number
    except (TypeError, ValueError):
        pass
    return None


def _safe_int(value):
    number = _safe_float(value)
    return int(number) if number is not None else None


def _round_or_none(value, digits=2):
    number = _safe_float(value)
    return round(number, digits) if number is not None else None


def _fast_info_value(fast_info, attr):
    try:
        return getattr(fast_info, attr, None)
    except Exception:
        return None


def _yf_history_with_retry(symbol, period, max_retries=3):
    """Fetch yfinance history with exponential backoff on 429."""
    delay = 2
    last_exc = None
    for attempt in range(max_retries):
        try:
            return _yf_ticker(symbol).history(period=period, timeout=_REQUEST_TIMEOUT)
        except Exception as e:
            last_exc = e
            if _is_rate_limited(e):
                logger.warning(
                    "Rate limited fetching %s history (attempt %d/%d), waiting %ds",
                    symbol, attempt + 1, max_retries, delay,
                )
                time.sleep(delay)
                delay *= 2
            else:
                raise
    raise last_exc


def get_historical_dataframe(symbol, period="1y"):
    """Return a pandas DataFrame of OHLCV data for use by strategy calculations."""
    symbol = symbol.upper()
    cache_key = f"df_{symbol}_{period}"

    cached = _cache_get(cache_key, ttl=600)
    if cached is not None:
        return cached

    hist = _yf_history_with_retry(symbol, period)

    if hist is None or hist.empty:
        raise ValueError(f"No historical data returned for {symbol}")

    _cache_set(cache_key, hist)
    return hist


def get_stock_history_dict(symbol, period="1y"):
    """Return serializable history dict for API routes."""
    symbol = symbol.upper()
    cache_key = f"hist_dict_{symbol}_{period}"

    cached = _cache_get(cache_key, ttl=300)
    if cached is not None:
        return cached

    hist = _yf_history_with_retry(symbol, period)

    if hist is None or hist.empty:
        return None

    records = []
    for idx, row in hist.iterrows():
        records.append({
            "date": str(idx.date()),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })

    result = {"symbol": symbol, "history": records}
    _cache_set(cache_key, result)
    return result


def get_ticker_info_raw(symbol):
    """Return current price and key company metrics for a ticker."""
    symbol = symbol.upper()
    cache_key = f"info_{symbol}"

    cached = _cache_get(cache_key, ttl=60)
    if cached is not None:
        return cached

    delay = 2
    last_exc = None
    for attempt in range(3):
        try:
            ticker = _yf_ticker(symbol)
            fi = ticker.fast_info
            info = {}

            try:
                info = ticker.info or {}
            except Exception:
                logger.info("Fundamental info unavailable for %s; returning price data only", symbol)

            price = _safe_float(_fast_info_value(fi, "last_price"))
            prev = _safe_float(_fast_info_value(fi, "previous_close"))
            if price is None:
                price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
            if prev is None:
                prev = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))

            if price is None:
                return None

            change = price - prev if prev else None
            result = {
                "symbol": symbol,
                "name": info.get("shortName") or info.get("longName") or symbol,
                "sector": info.get("sector") or "N/A",
                "industry": info.get("industry") or "N/A",
                "price": round(price, 2),
                "change": round(change, 2) if change is not None else 0,
                "changePercent": round((change / prev) * 100, 2) if change is not None and prev else 0,
                "previousClose": _round_or_none(prev),
                "volume": _safe_int(_fast_info_value(fi, "last_volume") or info.get("volume") or info.get("regularMarketVolume")),
                "marketCap": _safe_int(_fast_info_value(fi, "market_cap") or info.get("marketCap")),
                "high52w": _round_or_none(info.get("fiftyTwoWeekHigh") or _fast_info_value(fi, "year_high")),
                "low52w": _round_or_none(info.get("fiftyTwoWeekLow") or _fast_info_value(fi, "year_low")),
                "pe_ratio": _round_or_none(info.get("trailingPE")),
                "forward_pe": _round_or_none(info.get("forwardPE")),
                "trailingPE": _round_or_none(info.get("trailingPE")),
                "forwardPE": _round_or_none(info.get("forwardPE")),
                "returnOnEquity": _round_or_none(info.get("returnOnEquity"), digits=4),
                "profitMargins": _round_or_none(info.get("profitMargins"), digits=4),
            }
            _cache_set(cache_key, result)
            return result
        except Exception as e:
            last_exc = e
            if _is_rate_limited(e):
                logger.warning("Rate limited on info for %s (attempt %d/3), waiting %ds", symbol, attempt + 1, delay)
                time.sleep(delay)
                delay *= 2
            else:
                break

    logger.exception("Failed to fetch ticker info for %s: %s", symbol, last_exc)
    return None


def get_ticker_fundamentals(symbol):
    """Return full fundamentals dict from yfinance .info — used by factor_model and /fundamentals endpoint."""
    symbol = symbol.upper()
    cache_key = f"fundamentals_{symbol}"

    cached = _cache_get(cache_key, ttl=900)
    if cached is not None:
        return cached

    delay = 2
    last_exc = None
    for attempt in range(3):
        try:
            ticker = _yf_ticker(symbol)
            info = ticker.info or {}

            try:
                fi = ticker.fast_info
                if fi.last_price:
                    info.setdefault("currentPrice", fi.last_price)
                    info.setdefault("previousClose", fi.previous_close)
            except Exception:
                pass

            _cache_set(cache_key, info)
            return info
        except Exception as e:
            last_exc = e
            if _is_rate_limited(e):
                logger.warning("Rate limited on fundamentals for %s (attempt %d/3), waiting %ds", symbol, attempt + 1, delay)
                time.sleep(delay)
                delay *= 2
            else:
                break

    logger.warning("Failed to fetch fundamentals for %s: %s", symbol, last_exc)
    return {}


def get_ticker_news(symbol):
    """Return list of recent news articles for a symbol."""
    symbol = symbol.upper()
    cache_key = f"news_{symbol}"

    cached = _cache_get(cache_key, ttl=600)
    if cached is not None:
        return cached

    try:
        raw = _yf_ticker(symbol).news or []
        articles = []
        for item in raw[:8]:
            try:
                articles.append({
                    "title": item.get("title", ""),
                    "publisher": item.get("publisher", ""),
                    "link": item.get("link", ""),
                    "published": item.get("providerPublishTime", 0),
                })
            except Exception:
                continue
        _cache_set(cache_key, articles)
        return articles
    except Exception:
        logger.exception("Failed to fetch news for %s", symbol)
        return []


def search_stocks(query):
    """Search stocks by query string using yfinance Search."""
    try:
        search = yf.Search(query, max_results=8)
        results = []
        if hasattr(search, "quotes"):
            for q in search.quotes:
                sym = q.get("symbol")
                if sym:
                    results.append({
                        "symbol": sym,
                        "name": q.get("shortname") or q.get("longname") or sym,
                        "exchange": q.get("exchange", ""),
                    })
        return results
    except Exception as e:
        if _is_rate_limited(e):
            logger.warning("Rate limited on search, retrying after 2s")
            time.sleep(2)
            try:
                search = yf.Search(query, max_results=8)
                results = []
                if hasattr(search, "quotes"):
                    for q in search.quotes:
                        sym = q.get("symbol")
                        if sym:
                            results.append({
                                "symbol": sym,
                                "name": q.get("shortname") or q.get("longname") or sym,
                                "exchange": q.get("exchange", ""),
                            })
                return results
            except Exception:
                pass
        logger.exception("Failed to search for '%s'", query)
        return []
