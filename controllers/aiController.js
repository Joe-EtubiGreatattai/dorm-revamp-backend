const { model } = require('../config/gemini');
const Material = require('../models/Material');
const CBT = require('../models/CBT');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

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

        // Ensure timeSpent is a valid number
        const validTimeSpent = timeSpent && !isNaN(timeSpent) ? parseInt(timeSpent) : 0;

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
Time Taken: ${Math.floor(validTimeSpent / 60)} minutes ${validTimeSpent % 60} seconds
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
    - Comments on time management (was ${validTimeSpent}s efficient for ${totalQuestions} questions?)
    - Notes the time of day they took the test and if it might affect performance
    - Provides encouraging but honest feedback",
    
  "strengths": [
    "4-5 clear, specific sentences (15-20 words each) in simple language.
    Examples: 'You showed excellent understanding of phase sequencing and correctly identified most implementation details', 'Your time management was efficient, completing the test faster than your average'
    Focus on: specific topics/concepts mastered, patterns in correct answers, time efficiency, improvement trends"
  ],
  
  "weaknesses": [
    "4-5 clear, specific sentences (15-20 words each) in simple language.
    Examples: 'You struggled with questions about external benchmarks and often confused competitor features', 'There is a pattern of selecting option C too frequently which suggests guessing'
    Focus on: specific topics struggled with, answer biases detected, time management issues, questions skipped"
  ],
  
  "tips": [
    "6-8 actionable, specific tips (15-20 words each) in simple language.
    Examples: 'Review the differences between various AI platforms and their specific use cases to improve accuracy', 'Practice distributing your answers more evenly across all options to reduce guessing patterns'
    Include: specific study topics, test-taking strategies, time management advice, optimal study times, practice recommendations"
  ]
}

IMPORTANT: Be specific and detailed but use everyday language. Each point should give real value and actionable insight. Return ONLY valid JSON.`;

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

const updateAISettings = async (req, res) => {
    try {
        const { enabled, aiName, customContext } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    'aiSettings.enabled': enabled,
                    'aiSettings.aiName': aiName,
                    'aiSettings.customContext': customContext
                }
            },
            { new: true }
        );
        res.json(user.aiSettings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const handleAutoResponder = async (io, conversationId, receiverId, senderId, lastMessageContent) => {
    try {
        const receiver = await User.findById(receiverId);
        const conversation = await Conversation.findById(conversationId);

        if (!receiver || !receiver.aiSettings?.enabled) return;

        // Check if AI is disabled specifically for this conversation
        // If aiEnabledFor is used, we assume it must be present if conversation-level toggle is required
        // In my plan, I said "globally or per-conversation". 
        // Let's implement it so if it's in aiEnabledFor OR global is ON (and not explicitly OFF).
        // Actually, let's stick to: Global Toggle MUST be ON. 
        // And if aiEnabledFor has entries, it's only for those? No, let's say aiEnabledFor is for specific chats.

        // Simplified logic: Global Toggle must be ON.
        if (!receiver.aiSettings.enabled) return;

        console.log(`🤖 [AI] Auto-responding for ${receiver.name} (${receiver.aiSettings.aiName})`);

        const prompt = `You are ${receiver.aiSettings.aiName}, an AI assistant for ${receiver.name}. 
        Context about ${receiver.name}: ${receiver.aiSettings.customContext || 'A user of our platform.'}
        
        Role: Respond politely and helpfully to the message. If this is a vendor, provide info about products.
        Keep it concise (1-3 sentences).
        
        Last message received: "${lastMessageContent}"
        
        Response:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiText = response.text().trim();

        // Create AI Message
        const message = await Message.create({
            conversationId,
            senderId: receiverId, // AI speaks as the receiver
            receiverId: senderId,
            content: aiText,
            type: 'text',
            isAIReply: true,
            aiName: receiver.aiSettings.aiName,
            readBy: [{
                userId: receiverId,
                readAt: new Date()
            }]
        });

        // Update conversation
        conversation.lastMessage = aiText;
        conversation.lastMessageAt = Date.now();
        await conversation.save();

        const populatedMessage = await Message.findById(message._id);

        if (io) {
            io.to(conversationId.toString()).emit('message:receive', populatedMessage);
            io.to(senderId.toString()).emit('notification:message', {
                senderId: receiverId,
                senderName: `${receiver.aiSettings.aiName} (${receiver.name})`,
                content: aiText,
                conversationId,
                message: populatedMessage
            });
        }
    } catch (error) {
        console.error('AI Auto-responder Error:', error);
    }
};

module.exports = {
    summarizeDocument,
    generateCBT,
    generateCBTReport,
    updateAISettings,
    handleAutoResponder
};

