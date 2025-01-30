const express = require('express');
const router = express.Router();
const { Question, Story, Month, Level } = require('../models/model');

//Post Method
router.post('/create-level', async (req, res) => {
   try {
        const { levelName, monthNumber, storyNumber, storyName, questions } = req.body;

        //Validate Question Data
        if (!levelName || !monthNumber || !storyNumber || !storyName || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: "Question Array is required and may not be empty."});
        }

        for (const q of questions) {
            if (!q.question || !q.answer) {
                return res.status(400).json({ error: "Each question must have both 'question' and 'answer' fields."})
            }
        }

        //Create Questions
        const questionDocs = await Question.insertMany(questions);

        //Find or Create Level
        let level = await Level.findOne({ levelName});

        if (!level) {
            level = new Level({ levelName, months: []});
            await level.save();
        }

        //Find or Create Month linked to this Level
        let month = await Month.findOneAndUpdate(
            { monthNumber, level: level._id },  // Find an existing month in the same level
            { $setOnInsert: { stories: [], level: level._id } }, // Only set these fields if inserting
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
        if(!month.stories.includes(story._id)) {
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
    res.status(500).json({ error: 'Internal Server Error'});
   }
});

//Get All Levels
router.get('/getAllLevels', async (req, res) => {
    try{
        const data = await Level.find();
        res.json(data);
    }
    catch(error){
        res.status(500).json({message: error.message});
    }
})

// Get all months for a specific level
router.get('/level/:levelName/months', async (req, res) => {
    try {
        const level = await Level.findOne({ levelName: req.params.levelName}).populate('months');

    if (!level) {
        return res.status(404).json({ message: "level not found"});
    } 
    res.json(level.months); 
    } catch (error) {
        res.status(500).json({ error: error.message});
    }
})

//Get all stories for a specific month

router.get('/level/:levelName/month/:monthNumber/stories', async (req, res) => {

    try {

        const level = await Level.findOne({ levelName: req.params.levelName}).populate({
            path: 'months',
            match: { monthNumber: req.params.monthNumber},
            populate: { path: 'stories'}
        });

        if (!level) {
            return res.status(404).json({ message: "Level not found"});
        }

        const month = level.months.find(m => m.monthNumber == req.params.monthNumber);

        if (!month) {
            return res.status(404).json({ message: "Month not found in this level" })
        }

        res.json(month.stories);

    } catch (error) {
        res.status(500).json({ error: error.message});
    }

});

//Get all questions for a specific story

router.get('/level/:levelName/month/:monthNumber/story/:storyNumber/questions', async (req, res) => {

    try {
        const level = await Level.findOne( { levelName: req.params.levelName} ).populate({

          path: 'months',
          match: { monthNumber: req.params.monthNumber},
          populate: {

            path: 'stories',
            match: { storyNumber: req.params.storyNumber },
            populate: { path: 'questions' }

          }  
        });

        if (!level) {
            return res.status(404).json({ message: "Level not found"});
        }

        const month = level.months.find(m => m.monthNumber == req.params.monthNumber);
        if (!month) {
            return res.status(404).json({ message: "Month not found in this level" });
        }

        const story = month.stories.find (s => s.storyNumber == req.params.storyNumber);
        if (!story) {
            return res.status(404).json({ message: "Story not found in this month"});
        }

        res.json(story.questions);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = router;