import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Workout from '@/models/Workout';
import NutritionLog from '@/models/NutritionLog';
import SleepLog from '@/models/SleepLog';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/apiHelpers';

// Build the last N calendar days ending today (UTC midnight anchored)
function buildDayRange(n = 7) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(new Date(d));
  }
  return days;
}

function dayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
}
function shortDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function getProgress(request) {
  try {
    await connectDB();
    const userId = request.user.userId;

    const days7  = buildDayRange(7);
    const days30 = buildDayRange(30);
    const since7  = days7[0];
    const since30 = days30[0];
    const until   = new Date(days7[days7.length - 1].getTime() + 24 * 60 * 60 * 1000);

    // Fetch everything in parallel
    const [user, allWorkouts, allNutrition, allSleep] = await Promise.all([
      User.findById(userId).lean(),
      Workout.find({ userId, date: { $gte: since30 } }).sort({ date: 1 }).lean(),
      NutritionLog.find({ userId, date: { $gte: since30 } }).sort({ date: 1 }).lean(),
      SleepLog.find({ userId, date: { $gte: since30 } }).sort({ date: 1 }).lean(),
    ]);

    // ── Helper: find logs matching a UTC day ─────────────────────────────────
    const inDay = (doc, day) => {
      const docTs = new Date(doc.date).getTime();
      return docTs >= day.getTime() && docTs < day.getTime() + 86400000;
    };

    // ── Build per-day chart rows (last 7 days) ───────────────────────────────
    const last7days = days7.map((day) => {
      const wkts  = allWorkouts.filter((w) => inDay(w, day));
      const nutr  = allNutrition.find((n) => inDay(n, day));
      const sleep = allSleep.find((s) => inDay(s, day));

      const caloriesBurned  = wkts.reduce((s, w) => s + (w.totalCaloriesBurned || 0), 0);
      const workoutMinutes  = wkts.reduce((s, w) => s + (w.duration || 0), 0);
      const primaryType     = wkts.length ? wkts[0].type : null;

      let caloriesConsumed = 0, protein = 0, carbs = 0, fat = 0;
      if (nutr) {
        (nutr.meals || []).forEach((m) =>
          (m.foods || []).forEach((f) => {
            const q = f.quantity || 1;
            caloriesConsumed += (f.calories || 0) * q;
            protein          += (f.protein  || 0) * q;
            carbs            += (f.carbs    || 0) * q;
            fat              += (f.fat      || 0) * q;
          })
        );
      }

      return {
        date:             day.toISOString().split('T')[0],
        day:              dayLabel(day),
        shortDate:        shortDate(day),
        caloriesBurned:   Math.round(caloriesBurned),
        workoutMinutes,
        workoutType:      primaryType,
        hasWorkout:       wkts.length > 0,
        workoutCount:     wkts.length,
        caloriesConsumed: Math.round(caloriesConsumed),
        protein:          Math.round(protein),
        carbs:            Math.round(carbs),
        fat:              Math.round(fat),
        sleepHours:       sleep ? +sleep.duration.toFixed(1) : 0,
        sleepQuality:     sleep?.quality || 0,
        hasNutrition:     caloriesConsumed > 0,
        hasSleep:         !!sleep,
      };
    });

    // ── Workout type distribution (last 7 days) ──────────────────────────────
    const recentWorkouts = allWorkouts.filter((w) => inDay(w, days7[0]) || days7.some((d) => inDay(w, d)));
    const typeCounts = recentWorkouts.reduce((acc, w) => {
      acc[w.type] = (acc[w.type] || 0) + 1;
      return acc;
    }, {});
    const workoutTypes = Object.entries(typeCounts)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);

    // ── Average macros (days with nutrition data) ────────────────────────────
    const nutritionDays = last7days.filter((d) => d.hasNutrition);
    const avgMacros = nutritionDays.length
      ? {
          protein: Math.round(nutritionDays.reduce((s, d) => s + d.protein, 0) / nutritionDays.length),
          carbs:   Math.round(nutritionDays.reduce((s, d) => s + d.carbs,   0) / nutritionDays.length),
          fat:     Math.round(nutritionDays.reduce((s, d) => s + d.fat,     0) / nutritionDays.length),
        }
      : { protein: 0, carbs: 0, fat: 0 };

    // ── Progress scores ──────────────────────────────────────────────────────
    const goal       = user.profile?.fitnessGoal || 'general_fitness';
    const bodyWeight = user.profile?.weight || 70;

    const workoutsThisWeek = last7days.filter((d) => d.hasWorkout).length;
    const avgSleep         = last7days.reduce((s, d) => s + d.sleepHours, 0) / 7;
    const avgCalBurned     = last7days.reduce((s, d) => s + d.caloriesBurned, 0) / 7;
    const avgCalConsumed   = nutritionDays.length
      ? nutritionDays.reduce((s, d) => s + d.caloriesConsumed, 0) / nutritionDays.length : 0;

    const TARGET_WORKOUTS = { weight_loss: 4, muscle_gain: 4, endurance: 5, maintenance: 3, general_fitness: 3 };
    const activityScore  = Math.min(100, Math.round((workoutsThisWeek / (TARGET_WORKOUTS[goal] || 3)) * 100));
    const recoveryScore  = Math.min(100, Math.round((Math.min(avgSleep, 9) / 8) * 100));

    let nutritionScore = 0;
    if (!nutritionDays.length) {
      nutritionScore = 0;
    } else if (goal === 'weight_loss') {
      const deficit = avgCalBurned - avgCalConsumed;
      nutritionScore = deficit >= 500 ? 100 : deficit >= 200 ? 70 : deficit > 0 ? 40 : 10;
    } else if (goal === 'muscle_gain') {
      const protPerKg = avgMacros.protein / bodyWeight;
      nutritionScore = Math.min(100, Math.round((protPerKg / 1.8) * 100));
    } else {
      // consistency of logging
      nutritionScore = Math.round((nutritionDays.length / 7) * 100);
    }

    const WEIGHTS = {
      weight_loss:     { activity: 0.35, nutrition: 0.45, recovery: 0.20 },
      muscle_gain:     { activity: 0.40, nutrition: 0.40, recovery: 0.20 },
      endurance:       { activity: 0.50, nutrition: 0.30, recovery: 0.20 },
      maintenance:     { activity: 0.33, nutrition: 0.34, recovery: 0.33 },
      general_fitness: { activity: 0.33, nutrition: 0.34, recovery: 0.33 },
    };
    const w = WEIGHTS[goal] || WEIGHTS.general_fitness;
    const overallScore = Math.min(100, Math.round(
      activityScore * w.activity + nutritionScore * w.nutrition + recoveryScore * w.recovery
    ));

    // ── Current state ────────────────────────────────────────────────────────
    const strengthSessions = recentWorkouts.filter((w) => ['strength', 'hiit'].includes(w.type)).length;
    const cardioMins = last7days
      .filter((d) => d.workoutType === 'cardio')
      .reduce((s, d) => s + d.workoutMinutes, 0);

    let stateLabel, stateDesc, stateStatus;
    if (goal === 'weight_loss') {
      const weeklyDef = last7days.reduce((s, d) => s + (d.caloriesBurned - d.caloriesConsumed), 0);
      if (weeklyDef >= 2000)     { stateLabel = 'Burning Fat';      stateStatus = 'good';    stateDesc = 'Strong calorie deficit this week — fat loss is happening.'; }
      else if (weeklyDef >= 500) { stateLabel = 'On Track';         stateStatus = 'good';    stateDesc = 'Maintaining a healthy calorie deficit. Keep it up.'; }
      else if (workoutsThisWeek === 0) { stateLabel = 'Needs Movement'; stateStatus = 'alert'; stateDesc = 'No workouts logged this week. Add cardio to stay in deficit.'; }
      else                        { stateLabel = 'Adjust Intake';   stateStatus = 'warning'; stateDesc = 'Calorie intake is too high for weight loss. Reduce portions or increase cardio.'; }
    } else if (goal === 'muscle_gain') {
      if (strengthSessions >= 3 && avgMacros.protein >= bodyWeight * 1.6) { stateLabel = 'Building Muscle';  stateStatus = 'good';    stateDesc = `${strengthSessions} strength sessions with solid protein intake — great for hypertrophy.`; }
      else if (strengthSessions >= 2)  { stateLabel = 'Making Progress'; stateStatus = 'good';    stateDesc = 'Good training frequency. Boost protein to at least 1.6g per kg body weight.'; }
      else if (strengthSessions === 0) { stateLabel = 'Start Lifting';   stateStatus = 'alert';   stateDesc = 'No strength training logged. Aim for 3–4 sessions per week.'; }
      else                              { stateLabel = 'More Volume';     stateStatus = 'warning'; stateDesc = 'Increase strength training frequency and protein for consistent gains.'; }
    } else if (goal === 'endurance') {
      if (cardioMins >= 150)     { stateLabel = 'Building Endurance'; stateStatus = 'good';    stateDesc = `${cardioMins} cardio minutes this week — above the 150 min target.`; }
      else if (cardioMins >= 75) { stateLabel = 'Good Progress';      stateStatus = 'good';    stateDesc = 'Decent cardio volume. Aim for 150+ minutes per week for endurance gains.'; }
      else if (cardioMins === 0) { stateLabel = 'Start Cardio';       stateStatus = 'alert';   stateDesc = 'No cardio logged this week. Start with 30-min sessions, 3× per week.'; }
      else                        { stateLabel = 'More Cardio';        stateStatus = 'warning'; stateDesc = 'Increase cardio sessions to reach the 150 minutes per week target.'; }
    } else if (goal === 'maintenance') {
      if (overallScore >= 70)    { stateLabel = 'Well Balanced';   stateStatus = 'good';    stateDesc = 'Great balance of training, nutrition, and rest this week.'; }
      else if (overallScore >= 40) { stateLabel = 'Maintaining';   stateStatus = 'good';    stateDesc = 'Decent overall consistency. Stay on top of all three pillars.'; }
      else                        { stateLabel = 'Needs Focus';    stateStatus = 'warning'; stateDesc = 'Log your activities consistently to maintain your fitness level.'; }
    } else {
      if (overallScore >= 75)    { stateLabel = 'Feeling Great';   stateStatus = 'good';    stateDesc = 'Excellent all-around fitness week — keep the momentum!'; }
      else if (overallScore >= 45) { stateLabel = 'Getting Fitter'; stateStatus = 'good';    stateDesc = 'Good overall progress. Keep logging workouts, food, and sleep.'; }
      else                        { stateLabel = 'Just Starting';  stateStatus = 'warning'; stateDesc = 'Log your workouts, nutrition, and sleep daily to see progress here.'; }
    }

    return successResponse({
      user:         { profile: user.profile, stats: user.stats, name: user.name },
      last7days,
      workoutTypes,
      avgMacros,
      weekSummary: {
        workouts:     workoutsThisWeek,
        caloriesBurned: last7days.reduce((s, d) => s + d.caloriesBurned, 0),
        avgSleep:     +avgSleep.toFixed(1),
        avgCalories:  Math.round(avgCalConsumed),
      },
      scores: {
        activity:  activityScore,
        nutrition: nutritionScore,
        recovery:  recoveryScore,
        overall:   overallScore,
      },
      currentState: { label: stateLabel, description: stateDesc, status: stateStatus },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getProgress);
