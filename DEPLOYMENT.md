# Vyaas AI Deployment Guide

## 1. Backend (Already Deployed? ✅)
You provided the Railway URL: `https://web-production-a6de0.up.railway.app`
Ensure your Railway project is active and the build was successful.

**Verification:**
Open `https://web-production-a6de0.up.railway.app` in your browser. You should see a "Not Found" 404 message (which is good! it means the server is running, just no route at `/`).

## 2. Frontend (Vercel Deployment)
Now let's put the frontend online.

1.  **Go to Vercel:** [https://vercel.com](https://vercel.com)
2.  **Log in** with GitHub.
3.  Click **"Add New"** > **"Project"**.
4.  **Import Git Repository:**
    *   Find `vyaas-ai` in the list (or search for it).
    *   Click **"Import"**.
5.  **Configure Project:**
    *   **Project Name:** `vyaas-ai` (or whatever you like).
    *   **Framework Preset:** Select **"Other"**.
    *   **Root Directory:** Leave as `./` (default).
    *   **Build & Output Settings:** Leave default (empty).
    *   **Environment Variables:** None needed for frontend (we hardcoded the API URL).
6.  Click **"Deploy"**.

## 3. Testing
Once Vercel finishes (takes ~30 seconds):
1.  Click the **"Visit"** button (you'll get a URL like `vyaas-ai.vercel.app`).
2.  **Test the Chat:** Send a message like "Hello".
    *   *If it replies:* **Success!** 🎉
    *   *If it stucks loading:* Check the Console (F12) for errors.

## Troubleshooting
*   **CORS Errors:** If you see "Access-Control-Allow-Origin" errors in the console, ensure the Railway server has fully restarted with the new `server.py` containing `CORS(app)`.
*   **API Errors:** Ensure the Railway URL in `script.js` is exactly correct (no trailing slash issues, though our code handles it).

Enjoy your live AI assistant! 🚀
