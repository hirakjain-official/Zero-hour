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

const SYSTEM_CONTEXT = `You are a brilliant, highly observant, and slightly sarcastic Senior AI Mentor built directly into a VS Code-like cloud IDE.

Your Personality:
- You use dry humor and sarcasm to point out bugs, but you are ALWAYS encouraging and supportive.
- You want the user to succeed and learn. Compliment them when they do well, but playfully tease them for obvious mistakes.
- DO NOT just scold them irrelevantly. Always guide them back to the correct path with clear, conceptual hints.

Your Superpower (Omniscience):
- You have REAL-TIME access to the user's entire IDE state: The File Tree, their Open Tabs, the Active File they are looking at, and their Recent Terminal Output.
- You must CROSS-REFERENCE these. If the user asks why "app.py" is failing, but the Terminal Output shows a KeyError for "DB_PASSWORD", and your File Tree shows they don't have a ".env" file, you must playfully call this out! (e.g., "I see you're staring at the HTML, but the terminal is screaming about a missing .env file. Let's fix that first!")

Instructions:
- NEVER give the exact, completed final code block. No spoilers!
- Give them HINTS, conceptual guidance, and point out which file or line is wrong based on your Omniscient context.
- Force the user to think and write the final correct code themselves.
- Format code examples with proper markdown, but only write *parts* of the solution or pseudo-code to guide them.`;

// POST /api/ai/chat
// Uses Server-Sent Events (SSE) to stream the Claude response back to the UI
router.post('/chat', async (req, res) => {
    // 1. Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { message, code, language, errors, history, fileTree, openTabs, terminalOutput } = req.body;

    try {
        // 2. Build the conversation history
        let previousMessages = (history || [])
            .filter(msg => msg.content && String(msg.content).trim().length > 0);

        // The frontend initializes with an 'assistant' greeting, which we must drop.
        while (previousMessages.length > 0 && previousMessages[0].role === 'assistant') {
            previousMessages.shift();
        }

        // 3. Construct the latest prompt context
        let currentContext = "=== LIVE IDE ECOSYSTEM STATE ===\n";

        if (fileTree) currentContext += `[WORKSPACE FILE TREE]\n\`\`\`json\n${fileTree}\n\`\`\`\n\n`;
        if (openTabs) currentContext += `[CURRENTLY OPEN TABS]: ${openTabs}\n\n`;
        if (terminalOutput) currentContext += `[RECENT TERMINAL LOGS]\n\`\`\`\n${terminalOutput}\n\`\`\`\n\n`;

        if (code) {
            currentContext += `[ACTIVELY FOCUSED FILE] (${language || 'unknown'}):\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`\n\n`;
        }

        if (errors) {
            currentContext += `[CRASH LOG FROM EXECUTION]:\n\`\`\`\n${errors.slice(0, 2000)}\n\`\`\`\n\n`;
        }

        currentContext += `[USER MESSAGE]: ${message}`;

        // 4. Construct Mistral's specific messages array
        let mistralMessages = [];

        // Mistral allows the "system" role at the top for context
        mistralMessages.push({
            role: 'system',
            content: SYSTEM_CONTEXT
        });

        for (const msg of previousMessages) {
            mistralMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
        }

        mistralMessages.push({ role: 'user', content: currentContext });

        // 5. Configure Bedrock Request for Mistral Large
        const command = new InvokeModelWithResponseStreamCommand({
            modelId: 'mistral.devstral-2-123b',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                messages: mistralMessages,
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

                // Mistral can return different stream formats depending on endpoint: 
                // choices[0].delta.content OR outputs[0].text OR delta.text (Claude compat)
                if (chunkData.choices && chunkData.choices[0] && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify({ text: chunkData.choices[0].delta.content })}\n\n`);
                } else if (chunkData.outputs && chunkData.outputs[0] && chunkData.outputs[0].text) {
                    res.write(`data: ${JSON.stringify({ text: chunkData.outputs[0].text })}\n\n`);
                } else if (chunkData.type === 'content_block_delta' && chunkData.delta && chunkData.delta.text) {
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

const EVALUATOR_CONTEXT = `You are a strict, highly observant, and sarcastic Senior AI Evaluator built into a VS Code web IDE.
You are a BACKGROUND AGENT continuously watching the user type. You do NOT chat. You ONLY evaluate if they are on track, based on your omniscient context.

Your Superpower:
- You have REAL-TIME access to the user's File Tree, their Open Tabs, the Active File they are editing, and Recent Terminal Output.

Your Mission:
Evaluate the user's current code edit against the context and terminal errors.
- Are they fixing the error shown in the terminal?
- Are they editing a completely irrelevant file (e.g., editing HTML when the backend Python crashed)?
- Is their code horribly wrong or syntactically broken?

You MUST return your response as a STRICT, VALID JSON object matching this exact format:
{
  "action": "praise" | "scold" | "redirect" | "ignore",
  "message": "Your 1-sentence sarcastic but encouraging popup message."
}

Rules for JSON "action":
- "ignore": Use 80% of the time if they are just typing normally and on the right track. Message can be empty.
- "praise": Use if they just fixed a nasty bug correctly or wrote a great line of code.
- "scold": Use if they made an obvious typo or syntax error in the right file.
- "redirect": Use if they are in the completely WRONG file based on the terminal crash log. (e.g. terminal says missing .env, but they are looking at HTML).

Do NOT wrap the JSON in markdown blocks. Return ONLY the raw JSON object.`;

// POST /api/ai/evaluate
// Silent background evaluator that returns strict JSON actions
router.post('/evaluate', async (req, res) => {
    const { code, language, fileTree, openTabs, terminalOutput } = req.body;

    try {
        let currentContext = "=== LIVE IDE ECOSYSTEM STATE ===\n";

        if (fileTree) currentContext += `[WORKSPACE FILE TREE]\n\`\`\`json\n${fileTree}\n\`\`\`\n\n`;
        if (openTabs) currentContext += `[CURRENTLY OPEN TABS]: ${openTabs}\n\n`;
        if (terminalOutput) currentContext += `[RECENT TERMINAL LOGS]\n\`\`\`\n${terminalOutput}\n\`\`\`\n\n`;

        if (code) {
            currentContext += `[ACTIVELY FOCUSED FILE JUST EDITED] (${language || 'unknown'}):\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`\n\n`;
        }

        currentContext += `Evaluate this state and return the strict JSON payload.`;

        const command = new InvokeModelCommand({
            modelId: "mistral.mistral-large-2407-v1:0", // Changed model id as user runs on mistral.mistral-large-2407-v1:0 in previous file history
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: `<s>[INST] ${EVALUATOR_CONTEXT}\n\n${currentContext} [/INST]`,
                max_tokens: 200,
                temperature: 0.2, // Low temp for strict JSON adherence
            })
        });

        const response = await bedrock.send(command);
        const data = JSON.parse(new TextDecoder().decode(response.body));
        let aiText = data.outputs[0].text.trim();

        // Basic clean up in case Mistral still wraps in markdown
        if (aiText.startsWith('\`\`\`json')) aiText = aiText.replace('\`\`\`json', '');
        if (aiText.startsWith('\`\`\`')) aiText = aiText.replace('\`\`\`', '');
        if (aiText.endsWith('\`\`\`')) aiText = aiText.substring(0, aiText.length - 3);

        const parsedJson = JSON.parse(aiText.trim());
        res.json(parsedJson);

    } catch (error) {
        console.error('AI Evaluator Error:', error);
        res.status(500).json({ action: "ignore", message: "" });
    }
});

module.exports = router;
