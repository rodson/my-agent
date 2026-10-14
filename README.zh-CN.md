# my-agent

[English](README.md) | 简体中文

一个极简的命令行 AI Agent，基于 DeepSeek（`deepseek-chat`）的 OpenAI 兼容 API。它运行在你的终端里，可以通过工具读写文件、执行 shell 命令来完成任务。

## 功能

- 多轮对话，上下文在会话内保留
- 基于 function calling 的工具调用循环，单轮最多 20 次模型调用
- 内置三个工具：
  | 工具 | 作用 | 是否需要确认 |
  | --- | --- | --- |
  | `read_file` | 读取工作目录内的文本文件 | 否 |
  | `write_file` | 写入（覆盖）工作目录内的文件，自动创建父目录 | 是 |
  | `run_command` | 在工作目录中执行 shell 命令（超时 30 秒，不支持交互式命令） | 是 |
- 文件读写被限制在启动时的工作目录内
- 工具输出超过 10000 字符时自动截断

## 环境要求

- Node.js 20.6 及以上（需要 `--env-file` 支持）
- 一个 [DeepSeek API Key](https://platform.deepseek.com/)

## 快速开始

```bash
npm install
cp .env.example .env     # 编辑 .env，填入 DEEPSEEK_API_KEY
npm run dev
```

或者编译后运行：

```bash
npm run build
npm start
```

Agent 以**当前所在目录**作为工作目录，文件操作和命令都在这里进行。

## 使用

启动后在 `>` 提示符后输入问题即可：

```
DeepSeek Agent 已启动。输入 exit 退出，/clear 清空上下文。

> 看看 package.json 里有哪些脚本
🔧 read_file: package.json

package.json 中定义了以下脚本：...
```

| 输入 | 作用 |
| --- | --- |
| `exit` / Ctrl+C / Ctrl+D | 退出 |
| `/clear` | 清空对话上下文 |

当 Agent 要写文件或执行命令时，会先询问 `[y/N]`，只有输入 `y` 才会执行；拒绝后 Agent 会尝试换一种方式或向你询问。

> ⚠️ `run_command` 不受工作目录限制，确认前请仔细查看要执行的命令。

## 项目结构

```
src/
├── index.ts    # 入口：REPL 循环
├── agent.ts    # Agent 主循环：调用模型、执行工具调用
├── tools.ts    # 工具定义与执行
└── confirm.ts  # 共享的 readline 实例与确认提示
```

## 开发

```bash
npm run typecheck   # 类型检查（项目唯一的自动化检查）
```

新增工具：在 `src/tools.ts` 中定义一个 `{ definition, run }` 对象并加入 `tools` 数组即可。`run` 出错时直接抛异常，`runTool()` 会把错误转成字符串交给模型。

注意 `openai` 依赖锁定在 `^6`，因为 7.x 需要 Node 22 及以上。
