import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// 全局共用一个 readline 实例：同一个 stdin 上同时开两个 interface 会互相抢输入
export const rl = readline.createInterface({ input, output });

export async function confirm(question: string): Promise<boolean> {
  const answer = await rl.question(`${question} [y/N] `);
  return answer.trim().toLowerCase() === 'y';
}
