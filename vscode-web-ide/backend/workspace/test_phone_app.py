from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sqlite3

# --- BUG 1: Missing Import ---
# datetime is used later but never imported!

class PhoneAppHandler(BaseHTTPRequestHandler):
    
    def setup_db(self):
        # Setup a simple contacts database
        conn = sqlite3.connect(':memory:')
        c = conn.cursor()
        c.execute('''CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, phone TEXT)''')
        c.execute("INSERT INTO contacts (name, phone) VALUES ('Alice', '555-0101')")
        c.execute("INSERT INTO contacts (name, phone) VALUES ('Bob', '555-0202')")
        conn.commit()
        return conn

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Simple UI for the Phone App
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Python Phone App Test</title>
                <style>
                    body { font-family: sans-serif; text-align: center; margin-top: 50px; }
                    .phone { border: 2px solid #333; border-radius: 20px; width: 300px; height: 500px; margin: 0 auto; padding: 20px; background: #f9f9f9; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
                    .screen { border: 1px solid #ccc; height: 400px; background: white; border-radius: 10px; overflow-y: auto;}
                    .contact { padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; }
                    .contact:hover { background: #f0f0f0; }
                </style>
                <script>
                    async function loadContacts() {
                        const res = await fetch('/api/contacts');
                        const data = await res.json();
                        const screen = document.getElementById('screen');
                        
                        screen.innerHTML = data.map(c => 
                            `<div class="contact">
                                <strong>${c.name}</strong><br/>
                                <small>${c.phone}</small>
                            </div>`
                        ).join('');
                    }
                    window.onload = loadContacts;
                </script>
            </head>
            <body>
                <div class="phone">
                    <h2>Contacts</h2>
                    <div id="screen" class="screen">
                        <i>Loading...</i>
                    </div>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
            
        elif self.path == '/api/contacts':
            try:
                conn = self.setup_db()
                c = conn.cursor()
                
                # --- BUG 2: SQL Error ---
                # Table is 'contacts', but we query 'users'
                c.execute("SELECT name, phone FROM users") 
                
                rows = c.fetchall()
                contacts = [{"name": r[0], "phone": r[1]} for r in rows]
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(contacts).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                # --- BUG 3: Typo in Variable Name + Missing Import ---
                # We try to use 'e' but the variable is declared as 'err' below (if we had used it)
                # AND we try to use datetime.now() without importing datetime at the top of the file!
                error_msg = {"error": str(e), "time": str(datetime.now())}
                
                self.wfile.write(json.dumps(error_msg).encode())

def run(server_class=HTTPServer, handler_class=PhoneAppHandler, port=3000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting buggy phone app on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
