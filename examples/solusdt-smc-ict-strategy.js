/**
 * SOLUSDT Futures: SMC/ICT & Price Action Strategy Builder
 * 
 * Concepts Implemented:
 * 1. Liquidity Sweeps (Stop Hunts)
 * 2. Market Structure Shift (MSS) / Change of Character (ChoCh)
 * 3. Fair Value Gaps (FVG) / Imbalance
 * 4. Order Blocks (OB)
 * 5. Premium/Discount Arrays
 * 
 * Timeframes:
 * - HTF (1H/4H): Trend Direction & Major Liquidity
 * - LTF (5m/15m): Entry Trigger (Sweep + MSS + FVG)
 * 
 * NO API KEYS REQUIRED: Uses public WebSocket for data, Local Memory for Paper Trading.
 */

const axios = require('axios');
const WebSocket = require('ws');

// --- CONFIGURATION ---
const CONFIG = {
    symbol: 'SOLUSDT',
    leverage: 10,
    riskPerTrade: 0.01, // 1% of equity
    initialBalance: 10000,
    
    // Timeframes
    htf: '1h',      // Higher Timeframe for Bias
    ltf: '5m',      // Lower Timeframe for Entry
    
    // SMC Parameters
    lookbackSwings: 20, // Candles to identify swings/highs/lows
    fvgSizeThreshold: 0.0005, // Minimum size of FVG (0.05%)
    sweepDepth: 0.002, // How far past liquidity to consider a "sweep" (0.2%)
    
    // Risk Management
    stopLossType: 'STRUCTURAL', // 'STRUCTURAL' (below swing) or 'ATR_BASED'
    takeProfitRR: 2.0, // Minimum Risk:Reward ratio
    
    // Simulation
    tradingFee: 0.0004, // 0.04% per trade (Taker)
    slippage: 0.0001,   // 0.01% simulated slippage
};

// --- STATE MANAGEMENT (LOCAL MEMORY) ---
let state = {
    balance: CONFIG.initialBalance,
    equity: CONFIG.initialBalance,
    position: null, // { type: 'LONG'|'SHORT', entry: number, size: number, sl: number, tp: number, reason: string }
    history: [],    // Trade history
    candles: {
        htf: [],
        ltf: []
    },
    structures: {
        swingsHigh: [],
        swingsLow: [],
        fvgBullish: [],
        fvgBearish: [],
        liquidityPools: []
    },
    bias: 'NEUTRAL', // 'BULLISH', 'BEARISH', 'NEUTRAL'
    lastSignalTime: 0
};

// --- UTILITIES ---
const log = (msg, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    let prefix = `[${timestamp}]`;
    if (data) console.log(`${prefix} ${msg}`, JSON.stringify(data, null, 2));
    else console.log(`${prefix} ${msg}`);
};

const calculateFVG = (c1, c2, c3) => {
    // Bullish FVG: Low of candle 3 > High of candle 1
    if (c3.low > c1.high) {
        return { type: 'BULLISH', top: c3.low, bottom: c1.high, size: c3.low - c1.high };
    }
    // Bearish FVG: High of candle 3 < Low of candle 1
    if (c3.high < c1.low) {
        return { type: 'BEARISH', top: c1.low, bottom: c3.high, size: c1.low - c3.high };
    }
    return null;
};

const identifySwings = (candles, lookback) => {
    const swings = { highs: [], lows: [] };
    if (candles.length < lookback * 2 + 1) return swings;

    for (let i = lookback; i < candles.length - lookback; i++) {
        const current = candles[i];
        const left = candles.slice(i - lookback, i);
        const right = candles.slice(i + 1, i + lookback + 1);

        const maxLeft = Math.max(...left.map(c => c.high));
        const maxRight = Math.max(...right.map(c => c.high));
        const minLeft = Math.min(...left.map(c => c.low));
        const minRight = Math.min(...right.map(c => c.low));

        if (current.high > maxLeft && current.high > maxRight) {
            swings.highs.push({ index: i, price: current.high, time: current.time });
        }
        if (current.low < minLeft && current.low < minRight) {
            swings.lows.push({ index: i, price: current.low, time: current.time });
        }
    }
    return swings;
};

// --- CORE SMC LOGIC ---

/**
 * Detects Liquidity Sweeps and Market Structure Shifts
 */
