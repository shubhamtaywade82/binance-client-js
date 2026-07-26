'use strict';
const { z } = require('zod');
const symbol = z.string().min(1).transform((value) => value.trim().toUpperCase());
const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
function registerPositionTools(server, { client }) {
  server.registerTool('set_leverage', { description: 'Set futures leverage.', inputSchema: { symbol, leverage: z.number().int().min(1).max(125) } }, async ({ symbol, leverage }) => text(await client.setLeverage(symbol, leverage)));
  server.registerTool('set_margin_type', { description: 'Set futures margin type.', inputSchema: { symbol, marginType: z.enum(['ISOLATED', 'CROSSED']) } }, async ({ symbol, marginType }) => text(await client.setMarginType(symbol, marginType)));
  server.registerTool('adjust_isolated_margin', { description: 'Add or reduce isolated margin.', inputSchema: { symbol, amount: z.union([z.string(), z.number()]), type: z.number().int() } }, async ({ symbol, amount, type }) => text(await client.modifyPositionMargin(symbol, amount, type)));
  server.registerTool('set_position_mode', { description: 'Set hedge/one-way position mode.', inputSchema: { dualSidePosition: z.boolean() } }, async ({ dualSidePosition }) => text(await client._request('POST', '/fapi/v1/positionSide/dual', { dualSidePosition }, false)));
  server.registerTool('get_position_mode', { description: 'Get hedge/one-way position mode.', inputSchema: {} }, async () => text(await client._request('GET', '/fapi/v1/positionSide/dual', {}, false)));
  server.registerTool('get_leverage_brackets', { description: 'Get leverage brackets.', inputSchema: { symbol: symbol.optional() } }, async ({ symbol }) => text(await client.getLeverageBrackets(symbol)));
}
module.exports = { registerPositionTools };
