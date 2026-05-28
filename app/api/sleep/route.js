import connectDB from '@/lib/mongodb';
import SleepLog from '@/models/SleepLog';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/apiHelpers';

async function getSleepLogs(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const dateStr   = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate   = searchParams.get('endDate');

    const query = { userId: request.user.userId };

    if (dateStr) {
      const day     = new Date(dateStr + 'T00:00:00.000Z');
      const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      query.date = { $gte: day, $lt: nextDay };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate + 'T00:00:00.000Z'),
        $lte: new Date(endDate   + 'T00:00:00.000Z'),
      };
    }

    const logs = await SleepLog.find(query).sort({ date: -1 }).lean();
    return successResponse(logs);
  } catch (error) {
    return handleApiError(error);
  }
}

async function createOrUpdateSleepLog(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { date, ...rest } = body;

    if (!date) return errorResponse('Date is required', 400);
    if (rest.duration === undefined || rest.duration === null) {
      return errorResponse('Duration is required', 400);
    }

    const day = new Date(date + 'T00:00:00.000Z');

    const log = await SleepLog.findOneAndUpdate(
      { userId: request.user.userId, date: day },
      { $set: { ...rest, userId: request.user.userId, date: day } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    );

    return successResponse(log, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET  = requireAuth(getSleepLogs);
export const POST = requireAuth(createOrUpdateSleepLog);
