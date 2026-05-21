/**
 * Macropulse - Dashboard Logic
 * Search bar with debounce, trending stocks, navigation.
 */

const TRENDING_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA"];
const WATCHLIST_SYMBOLS = ["META", "JPM", "V", "JNJ", "WMT", "DIS"];
const UNDERPERFORMING_CANDIDATES = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA",
    "META", "NFLX", "AMD", "INTC", "BA", "NKE",
    "DIS", "PYPL", "SNAP", "PFE", "WMT", "JPM",
];

/* Yash Patel, 04/17/2026
Add new const variable and call function*/
const SAVED_STOCKS_KEY = "macropulseSavedStocks";

/* Recent search storage
 * Anurag Ravi 4/30/2026
 */
const RECENT_SEARCHES_KEY = "macropulseRecentSearches";
const MAX_RECENT_SEARCHES = 5;
const INVESTMENT_SURVEY_SEEN_KEY = "macropulseInvestmentSurveySeen";

const SURVEY_RECOMMENDATIONS = {
    long_term: {
        title: "S&P 500 core profile",
        symbol: "SPY",
        chartRange: "5y",
        copy: "For long-term growth, start research with a broad S&P 500 fund like SPY or VOO instead of trying to pick one winner.",
        chips: ["Broad market", "5+ year view", "Lower maintenance"],
        symbols: ["SPY", "VOO", "VTI", "QQQ"],
        weights: {
            momentum: 20,
            mean_reversion: 20,
            monte_carlo: 35,
            factor_model: 25,
        },
    },
    income: {
        title: "Income and quality profile",
        symbol: "VYM",
        chartRange: "2y",
        copy: "For steady income, start research with dividend-focused funds and mature companies, then use signals as a second opinion.",
        chips: ["Dividend focus", "Quality stocks", "Moderate swings"],
        symbols: ["SCHD", "VYM", "KO", "JNJ"],
        weights: {
            momentum: 15,
            mean_reversion: 25,
            monte_carlo: 30,
            factor_model: 30,
        },
    },
    active_trading: {
        title: "Signal-guided trading profile",
        symbol: "QQQ",
        chartRange: "3mo",
        copy: "For active trading, use BUY/HOLD/SELL signals to build a research list, then confirm with news, chart history, and risk limits.",
        chips: ["Signal watchlist", "Shorter chart", "Higher review frequency"],
        symbols: ["QQQ", "NVDA", "TSLA", "AMD"],
        weights: {
            momentum: 45,
            mean_reversion: 20,
            monte_carlo: 15,
            factor_model: 20,
        },
    },
    capital_protection: {
        title: "Defensive research profile",
        symbol: "BIL",
        chartRange: "1y",
        copy: "For protecting money, start with lower-volatility cash-like or bond ETF research and treat stock BUY signals conservatively.",
        chips: ["Lower volatility", "Cash-like ETFs", "Risk first"],
        symbols: ["BIL", "SHY", "XLP", "PG"],
        weights: {
            momentum: 10,
            mean_reversion: 20,
            monte_carlo: 45,
            factor_model: 25,
        },
    },
};

const RISK_ADJUSTMENTS = {
    low: {
        suffix: "Keep alerts conservative and avoid chasing fast moves.",
        symbolOverride: "",
    },
    balanced: {
        suffix: "Balance broad exposure with a few signal-backed stocks to research.",
        symbolOverride: "",
    },
    high: {
        suffix: "High risk can use signals more aggressively, but every BUY idea still needs a stop-loss and position-size limit.",
        symbolOverride: "QQQ",
    },
};

let searchTimeout = null;
let selectedSearchIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
    applyDashboardPreferences();
    initInvestmentSurveyModal();
    initSearch();
    loadTrendingStocks();
    loadUnderperformingStocks();
    loadWatchlistStocks();
    loadSavedStocks();
});

// ===== Search =====

