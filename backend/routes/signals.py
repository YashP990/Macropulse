# Mubashir - US-F: Added optional strategy weight overrides via query params.

from flask import Blueprint, jsonify, request
from strategies.signal_aggregator import get_aggregated_signal
from strategies.config import STRATEGY_WEIGHTS
from services.signal_history import record_signal

signals_bp = Blueprint("signals", __name__)

_WEIGHT_KEYS = list(STRATEGY_WEIGHTS.keys())


@signals_bp.route("/signals/<symbol>")
def signals(symbol):
    symbol = symbol.upper()

    # Parse optional per-strategy weight overrides (?w_momentum=0.5 etc.)
    weights = None
    raw = {k: request.args.get(f"w_{k}") for k in _WEIGHT_KEYS}
    if any(v is not None for v in raw.values()):
        try:
            weights = {}
            for k in _WEIGHT_KEYS:
                val = raw[k]
                if val is not None:
                    f = float(val)
                    if not 0.0 <= f <= 1.0:
                        return jsonify({"error": f"Weight w_{k} must be between 0 and 1"}), 400
                    weights[k] = f
                else:
                    weights[k] = STRATEGY_WEIGHTS[k]
        except ValueError:
            return jsonify({"error": "Invalid weight value — must be a number between 0 and 1"}), 400

    result = get_aggregated_signal(symbol, weights=weights)

    if result is None:
        return jsonify({"error": f"Could not generate signals for '{symbol}'"}), 404

    # Person 3 - US16: Record signal in history each time it is fetched
    record_signal(symbol, result)

    result["symbol"] = symbol
    return jsonify(result), 200
