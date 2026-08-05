# Adaptive Supertrend Backtest Report

## Executive Summary

This report presents the backtesting results of an **Adaptive Supertrend** strategy across multiple timeframes (5m, 15m, 1h, 4h, 1d) on BTCUSDT. The strategy uses volatility-based adaptive multipliers that adjust between 0.7x and 1.3x of the base multiplier (3.0) depending on market conditions.

## Strategy Details

### Configuration
- **Pair**: BTCUSDT
- **Base Period**: 10
- **Base Multiplier**: 3 (adapts between 2.1 - 3.9 based on volatility)
- **Lookback**: 1000 candles per timeframe
- **Hold Periods Analyzed**: 1, 3, 5, 10 candles

### Adaptive Mechanism
The multiplier adapts based on ATR volatility ratio:
- High volatility → Higher multiplier (wider bands, fewer false signals)
- Low volatility → Lower multiplier (tighter bands, earlier entries)
- Range: Base Multiplier × 0.7 to Base Multiplier × 1.3

---

## Key Findings by Timeframe

### 🟢 5-Minute Timeframe
**Signals**: 32 total (16 Bullish, 16 Bearish)  
**Avg Adaptive Multiplier**: 2.987  
**Avg ATR**: 68.55

#### Bullish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 16    | +0.0064    | 50.00      | 1.23          |
| 3    | 16    | +0.0195    | 50.00      | 1.47          |
| 5    | 16    | +0.0283    | 50.00      | 1.71          |
| 10   | 15    | -0.0561    | 40.00      | 0.52          |

#### Bearish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 16    | -0.0074    | 56.25      | 0.71          |
| 3    | 16    | -0.0271    | 37.50      | 0.56          |
| 5    | 16    | +0.0088    | 56.25      | 1.14          |
| 10   | 16    | -0.0032    | 56.25      | 0.97          |

**Insight**: Best performance on 5-candle hold for bullish signals (1.71 PF). Bearish signals show mixed results.

---

### 🟡 15-Minute Timeframe
**Signals**: 26 total (13 Bullish, 13 Bearish)  
**Avg Adaptive Multiplier**: 2.995  
**Avg ATR**: 133.60

#### Bullish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 13    | -0.0993    | 30.77      | 0.25          |
| 3    | 13    | -0.2155    | 38.46      | 0.11          |
| 5    | 13    | -0.1911    | 53.85      | 0.26          |
| 10   | 13    | -0.2979    | 38.46      | 0.11          |

#### Bearish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 13    | -0.0615    | 53.85      | 0.43          |
| 3    | 13    | -0.1034    | 23.08      | 0.31          |
| 5    | 13    | -0.1842    | 30.77      | 0.26          |
| 10   | 13    | -0.1711    | 46.15      | 0.35          |

**Insight**: Poor performance across all hold periods. This timeframe shows the weakest results, suggesting the adaptive supertrend may not work well in this middle ground.

---

### 🟠 1-Hour Timeframe
**Signals**: 22 total (11 Bullish, 11 Bearish)  
**Avg Adaptive Multiplier**: 2.993  
**Avg ATR**: 345.79

#### Bullish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 11    | +0.1551    | 54.55      | 2.79          |
| 3    | 11    | +0.2776    | 72.73      | 4.55          |
| 5    | 11    | +0.2401    | 54.55      | 4.98          |
| 10   | 11    | +0.0754    | 63.64      | 1.29          |

#### Bearish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 11    | -0.2382    | 45.45      | 0.24          |
| 3    | 11    | -0.2322    | 36.36      | 0.44          |
| 5    | 11    | -0.2502    | 27.27      | 0.37          |
| 10   | 11    | -0.7145    | 9.09       | 0.19          |

**Insight**: ⭐ **BEST TIMEFRAME FOR BULLISH SIGNALS** - Exceptional performance with 4.55-4.98 profit factor on 3-5 candle holds. Bearish signals underperform significantly.

---

