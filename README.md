📊 Market Regime Dashboard — Pro Version

A real-time macro intelligence system for market regime detection and tactical asset allocation.

🧠 Product Overview

The Market Regime Dashboard is a quantitative macro framework that consolidates key economic and financial indicators into a single Regime Score (0–100).

It translates complex macro signals into an actionable market state:

Score	Regime	Interpretation
0–25	Crisis	Systemic risk, capital preservation
25–45	Bear Market	Defensive positioning
45–68	Transition	Mixed signals, tactical trading
68–100	Bull Market	Risk-on environment
🎯 Core Value Proposition

The system answers one fundamental question:

👉 “What environment am I trading in?”

Instead of:

reacting to noise
relying on single indicators

It provides:
✔ structured macro context
✔ cross-asset confirmation
✔ regime-based decision support

⚙️ System Architecture
Frontend (UI Dashboard)
    ↓
Vercel Serverless API (/api/market-regime)
    ↓
FRED Economic Data API
🧩 System Components
1. Frontend (Dashboard UI)

Location:

/public/index.html

Responsibilities:

Visualization of macro indicators
Regime Score display
Trend history & momentum tracking
Signal classification (Bull / Neutral / Bear / Warning)
Local caching (5 min TTL)
Error handling
2. Backend (Data & Logic Engine)

Location:

/api/market-regime.js

Responsibilities:

Data retrieval (FRED API)
Data transformation (YoY, spreads, momentum)
Signal classification
Weighted scoring model
JSON output for frontend
📊 Indicator Framework

The model integrates 10 macro + market indicators:

Category	Indicator	Role
Rates	Yield Curve (10Y–3M)	Recession signal
Credit	High Yield Spread	Risk premium
Policy	Fed Funds Rate	Monetary stance
Labor	Unemployment	Economic health
Inflation	CPI (YoY)	Policy constraint
Volatility	VIX	Market stress
Equity	S&P 500 Trend	Risk appetite
Bonds	10Y Treasury Yield	Valuation pressure
FX	USD Index	Global liquidity
Commodities	Copper	Growth expectations
🧮 Scoring Model

Each indicator is mapped to a signal:

bull = 10
neutral = 5
warning = 2
bear = 1

Then weighted:

yield_curve = 2.0
credit = 1.8
policy/labor = 1.5
others = 1.0–1.3

Final score:

score = weighted_sum / max_possible
📈 Output Example
{
  "score": 52,
  "label": "TRANSITION",
  "summary": "Mixed macro signals, no clear trend dominance."
}
🔑 Data Source

Primary source:

👉 Federal Reserve Economic Data (FRED)
https://fred.stlouisfed.org

Characteristics:

Official US macro data
High reliability
Mostly daily/monthly frequency
🔐 Security Architecture
No API keys exposed in frontend
All secrets stored in Vercel environment variables
Backend-only data access
🚀 Deployment (Vercel)
Required Structure
/api/market-regime.js
/public/index.html
Environment Variable
FRED_API_KEY = your_api_key
Test Endpoint
https://your-project.vercel.app/api/market-regime
⚠️ Limitations
No intraday macro updates
일부 indicators lagging (e.g. unemployment, CPI)
VIX & equity data may be delayed
US-centric dataset
📊 Use Cases
Traders
Regime-based strategy switching
Risk exposure calibration
Portfolio Managers
Asset allocation overlay
Macro confirmation layer
Retail Investors
Market orientation tool
Avoid emotional decision making
🧭 Strategic Interpretation
Regime	Strategy Bias
Bull	Growth / momentum
Transition	Selective / tactical
Bear	Defensive / hedging
Crisis	Capital preservation
🔮 Roadmap (Pro Expansion)

Planned features:

Real-time market data (Yahoo / Polygon)
Backtesting engine
Strategy recommendation layer
Portfolio allocation module
Alerts (Regime Shift Detection)
Multi-region macro (EU, China, AU)
TradingView integration
Mobile app version
💡 Product Vision

The dashboard evolves into:

👉 A macro operating system for traders

Bridging:

macro analysis
systematic trading
decision automation
⚖️ Disclaimer

This tool provides analytical insights, not financial advice.

All decisions remain the responsibility of the user.
