const https = require('https');
const crypto = require('crypto');

/**
 * AI-Enhanced Regime-Adaptive Supertrend + KNN + ADX Backtester
 * Target: SOLUSDT
 * Features:
 * 1. Regime Classification (Trend/Volatility based)
 * 2. Adaptive Supertrend (Multiplier shifts by regime)
 * 3. KNN Pattern Matching
 * 4. ADX Directional Filtering
 * 5. AI/LLM Decision Layer (Ollama) for Entry/SL/TP/Capital
 */

// ================= CONFIGURATION =================
const CONFIG = {
  symbol: 'SOLUSDT',
  interval: '1h', // Base timeframe
  lookbackDays: 60,
  initialCapital: 10000,
  
  // Ollama AI Config
  USE_LIVE_AI: false, // Set true to call actual Ollama API
  OLLAMA_API_KEYS: [
    '2e09a33013334e669cdb321a1d7fcda4.M5-b44CAVbwiY9yOKx2GG_-Y',
    '4f01b45b1892426ab239db6ac99859cd.MZYP36XuJnkZ5oZg2TFXvs_x'
  ],
  OLLAMA_MODEL: 'ossgpt120b', // Or 'llama3', 'mistral'
  OLLAMA_HOST: 'localhost:11434', // Default local, change if using cloud
  
  // Strategy Parameters
  supertrendPeriod: 10,
  adxPeriod: 14,
  knnNeighbors: 5,
  minKnnScore: 0.55, // Minimum win rate from KNN neighbors
  
  // Risk Limits (Hard Caps)
  maxCapitalPerTrade: 0.05, // 5% max
  stopLossLimit: 0.15, // Max 15% SL
};

// ================= UTILS =================
const request = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON Parse Error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

// ================= INDICATORS =================
function calculateATR(data, period) {
  const atr = [];
  const tr = [];
  for (let i = 0; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const close = i > 0 ? data[i - 1].close : data[i].close;
    const val = Math.max(high - low, Math.abs(high - close), Math.abs(low - close));
    tr.push(val);
    if (i < period - 1) {
      atr.push(null);
    } else if (i === period - 1) {
      const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
    }
  }
  return atr;
}

function calculateSupertrend(data, atr, period, multiplier) {
  const st = [];
  const direction = [];
  const finalUpper = [];
  const finalLower = [];
  
  for (let i = 0; i < data.length; i++) {
    if (atr[i] === null) {
      st.push(null);
      direction.push(null);
      finalUpper.push(null);
      finalLower.push(null);
      continue;
    }

    const hl2 = (data[i].high + data[i].low) / 2;
    const basicUpper = hl2 + (multiplier * atr[i]);
    const basicLower = hl2 - (multiplier * atr[i]);

    if (i === 0) {
      finalUpper.push(basicUpper);
      finalLower.push(basicLower);
      direction.push(1); // Default bullish start
      st.push(finalLower[0]);
      continue;
    }

    // Calculate Final Upper
    let fu;
    if (basicUpper < finalUpper[i - 1] || data[i - 1].close > finalUpper[i - 1]) {
      fu = basicUpper;
    } else {
      fu = finalUpper[i - 1];
    }

    // Calculate Final Lower
    let fl;
    if (basicLower > finalLower[i - 1] || data[i - 1].close < finalLower[i - 1]) {
      fl = basicLower;
    } else {
      fl = finalLower[i - 1];
    }

    finalUpper.push(fu);
    finalLower.push(fl);

    // Determine Direction
    let dir = direction[i - 1];
    if (dir === 1) {
      if (data[i].close < fl) {
        dir = -1;
      } else {
        dir = 1;
      }
    } else {
      if (data[i].close > fu) {
        dir = 1;
      } else {
        dir = -1;
      }
    }
    direction.push(dir);
    
    // Supertrend Value
    st.push(dir === 1 ? fl : fu);
  }
  return { st, direction, finalUpper, finalLower };
}

