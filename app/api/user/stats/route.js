import connectDB from '@/lib/mongodb';
import Workout from '@/models/Workout';
import NutritionLog from '@/models/NutritionLog';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/apiHelpers';

async function getDashboardStats(request) {
  try {
    await connectDB();

    const userId = request.user.userId;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [user, weekWorkouts, recentWorkouts, todayNutrition] = await Promise.all([
      User.findById(userId),
      Workout.find({ userId, date: { $gte: startOfWeek } }),
      Workout.find({ userId }).sort({ date: -1 }).limit(5).lean(),
      NutritionLog.findOne({
        userId,
        date: {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lt: new Date(now.setHours(23, 59, 59, 999)),
        },
      }),
    ]);

    const weeklyCalories = weekWorkouts.reduce((sum, w) => sum + (w.totalCaloriesBurned || 0), 0);
    const weeklyDuration = weekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

    return successResponse({
      stats: user?.stats || {},
      weekly: {
        workouts: weekWorkouts.length,
        calories: weeklyCalories,
        duration: weeklyDuration,
      },
      recentWorkouts,
      todayNutrition: todayNutrition || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getDashboardStats);