function initSearch() {
    const input = document.getElementById("search-input");
    const dropdown = document.getElementById("search-dropdown");

    input.addEventListener("input", () => {
        const query = input.value.trim();
        if (searchTimeout) clearTimeout(searchTimeout);
        selectedSearchIndex = -1;

        if (query.length === 0) {
            dropdown.classList.remove("active");
            updateSearchSelection(dropdown);
            return;
        }

        // Debounce: wait 350ms after typing stops
        searchTimeout = setTimeout(() => performSearch(query), 350);
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrapper")) {
            dropdown.classList.remove("active");
            selectedSearchIndex = -1;
            updateSearchSelection(dropdown);
        }
    });

    input.addEventListener("keydown", (e) => {
        const results = getSearchResults(dropdown);

        if (e.key === "ArrowDown") {
            if (results.length === 0) return;
            e.preventDefault();
            moveSearchSelection(dropdown, 1);
            return;
        }

        if (e.key === "ArrowUp") {
            if (results.length === 0) return;
            e.preventDefault();
            moveSearchSelection(dropdown, -1);
            return;
        }

        if (e.key === "Escape") {
            dropdown.classList.remove("active");
            selectedSearchIndex = -1;
            updateSearchSelection(dropdown);
            return;
        }

        if (e.key === "Enter") {
            const selectedItem = results[selectedSearchIndex];
            const firstItem = results[0];
            const targetItem = selectedItem || firstItem;

            if (targetItem) {
                e.preventDefault();
                targetItem.click();
                return;
            }

            const query = input.value.trim().toUpperCase();
            if (query) {
                navigateToStock(query);
            }
        }
    });
}

function applyDashboardPreferences() {
    const preferences = typeof getPreferences === "function" ? getPreferences() : {};
    const searchInput = document.getElementById("search-input");
    const watchlistSection = document.getElementById("watchlist-section");
    const savedStocksSection = document.getElementById("saved-stocks-section");

    if (searchInput && preferences.defaultStockSymbol) {
        searchInput.value = preferences.defaultStockSymbol;
    }

    if (watchlistSection && savedStocksSection && preferences.showSavedStocksFirst) {
        watchlistSection.parentNode.insertBefore(savedStocksSection, watchlistSection);
    }
}

function initInvestmentSurveyModal() {
    const modal = document.getElementById("investment-survey-modal");
    const openButton = document.getElementById("open-investment-survey");
    const closeButton = document.getElementById("close-investment-survey");
    const form = document.getElementById("investment-survey-form");
    const clearButton = document.getElementById("clear-investment-survey");
    const feedback = document.getElementById("investment-survey-feedback");

    if (!modal || !openButton || !closeButton || !form || !clearButton) return;

    const openModal = () => {
        modal.hidden = false;
        document.body.classList.add("modal-open");
        sessionStorage.setItem(INVESTMENT_SURVEY_SEEN_KEY, "true");
        renderInvestmentSurvey(getPreferences());
        document.getElementById("investment-goal").focus();
    };

    const closeModal = () => {
        modal.hidden = true;
        document.body.classList.remove("modal-open");
    };

    openButton.addEventListener("click", openModal);
    closeButton.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const survey = {
            goal: document.getElementById("investment-goal").value,
            horizon: document.getElementById("investment-horizon").value,
            risk: document.getElementById("investment-risk").value,
            signalPreference: document.getElementById("signal-preference").value,
            lastRecommendation: "",
        };

        const recommendation = buildInvestmentRecommendation(survey);
        survey.lastRecommendation = recommendation.title;

        const updates = { investmentSurvey: survey };
        const applyDefaults = document.getElementById("apply-survey-defaults").checked;

        if (applyDefaults) {
            updates.defaultStockSymbol = recommendation.symbol;
            updates.preferredChartRange = recommendation.chartRange;
            updates.strategyWeights = recommendation.weights;
        }

        savePreferences(updates);
        applyDashboardPreferences();
        renderInvestmentSurvey(getPreferences());

        if (feedback) {
            feedback.textContent = applyDefaults
                ? "Recommendation saved and dashboard defaults updated."
                : "Recommendation saved.";
            feedback.classList.add("is-visible");
        }
    });

    clearButton.addEventListener("click", () => {
        savePreferences({
            investmentSurvey: {
                goal: "",
                horizon: "",
                risk: "",
                signalPreference: "",
                lastRecommendation: "",
            },
        });
        renderInvestmentSurvey(getPreferences());

        if (feedback) {
            feedback.textContent = "Survey cleared.";
            feedback.classList.add("is-visible");
        }
    });

    renderInvestmentSurvey(getPreferences());

    const survey = getPreferences().investmentSurvey || {};
    if (!survey.lastRecommendation && sessionStorage.getItem(INVESTMENT_SURVEY_SEEN_KEY) !== "true") {
        window.setTimeout(openModal, 650);
    }
}

