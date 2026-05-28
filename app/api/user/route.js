import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

async function getUser(request) {
  try {
    await connectDB();
    const user = await User.findById(request.user.userId);
    if (!user) return errorResponse('User not found', 404);
    return successResponse(user.toPublicJSON());
  } catch (error) {
    return handleApiError(error);
  }
}

async function updateUser(request) {
  try {
    await connectDB();
    const { name, profile } = await request.json();
    const update = {};
    if (name) update.name = name;
    if (profile) update.profile = profile;

    const user = await User.findByIdAndUpdate(
      request.user.userId,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!user) return errorResponse('User not found', 404);
    return successResponse(user.toPublicJSON());
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getUser);
export const PUT = requireAuth(updateUser);
