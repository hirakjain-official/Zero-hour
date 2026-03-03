from flask import Flask, render_template
import os

app = Flask(__name__)

# Simulating a database connection setup
# BUG: This will crash the app because there is no .env file or environment variable configured in this project
db_password = os.environ['DB_PASSWORD']

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
