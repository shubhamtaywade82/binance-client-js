const assert = require('assert');
const { spawn } = require('child_process');

function parseMessages(output) {
  return output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function main() {
  const child = spawn(process.execPath, ['mcp-server/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'unit-test', version: '1.0.0' } } }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'prompts/list', params: {} }) + '\n');

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for MCP responses. stderr=${stderr}`)), 3000);
    const interval = setInterval(() => {
      if (parseMessages(output).length >= 3) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 25);
  });

  child.kill();
  const messages = parseMessages(output);
  assert.strictEqual(messages[0].result.serverInfo.name, 'binance-client-js-mcp');
  const toolNames = messages[1].result.tools.map((tool) => tool.name);
  assert.strictEqual(toolNames.length, 38);
  assert(toolNames.includes('get_ticker_price'));
  assert(toolNames.includes('paper_summary'));
  assert(messages[2].result.prompts.some((prompt) => prompt.name === 'risk_check'));
  console.log('mcp server unit tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
