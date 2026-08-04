
# SMC/ICT Strategy Backtest Report

## Configuration
- Symbol: SOLUSDT
- Leverage: 10x
- Interval: 5m
- Period: 2026-08-01T01:05:00.000Z to 2026-08-04T12:20:00.000Z
- Total Candles: 1000

## Results Summary
[
  {
    "strategy": "Order Block",
    "totalTrades": 6,
    "wins": 2,
    "losses": 4,
    "winRate": "33.33",
    "avgWin": "0.00",
    "avgLoss": "0.00",
    "profitFactor": "NaN",
    "expectancy": "0.00",
    "totalPnl": "-17.54",
    "hasEdge": false
  },
  {
    "strategy": "Price Action S/R",
    "totalTrades": 370,
    "wins": 152,
    "losses": 218,
    "winRate": "41.08",
    "avgWin": "0.00",
    "avgLoss": "0.00",
    "profitFactor": "NaN",
    "expectancy": "0.00",
    "totalPnl": "200.40",
    "hasEdge": false
  }
]

## Conclusion
❌ No strategy showed consistent edge. Consider:
  - Adjusting parameters
  - Adding filters (volume, volatility)
  - Testing different timeframes
  - Combining strategies