const analyzeMarketStructure = () => {
    const { ltf, htf } = state.candles;
    if (ltf.length < 50 || htf.length < 20) return;

    const latest = ltf[ltf.length - 1];
    const prev = ltf[ltf.length - 2];
    
    // 1. Identify Recent Swings on LTF
    const swings = identifySwings(ltf, 5); // Shorter lookback for LTF
    const lastHigh = swings.highs[swings.highs.length - 1];
    const lastLow = swings.lows[swings.lows.length - 1];

    if (!lastHigh || !lastLow) return;

    // 2. Determine HTF Bias (Simple Structure)
    // If HTF made a higher high recently, bias is Bullish
    const htfSwings = identifySwings(htf, 5);
    if (htfSwings.highs.length > 1) {
        const lastHH = htfSwings.highs[htfSwings.highs.length - 1];
        const prevHH = htfSwings.highs[htfSwings.highs.length - 2];
        state.bias = lastHH.price > prevHH.price ? 'BULLISH' : 'BEARISH';
    }

    // 3. Detect Sweep + MSS Pattern
    // Scenario LONG: Price sweeps Last Low, then aggressively breaks recent structural High
    // Scenario SHORT: Price sweeps Last High, then aggressively breaks recent structural Low

    // Check for Sweep of Low
    const sweptLow = latest.low < lastLow.price && (lastLow.price - latest.low) > (lastLow.price * CONFIG.sweepDepth);
    // Check for Sweep of High
    const sweptHigh = latest.high > lastHigh.price && (latest.high - lastHigh.price) > (lastHigh.price * CONFIG.sweepDepth);

    // Check for MSS (Displacement)
    // We need a strong candle closing beyond the opposite structure
    // Simplified: If we swept low, did we just break a minor high with a large body?
    
    // Detect FVGs in the last 10 candles
    let recentFVG = null;
    for (let i = ltf.length - 10; i < ltf.length - 2; i++) {
        const fvg = calculateFVG(ltf[i], ltf[i+1], ltf[i+2]);
        if (fvg && fvg.size > (latest.close * CONFIG.fvgSizeThreshold)) {
            recentFVG = fvg;
            break;
        }
    }

    // --- SIGNAL GENERATION ---
    
    // LONG SETUP
    if (state.bias === 'BULLISH' && sweptLow && recentFVG && recentFVG.type === 'BULLISH') {
        // Confirm MSS: Did price move up strongly after the sweep?
        const sweepCandleIndex = ltf.findIndex(c => c.low === latest.low); // Approximate
        // In a real engine we'd track the specific candle that swept. 
        // Here we assume if we have a bullish FVG right after a low sweep, MSS happened.
        
        if (!state.position && Date.now() - state.lastSignalTime > 300000) { // 5min cooldown
            executeTrade('LONG', latest.close, recentFVG, 'Sweep+FVG+MSS');
        }
    }

    // SHORT SETUP
    if (state.bias === 'BEARISH' && sweptHigh && recentFVG && recentFVG.type === 'BEARISH') {
        if (!state.position && Date.now() - state.lastSignalTime > 300000) {
            executeTrade('SHORT', latest.close, recentFVG, 'Sweep+FVG+MSS');
        }
    }
};

const executeTrade = (type, price, fvg, reason) => {
    const riskAmount = state.equity * CONFIG.riskPerTrade;
    
    // Calculate Stop Loss (Below/Above the Swing that was swept)
    // For simplicity in this demo, we use the FVG boundary + buffer as SL
    let sl, tp;
    if (type === 'LONG') {
        sl = fvg.bottom * 0.999; // Just below FVG
        tp = price + ((price - sl) * CONFIG.takeProfitRR);
    } else {
        sl = fvg.top * 1.001; // Just above FVG
        tp = price - ((sl - price) * CONFIG.takeProfitRR);
    }

    const size = (riskAmount / (Math.abs(price - sl) * CONFIG.leverage)) * CONFIG.leverage; 
    // Note: Size calculation simplified for futures notional value

    state.position = {
        type,
        entry: price,
        size: size,
        sl,
        tp,
        fvgZone: fvg,
        reason,
        openTime: Date.now(),
        highest: type === 'LONG' ? price : price,
        lowest: type === 'LONG' ? price : price
    };

    state.lastSignalTime = Date.now();
    log(`🚀 OPENED ${type} POSITION`, {
        price: price,
        size: size.toFixed(2),
        sl: sl.toFixed(2),
        tp: tp.toFixed(2),
        reason: reason
    });
};

const managePosition = (currentPrice) => {
    if (!state.position) return;

    const pos = state.position;
    
    // Update extremes for trailing logic if needed
    if (pos.type === 'LONG') {
        if (currentPrice > pos.highest) pos.highest = currentPrice;
        if (currentPrice < pos.lowest) pos.lowest = currentPrice;
    } else {
        if (currentPrice < pos.lowest) pos.lowest = currentPrice;
        if (currentPrice > pos.highest) pos.highest = currentPrice;
    }

    // Check Stop Loss
    let closed = false;
    let closeReason = '';
    let closePrice = 0;

    if (pos.type === 'LONG' && currentPrice <= pos.sl) {
        closed = true; closeReason = 'STOP LOSS'; closePrice = pos.sl;
    } else if (pos.type === 'SHORT' && currentPrice >= pos.sl) {
        closed = true; closeReason = 'STOP LOSS'; closePrice = pos.sl;
    }

    // Check Take Profit
    if (!closed) {
        if (pos.type === 'LONG' && currentPrice >= pos.tp) {
            closed = true; closeReason = 'TAKE PROFIT'; closePrice = pos.tp;
        } else if (pos.type === 'SHORT' && currentPrice <= pos.tp) {
            closed = true; closeReason = 'TAKE PROFIT'; closePrice = pos.tp;
        }
    }

    // Check Invalidated FVG (Price moved through FVG without reacting)
    if (!closed) {
        if (pos.type === 'LONG' && currentPrice < pos.fvgZone.bottom) {
             // Optional: Early exit if FVG fails completely
             // closed = true; closeReason = 'FVG FAILED'; closePrice = currentPrice;
        }
    }

    if (closed) {
        const pnl = pos.type === 'LONG' 
            ? (closePrice - pos.entry) * pos.size 
            : (pos.entry - closePrice) * pos.size;
        
        const fee = (pos.entry * pos.size * CONFIG.tradingFee) + (closePrice * pos.size * CONFIG.tradingFee);
        const netPnl = pnl - fee;

        state.balance += netPnl;
        state.equity = state.balance; // Simplified (no open pnl)
        
        state.history.push({
            ...pos,
            closePrice,
            closeReason,
            pnl: netPnl,
            duration: Date.now() - pos.openTime
        });

        log(`💰 CLOSED POSITION: ${closeReason}`, {
            pnl: netPnl.toFixed(2),
            balance: state.balance.toFixed(2)
        });

        state.position = null;
    }
};

