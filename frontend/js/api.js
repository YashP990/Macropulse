/**
 * Macropulse API Client
 * Fetch wrapper for all backend calls with error handling and loading states.
 */

// Person 3 - US14: Prefer versioned /api/v1 endpoint, but fall back to legacy /api
const API_BASES = [];
const configuredApiBase = window.APP_CONFIG && window.APP_CONFIG.apiBase;

if (configuredApiBase) {
    API_BASES.push(configuredApiBase);
} else {
    API_BASES.push(`${window.location.origin}/api/v1`, `${window.location.origin}/api`);
}

async function fetchJsonWithFallback(endpoint, options = {}) {
    let lastError = null;

    for (const base of API_BASES) {
        const response = await fetch(`${base}${endpoint}`, options);

        if (response.ok) {
            return response.json();
        }

        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP ${response.status}`);
        error.status = response.status;
        lastError = error;

        // If this base is missing the route entirely, try the next compatible base.
        if (response.status === 404) {
            continue;
        }

        throw error;
    }

    throw lastError || new Error("Request failed");
}

async function apiRequest(endpoint) {
    return fetchJsonWithFallback(endpoint);
}

/**
 * Search stocks by query string.
 * GET /api/search?q=<query>
 */
async function searchStocks(query) {
    if (!query || query.trim().length === 0) return { results: [] };
    return apiRequest(`/search?q=${encodeURIComponent(query.trim())}`);
}

/**
 * Get current stock info.
 * GET /api/stock/<symbol>
 */
async function getStock(symbol) {
    return apiRequest(`/stock/${encodeURIComponent(symbol)}`);
}

/**
 * Get historical OHLCV data.
 * GET /api/stock/<symbol>/history?period=1y
 */
async function getStockHistory(symbol, period = "1y") {
    return apiRequest(`/stock/${encodeURIComponent(symbol)}/history?period=${period}`);
}

/**
 *
 * GET /api/v1/signals/<symbol>
 */
async function getSignals(symbol) {
    return apiRequest(`/signals/${encodeURIComponent(symbol)}`);
}

/**
 * Get signal history for a stock.
 * GET /api/v1/signals/<symbol>/history
 */
async function getSignalHistory(symbol) {
    return apiRequest(`/signals/${encodeURIComponent(symbol)}/history`);
}

/**
 * Get the server-side watchlist.
 * GET /api/v1/watchlist
 */
async function getWatchlist() {
    return apiRequest(`/watchlist`);
}

/**
 * Add a symbol to the server-side watchlist.
 * POST /api/v1/watchlist/<symbol>
 */
async function addToWatchlist(symbol) {
    return fetchJsonWithFallback(`/watchlist/${encodeURIComponent(symbol)}`, { method: "POST" });
}

/**
 * Remove a symbol from the server-side watchlist.
 * DELETE /api/v1/watchlist/<symbol>
 */
async function removeFromWatchlist(symbol) {
    return fetchJsonWithFallback(`/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
}
