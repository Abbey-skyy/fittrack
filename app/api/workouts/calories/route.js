import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth';
import { errorResponse, handleApiError } from '@/lib/apiHelpers';

const SYSTEM_PROMPT = `You are a certified fitness and exercise science expert. Calculate calories burned for a workout using MET (Metabolic Equivalent of Task) values and the Mifflin formula.

Formula: Calories = MET × weight_kg × duration_hours

MET reference values by exercise:
- Strength: bench press/squat/deadlift/compound lifts: 5.0, isolation (curls/lateral raises): 3.5, general weight training: 4.5
- Cardio: walking (slow): 3.0, walking (brisk): 4.0, jogging: 7.0, running (moderate): 9.0, running (fast): 11.0, cycling (moderate): 8.0, cycling (intense): 12.0, swimming: 8.0, jump rope: 12.0, rowing: 7.0, elliptical: 6.0
- HIIT/explosive: burpees: 12.0, box jumps: 10.0, mountain climbers: 10.0, kettlebell swings: 9.0, battle ropes: 10.0, general HIIT: 11.0
- Yoga/flexibility: light yoga/stretching: 2.5, power yoga/vinyasa: 4.0, pilates: 3.5
- Sports/mixed: boxing: 9.0, CrossFit: 10.0, circuit training: 8.0

Rules:
1. Use the user's body weight if provided, otherwise assume 75kg.
2. Distribute the total workout duration proportionally across exercises based on their count — each exercise gets duration / exercise_count minutes, adjusted for intensity.
3. Apply the MET that best matches each exercise's name and category. Be specific — "deadlift" gets a higher MET than "bicep curl".
4. Total up all exercise calories to get totalCalories.
5. Round all values to nearest whole number.
6. If no named exercises are provided, estimate based on workout type and duration alone.

Respond with ONLY a valid JSON object — no explanation, no text before or after:
{"totalCalories":number,"exercises":[{"name":"exercise name","calories":number}]}`;

async function estimateCalories(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse('ANTHROPIC_API_KEY is not configured', 503);
    }

    const { title, type, duration, exercises = [], userWeight } = await request.json();

    if (!duration || duration < 1) return errorResponse('Duration is required', 400);

    const weight = userWeight || 75;
    const exerciseList = exercises
      .filter((e) => e.name?.trim())
      .map((e) => `${e.name} (${e.category})`)
      .join(', ') || 'no specific exercises listed';

    const userMessage =
      `Workout: "${title || type}"
Type: ${type}
Duration: ${duration} minutes
Body weight: ${weight}kg
Exercises: ${exerciseList}

Calculate calories burned.`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return errorResponse('Could not parse calorie estimate', 500);

    const result = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = requireAuth(estimateCalories);