function buildInvestmentRecommendation(survey) {
    const goalKey = survey.goal || "long_term";
    const base = SURVEY_RECOMMENDATIONS[goalKey] || SURVEY_RECOMMENDATIONS.long_term;
    const risk = RISK_ADJUSTMENTS[survey.risk] || RISK_ADJUSTMENTS.balanced;
    const wantsSignals = survey.signalPreference === "signal_guided";
    const manualOnly = survey.signalPreference === "manual";
    const horizonCopy = survey.horizon === "short"
        ? "Because your timeline is short, treat this as a watchlist idea instead of a set-and-forget investment."
        : survey.horizon === "long"
            ? "Because your timeline is long, broad diversification matters more than daily signal noise."
            : "Review the recommendation regularly as your timeline changes.";

    return {
        ...base,
        symbol: risk.symbolOverride || base.symbol,
        copy: [
            base.copy,
            risk.suffix,
            wantsSignals
                ? "Use the app's BUY/HOLD/SELL signal as a research filter, not an automatic trade."
                : manualOnly
                    ? "No signal defaults were added; use this as a planning summary."
                    : "Start with safer broad-market research before relying on individual stock signals.",
            horizonCopy,
        ].join(" "),
    };
}

function renderInvestmentSurvey(preferences) {
    const survey = preferences.investmentSurvey || {};
    const recommendationPanel = document.getElementById("investment-recommendation");
    const title = document.getElementById("investment-recommendation-title");
    const copy = document.getElementById("investment-recommendation-copy");
    const chips = document.getElementById("investment-recommendation-chips");
    const symbols = document.getElementById("investment-recommendation-symbols");
    const feedback = document.getElementById("investment-survey-feedback");

    document.getElementById("investment-goal").value = survey.goal || "";
    document.getElementById("investment-horizon").value = survey.horizon || "";
    document.getElementById("investment-risk").value = survey.risk || "";
    document.getElementById("signal-preference").value = survey.signalPreference || "";

    if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("is-visible");
    }

    if (!recommendationPanel || !survey.lastRecommendation) {
        if (recommendationPanel) recommendationPanel.hidden = true;
        return;
    }

    const recommendation = buildInvestmentRecommendation(survey);
    title.textContent = recommendation.title;
    copy.textContent = recommendation.copy;
    chips.replaceChildren(
        ...recommendation.chips.map(createRecommendationChip),
        createRecommendationChip(`Starter symbol: ${recommendation.symbol}`),
        createRecommendationChip(`Chart: ${recommendation.chartRange}`)
    );
    if (symbols) {
        symbols.replaceChildren(
            ...recommendation.symbols.map(createRecommendationSymbolCard),
            createAddRecommendedSymbolsButton(recommendation.symbols)
        );
    }
    recommendationPanel.hidden = false;
}

function createRecommendationChip(text) {
    const chip = document.createElement("span");
    chip.textContent = text;
    return chip;
}

function createRecommendationSymbolCard(symbol) {
    const card = document.createElement("div");
    card.className = "recommendation-symbol-card";

    const heading = document.createElement("strong");
    heading.textContent = symbol;

    const actions = document.createElement("div");
    actions.className = "recommendation-symbol-actions";

    const researchButton = document.createElement("button");
    researchButton.type = "button";
    researchButton.className = "btn btn-secondary";
    researchButton.textContent = "Research";
    researchButton.addEventListener("click", () => navigateToStock(symbol));

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn btn-secondary";
    addButton.textContent = getSavedStocks().includes(symbol) ? "Added" : "Add";
    addButton.disabled = getSavedStocks().includes(symbol);
    addButton.addEventListener("click", () => {
        saveSymbolsToWatchlist([symbol]);
        addButton.textContent = "Added";
        addButton.disabled = true;
    });

    actions.append(researchButton, addButton);
    card.append(heading, actions);
    return card;
}

function createAddRecommendedSymbolsButton(symbols) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary recommendation-add-all";
    button.innerHTML = `<i class="fa-solid fa-star"></i> Add Recommended Watchlist`;
    button.addEventListener("click", () => {
        saveSymbolsToWatchlist(symbols);
        button.innerHTML = `<i class="fa-solid fa-check"></i> Watchlist Added`;
        button.disabled = true;
        loadSavedStocks();
    });
    return button;
}

function saveSymbolsToWatchlist(symbols) {
    const current = getSavedStocks();
    const next = [...current];

    symbols.forEach((symbol) => {
        const normalizedSymbol = String(symbol || "").trim().toUpperCase();
        if (normalizedSymbol && !next.includes(normalizedSymbol)) {
            next.push(normalizedSymbol);
        }
    });

    localStorage.setItem(SAVED_STOCKS_KEY, JSON.stringify(next));
    loadSavedStocks();
}

