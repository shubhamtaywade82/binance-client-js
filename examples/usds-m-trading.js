const { BinanceFuturesClient } = require('../binance-futures-client');
require('dotenv').config();

const client = new BinanceFuturesClient({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    testnet: true,
    debug: false
});

async function runTradingExample() {
    try {
        console.log('--- 💳 USDS-M Account Snapshot ---');
        const balances = await client.getBalance();
        const usdt = balances.find(b => b.asset === 'USDT') || { balance: '0' };
        const usdc = balances.find(b => b.asset === 'USDC') || { balance: '0' };
        console.log(`USDT Wallet: ${usdt.balance}`);
        console.log(`USDC Wallet: ${usdc.balance}`);

        console.log('\n--- 📈 Fetching USDS-M Market Rules ---');
        // This symbol matches the CoinDCX style provided in your error log
        const instrument = 'B-BTC_USDT'; 
        const details = await client.getInstrumentDetails(instrument);
        
        console.log(`Instrument Found: ${details.symbol}`);
        console.log(`Status: ${details.status}`);
        console.log(`Price Precision: ${details.pricePrecision}`);
        console.log(`Quantity Precision: ${details.quantityPrecision}`);
        
        const priceFilter = details.filters.find(f => f.filterType === 'PRICE_FILTER');
        if (priceFilter) {
            console.log(`Min Price: ${priceFilter.minPrice}`);
            console.log(`Max Price: ${priceFilter.maxPrice}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

runTradingExample();
