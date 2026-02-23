require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

(async () => {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with just: SDK working' }],
    });
    console.log('Success:', response.content[0].text);
  } catch (e) {
    console.error('Failed:', e.message);
  }
})();
