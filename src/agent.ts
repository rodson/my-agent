import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { runTool, toolDefinitions } from './tools.js';

const MODEL = 'deepseek-chat';
const MAX_TOOL_ITERATIONS = 20;

const SYSTEM_PROMPT = `你是一个运行在用户终端里的 AI 助手，可以通过工具读写文件、执行 shell 命令来完成任务。
- 当前工作目录：${process.cwd()}
- 操作系统：${process.platform}
- 文件操作只能在工作目录内进行
- 写文件和执行命令需要用户确认，被拒绝时请换一种方式或询问用户
- 先用工具了解实际情况再回答，不要编造文件内容或命令输出`;

export class Agent {
  private client: OpenAI;
  private messages: ChatCompletionMessageParam[] = [];

  constructor(apiKey: string) {
    this.client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });
    this.reset();
  }

  reset(): void {
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  // Handle one user input: call the model and run tools repeatedly until it replies without tool calls
  async run(userInput: string): Promise<string> {
    this.messages.push({ role: 'user', content: userInput });

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await this.client.chat.completions.create({
        model: MODEL,
        messages: this.messages,
        tools: toolDefinitions,
      });
      const message = completion.choices[0].message;
      this.messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls,
      });

      if (!message.tool_calls?.length) {
        return message.content ?? '';
      }

      // Every tool_call needs a tool message with a matching tool_call_id, or the next request fails
      for (const call of message.tool_calls) {
        let result: string;
        if (call.type === 'function') {
          console.log(`🔧 ${call.function.name}: ${summarizeArgs(call.function.arguments)}`);
          result = await runTool(call.function.name, call.function.arguments);
        } else {
          result = `错误：不支持的工具调用类型 ${call.type}`;
        }
        this.messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }

    return `（已达到单轮最多 ${MAX_TOOL_ITERATIONS} 次模型调用，已停止。可以输入"继续"让我接着做）`;
  }
}

// Show only the key argument when logging a tool call, so whole file contents don't flood the screen
function summarizeArgs(rawArgs: string): string {
  try {
    const args = JSON.parse(rawArgs);
    return args.command ?? args.path ?? rawArgs;
  } catch {
    return rawArgs;
  }
}
