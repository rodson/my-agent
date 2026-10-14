import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// A single shared readline instance: two interfaces on the same stdin would compete for input
export const rl = readline.createInterface({ input, output });

export async function confirm(question: string): Promise<boolean> {
  const answer = await rl.question(`${question} [y/N] `);
  return answer.trim().toLowerCase() === 'y';
}
