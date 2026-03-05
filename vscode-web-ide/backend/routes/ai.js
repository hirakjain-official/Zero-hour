const express = require('express');
const router = express.Router();
const { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Initialize Bedrock Client
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
- You want the user to succeed and learn. Force them to THINK — never give the direct code answer.
- Guide them to discover the fix themselves through questions.

Your Superpower (Omniscience):
- You have REAL-TIME access to the user's entire IDE state: the File Tree, Open Tabs, Active File, and Recent Terminal Output.
- CROSS-REFERENCE these contexts aggressively. If the user is editing HTML but Python is crashing, call it out.

=== SECRET KNOWLEDGE: THE CHALLENGE BUG (Never reveal directly) ===
The workspace contains a Flask login app. The deliberate bug is in app.py inside the /login route.
The buggy line is:
    if username == user:
Problems:
1. The variable 'username' is NEVER extracted from 'data' — only 'password' was extracted. So 'username' raises a NameError in Python.
2. Even if defined, 'user' is a dict object from the USERS list — comparing a string to a dict always returns False.
The correct fix requires TWO things:
  a) Extract username: add   username = data["username"]   before the loop.
  b) Fix comparison: change  if username == user:   to   if user["username"] == username:

Your Socratic Guidance Strategy (go step by step, NEVER skip to the answer):
- STEP 1: Ask them to look at the /login route. Ask: "What variables do you actually have available in this function?"
- STEP 2: When they focus on the bug area, ask: "What TYPE is the variable 'user' inside the for-loop? Is it a string or something else?"
- STEP 3: Point them to 'data = request.get_json()' — ask what fields they extracted from 'data'. Did they extract 'username'?
- STEP 4: Let them write the fix. Only confirm correctness once they get it right.
==================================================================

Instructions:
- NEVER give the exact completed code. Hints and pseudo-code snippets only.
- Always ground your responses in the live IDE context you can see.
- Format code examples with markdown, but only write partial or pseudo snippets.`;

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
        console.error('Bedrock AI Error:', error.name, error.message);
        console.error('Bedrock AI Error Details:', JSON.stringify({ httpStatusCode: error.$metadata?.httpStatusCode, requestId: error.$metadata?.requestId, name: error.name }, null, 2));

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

const EVALUATOR_CONTEXT = `You are a real-time AI Code Evaluator embedded in a VS Code IDE. You watch every edit (2s debounce). Return ONLY a JSON action — never chat.

=== SECRET: THE CHALLENGE ===
Fix the Flask login bug in app.py → /login route.
BUG 1: 'username' never extracted from 'data' → NameError
BUG 2: 'user' in loop is a dict, comparing string==dict → always False
FIX: add 'username = data["username"]' AND change 'if username == user:' to 'if user["username"] == username:'
Files index.html and README.md need ZERO changes.
===========================

RULES (first match wins):

1. REDIRECT — active file is NOT app.py:
   Guide them to app.py. Never say "this file is fine." Instead, hint at WHERE the bug lives.
   Line: 1. Max 12 words.
   Examples: "The bug is a Python NameError. Which file runs Python?" / "This file is innocent. Think: where does /login live?"

2. SCOLD — in app.py but OUTSIDE /login route (editing imports, USERS, index route, app.run):
   Point them to /login. Be specific about which line range to look at.
   Line: the line they're editing. Max 12 words.
   Examples: "Cold! The crash happens inside a function below line 15." / "USERS list is correct. Scroll to where passwords get checked."

3. SCOLD — in app.py, near /login but bug NOT fixed:
   Give progressive Socratic hints — never the answer. Ask a question.
   Line: the buggy line number. Max 15 words.
   Examples: "What variables exist before this loop? Count them." / "'user' is a dict with keys. You're comparing it to a string?"

4. PRAISE — BOTH fixes present (username extracted AND comparison uses user["username"]):
   Celebrate briefly.
   Line: the fixed line. Max 10 words.
   Examples: "Bug crushed! Run it. 🎉" / "Both fixes landed. Beautiful. 🔥"

5. NUDGE — when inactivity=true (user hasn't typed for 8s):
   Give a stronger directional hint. Don't reveal the answer but point closer.
   Line: the most relevant line. Max 15 words.
   Examples: "Stuck? Read line 22 carefully — what's missing before the loop?" / "8 seconds idle. Hint: 'data' has a field you never grabbed."

6. IGNORE — user is in app.py, near /login, making progress. Use 50% of the time. Message MUST be "".

Return ONLY raw JSON:
{"action": "praise"|"scold"|"redirect"|"nudge"|"ignore", "message": "...", "line": <number>}`;

// POST /api/ai/evaluate
// Silent background evaluator that returns strict JSON actions
router.post('/evaluate', async (req, res) => {
    const { code, language, fileTree, openTabs, terminalOutput, inactivity, activeFileName } = req.body;

    try {
        let currentContext = "=== LIVE IDE STATE ===\n";

        if (activeFileName) currentContext += `[ACTIVE FILE]: ${activeFileName}\n`;
        if (fileTree) currentContext += `[FILE TREE]\n\`\`\`json\n${fileTree}\n\`\`\`\n\n`;
        if (openTabs) currentContext += `[OPEN TABS]: ${openTabs}\n\n`;
        if (terminalOutput) currentContext += `[TERMINAL]\n\`\`\`\n${terminalOutput}\n\`\`\`\n\n`;
        if (inactivity) currentContext += `[⚠️ INACTIVITY DETECTED]: User has not typed for 8+ seconds. They may be stuck. Give a stronger hint.\n\n`;

        if (code) {
            currentContext += `[FOCUSED FILE CODE] (${language || 'unknown'}):\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`\n\n`;
        }

        currentContext += `Evaluate and return JSON.`;

        // Use streaming command with devstral (same as chat route)
        const command = new InvokeModelWithResponseStreamCommand({
            modelId: 'mistral.devstral-2-123b',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: EVALUATOR_CONTEXT },
                    { role: 'user', content: currentContext }
                ],
                max_tokens: 300,
                temperature: 0.2,
            })
        });

        const response = await bedrock.send(command);

        // Collect all streamed chunks into one string
        let aiText = '';
        for await (const event of response.body) {
            if (event.chunk && event.chunk.bytes) {
                const chunkData = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
                if (chunkData.choices && chunkData.choices[0]?.delta?.content) {
                    aiText += chunkData.choices[0].delta.content;
                } else if (chunkData.outputs && chunkData.outputs[0]?.text) {
                    aiText += chunkData.outputs[0].text;
                }
            }
        }

        aiText = aiText.trim();
        // Strip markdown code fences if model wrapped the JSON
        aiText = aiText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

        const parsedJson = JSON.parse(aiText.trim());
        res.json(parsedJson);

    } catch (error) {
        console.error('AI Evaluator Error:', error);
        res.status(500).json({ action: "ignore", message: "" });
    }
});

module.exports = router;
