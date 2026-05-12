// Mubashir - US-C: Stock screener logic — fetch signals, render sortable table with filter pills

let _screenerData = [];
let _sortCol = "confidence";
let _sortDir = -1; // -1 = descending
let _activeFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("run-screener-btn").addEventListener("click", runScreener);

    document.querySelectorAll(".screener-filter").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".screener-filter").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            _activeFilter = btn.dataset.filter;
            renderTable();
        });
    });

    document.querySelectorAll(".sortable").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (_sortCol === col) {
                _sortDir *= -1;
            } else {
                _sortCol = col;
                _sortDir = -1;
            }
            renderTable();
        });
    });

    // Show empty state on load
    document.getElementById("screener-empty").style.display = "block";
});

async function runScreener() {
    const btn = document.getElementById("run-screener-btn");
    const progress = document.getElementById("screener-progress");
    const progressBar = document.getElementById("screener-progress-bar");
    const progressText = document.getElementById("screener-progress-text");
    const errorEl = document.getElementById("screener-error");
    const emptyEl = document.getElementById("screener-empty");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning...`;
    progress.style.display = "flex";
    errorEl.style.display = "none";
    emptyEl.style.display = "none";
    document.getElementById("screener-table-wrapper").style.display = "none";

    // Animate progress bar while waiting
    let pct = 0;
    const ticker = setInterval(() => {
        pct = Math.min(pct + 2, 90);
        progressBar.style.width = `${pct}%`;
        progressText.textContent = `Scanning stocks... ${pct}%`;
    }, 300);

    try {
        const data = await getScreener();
        clearInterval(ticker);
        progressBar.style.width = "100%";
        progressText.textContent = "Done!";

        setTimeout(() => { progress.style.display = "none"; }, 600);

        _screenerData = data.results || [];
        renderTable();

        document.getElementById("screener-table-wrapper").style.display = "block";
    } catch (err) {
        clearInterval(ticker);
        progress.style.display = "none";
        errorEl.style.display = "block";
        document.getElementById("screener-error-msg").textContent =
            `Failed to run screener: ${err.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i> Refresh`;
    }
}

function renderTable() {
    const tbody = document.getElementById("screener-tbody");
    const countEl = document.getElementById("screener-count");

    let rows = _screenerData.filter(r =>
        _activeFilter === "all" || r.signal === _activeFilter
    );

    // Sort
    rows.sort((a, b) => {
        let av = a[_sortCol], bv = b[_sortCol];
        if (typeof av === "string") av = av.toLowerCase();
        if (typeof bv === "string") bv = bv.toLowerCase();
        if (av == null) return 1;
        if (bv == null) return -1;
        return av < bv ? _sortDir : av > bv ? -_sortDir : 0;
    });

    countEl.textContent = `${rows.length} result${rows.length !== 1 ? "s" : ""}`;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted)">No results for this filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const sig = (r.signal || "HOLD").toLowerCase();
        const chgClass = r.change >= 0 ? "positive" : "negative";
        const chgSign = r.change >= 0 ? "+" : "";
        const bd = r.breakdown || {};

        const stratBadge = (key) => {
            const s = bd[key];
            if (!s) return `<span class="signal-badge-sm hold">N/A</span>`;
            const sl = (s.signal || "hold").toLowerCase();
            return `<span class="signal-badge-sm ${sl}">${s.signal}</span>`;
        };

        return `
            <tr class="screener-row" data-symbol="${r.symbol}" style="cursor:pointer">
                <td><strong>${r.symbol}</strong></td>
                <td>${r.price != null ? "$" + r.price.toFixed(2) : "N/A"}</td>
                <td class="${chgClass}">${r.change != null ? chgSign + r.change.toFixed(2) + " (" + chgSign + (r.changePercent || 0).toFixed(2) + "%)" : "N/A"}</td>
                <td><span class="signal-badge-sm ${sig}">${r.signal}</span></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px">
                        <div class="confidence-bar" style="width:60px; height:6px">
                            <div class="confidence-fill ${sig}" style="width:${r.confidence}%; height:100%"></div>
                        </div>
                        ${r.confidence}%
                    </div>
                </td>
                <td>${stratBadge("momentum")}</td>
                <td>${stratBadge("mean_reversion")}</td>
                <td>${stratBadge("monte_carlo")}</td>
                <td>${stratBadge("factor_model")}</td>
            </tr>
        `;
    }).join("");

    // Click row → stock detail page
    tbody.querySelectorAll(".screener-row").forEach(row => {
        row.addEventListener("click", () => {
            window.location.href = `stock.html?symbol=${row.dataset.symbol}`;
        });
    });
}
