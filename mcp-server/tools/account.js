'use strict';
const { z } = require('zod');
const symbol = z.string().min(1).transform((value) => value.trim().toUpperCase());
const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
function registerAccountTools(server, { client }) {
  server.registerTool('get_balance', { description: 'Get signed futures wallet balances.', inputSchema: {} }, async () => text(await client.getBalance()));
  server.registerTool('get_positions', { description: 'Get signed futures positions.', inputSchema: { symbol: symbol.optional() } }, async ({ symbol }) => text(await client.getPositionRisk(symbol)));
  server.registerTool('get_account_summary', { description: 'Get signed futures account summary.', inputSchema: {} }, async () => text(await client.getAccount()));
  server.registerTool('get_open_orders', { description: 'Get signed open orders.', inputSchema: { symbol: symbol.optional() } }, async ({ symbol }) => text(await client.getOpenOrders(symbol)));
  server.registerTool('get_order_history', { description: 'Get signed order history.', inputSchema: { symbol, limit: z.number().int().positive().max(1000).default(100) } }, async ({ symbol, limit }) => text(await client.getAllOrders(symbol, { limit })));
}
module.exports = { registerAccountTools };
