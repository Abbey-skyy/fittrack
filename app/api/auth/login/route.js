import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

export async function POST(request) {
  try {
    await connectDB();

    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return errorResponse('Invalid email or password', 401);
    }

    const token = signToken({ userId: user._id, email: user.email, name: user.name });

    // Return user without password
    const userObj = user.toPublicJSON();

    return successResponse({ token, user: userObj });
  } catch (error) {
    return handleApiError(error);
  }
}
