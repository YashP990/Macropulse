# Mubashir - US-G: Trading journal route.
# CRUD over journal_trades with server-side P&L. Open positions (no exit_price)
# get an unrealized P&L computed from the live price; closed positions get a
# realized P&L. Deletes are soft (deleted=1) so history is never destroyed.

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from services.db import get_db
from services.data_fetcher import get_ticker_info_raw
from services.limiter import limiter

journal_bp = Blueprint("journal", __name__)

_VALID_TYPES = {"BUY", "SELL"}


def _compute_pnl(trade_type, entry_price, shares, close_price):
    """P&L for a BUY (long) or SELL (short) at a given close price."""
    if close_price is None:
        return None
    if trade_type == "SELL":
        return round((entry_price - close_price) * shares, 2)
    return round((close_price - entry_price) * shares, 2)


def _serialize(row):
    """Turn a journal_trades row into an API dict with computed P&L."""
    trade = dict(row)
    is_open = trade.get("exit_price") is None

    current_price = None
    if is_open:
        # Open position: value it at the live price for an unrealized P&L.
        info = get_ticker_info_raw(trade["symbol"])
        current_price = info["price"] if info else None
        close_price = current_price
    else:
        close_price = trade["exit_price"]

    pnl = _compute_pnl(
        trade["trade_type"], trade["entry_price"], trade["shares"], close_price
    )
    cost_basis = trade["entry_price"] * trade["shares"]

    trade["status"] = "open" if is_open else "closed"
    trade["current_price"] = current_price
    trade["pnl"] = pnl
    trade["pnl_percent"] = (
        round((pnl / cost_basis) * 100, 2) if pnl is not None and cost_basis else None
    )
    trade.pop("deleted", None)
    return trade


@journal_bp.route("/journal", methods=["GET"])
def list_trades():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM journal_trades WHERE deleted = 0 ORDER BY entry_date DESC, id DESC"
    ).fetchall()
    conn.close()
    return jsonify({"trades": [_serialize(r) for r in rows]}), 200


@journal_bp.route("/journal", methods=["POST"])
@limiter.limit("30 per minute")
def create_trade():
    data = request.get_json(silent=True) or {}

    symbol = str(data.get("symbol", "")).upper().strip()
    trade_type = str(data.get("trade_type", "")).upper().strip()
    entry_date = str(data.get("entry_date", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400
    if trade_type not in _VALID_TYPES:
        return jsonify({"error": "trade_type must be BUY or SELL"}), 400
    if not entry_date:
        return jsonify({"error": "entry_date is required"}), 400

    try:
        entry_price = float(data["entry_price"])
        shares = float(data["shares"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "entry_price and shares must be numbers"}), 400
    if entry_price <= 0 or shares <= 0:
        return jsonify({"error": "entry_price and shares must be positive"}), 400

    conn = get_db()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO journal_trades
                (symbol, trade_type, entry_date, entry_price, shares, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                symbol,
                trade_type,
                entry_date,
                entry_price,
                shares,
                notes,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        new_id = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM journal_trades WHERE id = ?", (new_id,)
        ).fetchone()
    conn.close()
    return jsonify(_serialize(row)), 201


@journal_bp.route("/journal/<int:trade_id>", methods=["PUT"])
def close_trade(trade_id):
    """Close an open position by recording exit_price and exit_date."""
    data = request.get_json(silent=True) or {}

    try:
        exit_price = float(data["exit_price"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "exit_price must be a number"}), 400
    if exit_price <= 0:
        return jsonify({"error": "exit_price must be positive"}), 400

    exit_date = str(data.get("exit_date", "")).strip() or datetime.now(
        timezone.utc
    ).date().isoformat()

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM journal_trades WHERE id = ? AND deleted = 0", (trade_id,)
    ).fetchone()
    if existing is None:
        conn.close()
        return jsonify({"error": "Trade not found"}), 404

    with conn:
        conn.execute(
            "UPDATE journal_trades SET exit_price = ?, exit_date = ? WHERE id = ?",
            (exit_price, exit_date, trade_id),
        )
        row = conn.execute(
            "SELECT * FROM journal_trades WHERE id = ?", (trade_id,)
        ).fetchone()
    conn.close()
    return jsonify(_serialize(row)), 200


@journal_bp.route("/journal/<int:trade_id>", methods=["DELETE"])
def delete_trade(trade_id):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM journal_trades WHERE id = ? AND deleted = 0", (trade_id,)
    ).fetchone()
    if existing is None:
        conn.close()
        return jsonify({"error": "Trade not found"}), 404

    with conn:
        conn.execute(
            "UPDATE journal_trades SET deleted = 1 WHERE id = ?", (trade_id,)
        )
    conn.close()
    return jsonify({"status": "deleted", "id": trade_id}), 200
