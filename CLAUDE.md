# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
cp .env.example .env     # then fill in DEEPSEEK_API_KEY
npm run dev              # run from source via tsx (loads .env with --env-file)
npm run typecheck        # tsc --noEmit
npm run build && npm start   # compile to dist/ and run with node
```

There is no test suite or linter. `npm run typecheck` is the only automated check.

## Architecture

A minimal CLI agent: a REPL that sends the conversation to DeepSeek (`deepseek-chat`) over its OpenAI-compatible API, with function calling for local tools.

- `src/index.ts`: the REPL loop (`exit`, `/clear`, Ctrl+C/Ctrl+D). Catches API errors per turn so the session survives.
- `src/agent.ts`: `Agent.run()` is the agent loop. It calls the model, executes every returned `tool_call`, appends a `role: 'tool'` message for each `tool_call_id` (the API rejects the next request otherwise), and repeats until the model replies without tool calls. The loop is capped at `MAX_TOOL_ITERATIONS` model calls per user turn. `messages` persists across turns, and `reset()` keeps only the system prompt.
- `src/tools.ts`: each tool is a `{ definition, run }` pair in the `tools` array, so adding a tool means adding an entry there. `runTool()` turns *all* failures (bad JSON, unknown tool, thrown errors) into strings returned to the model. Tools should throw and never exit the process. File paths go through `resolveInWorkDir()`, which confines them to `process.cwd()`. `write_file` and `run_command` ask the user to confirm before running.
- `src/confirm.ts`: owns the **single** shared `readline` interface. Both the REPL prompt and the tool confirmations must use this `rl`, because a second interface on stdin would compete for input.

## Constraints

- Local Node is v20. `openai` is pinned to `^6` because 7.x requires Node >= 22, so don't bump it unless Node is upgraded.
- ESM with `module: nodenext`: relative imports in `src/` must use the `.js` extension (e.g. `./tools.js`).
- In openai v6, `tool_calls` entries are a union (`function` | `custom`), so narrow on `call.type === 'function'` before reading `call.function`.
