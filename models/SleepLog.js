import mongoose from 'mongoose';

const SleepLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // UTC midnight of the logged night
    bedtime: { type: String },   // "HH:MM" 24-hour format
    wakeTime: { type: String },  // "HH:MM" 24-hour format
    duration: { type: Number, required: true, min: 0, max: 24 }, // hours
    quality: { type: Number, min: 1, max: 5 },
    deepSleep: { type: Number, min: 0 },  // hours
    remSleep: { type: Number, min: 0 },   // hours
    interruptions: { type: Number, default: 0, min: 0 },
    tags: [{
      type: String,
      enum: ['stress', 'caffeine', 'alcohol', 'exercised', 'late_meal', 'screen_time', 'nap', 'medication'],
    }],
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

SleepLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.models.SleepLog || mongoose.model('SleepLog', SleepLogSchema);
