import { Skills, writeOutput } from './index';
import { mkdir, writeFile } from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('Skills package', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('writeOutput', () => {
    it('should write output data to the specified path and create parent directory', async () => {
      const data = { status: 'success', value: 42 };
      const filePath = '/some/parent/dir/output.json';

      (mkdir as jest.Mock).mockResolvedValue(undefined);
      (writeFile as jest.Mock).mockResolvedValue(undefined);

      await Skills.writeOutput(data, filePath);

      expect(mkdir).toHaveBeenCalledWith('/some/parent/dir', { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    });

    it('should write output data without creating directory if parentDir is dot', async () => {
      const data = { test: true };
      const filePath = 'output.json';

      (writeFile as jest.Mock).mockResolvedValue(undefined);

      await writeOutput(data, filePath);

      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(data, null, 2),
        'utf8'
      );
    });

    it('should log and throw error if writing files fails', async () => {
      const data = { test: true };
      const filePath = '/invalid/path/output.json';
      const mockError = new Error('Permission denied');

      (mkdir as jest.Mock).mockRejectedValue(mockError);

      const spyError = jest.spyOn(Skills, 'error').mockImplementation(() => {});

      await expect(Skills.writeOutput(data, filePath)).rejects.toThrow('Permission denied');

      expect(spyError).toHaveBeenCalledWith(
        expect.stringContaining('Error writing output to /invalid/path/output.json: Permission denied')
      );

      spyError.mockRestore();
    });
  });
});
