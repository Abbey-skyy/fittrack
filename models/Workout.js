import mongoose from 'mongoose';

// Sub-schema for a single exercise set (strength)
const SetSchema = new mongoose.Schema(
  {
    reps: { type: Number },
    weight: { type: Number }, // kg
    duration: { type: Number }, // seconds (for time-based sets)
    restTime: { type: Number }, // seconds
    notes: { type: String, trim: true },
  },
  { _id: false }
);

// Sub-schema for an exercise within a workout
const ExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['strength', 'cardio', 'flexibility', 'balance', 'sports'],
      required: true,
    },
    muscleGroups: [{ type: String }],

    // Strength fields
    sets: [SetSchema],

    // Cardio fields
    distance: { type: Number }, // km
    duration: { type: Number }, // minutes
    pace: { type: Number },     // min/km
    speed: { type: Number },    // km/h
    incline: { type: Number },  // percentage

    // Shared
    caloriesBurned: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const WorkoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Workout title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['strength', 'cardio', 'hiit', 'yoga', 'mixed', 'other'],
      required: true,
    },
    exercises: {
      type: [ExerciseSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'Workout must have at least one exercise',
      },
    },
    date: { type: Date, default: Date.now, index: true },
    duration: { type: Number, required: true }, // minutes
    totalCaloriesBurned: { type: Number, default: 0 },
    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'tired', 'bad'],
    },
    rating: { type: Number, min: 1, max: 5 },
    notes: { type: String, trim: true, maxlength: [500, 'Notes cannot exceed 500 characters'] },
    isTemplate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-calculate totalCaloriesBurned before saving
WorkoutSchema.pre('save', function () {
  if (this.exercises?.length) {
    this.totalCaloriesBurned = this.exercises.reduce(
      (sum, ex) => sum + (ex.caloriesBurned || 0),
      0
    );
  }
});

export default mongoose.models.Workout || mongoose.model('Workout', WorkoutSchema);
