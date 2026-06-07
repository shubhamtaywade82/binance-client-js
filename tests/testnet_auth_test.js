const { BinanceFuturesClient } = require('../binance-futures-client');
require('dotenv').config();

/**
 * Authenticated Testnet Test Script
 * 
 * Performs:
 * 1. Fetch USDT Balance
 * 2. Get Account Information
 * 3. Place a safe Limit Buy order (far below market)
 * 4. Verify order existence
 * 5. Cancel the order
 */
async function runTestnetAuthTest() {
    // Check for API Keys
    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
        console.error('Error: BINANCE_API_KEY and BINANCE_API_SECRET must be set in your .env file.');
        console.log('Please update your .env file with your Binance Testnet keys.');
        process.exit(1);
    }

    const client = new BinanceFuturesClient({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
        testnet: true,
        debug: true // Helpful to see exactly what's being sent
    });

    const symbol = 'BTCUSDT';

    try {
        console.log('--- Phase 1: Account Information ---');
        const balances = await client.getBalance();
        const usdt = balances.find(b => b.asset === 'USDT');
        console.log(`[OK] USDT Balance: ${usdt.balance} (Available: ${usdt.availableBalance})`);

        const account = await client.getAccount();
        console.log(`[OK] Total Wallet Balance: ${account.totalWalletBalance} USDT`);

        console.log('\n--- Phase 2: Trading Operations ---');
        
        // We place an order at a very low price to ensure it doesn't get filled
        const testPrice = 30000; 
        console.log(`Placing a LIMIT BUY order for 0.005 ${symbol} at ${testPrice}...`);
        
        const order = await client.createOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity: 0.005,
            price: testPrice,
            timeInForce: 'GTC'
        });
        console.log(`[OK] Order Created. ID: ${order.orderId}, Status: ${order.status}`);

        console.log(`\nFetching status for Order ID: ${order.orderId}...`);
        const status = await client.getOrder(symbol, order.orderId);
        console.log(`[OK] Current Status: ${status.status}, Price: ${status.price}`);

        console.log(`\nCanceling Order ID: ${order.orderId}...`);
        const cancelResult = await client.cancelOrder(symbol, order.orderId);
        console.log(`[OK] Cancel Status: ${cancelResult.status}`);

        console.log('\n--- All Authenticated Tests Passed Successfully! ---');
        process.exit(0);

    } catch (error) {
        console.error('\n[FAIL] Testnet Authentication Test failed!');
        console.error('Error Details:', JSON.stringify(error, null, 2));
        process.exit(1);
    }
}

runTestnetAuthTest();
