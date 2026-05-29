import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/auth';
import { errorResponse, handleApiError } from '@/lib/apiHelpers';

const SYSTEM_PROMPT = `You are a precise nutrition database. Calculate the exact macronutrients for whatever food and quantity the user describes.

Critical rules:
- Calculate for the EXACT total amount the user describes. If they say "300g chicken breast", give macros for 300g — NOT per 100g.
- Use standard cooked/prepared values unless the user says raw.
- Respond with ONLY a JSON object and absolutely nothing else — no explanation, no text before or after.
- JSON format: {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number}
- Units: calories=kcal, protein/carbs/fat/fiber/sugar=grams, sodium=mg. All values are whole numbers.

Accurate reference values (cooked, per 100g):
- Chicken breast: 165 kcal, 31g protein, 3.6g fat, 0g carbs
- Beef (lean ground): 215 kcal, 26g protein, 12g fat, 0g carbs
- Salmon: 208 kcal, 20g protein, 13g fat, 0g carbs
- White rice (cooked): 130 kcal, 2.7g protein, 0.3g fat, 28g carbs
- Brown rice (cooked): 123 kcal, 2.7g protein, 1g fat, 26g carbs
- Egg (whole, 1 large = 50g): 78 kcal, 6g protein, 5g fat, 0.6g carbs
- Oats (cooked): 71 kcal, 2.5g protein, 1.5g fat, 12g carbs
- Banana (1 medium = 118g): 105 kcal, 1.3g protein, 0.4g fat, 27g carbs
- Whole milk (per 100ml): 61 kcal, 3.2g protein, 3.3g fat, 4.8g carbs`;

async function lookupNutrition(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse('ANTHROPIC_API_KEY is not configured in .env.local', 503);
    }

    const { foodName } = await request.json();
    if (!foodName?.trim()) return errorResponse('Food name is required', 400);

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 128,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: foodName.trim(),
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
