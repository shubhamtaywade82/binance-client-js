# SOLUSDT Multi-Timeframe Trend Strategy Builder

A professional-grade cryptocurrency futures trading strategy for SOLUSDT with 10x leverage, designed to profit from trending markets in both LONG and SHORT directions.

## 🚀 Features

### Multi-Timeframe Analysis
- **Major Trend (1h)**: Determines overall market direction using EMA(50) and ADX
- **Intermediate Trend (15m)**: Confirms trend alignment with EMA crossover and RSI
- **Entry Timing (5m)**: Precise entry signals using EMA crossover + MACD confirmation

### Technical Indicators
- **EMA (Exponential Moving Average)**: 9, 21, and 50 periods for trend identification
- **ADX (Average Directional Index)**: Filters weak trends (requires ADX > 25)
- **RSI (Relative Strength Index)**: Momentum confirmation
- **MACD (Moving Average Convergence Divergence)**: Entry signal confirmation
- **ATR (Average True Range)**: Volatility measurement

### Risk Management
- **10x Leverage**: Amplifies gains (and losses) by 10x
- **Take Profit**: 2% price movement (20% return with 10x leverage)
- **Stop Loss**: 1% price movement (10% loss with 10x leverage)
- **Trailing Stop**: Activates after 1% profit, trails by 0.5%
- **Daily Loss Limit**: Stops trading after 5% account loss
- **Position Sizing**: 10% of account per trade (100% exposure with 10x leverage)
- **Cooldown Period**: 15 minutes between trades to prevent overtrading

### Exit Strategies
1. **Take Profit**: Fixed 2% gain target
2. **Stop Loss**: Fixed 1% loss limit
3. **Trailing Stop**: Locks in profits during strong trends
4. **Trend Weakness**: Exits when ADX drops below 20

## 📋 Prerequisites

```bash
npm install axios ws dotenv technicalindicators
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```bash
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

### Strategy Parameters

Edit the `SOLUSDTTrendStrategyBuilder` configuration:

```javascript
const strategy = new SOLUSDTTrendStrategyBuilder({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,  // ALWAYS use testnet first!
    pair: 'SOLUSDT',
    leverage: 10
});
```

### Customizable Parameters

You can modify these in the constructor:

```javascript
// Timeframes
this.timeframes = {
    entry: '5m',
    intermediate: '15m',
    major: '1h'
};

// Indicator settings
this.indicatorParams = {
    emaFast: 9,
    emaSlow: 21,
    emaMajor: 50,
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    adxPeriod: 14,
    atrPeriod: 14
};

// Risk management
this.riskParams = {
    takeProfit: 0.02,              // 2%
    stopLoss: 0.01,                // 1%
    trailingStopActivation: 0.01,  // Activate after 1% profit
    trailingStopDistance: 0.005,   // Trail by 0.5%
    accountRiskPerTrade: 0.10,     // 10% of account
    dailyLossLimit: 0.05,          // 5% daily loss limit
    cooldownPeriod: 15 * 60 * 1000 // 15 minutes
};
```

## ▶️ Running the Strategy

### Testnet (Recommended for Testing)

```bash
node examples/solusdt-trend-strategy-builder.js
```

### Live Trading (⚠️ Use at Your Own Risk)

Change `testnet: true` to `testnet: false` in the configuration.

## 📊 Entry Conditions

### LONG Position
All conditions must be met:
1. ✅ **1h timeframe**: Price > EMA(50) AND ADX > 25
2. ✅ **15m timeframe**: EMA(9) > EMA(21) AND RSI > 50
3. ✅ **5m timeframe**: EMA(9) crosses above EMA(21)
4. ✅ **5m timeframe**: MACD histogram turns positive
5. ✅ **5m timeframe**: ADX > 25 (strong trend)

### SHORT Position
All conditions must be met:
1. ✅ **1h timeframe**: Price < EMA(50) AND ADX > 25
2. ✅ **15m timeframe**: EMA(9) < EMA(21) AND RSI < 50
3. ✅ **5m timeframe**: EMA(9) crosses below EMA(21)
4. ✅ **5m timeframe**: MACD histogram turns negative
5. ✅ **5m timeframe**: ADX > 25 (strong trend)

## 📈 Example Output

```
🚀 SOLUSDT Multi-Timeframe Trend Strategy Builder Started
   Pair       : SOLUSDT
   Leverage   : 10x
   Timeframes : 5m (entry), 15m (intermediate), 1h (major)
   Network    : TESTNET

💰 Initializing account...
   Account Balance: 10000.00 USDT
   ✅ Leverage set to 10x

📥 Loading historical candle data...
   ✅ 5m: 50 candles loaded
   ✅ 15m: 50 candles loaded
   ✅ 1h: 100 candles loaded

📡 Subscribing to WebSocket streams...
   ✅ Subscribed to 5m and 15m streams

📈 LONG SIGNAL DETECTED!
   Major (1h):    Price > EMA(50)=145.23, ADX=28.45
   Inter (15m):   EMA(9) > EMA(21), RSI=62.34
   Entry (5m):    EMA Cross ↑, MACD=0.0234, ADX=27.89

📝 Executing BUY order...
   Position Size: 689.6552 SOL
   Position Value: 10000.00 USDT (10x leverage)
✅ LONG position opened @ 145.0000
   Target Profit: 147.9000
   Stop Loss: 143.5500

🏆 TAKE PROFIT triggered! PnL: +2.00%
📝 Closing LONG position (TAKE PROFIT)...
🏁 Position closed @ 147.9000
   PnL: 2000.00 USDT (+20.00%)
   Daily PnL: 2000.00 USDT
```

## ⚠️ Risk Warnings

1. **High Risk**: 10x leverage means a 1% price move against you results in a 10% loss
2. **Test First**: Always test on Binance Testnet before using real funds
3. **Not Financial Advice**: This is for educational purposes only
4. **Market Risk**: Crypto markets are highly volatile
5. **Liquidation Risk**: With 10x leverage, positions can be liquidated quickly

## 🛑 Graceful Shutdown

The strategy handles shutdown signals gracefully:

```bash
# Press Ctrl+C to stop
```

It will:
- Close any open positions
- Close WebSocket connections
- Log final PnL

## 📝 Monitoring

The strategy prints:
- Real-time signal detection
- Entry/exit notifications
- Status reports every 5 minutes
- PnL tracking

## 🔧 Troubleshooting

### "Insufficient balance" error
- Reduce `accountRiskPerTrade` in risk parameters
- Increase account balance

### "Minimum quantity" error
- Adjust position sizing calculation
- Check Binance minimum order size for SOLUSDT

### No signals generated
- Check if ADX threshold is too high for current market
- Verify all timeframes have sufficient data
- Market may be ranging (ADX < 25)

## 📚 Additional Resources

- [Binance Futures API Documentation](https://binance-docs.github.io/apidocs/futures/en/)
- [Technical Indicators Documentation](https://www.npmjs.com/package/technicalindicators)
- [Original Library Documentation](../README.md)

---

**Disclaimer**: This strategy is provided for educational purposes only. Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Always do your own research and never trade with money you cannot afford to lose.
