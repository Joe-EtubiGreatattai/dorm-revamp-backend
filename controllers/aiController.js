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
        const { materialId, textContent, numQuestions = 5 } = req.body;

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

        res.json({ questions });
    } catch (error) {
        console.error('Gemini CBT Generation Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    summarizeDocument,
    generateCBT
};
