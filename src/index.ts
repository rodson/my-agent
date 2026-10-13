import { Agent } from './agent.js';
import { rl } from './confirm.js';

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error('缺少 DEEPSEEK_API_KEY。请复制 .env.example 为 .env 并填入你的 key。');
  process.exit(1);
}

const agent = new Agent(apiKey);

rl.on('SIGINT', () => {
  console.log('\n再见');
  process.exit(0);
});
rl.on('close', () => process.exit(0)); // Ctrl+D

console.log('DeepSeek Agent 已启动。输入 exit 退出，/clear 清空上下文。\n');

while (true) {
  const input = (await rl.question('> ')).trim();
  if (!input) continue;
  if (input === 'exit') break;
  if (input === '/clear') {
    agent.reset();
    console.log('上下文已清空\n');
    continue;
  }

  try {
    const reply = await agent.run(input);
    console.log(`\n${reply}\n`);
  } catch (err) {
    console.error(`\n请求失败：${err instanceof Error ? err.message : String(err)}\n`);
  }
}

rl.close();
