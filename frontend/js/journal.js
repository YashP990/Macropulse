/**
 * Macropulse Trading Journal (US-G)
 * Loads trades, renders a P&L-colored table, computes summary stats,
 * and handles create / close / delete via the journal API.
 *
 * US-H: CSV export of the visible trades.
 * US-I: filter (all/open/closed), symbol search, and sortable columns.
 */

const JOURNAL_TAGS_KEY = "macropulseJournalTags";
const els = {};
let allTrades = [];
const state = { filter: "all", search: "", tag: "", sortCol: null, sortDir: 1 };

document.addEventListener("DOMContentLoaded", () => {
    els.tbody = document.getElementById("journal-tbody");
    els.tableWrap = document.getElementById("journal-table-wrapper");
    els.controls = document.getElementById("journal-controls");
    els.count = document.getElementById("journal-count");
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

    // US-I: filter pills
    document.querySelectorAll("#journal-controls .screener-filter").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#journal-controls .screener-filter")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            state.filter = btn.dataset.filter;
            renderTable();
        });
    });

    // US-I: symbol search
    document.getElementById("journal-search").addEventListener("input", (e) => {
        state.search = e.target.value.trim().toUpperCase();
        renderTable();
    });

    document.getElementById("journal-tag-filter").addEventListener("input", (e) => {
        state.tag = normalizeTag(e.target.value);
        renderTable();
    });

    // US-I: sortable headers
    document.querySelectorAll("#journal-table th.sortable").forEach((th) => {
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            state.sortDir = state.sortCol === col ? -state.sortDir : 1;
            state.sortCol = col;
            renderTable();
        });
    });

    // US-H: CSV export
    document.getElementById("export-csv-btn").addEventListener("click", exportCsv);

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
        allTrades = data.trades || [];
        renderStats(allTrades);
        renderTable();
    } catch (err) {
        els.tableWrap.style.display = "none";
        els.controls.style.display = "none";
        els.empty.style.display = "none";
        els.errorMsg.textContent = err.message || "Failed to load journal.";
        els.error.style.display = "block";
    }
}

/** US-I: apply filter + search + sort to produce the rows to render. */
function getVisibleTrades() {
    let rows = allTrades.slice();

    if (state.filter !== "all") {
        rows = rows.filter((t) => t.status === state.filter);
    }
    if (state.search) {
        rows = rows.filter((t) => {
            const tags = getTradeTags(t).join(" ").toUpperCase();
            return t.symbol.includes(state.search) || tags.includes(state.search);
        });
    }
    if (state.tag) {
        rows = rows.filter((t) => getTradeTags(t).some((tag) => tag.includes(state.tag)));
    }
    if (state.sortCol) {
        const col = state.sortCol;
        rows.sort((a, b) => {
            let av = a[col];
            let bv = b[col];
            // Nulls (e.g. open-position P&L with no price) sort last.
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            if (typeof av === "string") {
                return av.localeCompare(bv) * state.sortDir;
            }
            return (av - bv) * state.sortDir;
        });
    }
    return rows;
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

function renderTable() {
    if (!allTrades.length) {
        els.tableWrap.style.display = "none";
        els.controls.style.display = "none";
        els.empty.style.display = "block";
        return;
    }
    els.empty.style.display = "none";
    els.controls.style.display = "flex";

    const trades = getVisibleTrades();
    els.count.textContent = `${trades.length} of ${allTrades.length}`;
    els.tableWrap.style.display = trades.length ? "block" : "none";

    els.tbody.innerHTML = "";
    for (const t of trades) {
        const tr = document.createElement("tr");
        const exitOrCurrent = t.status === "open" ? t.current_price : t.exit_price;
        const pnlPct = t.pnl_percent === null || t.pnl_percent === undefined
            ? "—"
            : `${t.pnl_percent.toFixed(2)}%`;
        const tagHtml = renderTagChips(getTradeTags(t));

        tr.innerHTML = `
            <td><a href="stock.html?symbol=${encodeURIComponent(t.symbol)}"><strong>${t.symbol}</strong></a></td>
            <td>${t.trade_type}</td>
            <td>${t.entry_date}</td>
            <td>$${t.entry_price.toFixed(2)}</td>
            <td>${t.shares}</td>
            <td>${exitOrCurrent === null || exitOrCurrent === undefined ? "—" : "$" + exitOrCurrent.toFixed(2)}</td>
            <td class="${pnlClass(t.pnl)}">${fmtMoney(t.pnl)}</td>
            <td class="${pnlClass(t.pnl)}">${pnlPct}</td>
            <td>${t.status === "open" ? '<span class="badge-open">OPEN</span>' : "Closed"}</td>
            <td>${tagHtml}</td>
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


function getJournalTagsMap() {
    try {
        const map = JSON.parse(localStorage.getItem(JOURNAL_TAGS_KEY) || "{}");
        return map && typeof map === "object" && !Array.isArray(map) ? map : {};
    } catch {
        return {};
    }
}

function saveJournalTagsMap(map) {
    localStorage.setItem(JOURNAL_TAGS_KEY, JSON.stringify(map));
}

function normalizeTag(tag) {
    return String(tag || "")
        .trim()
        .toLowerCase()
        .replace(/^#/, "")
        .replace(/[^a-z0-9_-]/g, "");
}

function parseTags(value) {
    return String(value || "")
        .split(",")
        .map(normalizeTag)
        .filter((tag, index, arr) => tag && arr.indexOf(tag) === index)
        .slice(0, 6);
}

function getTradeTags(trade) {
    if (Array.isArray(trade.tags)) return trade.tags.map(normalizeTag).filter(Boolean);
    const map = getJournalTagsMap();
    const tags = map[String(trade.id)] || [];
    return Array.isArray(tags) ? tags.map(normalizeTag).filter(Boolean) : [];
}

function saveTradeTags(tradeId, tags) {
    if (!tradeId) return;
    const map = getJournalTagsMap();
    if (tags.length) {
        map[String(tradeId)] = tags;
    } else {
        delete map[String(tradeId)];
    }
    saveJournalTagsMap(map);
}

function removeTradeTags(tradeId) {
    const map = getJournalTagsMap();
    delete map[String(tradeId)];
    saveJournalTagsMap(map);
}

function renderTagChips(tags) {
    if (!tags.length) return "";
    return tags
        .map((tag) => `<span class="journal-tag">#${escapeHtml(tag)}</span>`)
        .join("");
}
/** US-H: download the currently visible trades as a CSV file. */
function exportCsv() {
    const trades = getVisibleTrades();
    if (!trades.length) {
        alert("No trades to export.");
        return;
    }

    const cols = [
        "symbol", "trade_type", "entry_date", "entry_price", "shares",
        "exit_date", "exit_price", "current_price", "pnl", "pnl_percent",
        "status", "tags", "notes",
    ];
    const header = cols.join(",");
    const lines = trades.map((t) =>
        cols.map((c) => csvCell(c === "tags" ? getTradeTags(t).join("; ") : t[c])).join(",")
    );
    const csv = [header, ...lines].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `macropulse-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Quote fields containing commas, quotes, or newlines; escape inner quotes.
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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
    const tags = parseTags(document.getElementById("f-tags").value);

    if (!trade.symbol || !trade.entry_date || !(trade.entry_price > 0) || !(trade.shares > 0)) {
        els.formError.textContent = "Fill in all required fields with positive numbers.";
        return;
    }

    try {
        const savedTrade = await addJournalTrade(trade);
        saveTradeTags(savedTrade.id, tags);
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
        removeTradeTags(trade.id);
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


