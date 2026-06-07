const BinanceFuturesClient = require('../binance-futures-client');

const client = new BinanceFuturesClient({
    testnet: true,
    debug: false // Set to false to avoid flooding the console with request URLs
});

const symbol = 'BTCUSDT';

async function testPublicEndpoints() {
    console.log('--- Testing Public REST Endpoints ---');
    try {
        const ping = await client.getPing();
        console.log('[OK] getPing:', ping);

        const serverTime = await client.getServerTime();
        console.log('[OK] getServerTime:', serverTime);

        const exchangeInfo = await client.getExchangeInfo();
        console.log('[OK] getExchangeInfo: Found', exchangeInfo.symbols.length, 'symbols');

        const orderBook = await client.getOrderBook(symbol, 5);
        console.log('[OK] getOrderBook:', { bids: orderBook.bids.length, asks: orderBook.asks.length });

        const klines = await client.getKlines(symbol, '1m', { limit: 5 });
        console.log('[OK] getKlines: Received', klines.length, 'candles');

        const tickerPrice = await client.getTickerPrice(symbol);
        console.log('[OK] getTickerPrice:', tickerPrice.symbol, 'is', tickerPrice.price);

        const markPrice = await client.getMarkPrice(symbol);
        console.log('[OK] getMarkPrice:', markPrice.symbol, 'markPrice is', markPrice.markPrice);

        const fundingRate = await client.getFundingRateHistory(symbol, 5);
        console.log('[OK] getFundingRateHistory: Received', fundingRate.length, 'entries');

        console.log('\n--- Testing Public WebSocket Streams ---');
        
        const streams = [`${symbol.toLowerCase()}@aggTrade`, `${symbol.toLowerCase()}@markPrice`];
        const receivedData = { aggTrade: false, markPrice: false };

        streams.forEach(stream => {
            console.log(`Subscribing to ${stream}...`);
            const ws = client.subscribeMarketStream(stream);

            client.on(stream, (data) => {
                if (stream.includes('aggTrade') && !receivedData.aggTrade) {
                    console.log(`[OK] Received data from ${stream}: Price ${data.p}`);
                    receivedData.aggTrade = true;
                }
                if (stream.includes('markPrice') && !receivedData.markPrice) {
                    console.log(`[OK] Received data from ${stream}: Mark Price ${data.p}`);
                    receivedData.markPrice = true;
                }

                // If both received, we can stop
                if (receivedData.aggTrade && receivedData.markPrice) {
                    // We don't have a direct way to close all WS from client yet in a single call
                    // but we can close them individually if we kept track.
                    // For this test, we'll just exit after a short timeout.
                }
            });

            // Auto-close WS after 10 seconds for safety
            setTimeout(() => ws.close(), 10000);
        });

        // Wait to ensure WS data is received
        setTimeout(() => {
            if (receivedData.aggTrade && receivedData.markPrice) {
                console.log('\nAll public tests passed successfully!');
                process.exit(0);
            } else {
                console.error('\nSome WebSocket tests timed out.');
                process.exit(1);
            }
        }, 8000);

    } catch (error) {
        console.error('\n[FAIL] Test failed with error:', error);
        process.exit(1);
    }
}

testPublicEndpoints();
