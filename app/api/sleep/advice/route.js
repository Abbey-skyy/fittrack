import Anthropic from '@anthropic-ai/sdk';
import connectDB from '@/lib/mongodb';
import SleepLog from '@/models/SleepLog';
import { requireAuth } from '@/lib/auth';

const SYSTEM_PROMPT = `You are a certified sleep health coach AI integrated into FitTrack. Analyze the user's recent sleep data and provide concise, personalised, actionable advice.

Format your response with these exact section headers in plain text (no markdown symbols except • for bullets):
OVERVIEW
A 1-2 sentence summary of their sleep patterns.

WHAT'S WORKING
2-3 bullet points (use •) about positive sleep habits.

AREAS TO IMPROVE
2-3 bullet points (use •) about sleep issues or risks.

TONIGHT'S TIPS
2-3 specific, practical suggestions for better sleep tonight.

Keep total response under 300 words. Be encouraging, specific, and science-based.`;

function qualityLabel(q) {
  return ['', 'Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'][q] || 'Not rated';
}

async function getSleepAdvice(request) {
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
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);

    const logs = await SleepLog.find({
      userId: request.user.userId,
      date: { $gte: since },
    }).sort({ date: -1 }).lean();

    const goal       = userProfile?.profile?.fitnessGoal?.replace(/_/g, ' ') || 'general fitness';
    const weight     = userProfile?.profile?.weight ? `${userProfile.profile.weight}kg` : 'not specified';

    let sleepSummary;
    if (logs.length === 0) {
      sleepSummary = 'No sleep data logged in the last 7 days.';
    } else {
      const avgDuration = logs.reduce((s, l) => s + l.duration, 0) / logs.length;
      const avgQuality  = logs.filter((l) => l.quality).reduce((s, l) => s + l.quality, 0) / (logs.filter((l) => l.quality).length || 1);
      const allTags     = logs.flatMap((l) => l.tags || []);
      const tagFreq     = allTags.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
      const topTags     = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

      const entries = logs.map((l) => {
        const d = new Date(l.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const parts = [`${l.duration.toFixed(1)}h sleep`];
        if (l.quality)    parts.push(`quality: ${qualityLabel(l.quality)}`);
        if (l.bedtime)    parts.push(`bed: ${l.bedtime}`);
        if (l.wakeTime)   parts.push(`wake: ${l.wakeTime}`);
        if (l.interruptions) parts.push(`${l.interruptions} interruption(s)`);
        if (l.tags?.length)  parts.push(`tags: ${l.tags.join(', ')}`);
        return `- ${d}: ${parts.join(' | ')}`;
      }).join('\n');

      sleepSummary = `Last 7 nights (${logs.length} logged):
Average duration: ${avgDuration.toFixed(1)} hours
Average quality: ${avgQuality.toFixed(1)}/5
Common disruptors: ${topTags.length ? topTags.join(', ') : 'none noted'}

Nightly breakdown:
${entries}`;
    }

    const userMessage = `My fitness goal: ${goal}
Body weight: ${weight}

${sleepSummary}

Please analyse my sleep and give me personalised advice.`;

    const client  = new Anthropic();
    const stream  = await client.messages.stream({
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
    console.error('[Sleep AI Error]', error);
    return new Response('Failed to generate advice. Please try again.', { status: 500 });
  }
}

export const POST = requireAuth(getSleepAdvice);
