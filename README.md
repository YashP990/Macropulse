# Macropulse — Quantitative Stock Signals Platform

A web application that provides quantitative analysis and trading signals for stocks using a multi-strategy ensemble approach. It combines **Momentum**, **Mean Reversion**, **Monte Carlo simulation**, and **Factor Models** to produce BUY / SELL / HOLD signals with confidence scores, and adds a screener, backtesting, a trading journal, a portfolio overview, and configurable strategy weights on top.

---

## How to Run

### Prerequisites

- **Python 3.10+**
- **pip** (Python package manager)
- A modern web browser (Chrome, Firefox, Edge)

### Step 1: Set up the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Start the Server

```bash
# From the backend directory (with venv activated)
python app.py
```

The server starts at **http://localhost:5000**. On first run it creates `backend/data/macropulse.db` (SQLite) automatically.

### Step 3: Open the App

- **Dashboard:** http://localhost:5000/
- **Screener:** http://localhost:5000/screener.html
- **Journal:** http://localhost:5000/journal.html
- **Portfolio:** http://localhost:5000/portfolio.html
- **Settings:** http://localhost:5000/settings.html
- **Stock detail (example):** http://localhost:5000/stock.html?symbol=AAPL

No `npm install`, no build step. The frontend is pure HTML/CSS/JS served directly by Flask.

---

## Tech Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | Vanilla JS, HTML5, CSS3                               |
| Charts   | Chart.js 4.4.1 (CDN)                                  |
| Icons    | Font Awesome 6.5.1 (CDN)                              |
| Backend  | Python Flask 3.1.0, flask-cors, flask-limiter         |
| Data     | Yahoo Finance via `yfinance` (live only — no mocks)   |
| Storage  | SQLite (stdlib `sqlite3`) for watchlist, signal history, journal |
| Caching  | In-memory TTL cache (5–60 min depending on endpoint)  |

No JavaScript build tooling, no ORM, no paid third-party APIs.

---

## Project Structure

```
Macropulse/
├── frontend/
│   ├── index.html               # Dashboard
│   ├── stock.html               # Stock detail (signals, fundamentals, news, backtest)
│   ├── screener.html            # Stock screener
│   ├── journal.html             # Trading journal
│   ├── portfolio.html           # Portfolio overview
│   ├── settings.html            # Preferences + strategy weight sliders
│   ├── js/
│   │   ├── api.js               # API client wrapper
│   │   ├── app.js               # Dashboard logic
│   │   ├── stock.js             # Stock detail page logic
│   │   ├── screener.js          # Screener page logic
│   │   ├── journal.js           # Journal CRUD + filter/sort/CSV export
│   │   ├── portfolio.js         # Portfolio overview rendering
│   │   ├── settings.js          # Settings + weight sliders
│   │   ├── preferences.js       # localStorage preferences
│   │   └── charts.js            # Chart.js price & volume visualization
│   └── css/
│       └── style.css            # Full design system (dark + colorblind themes)
│
├── backend/
│   ├── app.py                   # Flask entry + blueprint registration
│   ├── requirements.txt
│   ├── data/
│   │   └── macropulse.db        # SQLite database (git-ignored)
│   ├── routes/
│   │   ├── search.py            # Stock search
│   │   ├── stock.py             # Stock info, history, fundamentals, news
│   │   ├── signals.py           # Aggregated quant signal
│   │   ├── history.py           # Signal history
│   │   ├── watchlist.py         # Persistent watchlist
│   │   ├── screener.py          # Multi-symbol screener
│   │   ├── backtest.py          # Per-strategy historical accuracy
│   │   ├── journal.py           # Trading journal CRUD
│   │   ├── portfolio.py         # Portfolio aggregation
│   │   └── security.py          # API-key safe status
│   ├── services/
│   │   ├── data_fetcher.py      # yfinance integration + caching
│   │   ├── db.py                # SQLite init + connection
│   │   ├── signal_history.py    # SQLite-backed signal history
│   │   ├── watchlist_store.py   # SQLite-backed watchlist
│   │   ├── backtest_engine.py   # Windowed strategy backtest
│   │   └── limiter.py           # Shared flask-limiter instance
│   └── strategies/
│       ├── signal_aggregator.py # Weighted ensemble (accepts custom weights)
│       ├── config.py            # Default weights + thresholds
│       ├── momentum.py
│       ├── mean_reversion.py
│       ├── monte_carlo.py
│       └── factor_model.py
│
└── README.md
```