function calculateADX(data, period) {
  const adx = [];
  const plusDI = [];
  const minusDI = [];
  
  const tr = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(0);
      plusDM.push(0);
      minusDM.push(0);
      continue;
    }
    const move = data[i].high - data[i - 1].high;
    const shift = data[i - 1].low - data[i].low;
    
    // True Range
    const h_l = data[i].high - data[i].low;
    const h_c0 = Math.abs(data[i].high - data[i - 1].close);
    const l_c0 = Math.abs(data[i].low - data[i - 1].close);
    tr.push(Math.max(h_l, h_c0, l_c0));

    // DM
    let pDM = 0, mDM = 0;
    if (move > shift && move > 0) pDM = move;
    if (shift > move && shift > 0) mDM = shift;
    plusDM.push(pDM);
    minusDM.push(mDM);
  }

  // Smooth TR, +DM, -DM
  const avgTR = new Array(data.length).fill(null);
  const avgPlusDM = new Array(data.length).fill(null);
  const avgMinusDM = new Array(data.length).fill(null);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) {
      let sumTR = 0, sumP = 0, sumM = 0;
      for (let j = 0; j < period; j++) {
        sumTR += tr[j];
        sumP += plusDM[j];
        sumM += minusDM[j];
      }
      avgTR[i] = sumTR / period;
      avgPlusDM[i] = sumP / period;
      avgMinusDM[i] = sumM / period;
    } else {
      avgTR[i] = (avgTR[i - 1] * (period - 1) + tr[i]) / period;
      avgPlusDM[i] = (avgPlusDM[i - 1] * (period - 1) + plusDM[i]) / period;
      avgMinusDM[i] = (avgMinusDM[i - 1] * (period - 1) + minusDM[i]) / period;
    }
  }

  // Calculate DI and ADX
  for (let i = 0; i < data.length; i++) {
    if (avgTR[i] === null || avgTR[i] === 0) {
      adx.push(null);
      plusDI.push(null);
      minusDI.push(null);
      continue;
    }
    const pDI = (avgPlusDM[i] / avgTR[i]) * 100;
    const mDI = (avgMinusDM[i] / avgTR[i]) * 100;
    plusDI.push(pDI);
    minusDI.push(mDI);

    const dx = Math.abs(pDI - mDI) / (pDI + mDI) * 100;
    
    if (i < 2 * period - 1) {
      adx.push(null);
    } else if (i === 2 * period - 1) {
      let sumDX = 0;
      for (let j = period - 1; j <= i; j++) {
        const p = (avgPlusDM[j] / avgTR[j]) * 100;
        const m = (avgMinusDM[j] / avgTR[j]) * 100;
        sumDX += (Math.abs(p - m) / (p + m) * 100);
      }
      adx.push(sumDX / period);
    } else {
      const prevADX = adx[i - 1];
      const currentDX = dx;
      adx.push((prevADX * (period - 1) + currentDX) / period);
    }
  }
  return { adx, plusDI, minusDI };
}

// ================= REGIME CLASSIFICATION =================
function classifyRegime(adx, atrRatio, priceChange) {
  // Simple rule-based regime classification
  // Can be replaced with K-Means clustering if needed
  if (adx < 20 && atrRatio < 0.8) return 'DEAD_ZONE';
  if (adx >= 20 && atrRatio >= 1.2) return 'STRONG_TREND';
  if (adx < 20 && atrRatio >= 1.2) return 'WEAK_TREND_VOLATILE';
  if (adx >= 20 && atrRatio < 1.2) return 'LOW_VOL_BREAKOUT';
  return 'NEUTRAL';
}

// ================= KNN SIMULATION =================
function simulateKNN(history, currentFeatures, k) {
  // Features: [ATR_Ratio, ADX, DI_Diff, Body_Ratio]
  // In a real scenario, this would search a vector DB
  // Here we simulate a "confidence score" based on recent regime performance
  const recentWins = history.slice(-20).filter(t => t.pnl > 0).length;
  const total = history.slice(-20).length;
  const winRate = total === 0 ? 0.5 : recentWins / total;
  
  return {
    score: winRate,
    neighbors: k,
    signal: winRate > 0.55 ? 'CONFIRM' : 'IGNORE'
  };
}

