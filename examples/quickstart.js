const BinanceFuturesClient = require('../binance-futures-client');
require('dotenv').config();

const client = new BinanceFuturesClient({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,
    debug: true
});

async function run() {
    try {
        console.log('--- Public API ---');
        const time = await client.getServerTime();
        console.log('Server Time:', time);

        const ticker = await client.getTickerPrice('BTCUSDT');
        console.log('BTCUSDT Price:', ticker.price);

        // --- WebSocket (Market) ---
        console.log('\n--- WebSocket Market Stream ---');
        console.log('Subscribing to btcusdt@aggTrade...');
        const marketWs = client.subscribeMarketStream('btcusdt@aggTrade');
        
        client.on('btcusdt@aggTrade', (data) => {
            console.log(`[Trade] ${data.s}: ${data.p} x ${data.q}`);
        });

        // --- WebSocket (User Data - if keys present) ---
        if (client.apiKey && client.apiSecret) {
            console.log('\n--- WebSocket User Stream ---');
            await client.subscribeUserStream();
            client.on('userData', (data) => {
                console.log('[User Data Event]:', data.e);
            });
        }

        // Keep alive for 10 seconds for demo
        setTimeout(() => {
            console.log('\nClosing demo...');
            marketWs.close();
            if (client.ws) client.unsubscribeUserStream();
            process.exit(0);
        }, 10000);

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
