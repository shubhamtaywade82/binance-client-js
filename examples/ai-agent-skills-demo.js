/**
 * Binance AI Agent Skills - Usage Examples
 * 
 * This file demonstrates how to use the BinanceAIAgentSkills adapter
 * to interact with Binance USD-M Futures through an AI-agent-friendly interface.
 */

const { BinanceAIAgentSkills } = require('./ai-agent-skills');
require('dotenv').config();

// Initialize the skills adapter
const agent = new BinanceAIAgentSkills({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: true, // Use testnet for safety
    debug: false
});

async function demonstrateSkills() {
    console.log('=== Binance AI Agent Skills Demo ===\n');

    // 1. List all available skills
    console.log('1. Available Skills:');
    const skills = agent.listSkills();
    skills.forEach(skill => {
        console.log(`   - ${skill.name}: ${skill.description}`);
        console.log(`     Methods: ${skill.methods.slice(0, 5).join(', ')}${skill.methods.length > 5 ? '...' : ''}`);
    });
    console.log();

    // 2. Get skill details
    console.log('2. Trading Skill Details:');
    const tradingSkill = agent.getSkillDetails('usdm_trading');
    console.log(`   ${tradingSkill.name}: ${tradingSkill.description}`);
    console.log(`   Methods: ${tradingSkill.methods.join(', ')}`);
    console.log();

    // 3. Market Data Skills (Public - no auth required)
    console.log('3. Market Data Skills:');
    try {
        const price = await agent.executeSkill('usdm_market_data', 'get_price', 'BTCUSDT');
        console.log(`   BTC Price: ${price.price}`);

        const ticker24h = await agent.executeSkill('usdm_market_data', 'get_24h_ticker', 'BTCUSDT');
        console.log(`   BTC 24h Change: ${ticker24h.priceChangePercent}%`);

        const markPrice = await agent.executeSkill('usdm_market_data', 'get_mark_price', 'BTCUSDT');
        console.log(`   BTC Mark Price: ${markPrice.markPrice}`);
    } catch (err) {
        console.log(`   Error: ${err.message}`);
    }
    console.log();

    // 4. Account Skills (Requires authentication)
    console.log('4. Account Skills:');
    if (process.env.BINANCE_API_KEY) {
        try {
            const balance = await agent.executeSkill('usdm_account', 'get_balance');
            console.log('   Account Balance:');
            balance.forEach(asset => {
                if (parseFloat(asset.availableBalance) > 0) {
                    console.log(`     ${asset.asset}: ${asset.availableBalance} ${asset.unit}`);
                }
            });

            const account = await agent.executeSkill('usdm_account', 'get_account');
            console.log(`   Total Wallet Balance: ${account.totalWalletBalance} USDT`);
            console.log(`   Available Balance: ${account.availableBalance} USDT`);
        } catch (err) {
            console.log(`   Error: ${err.message}`);
        }
    } else {
        console.log('   Skipping (no API credentials provided)');
    }
    console.log();

    // 5. Position Management Skills
    console.log('5. Position Management Skills:');
    if (process.env.BINANCE_API_KEY) {
        try {
            // Check current position mode
            const mode = await agent.executeSkill('usdm_positions', 'get_position_mode');
            console.log(`   Position Mode: ${mode.dualSidePosition ? 'Hedge' : 'One-way'}`);

            // Get leverage brackets
            const brackets = await agent.executeSkill('usdm_positions', 'get_leverage_brackets', 'BTCUSDT');
            if (brackets && brackets[0]) {
                console.log(`   BTCUSDT Max Leverage: ${brackets[0].notionalCap}x`);
            }
        } catch (err) {
            console.log(`   Error: ${err.message}`);
        }
    } else {
        console.log('   Skipping (no API credentials provided)');
    }
    console.log();

    // 6. Trading Skills (Example - won't execute without funds)
    console.log('6. Trading Skills Example:');
    console.log('   To place an order:');
    console.log(`   await agent.executeSkill('usdm_trading', 'place_order', {
       symbol: 'BTCUSDT',
       side: 'BUY',
       type: 'LIMIT',
       quantity: 0.001,
       price: 50000,
       timeInForce: 'GTC'
   });`);
    console.log();

    // 7. Algo Order Skills
    console.log('7. Algo Order Skills Example:');
    console.log('   To place a stop-loss order:');
    console.log(`   await agent.executeSkill('usdm_algo_orders', 'place_algo_order', {
       symbol: 'BTCUSDT',
       side: 'SELL',
       type: 'STOP_LOSS',
       quantity: 0.001,
       stopPrice: 48000,
       workingType: 'MARK_PRICE'
   });`);
    console.log();

    // 8. WebSocket Market Data Skills
    console.log('8. WebSocket Market Data Skills:');
    console.log('   Subscribing to BTCUSDT candlestick updates...');
    
    const ws = agent.executeSkill('usdm_ws_market', 'subscribe_candles', 'BTCUSDT', '1m');
    
    agent.client.on('ws:candlestick', (candle) => {
        console.log(`   Candle Update: ${candle.symbol} O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`);
        // Close after first update for demo
        ws.close();
        agent.client.closeAllWebSockets();
    });

    // Wait for WebSocket message
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log();

    // 9. WebSocket API Trading Skills
    console.log('9. WebSocket API Trading Skills:');
    console.log('   For ultra-low latency trading:');
    console.log(`   await agent.executeSkill('usdm_ws_api_trading', 'ws_place_order', {
       symbol: 'BTCUSDT',
       side: 'BUY',
       type: 'LIMIT',
       quantity: 0.001,
       price: 50000,
       timeInForce: 'GTC'
   });`);
    console.log();

    // 10. Utility Skills
    console.log('10. Utility Skills:');
    try {
        const serverTime = await agent.executeSkill('usdm_utilities', 'get_server_time');
        console.log(`    Server Time: ${new Date(serverTime.serverTime).toISOString()}`);

        const exchangeInfo = await agent.executeSkill('usdm_utilities', 'get_exchange_info');
        console.log(`    Exchange Status: ${exchangeInfo.status}`);
        console.log(`    Total Symbols: ${exchangeInfo.symbols.length}`);
    } catch (err) {
        console.log(`    Error: ${err.message}`);
    }
    console.log();

    console.log('=== Demo Complete ===');
}

