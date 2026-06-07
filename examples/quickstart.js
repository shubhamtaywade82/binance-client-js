const BinanceFuturesClient = require('../binance-futures-client');
require('dotenv').config();

const client = new BinanceFuturesClient({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: true, // Use testnet for safety
    debug: true
});

async function run() {
    try {
        console.log('--- Public API ---');
        const time = await client.getTime();
        console.log('Server Time:', time);

        const exchangeInfo = await client.getExchangeInfo();
        console.log('Exchange Info (Symbols count):', exchangeInfo.symbols.length);

        const ticker = await client.getTickerPrice('BTCUSDT');
        console.log('BTCUSDT Price:', ticker.price);

        // Authenticated API (Requires API Key/Secret)
        if (client.apiKey && client.apiSecret) {
            console.log('\n--- Authenticated API ---');
            const balance = await client.getBalance();
            console.log('Balance:', balance.find(b => b.asset === 'USDT'));

            const account = await client.getAccount();
            console.log('Account (Total Wallet Balance):', account.totalWalletBalance);
        }

        // WebSocket
        console.log('\n--- WebSocket ---');
        console.log('Subscribing to btcusdt@aggTrade...');
        const ws = client.subscribeMarketStream('btcusdt@aggTrade', (data) => {
            console.log('AggTrade:', data.s, data.p, data.q);
            // Close after 5 seconds for example
            setTimeout(() => {
                ws.close();
                process.exit(0);
            }, 5000);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

run();
