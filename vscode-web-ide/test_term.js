const { spawn } = require('child_process');

// Simulate the exact command from server.js
const proc = spawn('docker', ['exec', '-it', 'ide-workspace-1', 'bash']);

proc.stdout.on('data', d => console.log('STDOUT:', d.toString()));
proc.stderr.on('data', d => console.log('STDERR:', d.toString()));
proc.on('exit', code => console.log('EXIT:', code));
