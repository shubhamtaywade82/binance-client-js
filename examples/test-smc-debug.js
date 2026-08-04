const WebSocket = require('ws');

const CONFIG = { symbol: 'SOLUSDT', timeframes: ['5m', '15m', '1h'] };
let candles = {};
let ws = new WebSocket(
  'wss://stream.binance.com:9443/ws/' + 
  CONFIG.timeframes.map(tf => `${CONFIG.symbol.toLowerCase()}@kline_${tf}`).join('/')
);

let startTime = Date.now();
let signalCount = 0;

console.log('🔬 SMC Debug - Checking data flow...\n');

ws.on('open', () => console.log('✅ Connected\n'));

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (!msg.k || !msg.k.x) return;
  
  const tf = msg.k.i;
  const candle = {
    time: msg.k.t,
    open: parseFloat(msg.k.o),
    high: parseFloat(msg.k.h),
    low: parseFloat(msg.k.l),
    close: parseFloat(msg.k.c)
  };
  
  if (!candles[tf]) candles[tf] = [];
  candles[tf].push(candle);
  if (candles[tf].length > 50) candles[tf].shift();
  
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  if (runtime % 10 === 0 && runtime > 0) {
    console.log(`[${runtime}s] Candles: 5m=${candles['5m']?.length||0}, 15m=${candles['15m']?.length||0}, 1h=${candles['1h']?.length||0}`);
  }
  
  // Detect FVG with relaxed criteria
  if (candles['5m'] && candles['5m'].length >= 5) {
    const c5 = candles['5m'];
    for (let i = c5.length - 1; i >= 2; i--) {
      const curr = c5[i], prev2 = c5[i-2];
      
      if (curr.low > prev2.high) {
        const gap = ((curr.low - prev2.high) / curr.open) * 100;
        if (gap > 0.05 && signalCount < 3) {
          console.log(`📊 Bullish FVG: $${curr.close.toFixed(2)} | Gap: ${gap.toFixed(3)}%`);
          signalCount++;
        }
      }
      if (curr.high < prev2.low) {
        const gap = ((prev2.low - curr.high) / curr.open) * 100;
        if (gap > 0.05 && signalCount < 3) {
          console.log(`📊 Bearish FVG: $${curr.close.toFixed(2)} | Gap: ${gap.toFixed(3)}%`);
          signalCount++;
        }
      }
    }
  }
});

ws.on('error', (err) => console.error('Error:', err.message));

setTimeout(() => {
  ws.close();
  console.log('\n--- Final Status ---');
  console.log(`Signals found: ${signalCount}`);
  Object.keys(candles).forEach(tf => console.log(`${tf}: ${candles[tf].length} candles`));
  process.exit(0);
}, 60000);
