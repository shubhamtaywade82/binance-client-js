const BinanceFuturesClient = require('../binance-futures-client');

const client = new BinanceFuturesClient({
    testnet: true,
    debug: false
});

const symbol = 'BTCUSDT';
const period = '5m';

async function testAdvancedPublic() {
    console.log('--- Testing Advanced Public REST Endpoints ---');
    try {
        const oiHist = await client.getOpenInterestHistory(symbol, period, { limit: 5 });
        console.log('[OK] getOpenInterestHistory: Found', oiHist.length, 'entries');

        const topTraderPos = await client.getTopLongShortPositionRatio(symbol, period, { limit: 5 });
        console.log('[OK] getTopLongShortPositionRatio: Found', topTraderPos.length, 'entries');

        const takerVol = await client.getTakerBuySellVolume(symbol, period, { limit: 5 });
        console.log('[OK] getTakerBuySellVolume: Found', takerVol.length, 'entries');

        try {
            const assetIndex = await client.getAssetIndex('BTC');
            console.log('[OK] getAssetIndex (BTC):', assetIndex);
        } catch (e) {
            console.log('[INFO] getAssetIndex (BTC) failed (might not be on testnet):', e.msg || e);
        }

        const adl = client.apiKey ? await client.getAdlQuantile(symbol) : 'Skipped (needs API Key)';
        console.log('[OK] getAdlQuantile:', adl);

        console.log('\n--- Testing Advanced WebSocket Streams ---');
        
        console.log('Subscribing to All Market Tickers...');
        const tickerWs = client.subscribeAllMarketTickers();
        client.on('!ticker@arr', (data) => {
            console.log(`[OK] Received All Market Tickers data. Array size: ${data.length}`);
            tickerWs.close();
        });

        console.log('Subscribing to All Book Tickers...');
        const bookWs = client.subscribeAllBookTickers();
        client.on('!bookTicker', (data) => {
            console.log(`[OK] Received Book Ticker: ${data.s} Bid: ${data.b} Ask: ${data.a}`);
            bookWs.close();
        });

        // Exit after 10 seconds
        setTimeout(() => {
            console.log('\nAdvanced tests completed (WS results shown if data was received).');
            process.exit(0);
        }, 10000);

    } catch (error) {
        console.error('\n[FAIL] Advanced test failed with error:', error);
        process.exit(1);
    }
}

testAdvancedPublic();
