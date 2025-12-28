import os
import sys
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes (needed for Vercel frontend)

# --- Configuration ---
PORT = 8000
STATIC_FOLDER = os.path.dirname(os.path.abspath(__file__))

# Google Search Config
GOOGLE_API_KEY = "AIzaSyCZGMN6Oi-z9lX08piRiQqwRw-yWGlc9cw"
SEARCH_ENGINE_ID = "61f2239b8f42c4f60"

def google_search(query, num_results=3):
    """Searches Google and returns a list of {title, link, snippet}."""
    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        'key': GOOGLE_API_KEY,
        'cx': SEARCH_ENGINE_ID,
        'q': query,
        'num': num_results
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        items = data.get('items', [])
        return [{'title': i['title'], 'href': i['link'], 'body': i['snippet']} for i in items]
    except Exception as e:
        print(f"[ERROR] Google Search failed: {e}")
        return []

def scrape_content(url):
    """Fetches URL and extracts main text."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        # Aggressive timeout (3s) to prevent hanging
        resp = requests.get(url, headers=headers, timeout=3)
        if resp.status_code != 200:
            return ""
        
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            script.extract()
            
        text = soup.get_text(separator=' ')
        # Clean text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return clean_text[:1000] # Limit to 1000 chars (Speed optimization)
    except Exception as e:
        print(f"[WARN] Scraping {url} failed: {e}")
        return ""

# --- Web Research Endpoint ---
from concurrent.futures import ThreadPoolExecutor

# ... (Previous imports kept) ...

# ... (google_search and scrape_content functions kept) ...

# --- Web Research Endpoint ---
@app.route('/api/search', methods=['GET'])
def search_web():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    print(f"[RESEARCH] Deep Research for: {query}")
    
    # 1. Google Search
    results = google_search(query, num_results=3) # Keep 3 results, parallel scrape handles them fast
    
    # 2. Parallel Scrape
    final_results = []
    
    def process_result(res):
        print(f"[SCRAPE] Reading: {res['title']}")
        content = scrape_content(res['href'])
        if content:
            res['body'] = content
        return res

    with ThreadPoolExecutor(max_workers=3) as executor:
        final_results = list(executor.map(process_result, results))

    return jsonify({'results': final_results})

# --- Sarvam AI Proxy ---
SARVAM_API_KEY = "sk_enco2pel_WQcvzCqUKaR7ay5EjVs0OPBM" # <--- REPLACE THIS

@app.route('/api/chat/sarvam', methods=['POST'])
def proxy_sarvam():
    data = request.json
    
    # Use hardcoded key for now (Security: In production, use env vars)
    if not SARVAM_API_KEY or "YOUR_SARVAM" in SARVAM_API_KEY:
         print("[WARN] Sarvam API Key is missing!")
         # Proceeding might fail, but letting it try or error out cleanly is better
         # Actually, better to error out so user knows.
         return jsonify({'error': 'Server Error: Sarvam API Key not configured in server.py'}), 500

    sarvam_url = "https://api.sarvam.ai/v1/chat/completions"
    
    # Payload adaptation if needed (Sarvam is OpenAI compatible)
    payload = data
    
    # FORCE/MAP VALID MODEL
    # Frontend sends 'gemma3:4b' etc. Sarvam needs 'sarvam-m' or 'gemma-4b'
    # User requested Sarvam online model -> 'sarvam-m'
    payload["model"] = "sarvam-m" 
    
    # Optional: Logic to choose based on input if we wanted
    # if "sarvam" in data.get("model", ""): payload["model"] = "sarvam-m"

    try:
        resp = requests.post(
            sarvam_url,
            json=payload,
            headers={'Authorization': f'Bearer {SARVAM_API_KEY}', 'Content-Type': 'application/json'},
            stream=True,
            timeout=60
        )

        if resp.status_code != 200:
             return jsonify({'error': f"Sarvam API Error: {resp.text}"}), resp.status_code

        def generate():
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk

        return Response(generate(), content_type='text/event-stream')

    except Exception as e:
        print(f"[ERROR] Sarvam Proxy Failed: {e}")
        return jsonify({'error': str(e)}), 500

# --- OpenRouter AI Proxy (Vyaas Pro) ---
OPENROUTER_API_KEY = "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"
OPENROUTER_MODEL = "google/gemma-3-27b-it:free"

@app.route('/api/chat/openrouter', methods=['POST'])
def proxy_openrouter():
    data = request.json
    
    if not OPENROUTER_API_KEY:
        return jsonify({'error': 'OpenRouter API Key not configured'}), 500

    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
    
    # Use the payload from frontend, but force our model
    payload = data
    payload["model"] = OPENROUTER_MODEL
    
    try:
        resp = requests.post(
            openrouter_url,
            json=payload,
            headers={
                'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://vyaas.ai',
                'X-Title': 'Vyaas AI'
            },
            stream=True,
            timeout=60
        )

        if resp.status_code != 200:
            print(f"[ERROR] OpenRouter Error: {resp.text}")
            return jsonify({'error': f"OpenRouter API Error: {resp.text}"}), resp.status_code

        def generate():
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk

        return Response(generate(), content_type='text/event-stream')

    except Exception as e:
        print(f"[ERROR] OpenRouter Proxy Failed: {e}")
        return jsonify({'error': str(e)}), 500

# --- OpenRouter AI Proxy for VYAAS CODER (Qwen3-Coder) ---
CODER_MODEL = "qwen/qwen3-coder:free"

@app.route('/api/chat/openrouter-coder', methods=['POST'])
def proxy_openrouter_coder():
    data = request.json
    
    if not OPENROUTER_API_KEY:
        return jsonify({'error': 'OpenRouter API Key not configured'}), 500

    openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
    
    # Use the payload from frontend, but force our model
    payload = data
    payload["model"] = CODER_MODEL
    
    try:
        resp = requests.post(
            openrouter_url,
            json=payload,
            headers={
                'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://vyaas.ai',
                'X-Title': 'Vyaas AI'
            },
            stream=True,
            timeout=60
        )

        if resp.status_code != 200:
            print(f"[ERROR] OpenRouter Coder Error: {resp.text}")
            return jsonify({'error': f"OpenRouter API Error: {resp.text}"}), resp.status_code

        def generate():
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk

        return Response(generate(), content_type='text/event-stream')

    except Exception as e:
        print(f"[ERROR] OpenRouter Coder Proxy Failed: {e}")
        return jsonify({'error': str(e)}), 500

# --- Code Execution Endpoint ---
import subprocess
import tempfile

@app.route('/api/run', methods=['POST'])
def run_code():
    data = request.json
    code = data.get('code')
    language = data.get('language')

    if not code:
        return jsonify({'error': 'No code provided'}), 400

    if language == 'python':
        try:
            # Create a temporary file to run the code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
                f.write(code)
                temp_path = f.name
            
            # Run safely-ish using separate process
            # Timeout set to 30 seconds to prevent infinite loops
            result = subprocess.run(
                [sys.executable, temp_path], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            # Clean up (best effort)
            try:
                os.remove(temp_path)
            except:
                pass

            output = result.stdout + result.stderr
            return jsonify({'output': output if output else 'Code executed successfully (No Output).'})

        except subprocess.TimeoutExpired:
            return jsonify({'output': 'Error: Execution timed out (30s limit).'})
        except Exception as e:
            return jsonify({'output': f'Execution Error: {str(e)}'})

    return jsonify({'error': 'Unsupported language for server execution'}), 400

# --- TTS Endpoint (Sarvam AI - Best Hindi Voices) ---
import base64

@app.route('/api/tts', methods=['POST'])
def tts_endpoint():
    data = request.json
    text = data.get('text')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    print(f"[TTS] Sarvam Request: {text[:30]}... (Length: {len(text)})")

    # Sarvam TTS has stricter practical limits - keep text short for reliability
    MAX_TTS_CHARS = 500
    if len(text) > MAX_TTS_CHARS:
        # Find a good breaking point (sentence or word boundary)
        truncated = text[:MAX_TTS_CHARS]
        # Try to break at last sentence
        last_period = truncated.rfind('।')  # Hindi full stop
        if last_period == -1:
            last_period = truncated.rfind('.')
        if last_period > MAX_TTS_CHARS // 2:  # Only if we keep at least half
            truncated = truncated[:last_period + 1]
        text = truncated
        print(f"[TTS] Text truncated to {len(text)} chars for TTS limit")

    try:
        # Sarvam AI TTS API (Bulbul - Indian voices with emotion)
        url = "https://api.sarvam.ai/text-to-speech"
        headers = {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY
        }
        payload = {
            "inputs": [text],
            "target_language_code": "hi-IN",
            # Speaker removed - API uses default Anushka voice automatically
            "pitch": 0,
            "pace": 1.1,  # Slightly faster for natural feel
            "loudness": 1.5,
            "speech_sample_rate": 22050,
            "enable_preprocessing": True
            # Model removed - uses default bulbul:v2
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            if 'audios' in result and len(result['audios']) > 0:
                audio_base64 = result['audios'][0]
                audio_data = base64.b64decode(audio_base64)
                print("[TTS] Served via Sarvam AI (Bulbul)")
                return Response(audio_data, mimetype="audio/wav")
            else:
                print(f"[TTS] Sarvam returned no audio: {result}")
        else:
            print(f"[TTS] Sarvam Error ({response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"[TTS] Sarvam Failed: {e}")

    # If Sarvam failed, return error (no fallback - user requested removal)
    return jsonify({'error': 'TTS generation failed'}), 500

# --- Static File Serving ---
@app.route('/')
def serve_index():
    return send_from_directory(STATIC_FOLDER, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(STATIC_FOLDER, path)

if __name__ == '__main__':
    print(f"==================================================")
    print(f"      VYAAS AI SERVER (with Web Search)")
    print(f"==================================================")
    print(f"[INFO] Server starting on http://localhost:{PORT}")
    print(f"[INFO] Web Search API active at /api/search")
    print(f"==================================================")
    app.run(port=PORT, debug=True, use_reloader=False)
