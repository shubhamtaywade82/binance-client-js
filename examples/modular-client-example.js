/**
 * Example: Using the Modular Binance Futures Client
 * 
 * This example demonstrates the new modular architecture similar to dhanhq-ts:
 * - Public endpoints work without credentials
 * - Private endpoints require API credentials
 * - All mainnet REST APIs and WebSocket connections are supported
 */

const { BinanceFuturesClient } = require('../src');

// ============================================
// 1. PUBLIC ACCESS (No Credentials Required)
// ============================================

console.log('=== PUBLIC MARKET DATA EXAMPLE ===\n');

const publicClient = new BinanceFuturesClient({ debug: true });

async function testPublicEndpoints() {
    try {
        // Check if credentials are available
        console.log('Has credentials:', publicClient.hasCredentials());
        
        // Server time
        const time = await publicClient.getServerTime();
        console.log('Server Time:', new Date(time.serverTime).toISOString());
        
        // Exchange info
        const exchangeInfo = await publicClient.getExchangeInfo();
        console.log('Exchange Info - Symbols count:', exchangeInfo.symbols.length);
        
        // Order book
        const orderBook = await publicClient.getOrderBook('BTCUSDT', 10);
        console.log('BTCUSDT Order Book - Best Bid:', orderBook.bids[0][0], 'Best Ask:', orderBook.asks[0][0]);
        
        // Recent trades
        const trades = await publicClient.getTrades('ETHUSDT', 5);
        console.log('ETHUSDT Recent Trades:', trades.length);
        
        // Klines/Candlesticks
        const klines = await publicClient.getKlines('BTCUSDT', '1h', { limit: 5 });
        console.log('BTCUSDT Klines:', klines.length, 'candles');
        
        // Ticker price
        const ticker = await publicClient.getTickerPrice('BTCUSDT');
        console.log('BTCUSDT Price:', ticker.price);
        
        // 24hr ticker
        const ticker24h = await publicClient.getTicker24h('BTCUSDT');
        console.log('BTCUSDT 24h Change:', ticker24h.priceChangePercent + '%');
        
        // Mark price
        const markPrice = await publicClient.getMarkPrice('BTCUSDT');
        console.log('BTCUSDT Mark Price:', markPrice.markPrice);
        
        // Funding rate
        const fundingRate = await publicClient.getFundingRateHistory('BTCUSDT', { limit: 1 });
        console.log('Latest Funding Rate:', fundingRate[0].fundingRate);
        
        // Open interest
        const oi = await publicClient.getOpenInterest('BTCUSDT');
        console.log('BTCUSDT Open Interest:', oi.openInterest);
        
        console.log('\n✓ All public endpoints working!\n');
    } catch (error) {
        console.error('✗ Public endpoint error:', error.message);
    }
}

// ============================================
// 2. PRIVATE ACCESS (Credentials Required)
// ============================================

console.log('=== PRIVATE ACCOUNT & TRADING EXAMPLE ===\n');

// Create client WITHOUT credentials first
const noAuthClient = new BinanceFuturesClient();

async function testAuthRequirement() {
    console.log('Testing authentication requirement...');
    console.log('Has credentials:', noAuthClient.hasCredentials());
    
    try {
        // This should fail
        await noAuthClient.getAccount();
        console.log('✗ Should have thrown authentication error');
    } catch (error) {
        console.log('✓ Correctly blocked -', error.message);
    }
    
    try {
        // This should also fail
        await noAuthClient.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: 0.001, price: 50000 });
        console.log('✗ Should have thrown authentication error');
    } catch (error) {
        console.log('✓ Correctly blocked -', error.message);
    }
    
    console.log('\n');
}

// Create client WITH credentials (use your own or testnet)
const authClient = new BinanceFuturesClient({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: true, // Use testnet for safety
    debug: true
});

async function testPrivateEndpoints() {
    if (!authClient.hasCredentials()) {
        console.log('⚠ Skipping private endpoints - No API credentials provided\n');
        console.log('To test private endpoints, set environment variables:');
        console.log('  export BINANCE_API_KEY=your_api_key');
        console.log('  export BINANCE_API_SECRET=your_api_secret\n');
        return;
    }
    
    console.log('Has credentials:', authClient.hasCredentials());
    
    try {
        // Account balance
        const balance = await authClient.getBalance();
        console.log('Account Balance:', balance.length, 'assets');
        
        // Account info
        const account = await authClient.getAccount();
        console.log('Account Available Balance:', account.availableBalance, 'USDT');
        
        // Position risk
        const positions = await authClient.getPositionRisk();
        console.log('Open Positions:', positions.filter(p => parseFloat(p.positionAmt) !== 0).length);
        
        // Open orders
        const openOrders = await authClient.getOpenOrders();
        console.log('Open Orders:', openOrders.length);
        
        // Commission rates
        const commission = await authClient.getCommissionRates('BTCUSDT');
        console.log('Maker Commission:', commission.makerCommissionRate, 'Taker:', commission.takerCommissionRate);
        
        console.log('\n✓ All private endpoints working!\n');
    } catch (error) {
        console.error('✗ Private endpoint error:', error.message);
    }
}

// ============================================
// 3. WEBSOCKET EXAMPLES
// ============================================

console.log('=== WEBSOCKET STREAMS EXAMPLE ===\n');

const wsClient = new BinanceFuturesClient({ debug: true });

function testWebSocketStreams() {
    console.log('Subscribing to market data streams (no auth required)...');
    
    // Subscribe to candlestick stream
    const candleWs = wsClient.subscribeCandles('BTCUSDT', '1m');
    
    candleWs.on('open', () => {
        console.log('✓ Candlestick stream connected');
    });
    
    candleWs.on('message', (data) => {
        console.log('🕯️ Candle Update:', data.k.s, data.k.c);
        // Close after first message for demo
        wsClient.closeAllWebSockets();
    });
    
    candleWs.on('error', (err) => {
        console.error('✗ WebSocket error:', err.message);
    });
}

// ============================================
// RUN ALL EXAMPLES
// ============================================

(async () => {
    await testPublicEndpoints();
    await testAuthRequirement();
    await testPrivateEndpoints();
    
    // Uncomment to test WebSocket (will keep running)
    // testWebSocketStreams();
    
    console.log('\n=== EXAMPLE COMPLETE ===');
})();
