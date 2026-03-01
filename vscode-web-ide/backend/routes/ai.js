const express = require('express');
const router = express.Router();
const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');

// Initialize Bedrock Client
// Automatically uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY if securely provided in .env
const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
}
const bedrock = new BedrockRuntimeClient(clientConfig);

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
        // 2. Build the conversation history
        let previousMessages = (history || [])
            .filter(msg => msg.content && String(msg.content).trim().length > 0);

        // The frontend initializes with an 'assistant' greeting, which we must drop.
        while (previousMessages.length > 0 && previousMessages[0].role === 'assistant') {
            previousMessages.shift();
        }

        // 3. Construct the latest prompt context
        let currentContext = "";

        if (code) {
            currentContext += `Here is the current file they are looking at (${language || 'unknown'}):\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`\n\n`;
        }

        if (errors) {
            currentContext += `Here is the error output from the terminal they just triggered:\n\`\`\`\n${errors.slice(0, 2000)}\n\`\`\`\n\n`;
        }

        currentContext += `User Question: ${message}`;

        // 4. Construct Mistral's specific <s>[INST]...[/INST] prompt format
        let mistralPrompt = `<s>[INST] SYSTEM CONTEXT: ${SYSTEM_CONTEXT}\n\n`;

        for (const msg of previousMessages) {
            if (msg.role === 'user') {
                mistralPrompt += `${msg.content} [/INST] `;
            } else {
                mistralPrompt += `${msg.content} </s><s>[INST] `;
            }
        }
        mistralPrompt += `${currentContext} [/INST]`;

        // 5. Configure Bedrock Request for Mistral Large (using the model ID you mentioned)
        const command = new InvokeModelWithResponseStreamCommand({
            modelId: 'mistral.mistral-large-2407-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                prompt: mistralPrompt,
                max_tokens: 2000,
                temperature: 0.7,
                top_p: 0.9,
            })
        });

        // 6. Invoke the streaming API
        const response = await bedrock.send(command);

        // 7. Iterate through the stream chunks and pipe them to the client
        for await (const event of response.body) {
            if (event.chunk && event.chunk.bytes) {
                const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

                // Mistral returns an array of outputs: { outputs: [{ text: "..." }] }
                if (chunkData.outputs && chunkData.outputs[0] && chunkData.outputs[0].text) {
                    res.write(`data: ${JSON.stringify({ text: chunkData.outputs[0].text })}\n\n`);
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
