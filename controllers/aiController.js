const { model } = require('../config/gemini');
const Material = require('../models/Material');
const CBT = require('../models/CBT');

// @desc    Get summary of a document
// @route   POST /api/ai/summarize
// @access  Private
const summarizeDocument = async (req, res) => {
    try {
        const { materialId, textContent } = req.body;

        let content = textContent;

        if (materialId) {
            const material = await Material.findById(materialId);
            if (!material) {
                return res.status(404).json({ message: 'Material not found' });
            }
            content = material.content || material.description;
        }

        if (!content) {
            return res.status(400).json({ message: 'No content available to summarize' });
        }

        const prompt = `Summarize the following document content in a concise and informative way. Focus on the main points and key takeaways:\\n\\n${content}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        // Auto-save summary to material if requested
        if (materialId) {
            await Material.findByIdAndUpdate(materialId, { aiSummary: summary });
        }

        res.json({ summary });
    } catch (error) {
        console.error('Gemini Summarize Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate CBT questions based on document
// @route   POST /api/ai/generate-cbt
// @access  Private
const generateCBT = async (req, res) => {
    try {
        const { materialId, textContent, numQuestions = 15 } = req.body;

        let content = textContent;

        if (materialId) {
            const material = await Material.findById(materialId);
            if (!material) {
                return res.status(404).json({ message: 'Material not found' });
            }
            content = material.content || material.description;
        }

        if (!content) {
            return res.status(400).json({ message: 'No content available to generate questions' });
        }

        const prompt = `Based on the following document content, generate ${numQuestions} multiple-choice questions for a Computer Based Test (CBT). 
        Return the response ONLY as a JSON array of objects with the following structure:
        [
          {
            "question": "The question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0, // Index of the correct option (0-3)
            "explanation": "Brief explanation of why this answer is correct"
          }
        ]
        
        Content:\\n\\n${content}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean JSON response (sometimes Gemini wraps it in markdown code blocks)
        text = text.replace(/```json|```/g, '').trim();

        const questions = JSON.parse(text);

        // Save as a permanent CBT if materialId is provided
        let savedCBT = null;
        if (materialId) {
            const material = await Material.findById(materialId);
            if (material) {
                // Always create a new CBT for every generation attempt as requested
                savedCBT = await CBT.create({
                    title: `AI Review: ${material.title}`,
                    courseCode: material.courseCode || 'AI-GEN',
                    duration: numQuestions * 2, // 2 mins per question
                    questions,
                    material: materialId,
                    isGenerated: true,
                    createdBy: req.user._id
                });

                console.log('✅ Generated CBT Saved:', JSON.stringify(savedCBT, null, 2));

                // Emit socket event for real-time library update
                const io = req.app.get('io');
                if (io) {
                    const populatedCBT = await CBT.findById(savedCBT._id).populate('material', 'title courseCode coverUrl');
                    io.emit('new_cbt', populatedCBT);
                }
            }
        }

        res.json({
            questions,
            cbtId: savedCBT ? savedCBT._id : null
        });
    } catch (error) {
        console.error('Gemini CBT Generation Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Generate AI Report for CBT performance
// @route   POST /api/ai/cbt-report
// @access  Private
const generateCBTReport = async (req, res) => {
    try {
        const { questions, userAnswers, score, totalQuestions, timeSpent, cbtId } = req.body;
        const userId = req.user._id;

        if (!questions || !userAnswers) {
            return res.status(400).json({ message: 'Missing questions or answers' });
        }

        // Fetch user's historical CBT performance
        const CBTResult = require('../models/CBTResult');
        const historicalResults = await CBTResult.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('cbt', 'title courseCode');

        // Calculate historical stats
        const avgScore = historicalResults.length > 0
            ? (historicalResults.reduce((sum, r) => sum + r.score, 0) / historicalResults.length).toFixed(1)
            : 'N/A';
        const avgTime = historicalResults.length > 0
            ? (historicalResults.reduce((sum, r) => sum + r.timeSpent, 0) / historicalResults.length).toFixed(0)
            : 'N/A';

        // Get current time context
        const currentHour = new Date().getHours();
        const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

        // Analyze answer patterns
        let answerPatternAnalysis = '';
        const optionCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
        userAnswers.forEach(ans => {
            if (ans !== -1) optionCounts[ans]++;
        });

        // Construct detailed performance data
        let performanceData = `Score: ${score}/${totalQuestions} (${Math.round((score / totalQuestions) * 100)}%)
Time Taken: ${Math.floor(timeSpent / 60)} minutes ${timeSpent % 60} seconds
Time of Day: ${timeOfDay} (${currentHour}:00)

Historical Performance:
- Average Score: ${avgScore}/${totalQuestions} (last ${historicalResults.length} tests)
- Average Time: ${avgTime} seconds
- Current vs Historical: ${score > parseFloat(avgScore) ? 'Above average ⬆️' : score < parseFloat(avgScore) ? 'Below average ⬇️' : 'On par'}

Answer Distribution Pattern:
- Option A selected: ${optionCounts[0]} times
- Option B selected: ${optionCounts[1]} times  
- Option C selected: ${optionCounts[2]} times
- Option D selected: ${optionCounts[3]} times
${optionCounts[2] > totalQuestions * 0.4 ? '⚠️ Heavy bias towards Option C detected' : ''}

DETAILED QUESTION-BY-QUESTION ANALYSIS:\n\n`;

        questions.forEach((q, index) => {
            const userAnswerIndex = userAnswers[index];
            const isCorrect = userAnswerIndex === q.correctAnswer;
            const allOptions = q.options.map((opt, idx) =>
                `${String.fromCharCode(65 + idx)}. ${opt}${idx === q.correctAnswer ? ' ✓' : ''}`
            ).join('\n    ');

            performanceData += `Q${index + 1}: ${q.question}
    Options:
    ${allOptions}
    Your Answer: ${userAnswerIndex !== -1 ? `Option ${String.fromCharCode(65 + userAnswerIndex)} - "${q.options[userAnswerIndex]}"` : 'SKIPPED'}
    Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}
    ${!isCorrect && userAnswerIndex !== -1 ? `Correct was: "${q.options[q.correctAnswer]}"` : ''}

`;
        });

        const prompt = `You are an expert educational psychologist and test performance analyst. Analyze the following student's CBT performance in EXTREME DETAIL.

${performanceData}

Provide a comprehensive, personalized analysis in JSON format with these fields:

{
  "overallAnalysis": "A detailed 3-4 sentence paragraph that:
    - Acknowledges their score and compares it to their historical performance
    - Comments on time management (was ${timeSpent}s efficient for ${totalQuestions} questions?)
    - Notes the time of day they took the test and if it might affect performance
    - Provides encouraging but honest feedback",
    
  "strengths": [
    "3-5 SHORT, simple sentences (max 10 words each).
    Examples: 'Strong in algebra concepts', 'Good time management', 'Improved from last test'
    Focus on: topics mastered, correct answer patterns, time efficiency, improvements"
  ],
  
  "weaknesses": [
    "3-5 SHORT, simple sentences (max 10 words each).
    Examples: 'Struggled with geometry questions', 'Picks option C too much', 'Slower than average'
    Focus on: weak topics, answer biases, time issues, skipped questions"
  ],
  
  "tips": [
    "5-7 SHORT, actionable tips (max 12 words each).
    Examples: 'Practice more word problems', 'Avoid picking same option repeatedly', 'Study in the morning'
    Include: study recommendations, test strategies, time advice, practice suggestions"
  ]
}

CRITICAL: Keep all list items SHORT and SIMPLE. Use everyday language, not fancy words. Be specific and direct. Return ONLY valid JSON.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean JSON response
        text = text.replace(/```json|```/g, '').trim();
        const report = JSON.parse(text);

        res.json(report);

    } catch (error) {
        console.error('Gemini Report Generation Error:', error);
        res.status(500).json({ message: 'Failed to generate report' });
    }
};

module.exports = {
    summarizeDocument,
    generateCBT,
    generateCBTReport
};

