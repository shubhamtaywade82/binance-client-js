const assert = require('assert');
const { spawn } = require('child_process');

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function parseFrames(buffer) {
  const messages = [];
  let remaining = buffer;

  while (true) {
    const headerEnd = remaining.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = remaining.slice(0, headerEnd);
    const match = header.match(/Content-Length: (\d+)/i);
    assert(match, `Missing content length in ${header}`);

    const length = Number(match[1]);
    const start = headerEnd + 4;
    const end = start + length;
    if (remaining.length < end) break;

    messages.push(JSON.parse(remaining.slice(start, end)));
    remaining = remaining.slice(end);
  }

  return messages;
}

async function main() {
  const child = spawn(process.execPath, ['mcp-server.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

  child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
  child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for MCP responses. stderr=${stderr}`)), 2000);
    const interval = setInterval(() => {
      const messages = parseFrames(output);
      if (messages.length >= 2) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 25);
  });

  child.kill();

  const messages = parseFrames(output);
  assert.strictEqual(messages[0].result.serverInfo.name, 'binance-client-js-mcp');
  assert(messages[1].result.tools.some((tool) => tool.name === 'binance_ticker_price'));
  assert(messages[1].result.tools.every((tool) => tool.inputSchema && tool.description));
  console.log('mcp server unit tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
