import connectDB from '@/lib/mongodb';
import Workout from '@/models/Workout';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

async function getWorkouts(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type');
    const skip = (page - 1) * limit;

    const query = { userId: request.user.userId };
    if (type) query.type = type;

    const [workouts, total] = await Promise.all([
      Workout.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
      Workout.countDocuments(query),
    ]);

    return successResponse({
      workouts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function createWorkout(request) {
  try {
    await connectDB();

    const body = await request.json();
    const workout = await Workout.create({ ...body, userId: request.user.userId });

    // Update user stats
    await User.findByIdAndUpdate(request.user.userId, {
      $inc: {
        'stats.totalWorkouts': 1,
        'stats.totalCaloriesBurned': workout.totalCaloriesBurned,
      },
      $set: { 'stats.lastWorkoutDate': workout.date },
    });

    return successResponse(workout, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getWorkouts);
export const POST = requireAuth(createWorkout);
