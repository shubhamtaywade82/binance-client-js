/**
 * SMC Signal Detector - Live Test
 * Tests FVG and Liquidity Sweep detection on SOLUSDT
 */

const WebSocket = require('ws');

const CONFIG = { 
  symbol: 'SOLUSDT', 
  timeframes: ['1d', '4h', '1h', '15m', '5m'] 
};

let candles = {};
let ws = new WebSocket(
  'wss://stream.binance.com:9443/ws/' + 
  CONFIG.timeframes.map(tf => `${CONFIG.symbol.toLowerCase()}@kline_${tf}`).join('/')
);

let startTime = Date.now();
let tradeSignals = [];

console.log('🔬 SMC Signal Detector - Live Test');
console.log('   Symbol: SOLUSDT');
console.log('   Timeframes:', CONFIG.timeframes.join(', '));
console.log('   Duration: 60 seconds\n');

ws.on('open', () => console.log('✅ Connected to Binance WebSocket...\n'));

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (!msg.k || !msg.k.x) return; // Only closed candles
  
  const tf = msg.k.i;
  const candle = {
    time: msg.k.t,
    open: parseFloat(msg.k.o),
    high: parseFloat(msg.k.h),
    low: parseFloat(msg.k.l),
    close: parseFloat(msg.k.c),
    volume: parseFloat(msg.k.v)
  };
  
  if (!candles[tf]) candles[tf] = [];
  candles[tf].push(candle);
  if (candles[tf].length > 200) candles[tf].shift();
  
  // Check for signals after 30 seconds of data collection
  const runtime = Date.now() - startTime;
  if (runtime > 30000 && candles['5m'] && candles['5m'].length >= 20 && candles['1d'] && candles['1d'].length >= 10) {
    
    // Detect FVG on 5m
    const c5 = candles['5m'];
    for (let i = c5.length - 1; i >= Math.max(2, c5.length - 10); i--) {
      const curr = c5[i];
      const prev2 = c5[i-2];
      
      // Bullish FVG
      if (curr.low > prev2.high && (curr.close - curr.open) > (prev2.close - prev2.open) * 1.5) {
        const gapPct = ((curr.low - prev2.high) / curr.open) * 100;
        const exists = tradeSignals.some(s => s.type === 'FVG_BULL' && Math.abs(s.time - curr.time) < 300000);
        if (gapPct > 0.1 && !exists) {
          tradeSignals.push({ type: 'FVG_BULLISH', time: curr.time, price: curr.close, gap: gapPct.toFixed(3) + '%' });
          console.log(`📊 SIGNAL: Bullish FVG at $${curr.close} | Gap: ${gapPct.toFixed(3)}%`);
        }
      }
      
      // Bearish FVG
      if (curr.high < prev2.low && (prev2.open - prev2.close) > (curr.open - curr.close) * 1.5) {
        const gapPct = ((prev2.low - curr.high) / curr.open) * 100;
        const exists = tradeSignals.some(s => s.type === 'FVG_BEAR' && Math.abs(s.time - curr.time) < 300000);
        if (gapPct > 0.1 && !exists) {
          tradeSignals.push({ type: 'FVG_BEARISH', time: curr.time, price: curr.close, gap: gapPct.toFixed(3) + '%' });
          console.log(`📊 SIGNAL: Bearish FVG at $${curr.close} | Gap: ${gapPct.toFixed(3)}%`);
        }
      }
    }
    
    // Detect liquidity sweeps on 1h
    if (candles['1h'] && candles['1h'].length >= 5) {
      const c1h = candles['1h'];
      const recentHigh = Math.max(...c1h.slice(-5).map(c => c.high));
      const recentLow = Math.min(...c1h.slice(-5).map(c => c.low));
      const currentPrice = c5[c5.length-1].close;
      
      if (currentPrice > recentHigh * 1.002) {
        const exists = tradeSignals.some(s => s.type === 'SWEEP_HIGH' && Date.now() - s.time < 600000);
        if (!exists) {
          tradeSignals.push({ type: 'SWEEP_HIGH', time: Date.now(), price: currentPrice });
          console.log(`💧 LIQUIDITY SWEEP: Buy-side taken at $${currentPrice.toFixed(2)} (above ${recentHigh.toFixed(2)})`);
        }
      }
      
      if (currentPrice < recentLow * 0.998) {
        const exists = tradeSignals.some(s => s.type === 'SWEEP_LOW' && Date.now() - s.time < 600000);
        if (!exists) {
          tradeSignals.push({ type: 'SWEEP_LOW', time: Date.now(), price: currentPrice });
          console.log(`💧 LIQUIDITY SWEEP: Sell-side taken at $${currentPrice.toFixed(2)} (below ${recentLow.toFixed(2)})`);
        }
      }
    }
  }
});

ws.on('error', (err) => console.error('❌ Error:', err.message));

setTimeout(() => {
  ws.close();
  console.log('\n' + '='.repeat(50));
  console.log('--- SUMMARY ---');
  console.log('='.repeat(50));
  console.log(`Total Signals Detected: ${tradeSignals.length}`);
  console.log(`Candles Collected:`);
  Object.keys(candles).forEach(tf => console.log(`  ${tf}: ${candles[tf].length} candles`));
  
  if (tradeSignals.length > 0) {
    console.log('\nSignal Types:');
    const types = {};
    tradeSignals.forEach(s => types[s.type] = (types[s.type] || 0) + 1);
    Object.entries(types).forEach(([type, count]) => console.log(`  ${type}: ${count}`));
    
    console.log('\n🎯 Key Finding:');
    if (tradeSignals.some(s => s.type.includes('FVG'))) {
      console.log('   FVGs detected - Imbalance present in market');
    }
    if (tradeSignals.some(s => s.type.includes('SWEEP'))) {
      console.log('   Liquidity sweeps detected - Stop hunts occurring');
    }
  } else {
    console.log('\n⚠️ No clear SMC signals detected in this session.');
    console.log('   This is normal - institutional setups require specific confluence.');
    console.log('   Run longer or wait for higher volatility periods.');
  }
  console.log('='.repeat(50));
  process.exit(0);
}, 90000);