---

## Features

### Dashboard
- Real-time search with debounced autocomplete
- Trending stocks grid and survey-recommended watchlist cards
- Investment-guide modal for new users

### Stock Detail
- Signal badge (BUY/SELL/HOLD) with confidence bar
- Per-strategy breakdown cards (momentum, mean reversion, Monte Carlo, factor model)
- Interactive price chart with period selector (1M, 3M, 6M, 1Y, 2Y, 5Y)
- **Fundamentals** section (EPS, P/E, dividend yield, margins, etc.)
- **Recent News** feed sourced from Yahoo Finance
- **Backtest Results** — per-strategy directional accuracy over 1y or 2y of history
- Copy-ticker button

### Screener
- Scans 35 major S&P 100 stocks and ranks them by signal strength
- Filter pills (All / BUY / SELL / HOLD)
- Sortable table (ticker, price, change, signal, confidence, per-strategy scores)
- Progress bar during the scan

### Trading Journal
- Full CRUD with input validation; soft-delete preserves history
- **Server-side P&L:** realized P&L for closed trades, unrealized P&L valued at the live price for open trades
- Stats bar: total trades, win rate, total P&L, best & worst
- Filter pills (All / Open / Closed) and symbol search
- Sortable columns
- **CSV export** of the currently visible trades
- Ticker cells link to the matching stock detail page

### Portfolio Overview
- Aggregates open journal positions by symbol
- Per-symbol shares, average entry, current price, cost basis, market value, unrealized P&L, allocation %
- Portfolio totals and allocation percentages that sum to 100%
- Per-request price cache so duplicate tickers only hit yfinance once

### Settings
- Configurable strategy weight sliders (coupled so they always total 100%)
- Theme + colorblind modes (default, protanopia, deuteranopia, tritanopia)
- Privacy preferences
- API-key security status panel

---

## API Endpoints

All endpoints are versioned under `/api/v1/` (older `/api/` paths still work but include a `Deprecation: true` header).

| Method | Endpoint                                       | Description                                |
| ------ | ---------------------------------------------- | ------------------------------------------ |
| GET    | `/api/v1/search?q=<query>`                     | Search stocks by name or symbol            |
| GET    | `/api/v1/stock/<symbol>`                       | Current price and basic info               |
| GET    | `/api/v1/stock/<symbol>/history?period=<p>`    | OHLCV price history                        |
| GET    | `/api/v1/stock/<symbol>/fundamentals`          | EPS, P/E, margins, dividend yield, etc.    |
| GET    | `/api/v1/stock/<symbol>/news`                  | Recent news articles                       |
| GET    | `/api/v1/stock/<symbol>/backtest?period=<p>`   | Per-strategy historical accuracy (1y / 2y) |
| GET    | `/api/v1/signals/<symbol>[?w_*=...]`           | Aggregated signal; optional custom weights |
| GET    | `/api/v1/signals/<symbol>/history`             | Persisted signal history                   |
| GET    | `/api/v1/screener`                             | Ranked multi-symbol screener               |
| GET    | `/api/v1/watchlist`                            | Get watchlist                              |
| POST   | `/api/v1/watchlist/<symbol>`                   | Add to watchlist                           |
| DELETE | `/api/v1/watchlist/<symbol>`                   | Remove from watchlist                      |
| GET    | `/api/v1/journal`                              | List trades (server-computed P&L)          |
| POST   | `/api/v1/journal`                              | Create a trade                             |
| PUT    | `/api/v1/journal/<id>`                         | Close a trade (record exit price/date)     |
| DELETE | `/api/v1/journal/<id>`                         | Soft-delete a trade                        |
| GET    | `/api/v1/portfolio`                            | Aggregated open positions + totals         |
| GET    | `/api/v1/security/config`                      | Safe API-key configuration status          |
| GET    | `/health`                                      | Health check (rate-limit exempt)           |

