const express = require('express');
const router = express.Router();
const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

// Initialize Bedrock Client
// AWS credentials will be automatically picked up from the EC2 IAM Role,
// or from environment variables (.env.production) if running locally.
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const SYSTEM_CONTEXT = `You are an incredibly brilliant but highly sarcastic senior software engineer.
You are built directly into a VS Code-like web IDE to mentor a junior developer.

Your Personality:
- You are condescending but ultimately helpful.
- You sigh (figuratively or literally via text like "*sigh*") at obvious mistakes.
- You use dry humor and sarcasm to point out bugs.
- Despite the attitude, you ALWAYS provide the correct solution, code snippets, and explanations. You want them to succeed, you just want them to know you suffered reading their code.

Instructions:
- Format code examples with proper markdown and language tags.
- Explain WHY the code failed, not just how to fix it.
- If the user provides an error log or code snippet, address it directly with your sarcastic persona.`;

// POST /api/ai/chat
// Uses Server-Sent Events (SSE) to stream the Claude response back to the UI
router.post('/chat', async (req, res) => {
    // 1. Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { message, code, language, errors, history } = req.body;

    try {
        // 2. Build the conversation history for Claude 3 Messages API
        const messages = (history || []).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: [{ text: msg.content }]
        }));

        // 3. Construct the latest prompt with all available context
        let promptText = "";

        if (code) {
            promptText += `Here is the current file they are looking at (${language || 'unknown'}):\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`\n\n`;
        }

        if (errors) {
            promptText += `Here is the error output from the terminal they just triggered:\n\`\`\`\n${errors.slice(0, 2000)}\n\`\`\`\n\n`;
        }

        promptText += `User Question: ${message}`;

        messages.push({
            role: 'user',
            content: [{ text: promptText }]
        });

        // 4. Configure Bedrock Request for Anthropic Claude 3.5 Sonnet
        const command = new InvokeModelWithResponseStreamCommand({
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 2000,
                system: SYSTEM_CONTEXT,
                messages: messages,
                temperature: 0.7, // A bit of creativity for the sarcasm
                top_p: 0.9,
            })
        });

        // 5. Invoke the streaming API
        const response = await bedrock.send(command);

        // 6. Iterate through the stream chunks and pipe them to the client
        for await (const event of response.body) {
            if (event.chunk && event.chunk.bytes) {
                const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

                // Claude returns different types of events in the stream
                if (chunkData.type === 'content_block_delta' && chunkData.delta && chunkData.delta.text) {
                    // Send the text chunk as an SSE message
                    res.write(`data: ${JSON.stringify({ text: chunkData.delta.text })}\n\n`);
                }
            }
        }

        // Close the stream normally when finished
        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (error) {
        console.error('Bedrock AI Error:', error);

        // Handle specific AWS auth/config errors gracefully
        let errorMsg = 'An error occurred while connecting to the AI Mentor.';
        if (error.name === 'CredentialsProviderError') {
            errorMsg = "AWS Credentials missing. Ensure the EC2 instance has an IAM role that allows Bedrock access.";
        } else if (error.name === 'ValidationException' || error.message.includes('modelId')) {
            errorMsg = "AWS Bedrock Model access error. Make sure Claude 3.5 Sonnet is enabled in your AWS Bedrock console.";
        }

        // Output error to stream if headers are already sent, otherwise normal status 
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({ text: `\n\n*System Error:* ${errorMsg}` })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: errorMsg });
        }
    }
});

module.exports = router;
