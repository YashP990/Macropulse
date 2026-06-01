/**
 * Macropulse - Stock Comparison Logic
 * Fetches two stock symbols and renders key metrics side by side.
 */

const DEFAULT_SYMBOL_A = "AAPL";
const DEFAULT_SYMBOL_B = "MSFT";
const SAVED_STOCKS_KEY = "macropulseSavedStocks";
const RECENT_COMPARISONS_KEY = "macropulseRecentComparisons";
const MAX_RECENT_COMPARISONS = 5;

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const symbolAInput = document.getElementById("compare-symbol-a");
    const symbolBInput = document.getElementById("compare-symbol-b");
    const form = document.getElementById("compare-form");
    const watchlistButton = document.getElementById("load-watchlist-compare");
    const watchlistFeedback = document.getElementById("compare-watchlist-feedback");

    symbolAInput.value = normalizeSymbol(params.get("symbolA") || symbolAInput.value || DEFAULT_SYMBOL_A);
    symbolBInput.value = normalizeSymbol(params.get("symbolB") || symbolBInput.value || DEFAULT_SYMBOL_B);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        loadComparison(symbolAInput.value, symbolBInput.value, true);
    });

    if (watchlistButton) {
        watchlistButton.addEventListener("click", () => {
            const savedSymbols = getSavedCompareSymbols();

            if (savedSymbols.length < 2) {
                if (watchlistFeedback) {
                    watchlistFeedback.textContent = "Save at least two stocks to your watchlist first.";
                }
                return;
            }

            symbolAInput.value = savedSymbols[0];
            symbolBInput.value = savedSymbols[1];
            if (watchlistFeedback) {
                watchlistFeedback.textContent = `Loaded ${savedSymbols[0]} and ${savedSymbols[1]} from your watchlist.`;
            }
            loadComparison(symbolAInput.value, symbolBInput.value, true);
        });
    }

    [symbolAInput, symbolBInput].forEach((input) => {
        input.addEventListener("change", () => {
            loadComparison(symbolAInput.value, symbolBInput.value, true);
        });
    });

    loadComparison(symbolAInput.value, symbolBInput.value, false);
});

async function loadComparison(rawSymbolA, rawSymbolB, updateUrl) {
    const symbolA = normalizeSymbol(rawSymbolA);
    const symbolB = normalizeSymbol(rawSymbolB);

    hideComparisonError();
    setComparisonLoading(true);

    if (!symbolA || !symbolB) {
        setComparisonLoading(false);
        showComparisonError("Please enter two stock symbols before comparing.");
        return;
    }

    if (symbolA === symbolB) {
        setComparisonLoading(false);
        showComparisonError("Please enter two different stock symbols.");
        return;
    }

    try {
        const [stockA, stockB] = await Promise.all([getStock(symbolA), getStock(symbolB)]);
        renderComparison(stockA, stockB);
        saveRecentComparison(symbolA, symbolB);

        if (updateUrl) {
            const nextUrl = `compare.html?symbolA=${encodeURIComponent(symbolA)}&symbolB=${encodeURIComponent(symbolB)}`;
            window.history.replaceState(null, "", nextUrl);
        }
    } catch (err) {
        const invalidMessage = err.status === 404 || err.status === 400
            ? `One or both stock symbols are invalid: ${symbolA}, ${symbolB}.`
            : err.message || "Could not load comparison data. Make sure the backend is running.";
        showComparisonError(invalidMessage);
    } finally {
        setComparisonLoading(false);
    }
}

