/**
 * Macropulse - Stock Page Logic
 * Loads stock info, signals, and chart for the given symbol.
 */

let currentSymbol = null;
/* Yash Patel, 05/04/2026
constant key name for storing saved stocks data */
const SAVED_STOCKS_KEY = "macropulseSavedStocks";

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const preferences = typeof getPreferences === "function" ? getPreferences() : {};
    currentSymbol = params.get("symbol") || preferences.defaultStockSymbol;

    if (!currentSymbol) {
        showError("No stock symbol provided.");
        return;
    }
/* Yash Patel, 04/17/2026
call new function with save button*/

    document.title = `${currentSymbol.toUpperCase()} - Macropulse`;
    initSaveButton();
    initChartControls(preferences.preferredChartRange || "1y");
    initChartExport();
    loadStockPage(currentSymbol, preferences.preferredChartRange || "1y");
});

async function loadStockPage(symbol, defaultPeriod = "1y") {
    try {
        // Load stock info first
        const stockData = await getStock(symbol);
        renderStockHero(stockData);

        // Show content, hide loading
        document.getElementById("page-loading").style.display = "none";
        document.getElementById("stock-content").style.display = "block";

        // Load signals, chart, history, fundamentals, and news in parallel
        loadSignals(symbol);
        loadChart(symbol, defaultPeriod);
        loadSignalHistory(symbol);
        loadFundamentals(symbol);
        loadNews(symbol);
    } catch (err) {
        showError(err.message || `Could not find stock "${symbol}".`);
    }
}

/* Anurag Ravi, 04/23/2026
Skeleton loader functions for the metrics and strategy sections */
function showMetricsSkeleton() {
    const grid = document.getElementById("metrics-grid");
    if (!grid) return;
    grid.innerHTML = Array(6).fill(`
        <div class="metric-item">
            <div class="skeleton skeleton-label"></div>
            <div class="skeleton skeleton-value"></div>
        </div>
    `).join("");
}

function showStrategySkeleton() {
    const grid = document.getElementById("strategies-grid");
    if (!grid) return;
    grid.innerHTML = Array(4).fill(`
        <div class="strategy-card">
            <div class="skeleton skeleton-strategy-header"></div>
            <div class="skeleton skeleton-strategy-score"></div>
            <div class="skeleton skeleton-strategy-detail"></div>
        </div>
    `).join("");
}

function renderStockHero(data) {
    document.getElementById("stock-name").textContent = data.name;
    document.getElementById("stock-symbol").textContent = data.symbol;
    document.getElementById("stock-sector").textContent =
        data.sector && data.sector !== "N/A"
            ? `${data.sector} · ${data.industry || ""}`
            : "";
    document.getElementById("stock-price").textContent = `$${data.price.toFixed(2)}`;

    const changeEl = document.getElementById("stock-change");
    const isPositive = data.change >= 0;
    const sign = isPositive ? "+" : "";
    changeEl.textContent = `${sign}${data.change.toFixed(2)} (${sign}${data.changePercent.toFixed(2)}%)`;
    changeEl.className = `price-change ${isPositive ? "positive" : "negative"}`;
    changeEl.style.color = isPositive ? "var(--accent-green)" : "var(--accent-red)";

/* Yash Patel, 04/27/2026
Updates save button using current stock symbol*/

    // Key metrics
    renderMetrics(data);
    updateSaveButton(data.symbol);
}

function renderMetrics(data) {
    const grid = document.getElementById("metrics-grid");
    const metrics = [
        { label: "Market Cap", value: data.marketCap || "N/A" },
        { label: "Volume", value: data.volume ? formatNumber(data.volume) : "N/A" },
        { label: "52W High", value: data.high52w ? `$${data.high52w.toFixed(2)}` : "N/A" },
        { label: "52W Low", value: data.low52w ? `$${data.low52w.toFixed(2)}` : "N/A" },
        { label: "P/E Ratio", value: data.pe_ratio ? data.pe_ratio.toFixed(2) : "N/A" },
        { label: "Forward P/E", value: data.forward_pe ? data.forward_pe.toFixed(2) : "N/A" },
    ];

    grid.innerHTML = metrics
        .map(
            (m) => `
        <div class="metric-item">
            <div class="metric-label">${m.label}</div>
            <div class="metric-value">${m.value}</div>
        </div>
    `
        )
        .join("");
}

// ===== Signal Display =====

async function loadSignals(symbol) {
    const loadingEl = document.getElementById("signal-loading");
    const contentEl = document.getElementById("signal-content");

    try {
        const data = await getSignals(symbol);

        loadingEl.style.display = "none";
        contentEl.style.display = "block";

        // Main signal badge
        const badge = document.getElementById("signal-badge");
        const signalLower = data.signal.toLowerCase();
        badge.textContent = data.signal;
        badge.className = `signal-badge-lg ${signalLower}`;

        // Confidence bar
        const fill = document.getElementById("confidence-fill");
        fill.style.width = `${data.confidence}%`;
        fill.className = `confidence-fill ${signalLower}`;
        document.getElementById("confidence-value").textContent = `${data.confidence}%`;

        // Strategy breakdown
        renderStrategies(data.breakdown);
    } catch (err) {
        loadingEl.innerHTML = `<span style="color: var(--accent-red)">Could not load signals: ${err.message}</span>`;
    }
}

