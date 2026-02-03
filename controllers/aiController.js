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

        const prompt = `Summarize the following document content in a concise and informative way. Focus on the main points and key takeaways:\n\n${content}`;

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
        
        Content:\n\n${content}`;

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

module.exports = {
    summarizeDocument,
    generateCBT
};
