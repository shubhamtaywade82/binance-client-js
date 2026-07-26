'use strict';
const { z } = require('zod');
function prompt(text) { return { messages: [{ role: 'user', content: { type: 'text', text } }] }; }
function registerTradingPrompts(server) {
  server.registerPrompt('market_analysis', { description: 'Comprehensive symbol analysis workflow.', argsSchema: { symbol: z.string() } }, ({ symbol }) => prompt(`Analyze ${symbol} using ticker, mark price, funding, open interest, order book, and long/short data. Summarize trend, volatility, liquidity, and risks.`));
  server.registerPrompt('trade_plan', { description: 'Entry/SL/TP/sizing plan generator.', argsSchema: { symbol: z.string(), bias: z.enum(['long', 'short', 'neutral']).default('neutral') } }, ({ symbol, bias }) => prompt(`Create a ${bias} trade plan for ${symbol}. Include invalidation, entry, stop, targets, position sizing, and whether to use testnet or paper trading.`));
  server.registerPrompt('portfolio_review', { description: 'Position review and action items.', argsSchema: {} }, () => prompt('Review futures balances, positions, open orders, exposure, margin risk, and produce prioritized action items.'));
  server.registerPrompt('risk_check', { description: 'Pre-trade GO/NO-GO checklist.', argsSchema: { symbol: z.string(), side: z.string(), quantity: z.string() } }, ({ symbol, side, quantity }) => prompt(`Run a pre-trade risk check for ${side} ${quantity} ${symbol}. Verify market conditions, leverage, margin, stop-loss, and max loss before any live order.`));
}
module.exports = { registerTradingPrompts };