**Valid history periods:** `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`

**Strategy weight params on `/signals`:** `w_momentum`, `w_mean_reversion`, `w_monte_carlo`, `w_factor_model` (floats in `[0, 1]`).

---

## Quantitative Strategies

The signal engine combines 4 independent strategies in a weighted ensemble. Weights are user-configurable in the Settings page; defaults below.

### 1. Momentum (30% default weight)
- 12-month absolute return
- Rate of Change (20-day and 60-day)
- Relative outperformance vs S&P 500 (SPY)

### 2. Mean Reversion (25% default weight)
- Z-score of current price vs 20-day moving average
- Bollinger Band %B indicator
- Identifies oversold (buy) and overbought (sell) conditions

### 3. Monte Carlo Simulation (25% default weight)
- 1,000 simulated price paths using Geometric Brownian Motion
- 30-day forecast horizon
- Uses historical volatility and drift from 252-day data
- Signal based on probability of price increase

### 4. Factor Model (20% default weight)
- **Value (35%):** P/E ratio scoring
- **Quality (30%):** ROE and profit margins
- **Volatility (35%):** lower volatility preferred

### Final Signal
| Aggregate Score | Signal |
| --------------- | ------ |
| > 0.15          | BUY    |
| < −0.15         | SELL   |
| −0.15 to 0.15   | HOLD   |

Confidence ranges from 30% to 100% based on score magnitude.

### Backtesting
The backtest engine fetches OHLCV history once, slices it into non-overlapping 21-day windows, runs each strategy on the data available at signal time, and checks whether the actual price move at day +21 matched the signal direction. HOLD signals are excluded from the accuracy count. A minimum of 10 valid windows is required; results are cached for one hour.

---

## Data & Persistence

- **Primary source:** Yahoo Finance via `yfinance` (live only — no mock fallback). Failures bubble up as proper HTTP errors rather than fake data.
- **In-memory cache:** per-symbol price, fundamentals, news, screener results, and backtests, each with its own TTL.
- **SQLite database (`backend/data/macropulse.db`, git-ignored):**
  - `watchlist` — persisted across restarts
  - `signal_history` — every aggregated signal, capped per symbol
  - `journal_trades` — full trading journal with soft-delete

---

## Security & Hardening

- CORS restricted to approved origins via `CORS_ORIGINS` env var
- Per-IP rate limiting via `flask-limiter` (with per-route overrides)
- API versioning (`/api/v1/`) with deprecation headers on legacy paths
- Debug mode opt-in via `FLASK_DEBUG=true`
- Configurable port via `FLASK_PORT`
- Health check endpoint (`/health`) for monitoring

---

## Dependencies

### Backend (`requirements.txt`)
```
flask==3.1.0
flask-cors==5.0.1
flask-limiter
yfinance>=0.2.51
numpy>=2.2.3
pandas>=2.2.3
python-dotenv
```

### Frontend (CDN, no install)
- Chart.js 4.4.1
- Font Awesome 6.5.1

---

## Design

- Dark theme inspired by GitHub's dark mode
- Colorblind themes: protanopia, deuteranopia, tritanopia
- Color palette: `#0d1117` background, `#58a6ff` accent blue, `#3fb950` buy/green, `#f85149` sell/red, `#d29922` hold/yellow
- Responsive layout, max container width 1200px

---

## Data Flow

```
User Action → Frontend JS → HTTP Request → Flask Route → Service Layer
    → Check In-Memory Cache → Hit? Return : Fetch from yfinance / SQLite
    → Store in Cache → Return JSON → Frontend renders UI
```
