import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify

security_bp = Blueprint("security", __name__)

MARKET_DATA_PROVIDERS = [
    {
        "id": "yahoo_finance",
        "name": "Yahoo Finance",
        "env": None,
        "status": "no_key_needed",
    },
    {
        "id": "alpha_vantage",
        "name": "Alpha Vantage",
        "env": "ALPHA_VANTAGE_API_KEY",
    },
    {
        "id": "polygon",
        "name": "Polygon.io",
        "env": "POLYGON_API_KEY",
    },
    {
        "id": "finnhub",
        "name": "Finnhub",
        "env": "FINNHUB_API_KEY",
    },
]


def _provider_status(provider):
    if provider.get("status") == "no_key_needed":
        return "no_key_needed"

    env_name = provider.get("env")
    return "configured" if env_name and os.environ.get(env_name) else "missing"


@security_bp.route("/security/config", methods=["GET"])
def security_config():
    providers = [
        {
            "id": provider["id"],
            "name": provider["name"],
            "status": _provider_status(provider),
        }
        for provider in MARKET_DATA_PROVIDERS
    ]

    return jsonify({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "providers": providers,
    }), 200
