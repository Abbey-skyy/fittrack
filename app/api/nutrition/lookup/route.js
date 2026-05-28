import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth';
import { errorResponse, handleApiError } from '@/lib/apiHelpers';

const SYSTEM_PROMPT = `You are a nutrition database assistant. When given a food item and serving size, respond with ONLY a valid JSON object containing estimated nutritional values for that exact serving. Use this format with no extra text:
{"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number}
All values are numbers. calories=kcal, protein/carbs/fat/fiber/sugar=grams, sodium=mg. Be accurate based on standard food data.`;

async function lookupNutrition(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse('ANTHROPIC_API_KEY is not configured in .env.local', 503);
    }

    const { foodName, servingSize = 100, quantity = 1 } = await request.json();
    if (!foodName?.trim()) return errorResponse('Food name is required', 400);

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Food: "${foodName}", serving size: ${servingSize}g, quantity: ${quantity}`,
      }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return errorResponse('Could not parse nutrition data', 500);

    const nutrition = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, data: nutrition });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = requireAuth(lookupNutrition);
