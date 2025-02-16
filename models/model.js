const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true }
});

const StorySchema = new mongoose.Schema({
    storyNumber: { type: Number, required: true },
    storyName: { type: String, required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    month: { type: mongoose.Schema.Types.ObjectId, ref: 'Month', required: true } // Link story to month
}, { timestamps: true });

// Add a unique index on storyNumber + month to enforce uniqueness within a month
StorySchema.index({ storyNumber: 1, month: 1 }, { unique: true });

const MonthSchema = new mongoose.Schema({
    monthNumber: { type: Number, required: true },
    stories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Story' }],
    level: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true } // 🔥 Add this line
}, { timestamps: true });

// **Add unique index to prevent duplicate monthNumbers for the same level**
MonthSchema.index({ monthNumber: 1, level: 1 }, { unique: true });

const LevelSchema = new mongoose.Schema({
    levelName: { type: String, required: true },
    months: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Month' }]
}, { timestamps: true });

const Question = mongoose.model('Question', QuestionSchema);
const Story = mongoose.model('Story', StorySchema);
const Month = mongoose.model('Month', MonthSchema);
const Level = mongoose.model('Level', LevelSchema);

module.exports = { Question, Story, Month, Level };



