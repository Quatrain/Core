import inquirer from 'inquirer';

export { inquirer };

/**
 * Ask a yes/no question to the user.
 */
export async function askConfirm(message: string, defaultVal = true): Promise<boolean> {
  const result = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'value',
      message,
      default: defaultVal,
    },
  ]);
  return result.value;
}

/**
 * Prompt the user for textual input.
 */
export async function askInput(message: string, defaultVal?: string): Promise<string> {
  const result = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultVal,
    },
  ]);
  return result.value;
}

/**
 * Prompt the user to select from a list of choices.
 */
export async function askChoice<T = string>(
  message: string,
  choices: (string | { name: string; value: T })[]
): Promise<T> {
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message,
      choices,
    },
  ]);
  return result.value;
}

import { Command } from 'commander';

/**
 * Custom Commander subclass to wrap Command functionality inside @quatrain/cli.
 */
export class CliCommand extends Command {}