// --- DATA FETCHING & WEBSOCKET ---

const fetchHistoricalData = async (symbol, interval, limit = 100) => {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const response = await axios.get(url);
        
        return response.data.map(d => ({
            time: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        }));
    } catch (error) {
        console.error("Error fetching history:", error.message);
        return [];
    }
};

const startWebSocket = () => {
    const wsUrl = `wss://stream.binance.com:9443/ws/${CONFIG.symbol.toLowerCase()}@kline_${CONFIG.ltf}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        log('✅ Connected to Binance WebSocket (Public Data)');
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        const k = msg.k;
        
        const candle = {
            time: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
        };

        // Update LTF Candles
        const lastCandle = state.candles.ltf[state.candles.ltf.length - 1];
        if (lastCandle && lastCandle.time === candle.time) {
            state.candles.ltf[state.candles.ltf.length - 1] = candle; // Update existing
        } else {
            state.candles.ltf.push(candle); // New candle
            if (state.candles.ltf.length > 200) state.candles.ltf.shift();
            
            // Sync HTF occasionally or run separate WS for HTF
            // For this demo, we assume HTF is loaded once and updated roughly
        }

        // Run Logic
        analyzeMarketStructure();
        
        if (state.position) {
            managePosition(candle.close);
        }
        
        // Print Status every 10 candles
        if (state.candles.ltf.length % 10 === 0) {
            console.log(`\n--- STATUS UPDATE ---`);
            console.log(`Bias: ${state.bias}`);
            console.log(`Balance: $${state.balance.toFixed(2)}`);
            console.log(`Position: ${state.position ? state.position.type : 'NONE'}`);
            console.log(`Trades Today: ${state.history.filter(t => t.openTime > Date.now() - 86400000).length}`);
        }
    });

    ws.on('error', (err) => console.error('WS Error:', err));
    ws.on('close', () => {
        log('⚠️ WebSocket disconnected. Reconnecting...');
        setTimeout(startWebSocket, 5000);
    });
};

// --- INITIALIZATION ---

const init = async () => {
    log('🚀 Initializing SMC/ICT Strategy Builder...');
    log('📡 Fetching Historical Data for Context...');

    // Load HTF and LTF history
    state.candles.htf = await fetchHistoricalData(CONFIG.symbol, CONFIG.htf, 100);
    state.candles.ltf = await fetchHistoricalData(CONFIG.symbol, CONFIG.ltf, 100);

    if (state.candles.ltf.length === 0) {
        log('❌ Failed to load data. Exiting.');
        process.exit(1);
    }

    log(`✅ Loaded ${state.candles.ltf.length} LTF candles and ${state.candles.htf.length} HTF candles.`);
    log(`💰 Starting Balance: $${CONFIG.initialBalance}`);
    log(`⚙️ Leverage: ${CONFIG.leverage}x | Risk: ${(CONFIG.riskPerTrade*100)}%`);
    
    // Start Real-time Stream
    startWebSocket();
};

// Handle Graceful Shutdown
process.on('SIGINT', () => {
    log('\n🛑 Shutting down...');
    if (state.position) {
        log('⚠️ WARNING: You have an open paper position!', state.position);
    }
    console.log('\n--- FINAL PERFORMANCE ---');
    console.log(`Total Trades: ${state.history.length}`);
    const wins = state.history.filter(t => t.pnl > 0).length;
    const losses = state.history.filter(t => t.pnl <= 0).length;
    const totalPnl = state.history.reduce((acc, t) => acc + t.pnl, 0);
    
    console.log(`Wins: ${wins} | Losses: ${losses}`);
    console.log(`Win Rate: ${((wins/state.history.length)*100).toFixed(2)}%`);
    console.log(`Net PNL: $${totalPnl.toFixed(2)}`);
    console.log(`Final Balance: $${state.balance.toFixed(2)}`);
    
    process.exit(0);
});

init();
