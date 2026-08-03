const { BinanceBase, BinanceError, BinanceAPIError, BinanceNetworkError } = require('./base');
const { MarketData } = require('./modules/market-data');
const { Trading } = require('./modules/trading');
const { Account } = require('./modules/account');
const { WebSocketStreams } = require('./modules/websocket');
const { applyMixins } = require('./utils');

/**
 * Main Binance USDⓈ-M Futures Client Class
 * Combines all modules using mixin pattern (similar to dhanhq-ts)
 * 
 * @example
 * // Public access (no credentials required)
 * const client = new BinanceFuturesClient();
 * const ticker = await client.getTickerPrice('BTCUSDT');
 * 
 * @example
 * // Private access (credentials required)
 * const client = new BinanceFuturesClient({
 *     apiKey: 'YOUR_API_KEY',
 *     apiSecret: 'YOUR_API_SECRET'
 * });
 * await client.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', ... });
 */
class BinanceFuturesClient extends BinanceBase {}

// Apply mixins from all modules
applyMixins(BinanceFuturesClient, [
    MarketData,
    Trading,
    Account,
    WebSocketStreams
]);

// Export main client and all components
module.exports = {
    BinanceFuturesClient,
    BinanceError,
    BinanceAPIError,
    BinanceNetworkError,
    
    // Modules (for advanced usage)
    MarketData,
    Trading,
    Account,
    WebSocketStreams,
    
    // Base class (for extension)
    BinanceBase
};