### 🔵 4-Hour Timeframe
**Signals**: 30 total (15 Bullish, 15 Bearish)  
**Avg Adaptive Multiplier**: 3.000  
**Avg ATR**: 910.76

#### Bullish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 15    | +0.0447    | 46.67      | 1.14          |
| 3    | 15    | +0.2922    | 53.33      | 2.37          |
| 5    | 14    | -0.1813    | 50.00      | 0.76          |
| 10   | 14    | -0.1561    | 50.00      | 0.69          |

#### Bearish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 15    | -0.3448    | 26.67      | 0.32          |
| 3    | 15    | -0.5011    | 40.00      | 0.40          |
| 5    | 15    | -0.5094    | 46.67      | 0.55          |
| 10   | 15    | -1.5183    | 26.67      | 0.22          |

**Insight**: Good bullish performance on 3-candle hold (2.37 PF). Bearish signals consistently lose money.

---

### 🟣 Daily Timeframe
**Signals**: 26 total (13 Bullish, 13 Bearish)  
**Avg Adaptive Multiplier**: 3.000  
**Avg ATR**: 2899.69

#### Bullish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 13    | +0.4773    | 61.54      | 1.81          |
| 3    | 13    | +0.3966    | 61.54      | 1.28          |
| 5    | 13    | +1.6560    | 61.54      | 2.36          |
| 10   | 13    | +1.1309    | 53.85      | 1.52          |

#### Bearish Signals Performance
| Hold | Count | Avg Move % | Win Rate % | Profit Factor |
|------|-------|------------|------------|---------------|
| 1    | 13    | -0.4796    | 30.77      | 0.65          |
| 3    | 13    | -1.2111    | 23.08      | 0.47          |
| 5    | 13    | -2.3344    | 38.46      | 0.23          |
| 10   | 13    | -0.4828    | 61.54      | 0.80          |

**Insight**: Strong bullish performance, especially on 5-day hold (2.36 PF, +1.66% avg move). Bearish signals unprofitable except 10-day hold shows improvement.

---

## Overall Conclusions

### Best Performing Configurations

1. **1-Hour Bullish (3-5 candle hold)**: 
   - Profit Factor: 4.55 - 4.98
   - Win Rate: 54-73%
   - Average Move: +0.24% to +0.28%

2. **Daily Bullish (5-day hold)**:
   - Profit Factor: 2.36
   - Win Rate: 61.54%
   - Average Move: +1.66%

3. **4-Hour Bullish (3-candle hold)**:
   - Profit Factor: 2.37
   - Win Rate: 53.33%
   - Average Move: +0.29%

### Key Observations

1. **Bullish Bias**: All timeframes show significantly better performance on bullish signals vs bearish signals. This may indicate:
   - Long-term uptrend bias in BTC during the test period
   - Supertrend works better in trending markets than ranging/declining markets

2. **Optimal Hold Periods**: 
   - Shorter timeframes (5m, 1h): 3-5 candle holds work best
   - Longer timeframes (4h, 1d): 3-5 period holds also optimal

3. **15-Minute Anomaly**: The 15m timeframe showed unusually poor performance across all configurations, suggesting this may be a "noisy" timeframe for this strategy.

4. **Adaptive Multiplier Effectiveness**: The adaptive mechanism stayed close to the base 3.0 multiplier on average, with slight variations based on volatility regimes.

### Recommendations

1. **Focus on 1-Hour Timeframe**: Best risk-reward ratio for bullish signals
2. **Avoid Bearish Signals**: Or use additional filters to improve short-side performance
3. **Optimal Hold**: 3-5 candles across most timeframes
4. **Avoid 15m Timeframe**: Consistently underperforms
5. **Consider Trend Filter**: Add higher timeframe trend confirmation to improve bearish signal accuracy

---

## Data Files

Full results saved to: `supertrend-adaptive-backtest-results.json`

## Disclaimer

Past performance does not guarantee future results. This backtest is for educational purposes only and should not be considered financial advice. Always conduct your own research before trading.
