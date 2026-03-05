# 🐛 Challenge: Fix the Login Bug

## What this app does
A simple Flask login API + HTML frontend. Users can enter a username and password, hit **Login**, and receive a JWT-style success token.

## The problem
The login **always returns 401 Unauthorized**, even with correct credentials (`admin` / `secret123`).

## Your mission
Find and fix the bug in `app.py` so that valid credentials succeed.

## How to run
```bash
pip install flask flask-cors
python app.py
```
Then open: http://localhost:3000

**Hint:** Start by reading the `/login` route carefully. 👀
