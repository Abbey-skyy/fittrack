import mongoose from 'mongoose';

const FoodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    servingSize: { type: Number, required: true }, // grams
    servingUnit: { type: String, default: 'g' },
    quantity: { type: Number, required: true, default: 1 },

    // Macros per serving
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, default: 0 },   // g
    carbs: { type: Number, default: 0 },     // g
    fat: { type: Number, default: 0 },       // g
    fiber: { type: Number, default: 0 },     // g
    sugar: { type: Number, default: 0 },     // g
    sodium: { type: Number, default: 0 },    // mg
  },
  { _id: true }
);

const MealSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'],
      required: true,
    },
    time: { type: Date },
    foods: [FoodItemSchema],
    notes: { type: String, trim: true },
  },
  { _id: true }
);

// Virtual: computed totals for a meal
MealSchema.virtual('totals').get(function () {
  return this.foods.reduce(
    (acc, food) => {
      const qty = food.quantity;
      acc.calories += food.calories * qty;
      acc.protein += food.protein * qty;
      acc.carbs += food.carbs * qty;
      acc.fat += food.fat * qty;
      acc.fiber += food.fiber * qty;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
});

const NutritionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    meals: [MealSchema],
    waterIntake: { type: Number, default: 0 }, // ml
    goals: {
      calories: { type: Number },
      protein: { type: Number },
      carbs: { type: Number },
      fat: { type: Number },
    },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index: one log per user per day
NutritionLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Virtual: daily totals across all meals
NutritionLogSchema.virtual('dailyTotals').get(function () {
  return this.meals.reduce(
    (acc, meal) => {
      meal.foods.forEach((food) => {
        const qty = food.quantity;
        acc.calories += food.calories * qty;
        acc.protein += food.protein * qty;
        acc.carbs += food.carbs * qty;
        acc.fat += food.fat * qty;
        acc.fiber += food.fiber * qty;
      });
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
});

export default mongoose.models.NutritionLog || mongoose.model('NutritionLog', NutritionLogSchema);