function renderStrategies(breakdown) {
    const grid = document.getElementById("strategies-grid");
    const strategyNames = {
        momentum: { label: "Momentum", icon: "fa-rocket" },
        mean_reversion: { label: "Mean Reversion", icon: "fa-arrows-left-right" },
        monte_carlo: { label: "Monte Carlo", icon: "fa-dice" },
        factor_model: { label: "Factor Model", icon: "fa-scale-balanced" },
    };

    let html = "";
    for (const [key, result] of Object.entries(breakdown)) {
        const meta = strategyNames[key] || { label: key, icon: "fa-chart-simple" };
        const signalLower = (result.signal || "hold").toLowerCase();
        const scoreDisplay = result.signal === "N/A" ? "N/A" : result.score.toFixed(2);

        html += `
            <div class="strategy-card">
                <div class="strategy-header">
                    <span class="strategy-name">
                        <i class="fa-solid ${meta.icon}" style="margin-right:6px; color:var(--accent-blue)"></i>
                        ${meta.label}
                    </span>
                    <span class="signal-badge-sm ${signalLower}">${result.signal}</span>
                </div>
                <div class="strategy-score">${scoreDisplay}</div>
                <div class="strategy-details">${result.details}</div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

// ===== Chart =====

async function loadChart(symbol, period) {
    /* Anurag Ravi, 04/23/2026
    Show loading overlay while chart data is being fetched */
    showChartLoading("price-chart");
    setExportButtonState(false);

    try {
        const data = await getStockHistory(symbol, period);
        if (data && data.history && data.history.length > 0) {
            renderPriceChart("price-chart", data.history);
            setExportButtonState(true);
        } else {
            hideChartLoading("price-chart");
            setExportButtonState(false);
        }
    } catch (err) {
        hideChartLoading("price-chart");
        setExportButtonState(false);
        console.error("Chart load failed:", err);
    }
}

function initChartControls(defaultPeriod = "1y") {
    const buttons = document.querySelectorAll(".chart-btn[data-period]");
    buttons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-period") === defaultPeriod);
    });

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const period = btn.getAttribute("data-period");
            if (currentSymbol) loadChart(currentSymbol, period);
        });
    });
}

function initChartExport() {
    const exportButton = document.getElementById("export-chart-btn");
    if (!exportButton) return;

    exportButton.addEventListener("click", () => {
        if (typeof window.exportChartDataAsCSV === "function") {
            window.exportChartDataAsCSV();
        }
    });
}

function setExportButtonState(enabled) {
    const exportButton = document.getElementById("export-chart-btn");
    if (!exportButton) return;

    exportButton.disabled = !enabled;
}

/* Yash Patel, 04/17/2026
Initializes save button, stores unique stocks, and updates button state based on saved list*/
function initSaveButton() {
    const saveButton = document.getElementById("save-stock-btn");
    if (!saveButton) return;

    saveButton.addEventListener("click", () => {
        if (!currentSymbol) return;

        const normalizedSymbol = currentSymbol.toUpperCase();
        const savedStocks = getStoredSavedStocks();

/* Yash Patel, 05/04/2026
Checks if stocks exists and updats localStorage accordingly*/
        if (savedStocks.includes(normalizedSymbol)) {
            const updatedStocks = savedStocks.filter((symbol) => symbol !== normalizedSymbol);
            localStorage.setItem(SAVED_STOCKS_KEY, JSON.stringify(updatedStocks));
        } else {
            savedStocks.push(normalizedSymbol);
            localStorage.setItem(SAVED_STOCKS_KEY, JSON.stringify(savedStocks));
        }

        updateSaveButton(normalizedSymbol);
    });
/* Yash Patel, 05/04/2026
Changes button text to “Unsave” on hover, reverts to “Saved” when mouse doesn't hover*/
}

function getStoredSavedStocks() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_STOCKS_KEY) || "[]");
        if (!Array.isArray(saved)) return [];

        return saved
            .map((symbol) => String(symbol || "").trim().toUpperCase())
            .filter((symbol, index, arr) => symbol && arr.indexOf(symbol) === index);
    } catch {
        return [];
    }
}
       
function updateSaveButton(symbol) {
    const saveButton = document.getElementById("save-stock-btn");
    if (!saveButton) return;

    const isSaved = getStoredSavedStocks().includes(String(symbol || "").toUpperCase());
    const iconClass = isSaved ? "fa-solid fa-star" : "fa-regular fa-star";
    const buttonLabel = isSaved ? "Starred" : "Star Stock";

    saveButton.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${buttonLabel}</span>
    `;
    saveButton.setAttribute("aria-pressed", isSaved ? "true" : "false");
    saveButton.setAttribute(
        "aria-label",
        isSaved ? "Remove this stock from your watchlist" : "Add this stock to your watchlist"
    );
    saveButton.classList.toggle("saved", isSaved);
}

// ===== Signal History (Anurag Ravi - US16) =====

async function loadSignalHistory(symbol) {
    const loadingEl = document.getElementById("history-loading");
    const listEl = document.getElementById("signal-history-list");
    if (!loadingEl || !listEl) return;

    try {
        const data = await getSignalHistory(symbol);
        loadingEl.style.display = "none";
        listEl.style.display = "block";

        if (!data.history || data.history.length === 0) {
            listEl.innerHTML = `<div class="empty-state" style="padding:1rem 0"><p>No history yet — signal will be recorded when you visit this page.</p></div>`;
            return;
        }

        // Show most recent entries first
        renderSignalHistory([...data.history].reverse());
    } catch {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

function renderSignalHistory(history) {
    const listEl = document.getElementById("signal-history-list");
    if (!listEl) return;

    const rows = history.map((entry) => {
        const signalLower = (entry.signal || "hold").toLowerCase();
        const date = new Date(entry.timestamp);
        const formatted = date.toLocaleString(undefined, {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
        return `
            <div class="history-entry">
                <span class="signal-badge-sm ${signalLower}">${entry.signal}</span>
                <span class="history-confidence">${entry.confidence}% confidence</span>
                <span class="history-timestamp">${formatted}</span>
            </div>
        `;
    }).join("");

    listEl.innerHTML = `<div class="history-list">${rows}</div>`;
}

// ===== Mubashir - US-A: Fundamentals =====

async function loadFundamentals(symbol) {
    const grid = document.getElementById("fundamentals-grid");
    if (!grid) return;

    try {
        const data = await getStockFundamentals(symbol);

        const fmt = (val, prefix = "", suffix = "", decimals = 2) =>
            val != null ? `${prefix}${parseFloat(val).toFixed(decimals)}${suffix}` : "N/A";

        const fmtDate = (ts) => {
            if (!ts) return "N/A";
            return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        };

        const metrics = [
            { label: "Trailing EPS", value: fmt(data.trailingEPS, "$") },
            { label: "Forward EPS", value: fmt(data.forwardEPS, "$") },
            { label: "Analyst Target", value: data.analystTargetMedian ? `$${parseFloat(data.analystTargetMedian).toFixed(2)}` : "N/A" },
            { label: "Recommendation", value: data.analystRecommendation ? data.analystRecommendation.replace(/_/g, " ").toUpperCase() : "N/A" },
            { label: "Next Earnings", value: fmtDate(data.nextEarningsDate) },
            { label: "Dividend Yield", value: data.dividendYield ? `${(data.dividendYield * 100).toFixed(2)}%` : "N/A" },
            { label: "Profit Margin", value: data.profitMargins ? `${(data.profitMargins * 100).toFixed(2)}%` : "N/A" },
            { label: "Return on Equity", value: data.returnOnEquity ? `${(data.returnOnEquity * 100).toFixed(1)}%` : "N/A" },
        ];

        grid.innerHTML = metrics.map(m => `
            <div class="metric-item">
                <div class="metric-label">${m.label}</div>
                <div class="metric-value">${m.value}</div>
            </div>
        `).join("");
    } catch {
        if (grid) grid.innerHTML = `<div class="empty-state"><p>Fundamentals unavailable.</p></div>`;
    }
}

// ===== Mubashir - US-B: News =====

async function loadNews(symbol) {
    const loadingEl = document.getElementById("news-loading");
    const listEl = document.getElementById("news-list");
    if (!loadingEl || !listEl) return;

    try {
        const data = await getStockNews(symbol);
        loadingEl.style.display = "none";
        listEl.style.display = "block";

        if (!data.articles || data.articles.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><p>No recent news found.</p></div>`;
            return;
        }

        const fmtAge = (ts) => {
            if (!ts) return "";
            const diff = Math.floor((Date.now() / 1000) - ts);
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            return `${Math.floor(diff / 86400)}d ago`;
        };

        listEl.innerHTML = data.articles.map(a => `
            <a class="news-item" href="${a.link}" target="_blank" rel="noopener noreferrer">
                <div class="news-title">${a.title}</div>
                <div class="news-meta">
                    <span class="news-publisher">${a.publisher}</span>
                    <span class="news-age">${fmtAge(a.published)}</span>
                </div>
            </a>
        `).join("");
    } catch {
        if (loadingEl) loadingEl.style.display = "none";
        if (listEl) {
            listEl.style.display = "block";
            listEl.innerHTML = `<div class="empty-state"><p>News unavailable.</p></div>`;
        }
    }
}

// ===== Helpers =====

function showError(message) {
    document.getElementById("page-loading").style.display = "none";
    document.getElementById("page-error").style.display = "block";
    document.getElementById("error-message").textContent = message;
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toString();
}
