/**
 * Macropulse Trading Journal (US-G)
 * Loads trades, renders a P&L-colored table, computes summary stats,
 * and handles create / close / delete via the journal API.
 */

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    els.tbody = document.getElementById("journal-tbody");
    els.tableWrap = document.getElementById("journal-table-wrapper");
    els.empty = document.getElementById("journal-empty");
    els.error = document.getElementById("journal-error");
    els.errorMsg = document.getElementById("journal-error-msg");
    els.form = document.getElementById("trade-form");
    els.formError = document.getElementById("form-error");
    els.toggleBtn = document.getElementById("toggle-form-btn");

    els.toggleBtn.addEventListener("click", () => {
        const showing = els.form.style.display !== "none";
        els.form.style.display = showing ? "none" : "block";
    });

    // Default the entry-date picker to today.
    document.getElementById("f-entry-date").value = new Date().toISOString().slice(0, 10);

    els.form.addEventListener("submit", onSubmit);

    loadJournal();
});

function fmtMoney(n) {
    if (n === null || n === undefined) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pnlClass(n) {
    if (n === null || n === undefined) return "";
    if (n > 0) return "pnl-positive";
    if (n < 0) return "pnl-negative";
    return "";
}

async function loadJournal() {
    els.error.style.display = "none";
    try {
        const data = await getJournal();
        const trades = data.trades || [];
        renderStats(trades);
        renderTable(trades);
    } catch (err) {
        els.tableWrap.style.display = "none";
        els.empty.style.display = "none";
        els.errorMsg.textContent = err.message || "Failed to load journal.";
        els.error.style.display = "block";
    }
}

function renderStats(trades) {
    document.getElementById("stat-total").textContent = trades.length;

    const closed = trades.filter((t) => t.status === "closed" && t.pnl !== null);
    const wins = closed.filter((t) => t.pnl > 0).length;
    const winRate = closed.length ? `${Math.round((wins / closed.length) * 100)}%` : "—";
    document.getElementById("stat-winrate").textContent = winRate;

    const withPnl = trades.filter((t) => t.pnl !== null && t.pnl !== undefined);
    const totalPnl = withPnl.reduce((sum, t) => sum + t.pnl, 0);
    const pnlEl = document.getElementById("stat-pnl");
    pnlEl.textContent = withPnl.length ? fmtMoney(totalPnl) : "—";
    pnlEl.className = "metric-value " + pnlClass(withPnl.length ? totalPnl : null);

    const bestWorstEl = document.getElementById("stat-bestworst");
    if (withPnl.length) {
        const best = withPnl.reduce((a, b) => (b.pnl > a.pnl ? b : a));
        const worst = withPnl.reduce((a, b) => (b.pnl < a.pnl ? b : a));
        bestWorstEl.textContent = `${best.symbol} ${fmtMoney(best.pnl)} / ${worst.symbol} ${fmtMoney(worst.pnl)}`;
    } else {
        bestWorstEl.textContent = "—";
    }
}

function renderTable(trades) {
    if (!trades.length) {
        els.tableWrap.style.display = "none";
        els.empty.style.display = "block";
        return;
    }
    els.empty.style.display = "none";
    els.tableWrap.style.display = "block";

    els.tbody.innerHTML = "";
    for (const t of trades) {
        const tr = document.createElement("tr");
        const exitOrCurrent = t.status === "open" ? t.current_price : t.exit_price;
        const pnlPct = t.pnl_percent === null || t.pnl_percent === undefined
            ? "—"
            : `${t.pnl_percent.toFixed(2)}%`;

        tr.innerHTML = `
            <td><strong>${t.symbol}</strong></td>
            <td>${t.trade_type}</td>
            <td>${t.entry_date}</td>
            <td>$${t.entry_price.toFixed(2)}</td>
            <td>${t.shares}</td>
            <td>${exitOrCurrent === null || exitOrCurrent === undefined ? "—" : "$" + exitOrCurrent.toFixed(2)}</td>
            <td class="${pnlClass(t.pnl)}">${fmtMoney(t.pnl)}</td>
            <td class="${pnlClass(t.pnl)}">${pnlPct}</td>
            <td>${t.status === "open" ? '<span class="badge-open">OPEN</span>' : "Closed"}</td>
            <td>${t.notes ? escapeHtml(t.notes) : ""}</td>
            <td></td>
        `;

        const actions = tr.lastElementChild;
        if (t.status === "open") {
            const closeBtn = document.createElement("button");
            closeBtn.className = "btn btn-secondary btn-sm";
            closeBtn.textContent = "Close";
            closeBtn.addEventListener("click", () => onClose(t));
            actions.appendChild(closeBtn);
        }
        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-danger btn-sm";
        delBtn.textContent = "Delete";
        delBtn.style.marginLeft = "0.4rem";
        delBtn.addEventListener("click", () => onDelete(t));
        actions.appendChild(delBtn);

        els.tbody.appendChild(tr);
    }
}

async function onSubmit(e) {
    e.preventDefault();
    els.formError.textContent = "";

    const trade = {
        symbol: document.getElementById("f-symbol").value.trim().toUpperCase(),
        trade_type: document.getElementById("f-type").value,
        entry_date: document.getElementById("f-entry-date").value,
        entry_price: parseFloat(document.getElementById("f-entry-price").value),
        shares: parseFloat(document.getElementById("f-shares").value),
        notes: document.getElementById("f-notes").value.trim(),
    };

    if (!trade.symbol || !trade.entry_date || !(trade.entry_price > 0) || !(trade.shares > 0)) {
        els.formError.textContent = "Fill in all required fields with positive numbers.";
        return;
    }

    try {
        await addJournalTrade(trade);
        els.form.reset();
        document.getElementById("f-entry-date").value = new Date().toISOString().slice(0, 10);
        els.form.style.display = "none";
        loadJournal();
    } catch (err) {
        els.formError.textContent = err.message || "Failed to save trade.";
    }
}

async function onClose(trade) {
    const input = prompt(`Close ${trade.symbol} — enter exit price:`);
    if (input === null) return;
    const exitPrice = parseFloat(input);
    if (!(exitPrice > 0)) {
        alert("Exit price must be a positive number.");
        return;
    }
    try {
        await updateJournalTrade(trade.id, { exit_price: exitPrice });
        loadJournal();
    } catch (err) {
        alert(err.message || "Failed to close trade.");
    }
}

async function onDelete(trade) {
    if (!confirm(`Delete ${trade.symbol} trade? This cannot be undone.`)) return;
    try {
        await deleteJournalTrade(trade.id);
        loadJournal();
    } catch (err) {
        alert(err.message || "Failed to delete trade.");
    }
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
