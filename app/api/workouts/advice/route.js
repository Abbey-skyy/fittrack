import Anthropic from '@anthropic-ai/sdk';
import connectDB from '@/lib/mongodb';
import Workout from '@/models/Workout';
import { requireAuth } from '@/lib/auth';

const SYSTEM_PROMPT = `You are a certified personal trainer and fitness coach AI integrated into FitTrack. Analyze the user's recent workout history and provide concise, personalised, actionable advice.

Format your response with these exact section headers in plain text (no markdown symbols except • for bullets):
OVERVIEW
A 1-2 sentence summary of their training patterns.

STRENGTHS
2-3 bullet points (use •) about what they are doing well.

AREAS TO IMPROVE
2-3 bullet points (use •) about training gaps or recovery risks.

NEXT WEEK'S PLAN
2-3 specific, practical workout recommendations.

Keep total response under 300 words. Be encouraging and specific.`;

async function getWorkoutAdvice(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured in .env.local' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { userProfile } = await request.json().catch(() => ({}));

    await connectDB();

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const workouts = await Workout.find({
      userId: request.user.userId,
      date: { $gte: since },
    }).sort({ date: -1 }).limit(20).lean();

    const goal   = userProfile?.profile?.fitnessGoal?.replace(/_/g, ' ') || 'general fitness';
    const weight = userProfile?.profile?.weight ? `${userProfile.profile.weight}kg` : 'not specified';

    let trainingSummary;
    if (workouts.length === 0) {
      trainingSummary = 'No workouts logged in the last 14 days.';
    } else {
      const totalCals    = workouts.reduce((s, w) => s + (w.totalCaloriesBurned || 0), 0);
      const totalMins    = workouts.reduce((s, w) => s + (w.duration || 0), 0);
      const typeCounts   = workouts.reduce((acc, w) => { acc[w.type] = (acc[w.type] || 0) + 1; return acc; }, {});
      const typeBreakdown = Object.entries(typeCounts).map(([t, c]) => `${t}: ${c}`).join(', ');

      const entries = workouts.map((w) => {
        const d    = new Date(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const exs  = (w.exercises || []).map((e) => e.name).filter(Boolean).join(', ');
        const mood = w.mood ? ` | felt: ${w.mood}` : '';
        const note = w.notes ? ` | note: "${w.notes.slice(0, 60)}"` : '';
        return `- ${d}: ${w.title} (${w.type}, ${w.duration}min, ${w.totalCaloriesBurned}kcal${mood}${note})${exs ? ` — ${exs}` : ''}`;
      }).join('\n');

      trainingSummary = `Last 14 days (${workouts.length} sessions):
Total time: ${totalMins} min | Total calories burned: ${totalCals} kcal
Type breakdown: ${typeBreakdown}

Session log:
${entries}`;
    }

    const userMessage = `My fitness goal: ${goal}
Body weight: ${weight}

${trainingSummary}

Please analyse my training and give me personalised advice.`;

    const client = new Anthropic();
    const stream = await client.messages.stream({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
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
    console.error('[Workout AI Error]', error);
    return new Response('Failed to generate advice. Please try again.', { status: 500 });
  }
}

export const POST = requireAuth(getWorkoutAdvice);
