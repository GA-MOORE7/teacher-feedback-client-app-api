const express = require('express');
const router = express.Router();
const { Question, Story, Month, Level } = require('../models/model');

//Post Method
router.post('/create-level', async (req, res) => {
    try {
        const { levelName, monthNumber, storyNumber, storyName, questions } = req.body;

        //Validate Question Data
        if (!levelName || !monthNumber || !storyNumber || !storyName || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: "Question Array is required and may not be empty." });
        }

        for (const q of questions) {
            if (!q.question || !q.answer) {
                return res.status(400).json({ error: "Each question must have both 'question' and 'answer' fields." })
            }
        }

        //Create Questions
        const questionDocs = await Question.insertMany(questions);

        //Find or Create Level
        let level = await Level.findOneAndUpdate(
            { levelName },
            { $setOnInsert: { levelName, months: [] } },
            { new: true, upsert: true }

        )

        //Find or Create Month linked to this Level
        let month = await Month.findOneAndUpdate(
            { monthNumber, level: level._id },  // Find an existing month in the same level
            { $setOnInsert: { monthNumber, stories: [], level: level._id } }, // Only set these fields if inserting
            { new: true, upsert: true } // Create if not found
        );


        const existingStory = await Story.findOne({ storyNumber, month: month._id });

        if (existingStory) {
            return res.status(400).json({ error: `Story Number ${storyNumber} already exists for month ${monthNumber}.` })
        }

        //Create Story with Questions
        const story = new Story({
            storyNumber,
            storyName,
            questions: questionDocs.map(q => q._id),
            month: month._id // Ensure the story is linked to the month
        });
        await story.save();

        // Add Story to Month
        if (!month.stories.includes(story._id)) {
            month.stories.push(story._id);
            await month.save();
        }

        //Ensure Month is Linked to Level
        if (!level.months.includes(month._id)) {
            level.months.push(month._id);
            await level.save();
        }


        res.status(201).json({ message: "Data created successfully", level })

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//Get All Levels
router.get('/getAllLevels', async (req, res) => {
    try {
        const data = await Level.find().sort({ levelName: 1 });
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
})

// Get all months for a specific level
router.get('/level/:levelName/months', async (req, res) => {
    try {
        const level = await Level.findOne({ levelName: req.params.levelName })
        .populate({
            path: 'months',
            options: { sort: { monthNumber: 1 } }

        });

        if (!level) {
            return res.status(404).json({ message: "level not found" });
        }
        res.json(level.months);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

//Get all stories for a specific month

router.get('/level/:levelName/month/:monthNumber/stories', async (req, res) => {

    try {

        const level = await Level.findOne({ levelName: req.params.levelName }).populate({
            path: 'months',
            match: { monthNumber: req.params.monthNumber },
            populate: {
                path: 'stories',
                options: { sort: { storyNumber: 1 } }
            }
        });

        if (!level) {
            return res.status(404).json({ message: "Level not found" });
        }

        const month = level.months.find(m => m.monthNumber == req.params.monthNumber);

        if (!month) {
            return res.status(404).json({ message: "Month not found in this level" })
        }

        res.json(month.stories);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }

});

//Get all questions for a specific story

router.get('/level/:levelName/month/:monthNumber/story/:storyNumber/questions', async (req, res) => {

    try {
        const level = await Level.findOne({ levelName: req.params.levelName }).populate({

            path: 'months',
            match: { monthNumber: req.params.monthNumber },
            populate: {

                path: 'stories',
                match: { storyNumber: req.params.storyNumber },
                populate: { path: 'questions' }

            }
        });

        if (!level) {
            return res.status(404).json({ message: "Level not found" });
        }

        const month = level.months.find(m => m.monthNumber == req.params.monthNumber);
        if (!month) {
            return res.status(404).json({ message: "Month not found in this level" });
        }

        const story = month.stories.find(s => s.storyNumber == req.params.storyNumber);
        if (!story) {
            return res.status(404).json({ message: "Story not found in this month" });
        }

        res.json(story.questions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Story details (Level, Month, Story) along with creation timestamps
router.get('/get-recent-stories', async (req, res) => {

    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find all stories created in the last 7 days
        const recentStories = await Story.find({ createdAt: { $gte: sevenDaysAgo } })
            .populate({
                path: 'month',
                select: 'monthNumber level',
                populate: { path: 'level', select: 'levelName' }    
            })
            .select('storyNumber storyName createdAt')
            .sort({ createdAt: -1 });

        if (!recentStories.length) {
            return res.status(404).json({ message: "No stories found in the last 7 days" });
        }

        // Return the story details along with Level and Month information
        const response = recentStories.map(story => ({

            levelName: story.month?.level?.levelName || "Unknown",
            monthNumber: story.month?.monthNumber || "Unknown",
            storyNumber: story.storyNumber,
            storyName: story.storyName,
            storyCreatedAt: story.createdAt

        })); 
           
        

        res.status(200).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }


});

// Delete a story based on storyNumber
router.delete('/delete-story/:levelName/:monthNumber/:storyNumber', async (req, res) => {

    try {

        const { levelName, monthNumber, storyNumber } = req.params;
        
        // Find the level
        const level = await Level.findOne({ levelName });
        if (!level) {
            return res.status(404).json({ error: "Level not found" });
        }

        // Find the month within the level
        const month = await Month.findOne({ monthNumber, level: level._id });
        if (!month) {
            return res.status(404).json({ error: "Month not found in this level" });
        }

        // Find the story within the month
        const story = await Story.findOne({ storyNumber, month: month._id });
        if (!story) {
            return res.status(404).json({ error: "Story not found in this month" });
        }

        // Remove related questions
        await Question.deleteMany({_id: { $in: story.questions} });

        // Remove story from the months stories array before deleting
        month.stories = month.stories.filter(storyId => !storyId.equals(story._id));
        await month.save();

        // Delete the story
        await story.deleteOne();

        // If the month has not more stories, remove it from the level before deleting the month
        if (month.stories.length === 0) {
            level.months = level.months.filter(monthId => !monthId.equals(month._id));
            await month.deleteOne();
        } else {
            await level.save();
        }

        // If the Level has no more months, delete the Level
        if (level.months.length === 0) {
            await level.deleteOne();
            return res.status(200).json({ message: `Story and level '${levelName}' deleted as it had no remaining content.` });    
        }

        res.status(200).json({ message: `Story '${storyNumber}' deleted successfully.` });


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

});

module.exports = router;