# Mubashir - US-E: Backtest route.

from flask import Blueprint, jsonify, request
from services.backtest_engine import run_backtest
from services.limiter import limiter

backtest_bp = Blueprint("backtest", __name__)

_VALID_PERIODS = {"1y", "2y"}


@backtest_bp.route("/stock/<symbol>/backtest")
@limiter.limit("5 per minute")
def backtest(symbol):
    symbol = symbol.upper().strip()
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    period = request.args.get("period", "2y")
    if period not in _VALID_PERIODS:
        return jsonify({"error": f"period must be one of {sorted(_VALID_PERIODS)}"}), 400

    result = run_backtest(symbol, period=period)

    if result is None:
        return jsonify({"error": f"Could not run backtest for {symbol}"}), 500

    if result.get("insufficient_data"):
        return jsonify({"symbol": symbol, "insufficient_data": True}), 200

    if result.get("error"):
        return jsonify({"error": result["error"]}), 502

    return jsonify(result), 200