// ================= AI INTEGRATION (OLLAMA) =================
async function queryOllamaAI(context) {
  if (!CONFIG.USE_LIVE_AI) {
    // Simulation Mode: Deterministic heuristic mimicking AI
    return simulateAIResponse(context);
  }

  const prompt = `
    You are an expert crypto trading AI. Analyze the following market data for SOLUSDT and decide on a trade action.
    
    Market Context:
    - Regime: ${context.regime}
    - Price: ${context.price}
    - ATR Ratio: ${context.atrRatio.toFixed(2)} (High = Volatile)
    - ADX: ${context.adx.toFixed(2)} (Trend Strength)
    - Supertrend Direction: ${context.stDir > 0 ? 'BULLISH' : 'BEARISH'}
    - KNN Confidence: ${(context.knnScore * 100).toFixed(1)}%
    - +DI: ${context.plusDI.toFixed(2)}, -DI: ${context.minusDI.toFixed(2)}
    
    Task:
    1. Decide Action: 'LONG', 'SHORT', or 'WAIT'
    2. Set Confidence (0.0-1.0)
    3. Suggest StopLoss Multiplier (ATR mult, e.g., 2.0)
    4. Suggest TakeProfit Multiplier (ATR mult, e.g., 3.0)
    5. Suggest Capital Allocation (0.01 to 0.05)
    6. Provide brief Reasoning.

    Output STRICTLY valid JSON only:
    {
      "action": "LONG",
      "confidence": 0.85,
      "sl_mult": 2.5,
      "tp_mult": 4.0,
      "allocation": 0.02,
      "reasoning": "Strong trend confirmed by ADX and KNN..."
    }
  `;

  const payload = JSON.stringify({
    model: CONFIG.OLLAMA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    format: "json",
    stream: false
  });

  const options = {
    hostname: CONFIG.OLLAMA_HOST.split(':')[0],
    port: CONFIG.OLLAMA_HOST.split(':')[1] || 443,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.OLLAMA_API_KEYS[0]}`, // Using first key
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const res = await request(options, payload);
    if (res.message && res.message.content) {
      return JSON.parse(res.message.content);
    }
    throw new Error('Invalid AI response structure');
  } catch (err) {
    console.warn(`AI Query Failed: ${err.message}. Falling back to simulation.`);
    return simulateAIResponse(context);
  }
}

function simulateAIResponse(context) {
  // Heuristic fallback for speed/reproducibility
  let action = 'WAIT';
  let confidence = 0.5;
  let sl_mult = 2.0;
  let tp_mult = 3.0;
  let allocation = 0.01;
  let reasoning = "Neutral market conditions.";

  if (context.regime === 'DEAD_ZONE') {
    reasoning = "Market dead zone detected.";
  } else if (context.knnScore < CONFIG.minKnnScore) {
    reasoning = "KNN pattern confidence too low.";
  } else {
    const bullish = context.stDir > 0 && context.plusDI > context.minusDI;
    const bearish = context.stDir < 0 && context.minusDI > context.plusDI;

    if (bullish) {
      action = 'LONG';
      confidence = 0.6 + (context.knnScore * 0.3);
      reasoning = "Bullish Supertrend + DI confirmation.";
      if (context.regime === 'STRONG_TREND') {
        tp_mult = 4.0; sl_mult = 2.5; allocation = 0.03;
        reasoning += " Strong trend allows wider targets.";
      } else {
        tp_mult = 2.0; sl_mult = 1.5; allocation = 0.01;
        reasoning += " Volatile regime, taking quick profits.";
      }
    } else if (bearish) {
      action = 'SHORT';
      confidence = 0.6 + (context.knnScore * 0.3);
      reasoning = "Bearish Supertrend + DI confirmation.";
      if (context.regime === 'STRONG_TREND') {
        tp_mult = 4.0; sl_mult = 2.5; allocation = 0.03;
      } else {
        tp_mult = 2.0; sl_mult = 1.5; allocation = 0.01;
      }
    } else {
      reasoning = "Conflicting signals (ST vs DI).";
    }
  }

  return { action, confidence, sl_mult, tp_mult, allocation, reasoning };
}

// ================= BACKTEST ENGINE =================
async function runBacktest() {
  console.log(`🚀 Starting AI-Enhanced Backtest for ${CONFIG.symbol}...`);
  
  // 1. Fetch Data (Mocking for standalone script, replace with Binance API call)
  // In production: await binanceClient.fetchCandles(...)
  const mockData = []; 
  const basePrice = 145.0;
  let price = basePrice;
  for(let i=0; i<2000; i++) {
    const change = (Math.random() - 0.5) * 4;
    price += change;
    mockData.push({
      time: Date.now() - (2000-i)*3600000,
      open: price,
      high: price + Math.random()*2,
      low: price - Math.random()*2,
      close: price + (Math.random()-0.5)*2
    });
  }

  // 2. Calculate Indicators
  const atr = calculateATR(mockData, CONFIG.supertrendPeriod);
  const { st, direction } = calculateSupertrend(mockData, atr, CONFIG.supertrendPeriod, 2.0); // Base mult
  const { adx, plusDI, minusDI } = calculateADX(mockData, CONFIG.adxPeriod);

  // 3. Run Loop
  let capital = CONFIG.initialCapital;
  let position = null; // { type: 'LONG'|'SHORT', entry: number, size: number, sl: number, tp: number }
  const trades = [];
  const equityCurve = [];

  const avgATR = atr.slice(100).filter(x=>x).reduce((a,b)=>a+b,0) / atr.slice(100).filter(x=>x).length;

  for (let i = 100; i < mockData.length; i++) {
    if (!st[i] || !adx[i]) continue;

    const currentPrice = mockData[i].close;
    const currentATR = atr[i];
    const atrRatio = currentATR / avgATR;
    const regime = classifyRegime(adx[i], atrRatio, 0);
    
    // Prepare AI Context
    const aiContext = {
      regime,
      price: currentPrice,
      atrRatio,
      adx: adx[i],
      stDir: direction[i],
      knnScore: simulateKNN(trades, [], CONFIG.knnNeighbors).score,
      plusDI: plusDI[i],
      minusDI: minusDI[i]
    };

    // Query AI
    const aiDecision = await queryOllamaAI(aiContext);

    // Execute Logic
    if (position) {
      // Check Exit
      let exitPrice = null;
      let exitReason = '';
      
      if (position.type === 'LONG') {
        if (currentPrice <= position.sl) { exitPrice = position.sl; exitReason = 'SL'; }
        else if (currentPrice >= position.tp) { exitPrice = position.tp; exitReason = 'TP'; }
        else if (direction[i] === -1) { exitPrice = currentPrice; exitReason = 'ST_REVERSAL'; }
      } else {
        if (currentPrice >= position.sl) { exitPrice = position.sl; exitReason = 'SL'; }
        else if (currentPrice <= position.tp) { exitPrice = position.tp; exitReason = 'TP'; }
        else if (direction[i] === 1) { exitPrice = currentPrice; exitReason = 'ST_REVERSAL'; }
      }

      if (exitPrice) {
        const pnl = position.type === 'LONG' 
          ? (exitPrice - position.entry) * position.size 
          : (position.entry - exitPrice) * position.size;
        
        capital += pnl;
        trades.push({
          entry: position.entry,
          exit: exitPrice,
          pnl,
          type: position.type,
          reason: exitReason,
          aiReasoning: position.aiReasoning
        });
        position = null;
      }
    } else {
      // Check Entry
      if (aiDecision.action !== 'WAIT' && aiDecision.confidence > 0.6) {
        const riskPercent = Math.min(aiDecision.allocation, CONFIG.maxCapitalPerTrade);
        const riskAmount = capital * riskPercent;
        
        const slDist = currentATR * aiDecision.sl_mult;
        const tpDist = currentATR * aiDecision.tp_mult;
        
        let entry = currentPrice;
        let sl, tp;
        
        if (aiDecision.action === 'LONG') {
          sl = entry - slDist;
          tp = entry + tpDist;
        } else {
          sl = entry + slDist;
          tp = entry - tpDist;
        }

        // Hard Limits
        if (Math.abs(entry - sl) / entry > CONFIG.stopLossLimit) continue;

        const size = riskAmount / Math.abs(entry - sl);
        
        position = {
          type: aiDecision.action,
          entry,
          size,
          sl,
          tp,
          aiReasoning: aiDecision.reasoning
        };
        
        console.log(`[${new Date(mockData[i].time).toISOString().split('T')[0]}] ${aiDecision.action} @ ${entry.toFixed(2)} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | Reason: ${aiDecision.reasoning}`);
      }
    }
    
    equityCurve.push(capital);
  }

  // Results
  const totalReturn = ((capital - CONFIG.initialCapital) / CONFIG.initialCapital) * 100;
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  
  console.log("\n=== FINAL RESULTS ===");
  console.log(`Total Return: ${totalReturn.toFixed(2)}%`);
  console.log(`Total Trades: ${trades.length}`);
  console.log(`Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`Final Capital: $${capital.toFixed(2)}`);
  console.log("=====================\n");
  
  return { totalReturn, trades, winRate, finalCapital: capital };
}

// Run
runBacktest().catch(console.error);
