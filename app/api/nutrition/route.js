import connectDB from '@/lib/mongodb';
import NutritionLog from '@/models/NutritionLog';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

async function getNutritionLogs(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const query = { userId: request.user.userId };

    if (dateStr) {
      const day = new Date(dateStr + 'T00:00:00.000Z');
      const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: day, $lt: nextDay };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate + 'T00:00:00.000Z'),
        $lte: new Date(endDate + 'T00:00:00.000Z'),
      };
    }

    const logs = await NutritionLog.find(query).sort({ date: -1 }).lean();
    return successResponse(logs);
  } catch (error) {
    return handleApiError(error);
  }
}

async function createOrUpdateNutritionLog(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { date, ...rest } = body;

    if (!date) return errorResponse('Date is required', 400);

    const day = new Date(date + 'T00:00:00.000Z');

    const log = await NutritionLog.findOneAndUpdate(
      { userId: request.user.userId, date: day },
      { $set: { ...rest, userId: request.user.userId, date: day } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return successResponse(log, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = requireAuth(getNutritionLogs);
export const POST = requireAuth(createOrUpdateNutritionLog);
