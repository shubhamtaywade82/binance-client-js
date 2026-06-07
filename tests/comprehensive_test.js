const { BinanceFuturesClient } = require('../binance-futures-client');

const client = new BinanceFuturesClient({
    testnet: true,
    debug: false
});

const symbol = 'BTCUSDT';

async function testNewComprehensiveMethods() {
    console.log('--- Testing New Advanced Public REST Endpoints ---');
    try {
        const globalRatio = await client.getGlobalLongShortAccountRatio(symbol, '5m', { limit: 5 });
        console.log('[OK] getGlobalLongShortAccountRatio: Found', globalRatio.length, 'entries');

        const basis = await client.getBasis(symbol, '5m', { limit: 5 });
        console.log('[OK] getBasis: Found', basis.length, 'entries');

        try {
            const indexInfo = await client.getCompositeIndexInfo(symbol);
            console.log('[OK] getCompositeIndexInfo:', indexInfo.symbol || 'Empty response');
        } catch (e) {
            console.log('[INFO] getCompositeIndexInfo failed (standard for some symbols on testnet):', e.msg || e.message);
        }

        try {
            const constituents = await client.getIndexPriceConstituents(symbol);
            console.log('[OK] getIndexPriceConstituents: Found', constituents.constituents ? constituents.constituents.length : 0, 'constituents');
        } catch (e) {
            console.log('[INFO] getIndexPriceConstituents failed (standard for some symbols on testnet):', e.msg || e.message);
        }

        console.log('\n--- Testing New Advanced WebSocket Streams ---');
        
        console.log('Subscribing to Market-wide Liquidation Orders...');
        const liqWs = client.wsSubscribeAllLiquidationOrders();
        client.on('ws:allLiquidationOrders', (data) => {
            console.log(`[OK] Received Liquidation Order for ${data.symbol}`);
            liqWs.close();
        });

        console.log('Subscribing to Composite Index Price...');
        const compWs = client.wsSubscribeCompositeIndex('DEFIUSDT');
        client.on('ws:compositeIndex', (data) => {
            console.log(`[OK] Received Composite Index update for ${data.symbol}: Price ${data.close}`);
            compWs.close();
        });

        // Exit after 10 seconds
        setTimeout(() => {
            console.log('\nComprehensive coverage tests completed.');
            process.exit(0);
        }, 10000);

    } catch (error) {
        console.error('\n[FAIL] Comprehensive test failed with error:', error);
        process.exit(1);
    }
}

testNewComprehensiveMethods();
