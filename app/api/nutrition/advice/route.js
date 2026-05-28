import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth';

const SYSTEM_PROMPT = `You are a certified nutritionist AI integrated into FitTrack, a fitness tracking app. Analyze the user's daily nutrition and provide concise, personalized, and actionable advice.

Format your response with these sections using plain text (no markdown symbols):
OVERVIEW
A 1-2 sentence summary of today's intake.

WHAT YOU DID WELL
2-3 bullet points (use • symbol) about positives.

AREAS TO IMPROVE
2-3 bullet points (use • symbol) about gaps or concerns.

TOMORROW'S TIPS
2-3 specific, practical food suggestions.

Keep the total response under 280 words. Be encouraging and specific.`;

async function getNutritionAdvice(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured in .env.local' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { totals, meals, date, userProfile } = await request.json();

    const mealSummary = (meals || [])
      .map((m) => `${m.name.replace('_', ' ')}: ${(m.foods || []).map((f) => `${f.name} (${Math.round(f.calories * (f.quantity || 1))} kcal)`).join(', ')}`)
      .join('\n') || 'No meals logged yet';

    const goal = userProfile?.profile?.fitnessGoal?.replace(/_/g, ' ') || 'general fitness';
    const weight = userProfile?.profile?.weight ? `${userProfile.profile.weight}kg` : 'not specified';

    const userMessage = `Date: ${date}
Fitness goal: ${goal}
Body weight: ${weight}

Daily totals:
- Calories: ${Math.round(totals?.calories || 0)} kcal
- Protein: ${Math.round(totals?.protein || 0)}g
- Carbs: ${Math.round(totals?.carbs || 0)}g
- Fat: ${Math.round(totals?.fat || 0)}g
- Fiber: ${Math.round(totals?.fiber || 0)}g

Meals:
${mealSummary}

Please give me personalised nutrition advice for today.`;

    const client = new Anthropic();
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[AI Advice Error]', error);
    return new Response('Failed to generate advice. Please try again.', { status: 500 });
  }
}

export const POST = requireAuth(getNutritionAdvice);