/* Yash Patel, 04/27/2026
Fetches stock search results, updates dropdown UI, handles loading, no results, and errors.*/
async function performSearch(query) {
    const dropdown = document.getElementById("search-dropdown");
    selectedSearchIndex = -1;

    dropdown.innerHTML = `<div class="search-loading"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>`;
    dropdown.classList.add("active");

    try {
        const data = await searchStocks(query);
        if (data.results.length === 0) {
            dropdown.innerHTML = `<div class="search-no-results">No results found for "${query}"</div>`;
            return;
        }

        dropdown.innerHTML = data.results
            .slice(0, 8)
            .map(
                (r) => `
                <div class="search-result-item" onclick="navigateToStock('${r.symbol}')">
                    <span class="symbol">${r.symbol}</span>
                    <span class="name">${r.name}</span>
                    <span class="exchange">${r.exchange}</span>
                </div>
            `
            )
            .join("");

        attachSearchResultInteractions(dropdown);
        updateSearchSelection(dropdown);
    } catch (err) {
        dropdown.innerHTML = `<div class="search-no-results">Search error. Is the backend running?</div>`;
    }
}

function navigateToStock(symbol) {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    if (!normalizedSymbol) return;

    saveRecentSearch(normalizedSymbol);
    window.location.href = `stock.html?symbol=${encodeURIComponent(normalizedSymbol)}`;
}

/* Yash Patel, 04/17/2026 
Retrieves, cleans, deduplicates, and returns saved stock symbols from localStorage safely*/
function getSavedStocks() {
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

window.getSavedStocks = getSavedStocks;

/* Recent search helpers
 * Anurag Ravi 4/20/2026
 */
function getRecentSearches() {
    try {
        const recent = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
        if (!Array.isArray(recent)) return [];

        return recent
            .map((symbol) => String(symbol || "").trim().toUpperCase())
            .filter((symbol, index, arr) => symbol && arr.indexOf(symbol) === index)
            .slice(0, MAX_RECENT_SEARCHES);
    } catch {
        return [];
    }
}

function saveRecentSearch(symbol) {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    if (!normalizedSymbol) return;

    const recent = getRecentSearches().filter((item) => item !== normalizedSymbol);
    recent.unshift(normalizedSymbol);
    localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES))
    );
}
/* Anurag Ravi, 5/7/2026
Clears recent search history and resets the search dropdown on the dashboard. */
function initClearRecentSearches() {
    const clearButton = document.getElementById("clear-recent-searches-btn");
    const dropdown = document.getElementById("search-dropdown");
    const input = document.getElementById("search-input");

    if (!clearButton) return;

    clearButton.addEventListener("click", () => {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
        selectedSearchIndex = -1;

        if (dropdown) {
            dropdown.classList.remove("active");
            dropdown.innerHTML = "";
        }

        if (input) input.focus();
    });
}

function renderRecentSearches(dropdown) {
    const recent = getRecentSearches();
    selectedSearchIndex = -1;

    if (recent.length === 0) {
        dropdown.classList.remove("active");
        dropdown.innerHTML = "";
        return;
    }

    dropdown.innerHTML = `
        <div class="search-loading">Recent searches</div>
        ${recent
            .map(
                (symbol) => `
                    <div class="search-result-item" onclick="navigateToStock('${symbol}')">
                        <span class="symbol">${symbol}</span>
                        <span class="name">Recent search</span>
                    </div>
                `
            )
            .join("")}
    `;
    dropdown.classList.add("active");
    attachSearchResultInteractions(dropdown);
    updateSearchSelection(dropdown);
}

function getSearchResults(dropdown) {
    return Array.from(dropdown.querySelectorAll(".search-result-item"));
}

function moveSearchSelection(dropdown, direction) {
    const results = getSearchResults(dropdown);
    if (results.length === 0) return;

    selectedSearchIndex =
        selectedSearchIndex < 0
            ? direction > 0
                ? 0
                : results.length - 1
            : (selectedSearchIndex + direction + results.length) % results.length;

    updateSearchSelection(dropdown);
}

