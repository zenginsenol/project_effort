import { afterEach, describe, expect, it } from 'vitest';

import { extractTasksFromText } from '../task-extractor';

const originalOpenAiKey = process.env.OPENAI_API_KEY;

describe('task-extractor no-mock behavior', () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  it('throws when no user key and no env key are configured', async () => {
    process.env.OPENAI_API_KEY = '';

    await expect(
      extractTasksFromText('Simple requirements text for extraction', 'Test project', 100, null),
    ).rejects.toThrow('No valid AI API key configured');
  });
});
