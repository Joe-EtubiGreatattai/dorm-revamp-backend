const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:5001/api/ai';

// Note: You need a valid JWT token to test protected routes.
// For this test, you'll need to manually paste a token from your logged-in session.
const TOKEN = 'YOUR_JWT_TOKEN_HERE';

const testSummarize = async () => {
    try {
        console.log('🧪 Testing Summarize...');
        const response = await axios.post(`${BASE_URL}/summarize`, {
            textContent: "The Renaissance was a fervent period of European cultural, artistic, political and economic “rebirth” following the Middle Ages. Generally described as taking place from the 14th century to the 17th century, the Renaissance promoted the rediscovery of classical philosophy, literature and art. Some of the greatest thinkers, authors, statesmen, scientists and artists in human history thrived during this era, while global exploration opened up new lands and cultures to European commerce. The Renaissance is credited with bridging the gap between the Middle Ages and modern-day civilization."
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log('✅ Summary Response:', response.data.summary);
    } catch (error) {
        console.error('❌ Summarize Test Failed:', error.response?.data || error.message);
    }
};

const testGenerateCBT = async () => {
    try {
        console.log('\n🧪 Testing CBT Generation...');
        const response = await axios.post(`${BASE_URL}/generate-cbt`, {
            textContent: "Photosynthesis is the process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water. Photosynthesis in plants generally involves the green pigment chlorophyll and generates oxygen as a byproduct.",
            numQuestions: 2
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log('✅ CBT Response:', JSON.stringify(response.data.questions, null, 2));
    } catch (error) {
        console.error('❌ CBT Test Failed:', error.response?.data || error.message);
    }
};

// Uncomment to run (after setting TOKEN)
// testSummarize();
// testGenerateCBT();
