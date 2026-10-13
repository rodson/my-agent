import { exec } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import { confirm } from './confirm.js';

const execAsync = promisify(exec);

const WORK_DIR = process.cwd();
const MAX_OUTPUT_CHARS = 10_000;
const COMMAND_TIMEOUT_MS = 30_000;

interface Tool {
  definition: ChatCompletionFunctionTool;
  run(args: Record<string, unknown>): Promise<string>;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n...[已截断，共 ${text.length} 字符]`;
}

// 把模型给的路径解析为绝对路径，并拒绝工作目录之外的路径
function resolveInWorkDir(p: unknown): string {
  if (typeof p !== 'string' || p === '') throw new Error('path 必须是非空字符串');
  const abs = path.resolve(WORK_DIR, p);
  const rel = path.relative(WORK_DIR, abs);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`路径超出工作目录 ${WORK_DIR}：${p}`);
  }
  return abs;
}

const readFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取工作目录内某个文本文件的内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
        },
        required: ['path'],
      },
    },
  },
  async run(args) {
    const file = resolveInWorkDir(args.path);
    return truncate(await readFile(file, 'utf8'));
  },
};

const writeFileTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: '把内容写入工作目录内的文件（覆盖已有内容，父目录不存在时自动创建）',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径，相对于工作目录' },
          content: { type: 'string', description: '要写入的完整文件内容' },
        },
        required: ['path', 'content'],
      },
    },
  },
  async run(args) {
    const file = resolveInWorkDir(args.path);
    if (typeof args.content !== 'string') throw new Error('content 必须是字符串');
    if (!(await confirm(`允许写入 ${path.relative(WORK_DIR, file)}（${args.content.length} 字符）？`))) {
      return '用户拒绝了该操作';
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, args.content, 'utf8');
    return `已写入 ${path.relative(WORK_DIR, file)}`;
  },
};

const runCommandTool: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'run_command',
      description: `在工作目录中执行一条 shell 命令，返回退出码、stdout 和 stderr。超时 ${COMMAND_TIMEOUT_MS / 1000} 秒，不支持交互式命令`,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的 shell 命令' },
        },
        required: ['command'],
      },
    },
  },
  async run(args) {
    if (typeof args.command !== 'string' || args.command === '') {
      throw new Error('command 必须是非空字符串');
    }
    if (!(await confirm(`允许执行命令 \`${args.command}\`？`))) {
      return '用户拒绝了该操作';
    }
    let exitCode = 0;
    let stdout = '';
    let stderr = '';
    try {
      ({ stdout, stderr } = await execAsync(args.command, {
        cwd: WORK_DIR,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      }));
    } catch (err) {
      // 非零退出码、超时也会进入这里，此时 err 上同样带有 stdout/stderr
      const e = err as { code?: number; killed?: boolean; stdout?: string; stderr?: string; message: string };
      exitCode = typeof e.code === 'number' ? e.code : 1;
      stdout = e.stdout ?? '';
      stderr = e.stderr || e.message;
      if (e.killed) stderr += `\n[命令超时（${COMMAND_TIMEOUT_MS / 1000}s）被终止]`;
    }
    return truncate(`exit code: ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  },
};

const tools: Tool[] = [readFileTool, writeFileTool, runCommandTool];

export const toolDefinitions = tools.map((t) => t.definition);

// 执行工具调用。任何错误都转成字符串返回给模型，而不是让程序崩溃
export async function runTool(name: string, rawArgs: string): Promise<string> {
  const tool = tools.find((t) => t.definition.function.name === name);
  if (!tool) return `错误：未知工具 ${name}`;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return `错误：参数不是合法的 JSON：${rawArgs}`;
  }
  try {
    return await tool.run(args);
  } catch (err) {
    return `错误：${err instanceof Error ? err.message : String(err)}`;
  }
}
