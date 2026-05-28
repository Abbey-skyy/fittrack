import connectDB from '@/lib/mongodb';
import Workout from '@/models/Workout';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

async function getWorkout(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const workout = await Workout.findOne({ _id: id, userId: request.user.userId });
    if (!workout) return errorResponse('Workout not found', 404);
    return successResponse(workout);
  } catch (error) {
    return handleApiError(error);
  }
}

async function updateWorkout(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const workout = await Workout.findOneAndUpdate(
      { _id: id, userId: request.user.userId },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!workout) return errorResponse('Workout not found', 404);
    return successResponse(workout);
  } catch (error) {
    return handleApiError(error);
  }
}

async function deleteWorkout(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const workout = await Workout.findOneAndDelete({ _id: id, userId: request.user.userId });
    if (!workout) return errorResponse('Workout not found', 404);
    return successResponse({ message: 'Workout deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getWorkout);
export const PUT = requireAuth(updateWorkout);
export const DELETE = requireAuth(deleteWorkout);
