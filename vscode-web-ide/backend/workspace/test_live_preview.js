const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                    background-color: #1e1e1e; 
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .box {
                    background: #2d2d2d;
                    padding: 2rem;
                    border-radius: 12px;
                    border: 1px solid #444;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    max-width: 90%;
                }
                h1 { color: #61dafb; margin-top: 0; font-size: 1.8rem; }
                .success { 
                    color: #4CAF50; 
                    font-weight: bold; 
                    background: rgba(76, 175, 80, 0.1);
                    padding: 8px 16px;
                    border-radius: 20px;
                    display: inline-block;
                }
                .logo {
                    font-size: 3rem;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="logo">🚀</div>
                <h1>Zero Hour Sandbox</h1>
                <p>The Live Preview Window is completely working!</p>
                <div class="success">Connected to Docker Container</div>
                <p style="color: #888; font-size: 0.9em; margin-top: 25px;">
                    This app is running securely on port 3000 inside your isolated workspace.
                </p>
            </div>
        </body>
        </html>
    `);
    res.end();
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('✅ Zero Hour Test Server Started!');
    console.log(`📡 Listening on Port ${PORT} inside the Docker container.`);
    console.log('👉 Check the Preview pane on the right-hand side of your screen!');
});
