/**
 * Macropulse Portfolio Overview (US-J)
 * Loads aggregated open positions from the portfolio API and renders
 * portfolio totals plus a per-symbol allocation table.
 */

const pels = {};

document.addEventListener("DOMContentLoaded", () => {
    pels.tbody = document.getElementById("portfolio-tbody");
    pels.tableWrap = document.getElementById("portfolio-table-wrapper");
    pels.empty = document.getElementById("portfolio-empty");
    pels.error = document.getElementById("portfolio-error");
    pels.errorMsg = document.getElementById("portfolio-error-msg");
    loadPortfolio();
});

function pfMoney(n) {
    if (n === null || n === undefined) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pfPnlClass(n) {
    if (n === null || n === undefined) return "";
    if (n > 0) return "pnl-positive";
    if (n < 0) return "pnl-negative";
    return "";
}

async function loadPortfolio() {
    pels.error.style.display = "none";
    try {
        const data = await getPortfolio();
        renderTotals(data.totals || {});
        renderPositions(data.positions || []);
    } catch (err) {
        pels.tableWrap.style.display = "none";
        pels.empty.style.display = "none";
        pels.errorMsg.textContent = err.message || "Failed to load portfolio.";
        pels.error.style.display = "block";
    }
}

function renderTotals(totals) {
    document.getElementById("tot-count").textContent = totals.position_count || 0;
    document.getElementById("tot-cost").textContent = pfMoney(totals.cost_basis);
    document.getElementById("tot-market").textContent = pfMoney(totals.market_value);

    const pnlEl = document.getElementById("tot-pnl");
    const pnl = totals.unrealized_pnl;
    const pct = totals.unrealized_pnl_percent;
    pnlEl.textContent =
        pnl === null || pnl === undefined
            ? "—"
            : `${pfMoney(pnl)}${pct === null || pct === undefined ? "" : ` (${pct.toFixed(2)}%)`}`;
    pnlEl.className = "metric-value " + pfPnlClass(pnl);
}

function renderPositions(positions) {
    if (!positions.length) {
        pels.tableWrap.style.display = "none";
        pels.empty.style.display = "block";
        return;
    }
    pels.empty.style.display = "none";
    pels.tableWrap.style.display = "block";

    pels.tbody.innerHTML = "";
    for (const p of positions) {
        const tr = document.createElement("tr");
        const current = p.priced ? "$" + p.current_price.toFixed(2) : "—";
        tr.innerHTML = `
            <td><a href="stock.html?symbol=${encodeURIComponent(p.symbol)}"><strong>${p.symbol}</strong></a></td>
            <td>${p.shares}</td>
            <td>$${p.avg_entry.toFixed(2)}</td>
            <td>${current}</td>
            <td>${pfMoney(p.cost_basis)}</td>
            <td>${p.priced ? pfMoney(p.market_value) : "—"}</td>
            <td class="${pfPnlClass(p.unrealized_pnl)}">${p.priced ? pfMoney(p.unrealized_pnl) : "—"}</td>
            <td>${p.priced ? p.allocation.toFixed(2) + "%" : "—"}</td>
        `;
        pels.tbody.appendChild(tr);
    }
}
