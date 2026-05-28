import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

export async function POST(request) {
  try {
    await connectDB();

    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return errorResponse('Name, email, and password are required', 400);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return errorResponse('An account with this email already exists', 409);
    }

    const user = await User.create({ name, email, password });
    const token = signToken({ userId: user._id, email: user.email, name: user.name });

    return successResponse(
      { token, user: user.toPublicJSON() },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