function updateSearchSelection(dropdown) {
    const results = getSearchResults(dropdown);

    results.forEach((item, index) => {
        const isSelected = index === selectedSearchIndex;
        item.style.backgroundColor = isSelected ? "rgba(88, 166, 255, 0.12)" : "";
        item.style.outline = isSelected ? "1px solid rgba(88, 166, 255, 0.35)" : "";
        item.style.borderRadius = isSelected ? "10px" : "";
        item.setAttribute("aria-selected", isSelected ? "true" : "false");

        if (isSelected) {
            item.scrollIntoView({ block: "nearest" });
        }
    });
}

function attachSearchResultInteractions(dropdown) {
    const results = getSearchResults(dropdown);

    results.forEach((item, index) => {
        item.addEventListener("mouseenter", () => {
            selectedSearchIndex = index;
            updateSearchSelection(dropdown);
        });

        item.addEventListener("mouseleave", () => {
            selectedSearchIndex = -1;
            updateSearchSelection(dropdown);
        });
    });
}

// ===== Trending Stocks =====

async function loadTrendingStocks() {
    const grid = document.getElementById("trending-grid");
    const loading = document.getElementById("trending-loading");

    try {
        const cards = await Promise.allSettled(
            TRENDING_SYMBOLS.map((sym) => loadStockCard(sym))
        );

        loading.style.display = "none";

        const html = cards
            .filter((r) => r.status === "fulfilled" && r.value)
            .map((r) => r.value)
            .join("");

        if (html) {
            grid.innerHTML = html;
        } else {
            grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-xmark"></i><p>Could not load trending stocks. Make sure the backend is running.</p></div>`;
        }
    } catch {
        loading.style.display = "none";
        grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-xmark"></i><p>Backend connection failed.</p></div>`;
    }
}

async function loadWatchlistStocks() {
    const grid = document.getElementById("watchlist-grid");

    try {
        const cards = await Promise.allSettled(
            WATCHLIST_SYMBOLS.map((sym) => loadStockCard(sym))
        );

        const html = cards
            .filter((r) => r.status === "fulfilled" && r.value)
            .map((r) => r.value)
            .join("");

        if (html) {
            grid.innerHTML = html;
        } else {
            grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-chart-bar"></i><p>Could not load watchlist stocks.</p></div>`;
        }
    } catch {
        grid.innerHTML = "";
    }
}

/* Yash Patel, 04/17/2026
Loads saved stocks, fetches cards, and displays successful results in grid*/
/* Kevin Ngo - US17: Each saved stock card shows BUY/SELL/HOLD signal and a remove button */
async function loadSavedStocks() {
    const grid = document.getElementById("saved-stocks-grid");
    if (!grid) return;

    const savedSymbols = getSavedStocks();

    if (savedSymbols.length === 0) {
        grid.innerHTML = `
            <div class="empty-state watchlist-empty-state">
                <i class="fa-regular fa-star"></i>
                <p>Star stocks on their detail pages to build your personal watchlist dashboard.</p>
            </div>
        `;
        return;
    }

    try {
        const cards = await Promise.allSettled(
            savedSymbols.map((sym) => loadSavedStockCard(sym))
        );

        const html = cards
            .filter((r) => r.status === "fulfilled" && r.value)
            .map((r) => r.value)
            .join("");

        if (html) {
            grid.innerHTML = html;
            attachRemoveButtons(grid);
        } else {
            grid.innerHTML = `
                <div class="empty-state watchlist-empty-state">
                    <i class="fa-solid fa-chart-line"></i>
                    <p>We couldn't load your watchlist right now. Try opening one of your starred stocks again.</p>
                </div>
            `;
        }
    } catch {
        grid.innerHTML = `
            <div class="empty-state watchlist-empty-state">
                <i class="fa-solid fa-chart-line"></i>
                <p>We couldn't load your watchlist right now. Try again in a moment.</p>
            </div>
        `;
    }
}

async function loadUnderperformingStocks() {
    const grid = document.getElementById("underperforming-grid");
    const loading = document.getElementById("underperforming-loading");

    if (!grid || !loading) return;

    try {
        const results = await Promise.allSettled(
            UNDERPERFORMING_CANDIDATES.map((symbol) => getStock(symbol))
        );

        const decliners = results
            .filter((result) => result.status === "fulfilled" && result.value)
            .map((result) => result.value)
            .filter((stock) => Number(stock.change ?? 0) < 0)
            .sort((a, b) => Number(a.changePercent ?? a.change ?? 0) - Number(b.changePercent ?? b.change ?? 0))
            .slice(0, 5);

        loading.style.display = "none";

        if (decliners.length === 5) {
            grid.innerHTML = decliners.map((stock) => renderStockCard(stock)).join("");
        } else if (decliners.length > 0) {
            grid.innerHTML = decliners.map((stock) => renderStockCard(stock)).join("");
        } else {
            grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-arrow-trend-down"></i><p>No underperforming stocks are available right now.</p></div>`;
        }
    } catch {
        loading.style.display = "none";
        grid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-plug-circle-xmark"></i><p>Could not load underperforming stocks.</p></div>`;
    }
}

