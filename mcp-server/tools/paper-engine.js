'use strict';
const { z } = require('zod');
const symbol = z.string().min(1).transform((value) => value.trim().toUpperCase());
const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
function pnl(position, price) { const direction = position.side === 'LONG' ? 1 : -1; return (price - position.entryPrice) * position.quantity * direction; }
function registerPaperTools(server, context) {
  const paper = context.paper;
  server.registerTool('paper_init', { description: 'Initialize paper trading balance.', inputSchema: { balance: z.number().positive().default(10000) } }, async ({ balance }) => { paper.balance = balance; paper.positions = []; paper.history = []; return text(paper); });
  server.registerTool('paper_balance', { description: 'Get paper trading balance.', inputSchema: {} }, async () => text({ balance: paper.balance }));
  server.registerTool('paper_open_position', { description: 'Open an in-memory paper position.', inputSchema: { symbol, side: z.enum(['LONG', 'SHORT']), quantity: z.number().positive(), price: z.number().positive().optional() } }, async ({ symbol, side, quantity, price }) => { const market = price || Number((await context.client.getTickerPrice(symbol)).price); const position = { id: Date.now().toString(), symbol, side, quantity, entryPrice: market, openedAt: new Date().toISOString() }; paper.positions.push(position); paper.history.push({ type: 'open', ...position }); return text(position); });
  server.registerTool('paper_close_position', { description: 'Close an in-memory paper position.', inputSchema: { id: z.string(), price: z.number().positive().optional() } }, async ({ id, price }) => { const index = paper.positions.findIndex((p) => p.id === id); if (index === -1) throw new Error('paper position not found'); const position = paper.positions[index]; const market = price || Number((await context.client.getTickerPrice(position.symbol)).price); const realizedPnl = pnl(position, market); paper.balance += realizedPnl; paper.positions.splice(index, 1); const event = { type: 'close', ...position, exitPrice: market, realizedPnl, closedAt: new Date().toISOString() }; paper.history.push(event); return text(event); });
  server.registerTool('paper_positions', { description: 'List paper positions.', inputSchema: {} }, async () => text(paper.positions));
  server.registerTool('paper_history', { description: 'List paper trading history.', inputSchema: {} }, async () => text(paper.history));
  server.registerTool('paper_summary', { description: 'Summarize paper trading state.', inputSchema: {} }, async () => text({ balance: paper.balance, openPositions: paper.positions.length, trades: paper.history.length }));
}
module.exports = { registerPaperTools };
