
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config({ path: path.join(__dirname, '.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function testGeminiDirectly() {
    console.log('🚀 Starting Direct Gemini Test for Joe Great');
    console.log('🔑 API Key present:', !!process.env.GEMINI_API_KEY);

    const userContext = "Answer greetings";
    const aiName = "Peak";
    const userName = "Joe Great";
    const lastMessage = "How are you feeling today  ?";

    const prompt = `You are ${aiName}, an AI assistant for ${userName}. 
Context about ${userName}: ${userContext}

Role: Respond politely and helpfully to the message. Be brief and friendly.
If the message is not clear, ask for clarification.
Keep it concise (1-3 sentences).

Last message received from user: "${lastMessage}"

Response:`;

    console.log('📝 Prompt:', prompt);

    try {
        console.log('📡 Calling Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        console.log('✅ Gemini Success:', text);
    } catch (error) {
        console.error('❌ Gemini Error:', error);
        if (error.message) console.error('Error Message:', error.message);
        if (error.stack) console.error('Stack:', error.stack);
    }
}

testGeminiDirectly();