function renderComparison(stockA, stockB) {
    document.getElementById("compare-results").style.display = "block";
    document.getElementById("compare-header-a").textContent = `${stockA.symbol} (${stockA.name || "Stock A"})`;
    document.getElementById("compare-header-b").textContent = `${stockB.symbol} (${stockB.name || "Stock B"})`;

    document.getElementById("compare-summary-grid").innerHTML = [stockA, stockB]
        .map((stock) => renderSummaryCard(stock))
        .join("");

    const rows = [
        { label: "Current Price", value: (stock) => formatCurrency(stock.price) },
        { label: "Market Capitalization", value: (stock) => formatMarketCap(stock.marketCap) },
        { label: "Daily Change", value: (stock) => formatChange(stock), className: (stock) => getChangeClass(stock.change) },
        { label: "P/E Ratio", value: (stock) => formatRatio(stock.pe_ratio) },
    ];

    document.getElementById("compare-table-body").innerHTML = rows
        .map((row) => {
            const classA = typeof row.className === "function" ? row.className(stockA) : "";
            const classB = typeof row.className === "function" ? row.className(stockB) : "";

            return `
                <tr>
                    <th scope="row">${row.label}</th>
                    <td class="${classA}">${row.value(stockA)}</td>
                    <td class="${classB}">${row.value(stockB)}</td>
                </tr>
            `;
        })
        .join("");
}

function renderSummaryCard(stock) {
    const changeClass = getChangeClass(stock.change);
    return `
        <article class="comparison-summary-card" aria-label="${stock.symbol} summary">
            <div class="comparison-summary-header">
                <div>
                    <div class="ticker">${stock.symbol}</div>
                    <div class="stock-name">${stock.name || `${stock.symbol} stock`}</div>
                </div>
                <a href="stock.html?symbol=${encodeURIComponent(stock.symbol)}" aria-label="Open ${stock.symbol} details">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </div>
            <div class="price">${formatCurrency(stock.price)}</div>
            <div class="change ${changeClass}">${formatChange(stock)}</div>
        </article>
    `;
}


function getSavedCompareSymbols() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVED_STOCKS_KEY) || "[]");
        if (!Array.isArray(saved)) return [];

        return saved
            .map((symbol) => normalizeSymbol(symbol))
            .filter((symbol, index, arr) => symbol && arr.indexOf(symbol) === index);
    } catch {
        return [];
    }
}

function saveRecentComparison(symbolA, symbolB) {
    const comparison = {
        symbolA: normalizeSymbol(symbolA),
        symbolB: normalizeSymbol(symbolB),
        savedAt: new Date().toISOString(),
    };

    if (!comparison.symbolA || !comparison.symbolB || comparison.symbolA === comparison.symbolB) return;

    try {
        const recent = JSON.parse(localStorage.getItem(RECENT_COMPARISONS_KEY) || "[]");
        const deduped = Array.isArray(recent)
            ? recent.filter((item) => !(item.symbolA === comparison.symbolA && item.symbolB === comparison.symbolB))
            : [];

        deduped.unshift(comparison);
        localStorage.setItem(RECENT_COMPARISONS_KEY, JSON.stringify(deduped.slice(0, MAX_RECENT_COMPARISONS)));
    } catch {
        localStorage.setItem(RECENT_COMPARISONS_KEY, JSON.stringify([comparison]));
    }
}
function setComparisonLoading(isLoading) {
    document.getElementById("compare-loading").style.display = isLoading ? "flex" : "none";
}

function showComparisonError(message) {
    document.getElementById("compare-results").style.display = "none";
    document.getElementById("compare-error").style.display = "block";
    document.getElementById("compare-error-message").textContent = message;
}

function hideComparisonError() {
    document.getElementById("compare-error").style.display = "none";
}

function normalizeSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
}

function getChangeClass(change) {
    return Number(change || 0) >= 0 ? "positive" : "negative";
}

function formatCurrency(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `$${number.toFixed(2)}` : "N/A";
}

function formatRatio(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "N/A";
}

function formatMarketCap(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "N/A";
    if (number >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
    if (number >= 1e9) return `$${(number / 1e9).toFixed(2)}B`;
    if (number >= 1e6) return `$${(number / 1e6).toFixed(2)}M`;
    return `$${number.toLocaleString()}`;
}

function formatChange(stock) {
    const change = Number(stock.change);
    const changePercent = Number(stock.changePercent);
    if (!Number.isFinite(change)) return "N/A";

    const sign = change >= 0 ? "+" : "-";
    const dollars = `$${Math.abs(change).toFixed(2)}`;
    const percentText = Number.isFinite(changePercent)
        ? ` (${sign}${Math.abs(changePercent).toFixed(2)}%)`
        : "";

    return `${sign}${dollars}${percentText}`;
}

