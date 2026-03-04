from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded users (in-memory for this demo)
USERS = [
    {"username": "admin", "password": "secret123"},
    {"username": "alice", "password": "wonderland"},
]


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing username or password"}), 400

    password = data['password']

    for user in USERS:
        if username == user:  # BUG: 'username' is not defined; should be user['username'] == data['username']
            if user['password'] == password:
                return jsonify({"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.success"}), 200

    return jsonify({"error": "Invalid credentials"}), 401


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