/* Kevin Ngo - US17: Loads a saved stock card with price data and BUY/SELL/HOLD signal badge */
async function loadSavedStockCard(symbol) {
    try {
        const [stockData, signalData] = await Promise.allSettled([
            getStock(symbol),
            getSignals(symbol),
        ]);

        if (stockData.status !== "fulfilled" || !stockData.value) return null;
        const data = stockData.value;

        const price = Number(data.price ?? 0);
        const change = Number(data.change ?? 0);
        const hasChangePercent = Number.isFinite(Number(data.changePercent));
        const changePercent = hasChangePercent ? Number(data.changePercent) : null;
        const changeClass = change >= 0 ? "positive" : "negative";
        const changeIcon = change >= 0 ? "fa-caret-up" : "fa-caret-down";
        const changeSign = change >= 0 ? "+" : "";
        const changeText = hasChangePercent
            ? `${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)`
            : `${changeSign}${change.toFixed(2)}`;

        let signalBadge = "";
        if (signalData.status === "fulfilled" && signalData.value) {
            const sig = signalData.value.signal.toLowerCase();
            signalBadge = `<span class="signal-badge-sm ${sig}" style="margin-left:auto">${signalData.value.signal}</span>`;
        }

        const stockName = data.name || `${data.symbol} stock`;

        return `
            <div class="stock-card" onclick="navigateToStock('${data.symbol}')">
                <div class="stock-header">
                    <div>
                        <div class="ticker">${data.symbol}</div>
                        <div class="stock-name">${stockName}</div>
                    </div>
                    ${signalBadge}
                </div>
                <div class="price">$${price.toFixed(2)}</div>
                <div class="change ${changeClass}">
                    <i class="fa-solid ${changeIcon}"></i>
                    ${changeText}
                </div>
                <button class="btn-remove-saved" data-symbol="${data.symbol}" onclick="event.stopPropagation(); removeSavedStock('${data.symbol}')">
                    <i class="fa-solid fa-star"></i> Unstar
                </button>
            </div>
        `;
    } catch {
        return null;
    }
}

/* Kevin Ngo - US17: Attaches click handlers to remove buttons already in the DOM */
function attachRemoveButtons(grid) {
    grid.querySelectorAll(".btn-remove-saved").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeSavedStock(btn.getAttribute("data-symbol"));
        });
    });
}

/* Kevin Ngo - US17: Removes a stock from saved list and refreshes the grid */
function removeSavedStock(symbol) {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const current = getSavedStocks().filter((s) => s !== normalizedSymbol);
    localStorage.setItem(SAVED_STOCKS_KEY, JSON.stringify(current));
    loadSavedStocks();
}

window.removeSavedStock = removeSavedStock;

async function loadStockCard(symbol) {
    try {
        const data = await getStock(symbol);
        return renderStockCard(data);
    } catch {
        return null;
    }
}

function renderStockCard(data) {
    const price = Number(data.price ?? 0);
    const change = Number(data.change ?? 0);
    const hasChangePercent = Number.isFinite(Number(data.changePercent));
    const changePercent = hasChangePercent ? Number(data.changePercent) : null;
    const changeClass = change >= 0 ? "positive" : "negative";
    const changeIcon = change >= 0 ? "fa-caret-up" : "fa-caret-down";
    const changeSign = change >= 0 ? "+" : "";
    const stockName = data.name || `${data.symbol} stock`;
    const changeText = hasChangePercent
        ? `${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)`
        : `${changeSign}${change.toFixed(2)}`;

    return `
        <div class="stock-card" onclick="navigateToStock('${data.symbol}')">
            <div class="stock-header">
                <div>
                    <div class="ticker">${data.symbol}</div>
                    <div class="stock-name">${stockName}</div>
                </div>
            </div>
            <div class="price">$${price.toFixed(2)}</div>
            <div class="change ${changeClass}">
                <i class="fa-solid ${changeIcon}"></i>
                ${changeText}
            </div>
        </div>
    `;
}