/**
 * Simple AI Command Handler Example
 * 
 * This demonstrates how to integrate skills with a chatbot or AI assistant
 */
async function handleAICommand(command, params) {
    const commandMap = {
        'price': { skill: 'usdm_market_data', method: 'get_price' },
        'ticker': { skill: 'usdm_market_data', method: 'get_24h_ticker' },
        'orderbook': { skill: 'usdm_market_data', method: 'get_orderbook' },
        'buy': { skill: 'usdm_trading', method: 'place_order' },
        'sell': { skill: 'usdm_trading', method: 'place_order' },
        'cancel': { skill: 'usdm_trading', method: 'cancel_order' },
        'position': { skill: 'usdm_positions', method: 'get_position' },
        'balance': { skill: 'usdm_account', method: 'get_balance' },
        'account': { skill: 'usdm_account', method: 'get_account' },
        'leverage': { skill: 'usdm_positions', method: 'set_leverage' },
        'stop_loss': { skill: 'usdm_algo_orders', method: 'place_algo_order' },
        'take_profit': { skill: 'usdm_algo_orders', method: 'place_algo_order' }
    };

    const mapping = commandMap[command.toLowerCase()];
    if (!mapping) {
        throw new Error(`Unknown command: ${command}. Available: ${Object.keys(commandMap).join(', ')}`);
    }

    return await agent.executeSkill(mapping.skill, mapping.method, ...params);
}

// Run the demo
if (require.main === module) {
    demonstrateSkills().catch(console.error);
}

module.exports = { demonstrateSkills, handleAICommand };
