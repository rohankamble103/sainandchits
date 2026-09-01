const SYSTEM_PROMPT = `You are Sai, the helpful website assistant for Sainand Chits India Pvt. Ltd. Answer clearly and politely in short paragraphs.

Business details:
- Sainand Chits India Pvt. Ltd. operates from Nagpur, Maharashtra.
- Phone: +91 98765 43210.
- Email: info@sainandchitfund.com.
- Plans shown on the website include 5 Lakh, 10 Lakh, 15 Lakh, and 20 Lakh Bhisi plans.
- Explain that exact eligibility, fees, bidding rules, documents, and availability should be confirmed by the company team.
- Do not promise approvals, returns, or financial outcomes.
- For account-specific or urgent questions, direct the visitor to the phone number or email above.
- Never claim to be a human or to have access to private customer records.`;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: 'Chat service is not configured.' });
  }

  try {
    const { messages } = request.body || {};
    if (!Array.isArray(messages)) {
      return response.status(400).json({ error: 'Invalid chat messages.' });
    }

    const safeMessages = messages
      .filter(message => message && ['user', 'assistant'].includes(message.role))
      .slice(-12)
      .map(message => ({
        role: message.role,
        content: String(message.content || '').slice(0, 2000),
      }));

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...safeMessages,
        ],
      }),
    });

    const result = await openAiResponse.json();
    if (!openAiResponse.ok) {
      console.error('OpenAI error:', result);
      return response.status(502).json({ error: 'The chat service is temporarily unavailable.' });
    }

    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return response.status(502).json({ error: 'The chat service returned no answer.' });
    }

    return response.status(200).json({ answer });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return response.status(500).json({ error: 'Unable to process the chat message.' });
  }
}
