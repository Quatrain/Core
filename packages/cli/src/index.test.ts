jest.mock('inquirer', () => {
  return {
    prompt: jest.fn(),
  };
}, { virtual: true });

import { askConfirm, askInput, askChoice, CliCommand } from './index';
import inquirer from 'inquirer';

describe('CLI helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('askConfirm', () => {
    it('should call inquirer.prompt with confirm type and return the value', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ value: true });

      const result = await askConfirm('Do you want to proceed?');
      expect(result).toBe(true);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'value',
          message: 'Do you want to proceed?',
          default: true,
        },
      ]);
    });

    it('should respect custom default value', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ value: false });

      const result = await askConfirm('Proceed?', false);
      expect(result).toBe(false);
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'value',
          message: 'Proceed?',
          default: false,
        },
      ]);
    });
  });

  describe('askInput', () => {
    it('should call inquirer.prompt with input type and return the text', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ value: 'hello' });

      const result = await askInput('Enter name:', 'defaultName');
      expect(result).toBe('hello');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'input',
          name: 'value',
          message: 'Enter name:',
          default: 'defaultName',
        },
      ]);
    });
  });

  describe('askChoice', () => {
    it('should call inquirer.prompt with list type and return the selected choice', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ value: 'optionB' });

      const choices = ['optionA', 'optionB', { name: 'Option C', value: 'optionC' }];
      const result = await askChoice('Select option:', choices);
      
      expect(result).toBe('optionB');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'list',
          name: 'value',
          message: 'Select option:',
          choices,
        },
      ]);
    });
  });

  describe('CliCommand', () => {
    it('should instantiate CliCommand successfully', () => {
      const cmd = new CliCommand('test');
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe('test');
    });
  });
});
