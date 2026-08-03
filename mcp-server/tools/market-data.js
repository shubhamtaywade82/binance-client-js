'use strict';
const { z } = require('zod');
const symbol = z.string().min(1).transform((value) => value.trim().toUpperCase());
const interval = z.string().default('1h');
const limit = z.number().int().positive().max(1500).default(100);
const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
function registerMarketDataTools(server, { client }) {
  server.registerTool('get_ticker_price', { description: 'Get latest futures ticker price.', inputSchema: { symbol } }, async ({ symbol }) => text(await client.getTickerPrice(symbol)));
  server.registerTool('get_24hr_ticker', { description: 'Get 24 hour ticker statistics.', inputSchema: { symbol: symbol.optional() } }, async ({ symbol }) => text(await client.getTicker24h(symbol)));
  server.registerTool('get_order_book', { description: 'Get order book depth.', inputSchema: { symbol, limit } }, async ({ symbol, limit }) => text(await client.getOrderBook(symbol, limit)));
  server.registerTool('get_recent_trades', { description: 'Get recent trades.', inputSchema: { symbol, limit: limit.default(500) } }, async ({ symbol, limit }) => text(await client.getTrades(symbol, limit)));
  server.registerTool('get_agg_trades', { description: 'Get aggregate trades.', inputSchema: { symbol, limit } }, async ({ symbol, limit }) => text(await client.getAggregateTrades(symbol, { limit })));
  server.registerTool('get_klines', { description: 'Get candlestick klines.', inputSchema: { symbol, interval, limit } }, async ({ symbol, interval, limit }) => text(await client.getKlines(symbol, interval, { limit })));
  server.registerTool('get_funding_rate', { description: 'Get funding rate history.', inputSchema: { symbol, limit } }, async ({ symbol, limit }) => text(await client.getFundingRateHistory(symbol, limit)));
  server.registerTool('get_mark_price', { description: 'Get mark price and funding data.', inputSchema: { symbol } }, async ({ symbol }) => text(await client.getMarkPrice(symbol)));
  server.registerTool('get_open_interest', { description: 'Get current open interest.', inputSchema: { symbol } }, async ({ symbol }) => text(await client.getOpenInterest(symbol)));
  server.registerTool('get_premium_index', { description: 'Alias for mark price premium index data.', inputSchema: { symbol } }, async ({ symbol }) => text(await client.getMarkPrice(symbol)));
  server.registerTool('get_top_long_short', { description: 'Get top trader long/short account ratio.', inputSchema: { symbol, period: z.string().default('5m'), limit } }, async ({ symbol, period, limit }) => text(await client.getTopLongShortAccountRatio(symbol, period, { limit })));
  server.registerTool('get_global_long_short', { description: 'Get global long/short account ratio.', inputSchema: { symbol, period: z.string().default('5m'), limit } }, async ({ symbol, period, limit }) => text(await client.getGlobalLongShortAccountRatio(symbol, period, { limit })));
}
module.exports = { registerMarketDataTools };
