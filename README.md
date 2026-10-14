# my-agent

English | [简体中文](README.zh-CN.md)

A minimal command-line AI agent built on DeepSeek's (`deepseek-chat`) OpenAI-compatible API. It runs in your terminal and completes tasks by reading and writing files and running shell commands through tools.

## Features

- Multi-turn conversation, with context kept for the whole session
- A function-calling tool loop, capped at 20 model calls per turn
- Three built-in tools:
  | Tool | What it does | Needs confirmation |
  | --- | --- | --- |
  | `read_file` | Read a text file inside the working directory | No |
  | `write_file` | Write (overwrite) a file inside the working directory, creating parent directories | Yes |
  | `run_command` | Run a shell command in the working directory (30s timeout, no interactive commands) | Yes |
- File reads and writes are confined to the working directory at startup
- Tool output longer than 10,000 characters is truncated

## Requirements

- Node.js 20.6 or later (needed for `--env-file`)
- A [DeepSeek API key](https://platform.deepseek.com/)

## Quick start

```bash
npm install
cp .env.example .env     # edit .env and fill in DEEPSEEK_API_KEY
npm run dev
```

Or build and run the compiled output:

```bash
npm run build
npm start
```

The agent uses the **current directory** as its working directory. All file operations and commands happen there.

## Usage

Type a request at the `>` prompt. The CLI prompts and messages are in Chinese:

```
DeepSeek Agent 已启动。输入 exit 退出，/clear 清空上下文。

> What scripts are in package.json?
🔧 read_file: package.json

package.json defines the following scripts: ...
```

| Input | Effect |
| --- | --- |
| `exit` / Ctrl+C / Ctrl+D | Quit |
| `/clear` | Clear the conversation context |

Before writing a file or running a command, the agent asks `[y/N]`. Only `y` lets it go ahead. If you decline, the agent tries another approach or asks you what to do.

> ⚠️ `run_command` is not confined to the working directory. Read each command carefully before confirming it.

## Project structure

```
src/
├── index.ts    # Entry point: the REPL loop
├── agent.ts    # Agent loop: calls the model and runs tool calls
├── tools.ts    # Tool definitions and execution
└── confirm.ts  # Shared readline instance and confirmation prompt
```

## Development

```bash
npm run typecheck   # type check (the project's only automated check)
```

To add a tool, define a `{ definition, run }` object in `src/tools.ts` and add it to the `tools` array. When `run` fails it should just throw: `runTool()` turns the error into a string and hands it to the model.

The `openai` dependency is pinned to `^6` because 7.x requires Node 22 or later.
