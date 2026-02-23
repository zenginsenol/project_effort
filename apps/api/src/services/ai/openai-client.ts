import OpenAI from 'openai';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === retries) throw error;
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const delay = isRateLimit ? RETRY_DELAY_MS * attempt * 2 : RETRY_DELAY_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getClient();
  const response = await withRetry(() =>
    openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    }),
  );
  return response.data[0]?.embedding ?? [];
}

export async function generateEstimationSuggestion(
  taskTitle: string,
  taskDescription: string,
  similarTasks: Array<{ title: string; estimatedPoints: number | null; estimatedHours: number | null }>,
): Promise<{
  suggestedPoints: number;
  suggestedHours: number;
  confidence: number;
  reasoning: string;
}> {
  const openai = getClient();

  const similarTasksContext = similarTasks
    .map((t, i) => `${i + 1}. "${t.title}" - Points: ${t.estimatedPoints ?? 'N/A'}, Hours: ${t.estimatedHours ?? 'N/A'}`)
    .join('\n');

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert software project estimator. Given a task and similar historical tasks, provide an effort estimation. Respond in JSON format with: suggestedPoints (number, Fibonacci scale: 1,2,3,5,8,13,21), suggestedHours (number), confidence (number 0-1), reasoning (string, brief explanation).`,
        },
        {
          role: 'user',
          content: `Task: "${taskTitle}"\nDescription: "${taskDescription}"\n\nSimilar completed tasks:\n${similarTasksContext || 'No similar tasks found.'}\n\nProvide your estimation.`,
        },
      ],
    }),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { suggestedPoints: 5, suggestedHours: 8, confidence: 0.3, reasoning: 'Unable to generate AI suggestion.' };
  }

  try {
    const parsed = JSON.parse(content) as {
      suggestedPoints?: number;
      suggestedHours?: number;
      confidence?: number;
      reasoning?: string;
    };
    return {
      suggestedPoints: parsed.suggestedPoints ?? 5,
      suggestedHours: parsed.suggestedHours ?? 8,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning ?? 'AI estimation based on task analysis.',
    };
  } catch {
    return { suggestedPoints: 5, suggestedHours: 8, confidence: 0.3, reasoning: 'Failed to parse AI response.' };
  }
}

export async function generateCalibrationRecommendations(historicalData: {
  tasks: Array<{
    taskType: string;
    complexity: string;
    estimatedHours: number;
    actualHours: number;
    estimatedPoints: number | null;
    actualPoints: number | null;
  }>;
  overallAccuracy: number;
  taskTypeBreakdown: Array<{ taskType: string; averageAccuracy: number; count: number }>;
  complexityBreakdown: Array<{ complexity: string; averageAccuracy: number; count: number }>;
}): Promise<{
  recommendations: Array<{
    category: string;
    adjustmentFactor: number;
    description: string;
    confidence: number;
  }>;
  overallInsight: string;
}> {
  const openai = getClient();

  const tasksSummary = historicalData.tasks
    .slice(0, 20)
    .map(
      (t, i) =>
        `${i + 1}. Type: ${t.taskType}, Complexity: ${t.complexity}, Est: ${t.estimatedHours}h, Actual: ${t.actualHours}h (Ratio: ${(t.actualHours / t.estimatedHours).toFixed(2)})`,
    )
    .join('\n');

  const taskTypeContext = historicalData.taskTypeBreakdown
    .map((tb) => `${tb.taskType}: ${(tb.averageAccuracy * 100).toFixed(1)}% accuracy (${tb.count} tasks)`)
    .join('\n');

  const complexityContext = historicalData.complexityBreakdown
    .map((cb) => `${cb.complexity}: ${(cb.averageAccuracy * 100).toFixed(1)}% accuracy (${cb.count} tasks)`)
    .join('\n');

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert in agile estimation calibration. Analyze historical estimation data and provide actionable calibration recommendations. Respond in JSON format with:
- recommendations: array of objects with category (string), adjustmentFactor (number, e.g., 1.3 means apply 30% buffer), description (string explaining the pattern), confidence (number 0-1)
- overallInsight: string summarizing the team's estimation tendencies

Focus on identifying systematic biases (over/under-estimation) by task type and complexity. Provide specific, actionable adjustment factors.`,
        },
        {
          role: 'user',
          content: `Overall team accuracy: ${(historicalData.overallAccuracy * 100).toFixed(1)}%

Task Type Breakdown:
${taskTypeContext || 'No task type data available.'}

Complexity Breakdown:
${complexityContext || 'No complexity data available.'}

Sample Recent Tasks (Estimated vs Actual):
${tasksSummary || 'No historical tasks available.'}

Provide calibration recommendations to improve future estimation accuracy.`,
        },
      ],
    }),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      recommendations: [],
      overallInsight: 'Unable to generate calibration recommendations due to insufficient data.',
    };
  }

  try {
    const parsed = JSON.parse(content) as {
      recommendations?: Array<{
        category?: string;
        adjustmentFactor?: number;
        description?: string;
        confidence?: number;
      }>;
      overallInsight?: string;
    };

    const recommendations = (parsed.recommendations ?? []).map((rec) => ({
      category: rec.category ?? 'General',
      adjustmentFactor: rec.adjustmentFactor ?? 1.0,
      description: rec.description ?? 'No specific recommendation available.',
      confidence: Math.min(1, Math.max(0, rec.confidence ?? 0.5)),
    }));

    return {
      recommendations,
      overallInsight: parsed.overallInsight ?? 'Analysis completed based on available historical data.',
    };
  } catch {
    return {
      recommendations: [],
      overallInsight: 'Failed to parse AI calibration recommendations.',
    };
  }
}
