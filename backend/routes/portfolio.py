# Mubashir - US-J: Portfolio overview.
# Aggregates all OPEN journal positions (exit_price IS NULL) by symbol, valuing
# each at the live price to produce per-symbol cost basis, market value,
# unrealized P&L and allocation %, plus portfolio totals. Read-only; reuses the
# journal_trades table and get_ticker_info_raw, so no new dependencies.

from flask import Blueprint, jsonify

from services.db import get_db
from services.data_fetcher import get_ticker_info_raw

portfolio_bp = Blueprint("portfolio", __name__)


def _unrealized_pnl(trade_type, entry_price, shares, price):
    if price is None:
        return None
    if trade_type == "SELL":
        return (entry_price - price) * shares
    return (price - entry_price) * shares


@portfolio_bp.route("/portfolio")
def portfolio():
    conn = get_db()
    rows = conn.execute(
        "SELECT symbol, trade_type, entry_price, shares "
        "FROM journal_trades WHERE deleted = 0 AND exit_price IS NULL"
    ).fetchall()
    conn.close()

    positions = {}
    price_cache = {}

    for r in rows:
        symbol = r["symbol"]
        if symbol not in price_cache:
            info = get_ticker_info_raw(symbol)
            price_cache[symbol] = info["price"] if info else None
        price = price_cache[symbol]

        shares = r["shares"]
        entry = r["entry_price"]
        cost = entry * shares
        market = price * shares if price is not None else 0.0
        pnl = _unrealized_pnl(r["trade_type"], entry, shares, price)

        pos = positions.setdefault(symbol, {
            "symbol": symbol,
            "shares": 0.0,
            "cost_basis": 0.0,
            "market_value": 0.0,
            "unrealized_pnl": 0.0,
            "current_price": price,
            "priced": price is not None,
        })
        pos["shares"] += shares
        pos["cost_basis"] += cost
        pos["market_value"] += market
        if pnl is not None:
            pos["unrealized_pnl"] += pnl
        if price is None:
            pos["priced"] = False

    total_cost = total_market = total_pnl = 0.0
    for pos in positions.values():
        total_cost += pos["cost_basis"]
        total_market += pos["market_value"]
        total_pnl += pos["unrealized_pnl"]

    position_list = []
    for pos in positions.values():
        pos["avg_entry"] = round(pos["cost_basis"] / pos["shares"], 2) if pos["shares"] else 0.0
        pos["allocation"] = (
            round((pos["market_value"] / total_market) * 100, 2) if total_market else 0.0
        )
        pos["cost_basis"] = round(pos["cost_basis"], 2)
        pos["market_value"] = round(pos["market_value"], 2)
        pos["unrealized_pnl"] = round(pos["unrealized_pnl"], 2)
        position_list.append(pos)

    position_list.sort(key=lambda p: p["market_value"], reverse=True)

    totals = {
        "cost_basis": round(total_cost, 2),
        "market_value": round(total_market, 2),
        "unrealized_pnl": round(total_pnl, 2),
        "unrealized_pnl_percent": (
            round((total_pnl / total_cost) * 100, 2) if total_cost else None
        ),
        "position_count": len(position_list),
    }

    return jsonify({"positions": position_list, "totals": totals}), 200
