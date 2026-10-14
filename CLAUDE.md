# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
cp .env.example .env     # then fill in DEEPSEEK_API_KEY
npm run dev              # run from source via tsx (loads .env with --env-file)
npm run typecheck        # tsc --noEmit
npm run build && npm start   # compile to dist/ and run with node (also loads .env with --env-file)
```

There is no test suite or linter. `npm run typecheck` is the only automated check, so run it after every change.

## Architecture

A minimal CLI agent: a REPL that sends the conversation to DeepSeek (`deepseek-chat`) over its OpenAI-compatible API (`baseURL: https://api.deepseek.com`), with function calling for local tools. The whole project is four files in `src/`.

- `src/index.ts`: the entry point and REPL loop. It exits at startup if `DEEPSEEK_API_KEY` is missing. It handles `exit`, `/clear` (calls `agent.reset()`), Ctrl+C (`SIGINT` on `rl`) and Ctrl+D (`close` on `rl`). API errors are caught per turn with `try/catch` so the session survives.
- `src/agent.ts`: `Agent.run()` is the agent loop. It calls the model, executes every returned `tool_call`, appends a `role: 'tool'` message for each `tool_call_id` (the API rejects the next request otherwise), and repeats until the model replies without tool calls. The loop is capped at `MAX_TOOL_ITERATIONS` (20) model calls per user turn. Hitting the cap returns a notice instead of throwing. `messages` persists across turns, and `reset()` keeps only the system prompt.
  - `SYSTEM_PROMPT` is built at module load and embeds `process.cwd()` and `process.platform`.
  - Each tool call prints `🔧 <tool name>: <argument summary>`. `summarizeArgs()` picks the `command` or `path` argument and falls back to the raw JSON. If a new tool's key argument has a different name, add it there.
- `src/tools.ts`: each tool is a `{ definition, run }` pair in the `tools` array, and `toolDefinitions` is derived from it, so adding a tool means adding an entry there. `runTool()` turns *all* failures (bad JSON, unknown tool, thrown errors) into `错误：...` strings returned to the model. Tools should throw and never exit the process.
  - `read_file`: reads a text file.
  - `write_file`: overwrites the file, creates missing parent directories, and asks the user to confirm first.
  - `run_command`: runs a shell command with `exec` in `WORK_DIR`, with a `COMMAND_TIMEOUT_MS` (30s) timeout and a 1MB `maxBuffer`, and asks the user to confirm first. Non-zero exit codes and timeouts don't throw: the `exit code`, `stdout` and `stderr` are all returned to the model.
  - All tool output goes through `truncate()`, capped at `MAX_OUTPUT_CHARS` (10,000 characters).
  - File paths go through `resolveInWorkDir()`, which confines them to `WORK_DIR` (`process.cwd()` at startup). `run_command` is *not* confined this way, so user confirmation is its only safeguard.
- `src/confirm.ts`: owns the **single** shared `readline` interface `rl` and exports `confirm()` (only `y`/`Y` counts as yes). Both the REPL prompt and the tool confirmations must use this `rl`, because a second interface on stdin would compete for input.

## Conventions

- Code comments are in English. User-facing text (the system prompt, CLI messages, tool descriptions, error strings) is in Chinese, so keep new user-facing text in Chinese.
- `README.md` is the English README and `README.zh-CN.md` is the Chinese one. Keep them in sync when either changes.
- Tools that need confirmation return `'用户拒绝了该操作'` when the user declines, rather than throwing, so the model can try another approach.

## Constraints

- Local Node is v20. `openai` is pinned to `^6` because 7.x requires Node >= 22, so don't bump it unless Node is upgraded.
- ESM with `module: nodenext`: relative imports in `src/` must use the `.js` extension (e.g. `./tools.js`).
- In openai v6, `tool_calls` entries are a union (`function` | `custom`), so narrow on `call.type === 'function'` before reading `call.function`. Tool definitions are typed as `ChatCompletionFunctionTool`.
