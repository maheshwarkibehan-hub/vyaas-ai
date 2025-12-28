const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const historyList = document.getElementById('historyList');
const newChatBtn = document.getElementById('newChatBtn');
const modelSelect = document.getElementById('modelSelect');

// Image upload elements
const imageInput = document.getElementById('imageInput');
// const uploadBtn = document.getElementById('uploadBtn'); // REPLACED
const plusBtn = document.getElementById('plusBtn');
const uploadMenu = document.getElementById('uploadMenu');
const codeInput = document.getElementById('codeInput');
const menuUploadImage = document.getElementById('menuUploadImage');
const menuUploadCode = document.getElementById('menuUploadCode');
const menuTakePicture = document.getElementById('menuTakePicture');

// Camera Elements
const cameraModal = document.getElementById('cameraModal');
const cameraFeed = document.getElementById('cameraFeed');
const cameraCanvas = document.getElementById('cameraCanvas');
const captureBtn = document.getElementById('captureBtn');
const closeCamera = document.getElementById('closeCamera');

const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

// Gen AI
const genBtn = document.getElementById('genBtn');
let isGenMode = false;

// Lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightbox = document.getElementById('closeLightbox');
const downloadLink = document.getElementById('downloadLink');

// Auth UI Elements
const loginModal = document.getElementById('loginModal');
const closeLogin = document.getElementById('closeLogin');
const loginForm = document.getElementById('loginForm');
const googleBtn = document.getElementById('googleBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const toggleAuthText = document.getElementById('toggleAuthText');
const authError = document.getElementById('authError');
const userProfile = document.querySelector('.user-profile');
const wordCountBadge = document.getElementById('wordCountBadge');
const wordCountVal = document.getElementById('wordCountVal');

let isSignup = false;

// Default model if fetch fails
let selectedModel = 'vyaas:latest';

// ============================================================
// DEPLOYMENT CONFIGURATION
// ============================================================
// For LOCAL development: Set to '' (empty string)
// For PRODUCTION: Railway backend URL
// ============================================================
const API_BASE = 'https://web-production-a6de0.up.railway.app';

const CHAT_API_URL = 'http://localhost:11434/api/chat';
const TAGS_API_URL = 'http://localhost:11434/api/tags';

// API KEYS ARE NOW SECURELY STORED ON BACKEND
// All AI requests go through /api/chat/openrouter and /api/chat/openrouter-coder proxies
// No API keys are exposed in frontend code

// Gemini model name (used for routing, not direct API calls)
const GEMINI_MODEL = 'gemini-2.5-flash';

// Sarvam URL (for reference only, calls go through backend proxy)
const SARVAM_URL = 'https://api.sarvam.ai/v1/chat/completions';

// Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
    apiKey: "AIzaSyCRZmFsDxj6FhqKX5nbn3Qz4RU3xTKf094",
    authDomain: "vyaas-ai.firebaseapp.com",
    projectId: "vyaas-ai",
    storageBucket: "vyaas-ai.firebasestorage.app",
    messagingSenderId: "488812446364",
    appId: "1:488812446364:web:a775fac3d7ff845ab16359",
    measurementId: "G-19WKP5VK3H"
};

// Initialize Firebase
let auth;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
} catch (e) {
    console.warn("Firebase not initialized. Add your config in script.js to enable login.");
}


// State
// State
let currentChatId = null;
let chatHistory = JSON.parse(localStorage.getItem('vyaas_history')) || [];
let currentImageBase64 = null;
let currentUser = null;
let guestWordCount = parseInt(localStorage.getItem('vyaas_guest_word_count') || '0');
const GUEST_WORD_LIMIT = 500;

// Markdown setup
// Markdown renderer override
const renderer = new marked.Renderer();
renderer.code = function (code, language) {
    const validLang = !!(language && hljs.getLanguage(language));
    const highlighted = validLang ? hljs.highlight(code, { language }).value : hljs.highlightAuto(code).value;
    const langLabel = language || 'plaintext';
    const id = 'code-' + Math.random().toString(36).substr(2, 9);

    // Check if runnable
    const isClientRun = ['html', 'javascript', 'js'].includes(langLabel.toLowerCase());
    const isServerRun = ['python', 'py'].includes(langLabel.toLowerCase());
    const canRun = isClientRun || isServerRun;

    // Encode code for attribute safely
    const codeBase64 = btoa(unescape(encodeURIComponent(code))); // Simple base64 encoding

    return `
    <div class="code-wrapper">
        <div class="code-header">
            <span class="code-lang">${langLabel}</span>
            <div class="code-actions">
                <button class="code-btn" onclick="copyCode(this)" data-code="${codeBase64}">
                    <i class="ri-file-copy-line"></i> Copy
                </button>
                ${canRun ? `
                <button class="code-btn run-btn" onclick="runCode(this, '${langLabel}')" data-code="${codeBase64}">
                    <i class="ri-play-fill"></i> Run
                </button>` : ''}
            </div>
        </div>
        <pre><code id="${id}" class="language-${langLabel}">${highlighted}</code></pre>
        <div class="code-output hidden" id="out-${id}"></div>
    </div>`;
};

marked.setOptions({ renderer: renderer });

// --- PERFORMANCE OPTIMIZATION: Throttled Rendering ---
let lastRenderTime = 0;
let pendingRender = null;
const RENDER_THROTTLE_MS = 100; // Update UI max every 100ms

function throttledRender(element, content) {
    const now = Date.now();

    if (now - lastRenderTime >= RENDER_THROTTLE_MS) {
        // Enough time passed, render immediately
        lastRenderTime = now;
        try {
            element.innerHTML = marked.parse(content);
            // Only highlight NEW code blocks (not already highlighted)
            element.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                hljs.highlightElement(block);
            });
        } catch (e) {
            element.textContent = content;
        }
    } else {
        // Throttle: schedule render for later
        if (pendingRender) clearTimeout(pendingRender);
        pendingRender = setTimeout(() => {
            lastRenderTime = Date.now();
            try {
                element.innerHTML = marked.parse(content);
                element.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                    hljs.highlightElement(block);
                });
            } catch (e) {
                element.textContent = content;
            }
        }, RENDER_THROTTLE_MS);
    }
}

// --- SMART SCROLL: Only scroll if user is near bottom ---
function smartScroll() {
    const scrollThreshold = 150; // pixels from bottom
    const container = messagesContainer;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;

    if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
}

// Legacy scroll function (replaced by smartScroll)
function scrollToBottom() {
    smartScroll();
}

// --- EXECUTION HELPERS ---
window.copyCode = function (btn) {
    const base64 = btn.getAttribute('data-code');
    const code = decodeURIComponent(escape(atob(base64)));
    navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="ri-check-line"></i> Copied!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    });
};

window.runCode = async function (btn, lang) {
    const base64 = btn.getAttribute('data-code');
    const code = decodeURIComponent(escape(atob(base64)));
    const wrapper = btn.closest('.code-wrapper');
    // Find output div relative to wrapper
    const outputDiv = wrapper.querySelector('.code-output');

    // CLIENT SIDE (HTML/JS)
    if (['html', 'javascript', 'js'].includes(lang.toLowerCase())) {
        const win = window.open('', '_blank');
        win.document.write(code);
        win.document.close();
        return;
    }

    // SERVER SIDE (PYTHON)
    if (['python', 'py'].includes(lang.toLowerCase())) {
        outputDiv.innerHTML = '<div class="output-label">Output</div>Running...';
        outputDiv.classList.remove('hidden');

        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code, language: 'python' })
            });

            const data = await response.json();
            const result = data.output || data.error || 'No output.';

            outputDiv.innerHTML = `<div class="output-label">Output</div><div style="white-space: pre-wrap;">${result}</div>`;
        } catch (err) {
            outputDiv.innerHTML = `<div class="output-label">Error</div>Connection Failed: ${err.message}`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchModels();
    renderHistoryList();
    startNewChat();
    updateWordCountDisplay();
});

modelSelect.addEventListener('change', (e) => {
    // PRO PLAN GATE: Check for Pro Model
    if (e.target.value === 'gemini' && !currentUser) {
        alert("🔒 Vyaas 2.0 Pro is a Premium Feature.\n\nPlease login to access our smartest AI model.");
        e.target.value = selectedModel; // Revert selection
        loginModal.classList.remove('hidden');
        return;
    }

    selectedModel = e.target.value;
    console.log('Model switched to:', selectedModel);

    // UPDATE RAW MODEL DISPLAY
    const infoDisplay = document.getElementById('modelInfoDisplay');
    // if (infoDisplay) infoDisplay.textContent = `[ID: ${selectedModel}]`; // REMOVED BY USER REQUEST

    // ADD SYSTEM NOTIFICATION TO CHAT
    const modelName = e.target.options[e.target.selectedIndex].text;
    renderMessageToUI(`Switched to model: <strong>${modelName}</strong>`, 'system');


});

// Gen Mode Toggle
genBtn.addEventListener('click', () => {
    // PRO PLAN GATE: Image Generation
    if (!isGenMode && !currentUser) {
        // trying to turn ON gen mode
        alert("🔒 Image Generation is a Pro Feature.\n\nPlease login to act like a creator!");
        loginModal.classList.remove('hidden');
        return;
    }

    isGenMode = !isGenMode;
    if (isGenMode) {
        genBtn.style.color = '#fff';
        genBtn.style.background = '#ec4899';
        userInput.placeholder = "Describe an image to generate...";
    } else {
        genBtn.style.color = '#ec4899';
        genBtn.style.background = 'transparent';
        userInput.placeholder = `Message ${selectedModel.split(':')[0]}...`;
    }
    userInput.focus();
});

// Lightbox Logic
messagesContainer.addEventListener('click', async (e) => {
    if (e.target.tagName === 'IMG' && e.target.classList.contains('chat-image')) {
        lightbox.classList.remove('hidden');
        lightboxImg.src = e.target.src;

        // Improve download: Fetch blob to force correct resolution/saving
        downloadLink.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Preparing...';

        try {
            const response = await fetch(e.target.src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = `vyaas-gen-${Date.now()}.png`;
            downloadLink.innerHTML = '<i class="ri-download-line"></i> Download HD';
        } catch (err) {
            console.error("Download prep failed", err);
            // Fallback
            downloadLink.href = e.target.src;
            downloadLink.innerHTML = '<i class="ri-download-line"></i> Download';
        }
    }
});

closeLightbox.addEventListener('click', () => {
    lightbox.classList.add('hidden');
});

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        lightbox.classList.add('hidden');
    }
});


async function fetchModels() {
    // All models are now cloud-based (OpenRouter) - no local Ollama needed
    modelSelect.innerHTML = '';

    // VYAAS 2.0 PRO (OpenRouter - Gemma 27B)
    const geminiOption = document.createElement('option');
    geminiOption.value = 'gemini';
    geminiOption.text = '✨ Vyaas 2.0 Pro';
    modelSelect.appendChild(geminiOption);

    // VYAAS RAPID (OpenRouter - Fast responses)
    const rapidOption = document.createElement('option');
    rapidOption.value = 'sarvam-m';
    rapidOption.text = '🚀 Vyaas Rapid';
    modelSelect.appendChild(rapidOption);

    // VYAAS CODER (OpenRouter - Qwen3-Coder)
    const coderOption = document.createElement('option');
    coderOption.value = 'vyaas-coder';
    coderOption.text = '💻 Vyaas Coder';
    modelSelect.appendChild(coderOption);

    // Default: Select Pro
    geminiOption.selected = true;
    selectedModel = 'gemini';
}


newChatBtn.addEventListener('click', () => {
    startNewChat();
});

function adjustTextareaHeight() {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
}

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Abort Controller for stopping generation
let abortController = null;
let isGenerating = false;

// Unified Click Handler
sendBtn.addEventListener('click', () => {
    if (isGenerating) {
        stopGeneration();
    } else {
        sendMessage();
    }
});

function stopGeneration() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    setGeneratingState(false);
}

function setGeneratingState(generating) {
    isGenerating = generating;
    if (generating) {
        userInput.disabled = true;
        userInput.style.opacity = '0.7';
        // Change icon to Stop
        sendBtn.innerHTML = '<i class="ri-stop-circle-fill"></i>';
        sendBtn.style.color = '#ef4444'; // Red
    } else {
        userInput.disabled = false;
        userInput.style.opacity = '1';
        userInput.focus();
        // Change icon to Send
        sendBtn.innerHTML = '<i class="ri-arrow-up-line"></i>';
        sendBtn.style.color = ''; // Reset to default/CSS
    }
}

// Image Handling
// uploadBtn.addEventListener('click', () => { ... }); // REMOVED

// --- PLUS MENU LOGIC ---
plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!uploadMenu.classList.contains('hidden') && !e.target.closest('.plus-menu-container')) {
        uploadMenu.classList.add('hidden');
    }
});

// Menu Actions
menuUploadImage.addEventListener('click', () => {
    // PRO PLAN GATE: File/Image Upload
    if (!currentUser) {
        alert("🔒 File Analysis is a Pro Feature.\n\nSign in to let AI see what you see.");
        loginModal.classList.remove('hidden');
        return;
    }
    imageInput.click();
    uploadMenu.classList.add('hidden');
});

menuUploadCode.addEventListener('click', () => {
    if (!currentUser) {
        alert("🔒 Code Analysis is a Pro Feature.");
        loginModal.classList.remove('hidden');
        return;
    }
    codeInput.click();
    uploadMenu.classList.add('hidden');
});

menuTakePicture.addEventListener('click', () => {
    if (!currentUser) {
        alert("🔒 Camera Vision is a Pro Feature.");
        loginModal.classList.remove('hidden');
        return;
    }
    openCamera();
    uploadMenu.classList.add('hidden');
});

// Code Input Handler
codeInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const ext = file.name.split('.').pop();
            const box = `\n\`\`\`${ext}\n${content}\n\`\`\`\n`;

            userInput.value += box;
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
            userInput.focus();
        };
        reader.readAsText(file);
    }
    // Reset so same file triggers change again if needed
    codeInput.value = '';
});


// --- CAMERA LOGIC ---
let localStream = null;

async function openCamera() {
    cameraModal.classList.remove('hidden');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraFeed.srcObject = localStream;
    } catch (err) {
        console.error("Camera access denied", err);
        alert("Could not access camera. Please allow permissions.");
        cameraModal.classList.add('hidden');
    }
}

function stopCamera() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    cameraModal.classList.add('hidden');
}

closeCamera.addEventListener('click', stopCamera);

captureBtn.addEventListener('click', () => {
    if (!localStream) return;

    const ctx = cameraCanvas.getContext('2d');
    cameraCanvas.width = cameraFeed.videoWidth;
    cameraCanvas.height = cameraFeed.videoHeight;

    // Draw video to canvas
    // Note: If video is mirrored in CSS, canvas drawing is RAW.
    // If we want mirrored image, we must flip context.
    ctx.translate(cameraCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraFeed, 0, 0);

    const base64 = cameraCanvas.toDataURL('image/jpeg');

    // Set as current image
    currentImageBase64 = base64.split(',')[1];
    imagePreview.src = base64;
    imagePreviewContainer.classList.remove('hidden');

    stopCamera();
});


imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            currentImageBase64 = base64.split(',')[1];
            imagePreview.src = base64;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', () => {
    clearImage();
});

function clearImage() {
    currentImageBase64 = null;
    imageInput.value = '';
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
}


function startNewChat() {
    currentChatId = Date.now().toString();
    clearImage();

    messagesContainer.innerHTML = `
        <div class="message system-message">
            <div class="message-content">
                <h2>Welcome to Vyaas AI</h2>
                <p>I'm running locally. How can I help you?</p>
            </div>
        </div>
    `;

    const newChat = {
        id: currentChatId,
        title: 'New Chat',
        messages: []
    };

    chatHistory.unshift(newChat);
    saveHistory();
    renderHistoryList();
    userInput.focus();
}

function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    clearImage();

    messagesContainer.innerHTML = '';
    if (chat.messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="message system-message">
                <div class="message-content">
                    <h2>Welcome to Vyaas AI</h2>
                    <p>Message history loaded.</p>
                </div>
            </div>`;
    } else {
        chat.messages.forEach(msg => {
            renderMessageToUI(msg.content, msg.role === 'user' ? 'user' : 'ai', false, null, msg.images);
        });
    }

    renderHistoryList();
    scrollToBottom();
}

function saveHistory() {
    localStorage.setItem('vyaas_history', JSON.stringify(chatHistory));
}

function updateChatTitle(chatId, firstMessage) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat && chat.title === 'New Chat') {
        const titleText = firstMessage || "Image Upload";
        chat.title = titleText.substring(0, 30) + (titleText.length > 30 ? '...' : '');
        saveHistory();
        renderHistoryList();
    }
}

function renderHistoryList() {
    historyList.innerHTML = '';
    chatHistory.forEach(chat => {
        const btn = document.createElement('button');
        btn.className = `nav-item ${chat.id === currentChatId ? 'active' : ''}`;
        btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; overflow: hidden;">
                <i class="ri-message-3-line"></i>
                <span>${chat.title}</span>
            </div>
        `;
        btn.onclick = () => loadChat(chat.id);

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
        delBtn.className = 'delete-chat-btn';
        delBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent loading the chat
            deleteChat(chat.id);
        };

        btn.appendChild(delBtn);
        historyList.appendChild(btn);
    });
}

function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    chatHistory = chatHistory.filter(c => c.id !== chatId);
    saveHistory();

    // If we deleted the current chat, start a new one or load the first available
    if (chatId === currentChatId) {
        if (chatHistory.length > 0) {
            loadChat(chatHistory[0].id);
        } else {
            startNewChat();
        }
    } else {
        renderHistoryList();
    }
}

function renderMessageToUI(text, sender, isStreaming = false, id = null, images = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender === 'user' ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.minWidth = '32px';

    if (sender === 'user') {
        avatar.textContent = 'U';
        avatar.style.background = 'var(--bg-card)';
        avatar.style.border = '1px solid var(--border)';
    } else {
        // Change icon based on model?
        avatar.innerHTML = '<i class="ri-sparkling-fill"></i>'; // ALWAYS USE SPARKLE (Removed Google G)
        avatar.style.background = 'transparent';
        avatar.style.color = 'var(--primary)'; // ALWAYS USE PRIMARY COLOR
        avatar.style.fontSize = '1.2rem';
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content prose';
    if (id) contentDiv.id = id;

    let htmlContent = '';

    // Add images if present
    if (images && images.length > 0) {
        images.forEach(imgBase64 => {
            // Check if it's a URL (Pollinations) or base64
            // Added class 'chat-image' for lightbox listener
            if (imgBase64.startsWith('http')) {
                htmlContent += `<img src="${imgBase64}" alt="Generated image" class="chat-image generated-image"><br>`;
            } else {
                htmlContent += `<img src="data:image/jpeg;base64,${imgBase64}" alt="Uploaded image" class="chat-image"><br>`;
            }
        });
    }

    if (!isStreaming) {
        htmlContent += sender === 'user' ? `<p>${text}</p>` : marked.parse(String(text || ""));
    } else {
        htmlContent += text;
    }

    contentDiv.innerHTML = htmlContent;

    if (sender === 'user') {
        msgDiv.appendChild(contentDiv);
    } else {
        msgDiv.appendChild(avatar);
        msgDiv.appendChild(contentDiv);
    }

    messagesContainer.appendChild(msgDiv);
    return contentDiv;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentImageBase64) return;

    // Word Limit Check for Guests
    if (!currentUser) {
        const words = text.split(/\s+/).length;
        if (guestWordCount + words > GUEST_WORD_LIMIT) {
            alert(`Limit Reached! You have used ${guestWordCount} words. Login to send unlimited messages.`);
            loginModal.classList.remove('hidden');
            return;
        }
        guestWordCount += words;
        localStorage.setItem('vyaas_guest_word_count', guestWordCount);
        updateWordCountDisplay();
    }

    // Prevent double invocation
    if (isGenerating) return;

    // 1. Capture State
    const messageText = text;
    let messageImages = currentImageBase64 ? [currentImageBase64] : null;

    // 2. Clear UI
    userInput.value = '';
    userInput.style.height = 'auto';
    clearImage();

    // Set Loading State
    setGeneratingState(true);
    abortController = new AbortController();
    const signal = abortController.signal;

    // ---- GENERATION / EDIT MODE CHECK ----
    if (isGenMode || messageText.toLowerCase().startsWith('/img ')) {

        let imageUrl = '';
        const prompt = messageText.replace(/^\/img\s*/i, '');
        const encodedPrompt = encodeURIComponent(prompt);

        // CHECK: EDIT MODE (Gen + Image)
        if (isGenMode && messageImages) {
            renderMessageToUI(`Editing image: ${prompt}`, 'user', false, null, messageImages);

            try {
                const publicUrl = await uploadImage(messageImages[0]);
                console.log("Uploaded Image URL:", publicUrl); // Debug
                // renderMessageToUI(`Debug: Uploaded to ${publicUrl}`, 'system'); 

                // Kontext Model for editing
                imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?image=${encodeURIComponent(publicUrl)}&model=kontext&nologo=true`;
            } catch (err) {
                renderMessageToUI(`Error: Could not upload image for editing. ${err.message}`, 'ai');
                setGeneratingState(false);
                return;
            }

        } else {
            // NORMAL GEN MODE
            renderMessageToUI(`Generating image: ${prompt}`, 'user');
            imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1920&height=1080&model=flux&nologo=true`;
        }

        // Toggle off mode if it was on
        if (isGenMode) {
            isGenMode = false;
            genBtn.style.color = '#ec4899';
            genBtn.style.background = 'transparent';
            updatePlaceholder();
        }

        const chat = chatHistory.find(c => c.id === currentChatId);
        if (chat) {
            const content = messageImages ? `Edit image attached: ${prompt}` : `Generate image: ${prompt}`;
            chat.messages.push({ role: 'user', content: content, images: messageImages });
        }

        setTimeout(() => {
            // Check if aborted during wait
            if (signal.aborted) {
                setGeneratingState(false);
                return;
            }

            const aiMessageId = 'msg-' + Date.now();
            renderMessageToUI(`Here is your ${messageImages ? 'edited' : 'generated'} image for: **${prompt}**`, 'ai', false, aiMessageId, [imageUrl]);
            scrollToBottom();

            if (chat) {
                chat.messages.push({
                    role: 'ai',
                    content: `Here is your ${messageImages ? 'edited' : 'generated'} image for: **${prompt}**`,
                    images: [imageUrl]
                });
                saveHistory();
            }
            setGeneratingState(false);
        }, 3000); // Wait for generation

        return;
    }
    // -------------------------------

    // 3. Update History (Normal Chat)
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({
            role: 'user',
            content: messageText,
            images: messageImages
        });
        updateChatTitle(currentChatId, messageText);
        saveHistory();
    }

    // 4. Render User Message
    renderMessageToUI(messageText, 'user', false, null, messageImages);
    scrollToBottom();

    // 5. Prepare AI Answer Container
    const aiMessageId = 'msg-' + Date.now();
    const aiContentDiv = renderMessageToUI('', 'ai', true, aiMessageId);

    // Create Answer Container (Always present)
    const answerDiv = document.createElement('div');
    answerDiv.className = 'ai-answer';

    // Thinking UI (Created but NOT attached yet)
    const thinkingUI = createThinkingUI();

    // AUTONOMOUS DECISION ENGINE
    let contextMessage = messageText;
    let finalPrompt = messageText;

    try {
        // 1. SHOW THINKING UI IMMEDIATELY
        aiContentDiv.appendChild(thinkingUI);
        aiContentDiv.appendChild(answerDiv);
        updateThinkingStep(thinkingUI, 'Analyzing request...', 'working');

        const decision = await decideIntent(messageText, selectedModel);

        if (decision.action === 'SEARCH') {
            // Update UI for search
            updateThinkingStep(thinkingUI, 'Analyzing request...', 'done');
            updateThinkingStep(thinkingUI, `Searching Google: "${decision.query}"...`, 'working');

            const searchResults = await performWebSearch(decision.query);

            if (searchResults) {
                updateThinkingStep(thinkingUI, 'Reading website content...', 'working');

                const searchContext = `
[DEEP WEB RESEARCH]
${searchResults}

[USER QUERY]
${messageText}

[INSTRUCTION]
Use the above web search results to answer the user's query accurately. 
Cite the sources if possible.
`;
                contextMessage = searchContext; // For Ollama
                finalPrompt = searchContext;    // For Gemini

                updateThinkingStep(thinkingUI, 'Processing findings...', 'done');
            } else {
                updateThinkingStep(thinkingUI, 'Search returned no results.', 'done');
            }

            // Auto-collapse after a moment
            setTimeout(() => thinkingUI.classList.remove('expanded'), 2000);
        } else {
            // DIRECT CHAT (No Search)
            // Just proceed
            updateThinkingStep(thinkingUI, 'Processing...', 'done');
            setTimeout(() => thinkingUI.classList.remove('expanded'), 500);
        }

    } catch (err) {
        console.warn("Decision Engine failed, defaulting to chat.", err);
    }

    // --- SPECIAL ROUTING ---
    // 1. VYAAS 2.0 PRO (Uses OpenRouter with Gemma 27B)
    if (selectedModel === 'gemini') {
        await callSarvamAndStream(finalPrompt, messageImages, answerDiv, signal, 'gemini');
        return;
    }
    //

    // 2. SARVAM-M/RAPID MODEL (Now uses OpenRouter)
    if (selectedModel === 'sarvam-2b-v0.5' || selectedModel === 'sarvam-m' || selectedModel.includes('sarvam')) {
        await callSarvamAndStream(finalPrompt, messageImages, answerDiv, signal, 'rapid');
        return; // EXIT HERE
    }

    // 3. VYAAS CODER (OpenRouter with Qwen3-Coder)
    if (selectedModel === 'vyaas-coder') {
        await callCoderAndStream(finalPrompt, messageImages, answerDiv, signal);
        return;
    }

    // OLLAMA LOGIC
    let fullResponse = "";

    // Construct Messages for Ollama
    let apiMessages = chat ? chat.messages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
        images: m.images ? m.images.filter(img => !img.startsWith('http')) : null
    })) : [];

    // Add current message (with context if search was active)
    apiMessages.push({ role: 'user', content: contextMessage, images: messageImages });

    // SYSTEM PROMPT GENERATION
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    let systemPromptContent = getSystemPrompt(selectedModel);
    systemPromptContent += `\n[SYSTEM UPDATE]\nCurrent Date: ${today}\n`;

    const systemPrompt = {
        role: 'system',
        content: systemPromptContent
    };
    apiMessages.unshift(systemPrompt);

    try {
        // ROUTING LOGIC
        let endpoint = CHAT_API_URL; // Default: Local Ollama

        // Vyaas Rapid (Gemma) -> NOW ROUTES TO OPENROUTER
        if (selectedModel.includes('gemma') || selectedModel.includes('rapid')) {
            endpoint = '/api/chat/openrouter';
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: apiMessages,
                stream: true
            }),
            signal: signal // Pass Abort Signal
        });

        if (!response.ok) {
            let limitMsg = '';
            try {
                const errJson = await response.json();
                limitMsg = errJson.error || errJson.message || response.statusText;
            } catch (e) {
                limitMsg = response.statusText;
            }
            throw new Error(`Server Error: ${limitMsg}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        answerDiv.innerHTML = ''; // Clear only answer container

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message && json.message.content) {
                        const content = json.message.content;
                        fullResponse += content;
                        aiContentDiv.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                        // Use answerDiv for Ollama too?
                        // Actually, since Ollama logic reconstructs innerHTML in the loop, we need to adapt it.
                        // FIX: We need Ollama to target `answerDiv` not `aiContentDiv`, OR we re-append thinkingUI.
                        // Strategy: Let's target answerDiv. BUT `aiContentDiv` was passed. 
                        // Wait, previous code used `aiContentDiv.innerHTML = marked.parse...` which WIPES the thinking UI.
                        try {
                            answerDiv.innerHTML = marked.parse(String(fullResponse || ""));
                            answerDiv.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightElement(block);
                            });
                        } catch (e) {
                            console.error("Markdown Error:", e);
                            answerDiv.textContent = fullResponse; // Fallback to raw text
                        }
                        scrollToBottom();
                    }
                } catch (e) { console.error(e); }
            }
        }

        finalizeMessage(fullResponse);

    } catch (error) {
        if (error.name === 'AbortError') {
            aiContentDiv.innerHTML += ' <span style="color: #ef4444; font-size: 0.8rem;">(Stopped)</span>';
        } else {
            aiContentDiv.innerHTML = `<span style="color: #ef4444;">Error: ${error.message} - Model: ${selectedModel}</span>`;
        }
    } finally {
        setGeneratingState(false);
    }
}


async function callGeminiAndStream(prompt, images, aiContentDiv, signal) {
    aiContentDiv.innerHTML = '';
    let fullResponse = "";

    // Default URL for Gemini 2.5 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}`;

    try {
        // PREPEND SYSTEM PROMPT (Vyaas Identity)
        let systemPromptContent = getSystemPrompt('gemini');
        const finalPrompt = systemPromptContent + "\n\nUser Query: " + prompt;

        // Prepare Parts (Text + Image)
        const parts = [{ text: finalPrompt }];

        // Agar image hai to add karo
        if (images && images.length > 0) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: images[0] // Base64 string from script state
                }
            });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            }),
            signal: signal
        });

        if (!response.ok) {
            const errData = await response.json();
            const errorMsg = errData?.error?.message || errData?.message || JSON.stringify(errData) || 'Gemini API Error';
            throw new Error(errorMsg);
        }

        // Gemini Stream Parser
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Gemini returns a specific JSON structure, sometimes mostly complete arrays
            // Simple parsing strategy: extract "text" fields

            // Note: Robust JSON stream parsing is complex, this uses a regex approach for speed
            // Matches: "text": "..."
            const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = regex.exec(chunk)) !== null) {
                // Unescape JSON string
                let textSegment = match[1];
                try {
                    textSegment = JSON.parse(`"${textSegment}"`); // Safe unescape
                } catch (e) {
                    textSegment = textSegment.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }

                fullResponse += textSegment;

                // Update UI
                try {
                    aiContentDiv.innerHTML = marked.parse(fullResponse);
                    aiContentDiv.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                } catch (e) {
                    aiContentDiv.textContent = fullResponse;
                }
                scrollToBottom();
            }
        }

        finalizeMessage(fullResponse);

    } catch (error) {
        if (error.name === 'AbortError') {
            aiContentDiv.innerHTML += ' <span style="color: #ef4444; font-size: 0.8rem;">(Stopped)</span>';
        } else {
            console.error("[Vyaas Error Log]:", error);
            aiContentDiv.innerHTML = `<div style="color: #fbbf24; background: rgba(251,191,36,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <strong>⚠️ Vyaas AI is busy</strong><br>
                <span style="font-size: 0.9rem;">Please try again in a moment.</span>
            </div>`;
        }
    } finally {
        setGeneratingState(false);
    }
}

// --- OPENROUTER AI HANDLER FOR VYAAS PRO & RAPID ---
async function callSarvamAndStream(prompt, images, aiContentDiv, signal, modelType = 'gemini') {
    aiContentDiv.innerHTML = '';
    let fullResponse = "";

    try {
        // Get system prompt based on model type (Pro vs Rapid)
        let systemPromptContent = getSystemPrompt(modelType);

        // Build messages array
        const messages = [
            { role: 'system', content: systemPromptContent },
            { role: 'user', content: prompt }
        ];

        // Call OpenRouter via our backend proxy
        const response = await fetch(API_BASE + '/api/chat/openrouter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'google/gemma-3-27b-it:free',
                messages: messages,
                stream: true
            }),
            signal: signal
        });

        if (!response.ok) {
            const errData = await response.json();
            const errorMsg = errData?.error || errData?.message || 'OpenRouter API Error';
            throw new Error(errorMsg);
        }

        // Stream Parser (Sarvam uses SSE format)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim() || line.startsWith('data: [DONE]')) continue;

                // Remove 'data: ' prefix if present
                let jsonStr = line;
                if (line.startsWith('data: ')) {
                    jsonStr = line.slice(6);
                }

                try {
                    const json = JSON.parse(jsonStr);
                    // Sarvam uses OpenAI-style format
                    if (json.choices && json.choices[0]?.delta?.content) {
                        const content = json.choices[0].delta.content;
                        fullResponse += content;

                        // Update UI with throttled render
                        throttledRender(aiContentDiv, fullResponse);
                        smartScroll();
                    }
                } catch (e) { /* Skip invalid JSON */ }
            }
        }

        finalizeMessage(fullResponse);

    } catch (error) {
        if (error.name === 'AbortError') {
            aiContentDiv.innerHTML += ' <span style="color: #ef4444; font-size: 0.8rem;">(Stopped)</span>';
        } else {
            console.error("[Vyaas Error Log]:", error);
            aiContentDiv.innerHTML = `<div style="color: #fbbf24; background: rgba(251,191,36,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <strong>⚠️ Vyaas AI is busy</strong><br>
                <span style="font-size: 0.9rem;">Please try again in a moment.</span>
            </div>`;
        }
    } finally {
        setGeneratingState(false);
    }
}

// --- OPENROUTER AI HANDLER FOR VYAAS CODER (Qwen3-Coder) ---
async function callCoderAndStream(prompt, images, aiContentDiv, signal) {
    aiContentDiv.innerHTML = '';
    let fullResponse = "";

    try {
        // Get system prompt for Vyaas Coder
        let systemPromptContent = getSystemPrompt('coder');

        // Build messages array
        const messages = [
            { role: 'system', content: systemPromptContent },
            { role: 'user', content: prompt }
        ];

        // Call OpenRouter via our backend proxy with Qwen3-Coder model
        const response = await fetch(API_BASE + '/api/chat/openrouter-coder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen/qwen3-coder:free',
                messages: messages,
                stream: true
            }),
            signal: signal
        });

        if (!response.ok) {
            const errData = await response.json();
            const errorMsg = errData?.error || errData?.message || 'OpenRouter API Error';
            throw new Error(errorMsg);
        }

        // Stream Parser (OpenRouter uses SSE format)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim() || line.startsWith('data: [DONE]')) continue;

                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        const content = json.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            // Update UI with throttled render
                            throttledRender(aiContentDiv, fullResponse);
                            smartScroll();
                        }
                    } catch (e) { /* Skip invalid JSON */ }
                }
            }
        }

        finalizeMessage(fullResponse);

    } catch (error) {
        if (error.name === 'AbortError') {
            aiContentDiv.innerHTML += ' <span style="color: #ef4444; font-size: 0.8rem;">(Stopped)</span>';
        } else {
            console.error("[Vyaas Error Log]:", error);
            aiContentDiv.innerHTML = `<div style="color: #fbbf24; background: rgba(251,191,36,0.1); padding: 15px; border-radius: 8px; text-align: center;">
                <strong>⚠️ Vyaas AI is busy</strong><br>
                <span style="font-size: 0.9rem;">Please try again in a moment.</span>
            </div>`;
        }
    } finally {
        setGeneratingState(false);
    }
}

function finalizeMessage(responseContent) {
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({ role: 'ai', content: responseContent });
        saveHistory();
    }

    // --- VOICE MODE / READ ALOUD REPLY ---
    if (isVoiceActive || isReadAloudEnabled) {
        playTTS(responseContent);
        isVoiceActive = false; // Reset voice flag (one-turn)
    }
}

// --- READ ALOUD TOGGLE ---
const speakerBtn = document.getElementById('speakerBtn');
let isReadAloudEnabled = false;

if (speakerBtn) {
    speakerBtn.addEventListener('click', () => {
        isReadAloudEnabled = !isReadAloudEnabled;
        if (isReadAloudEnabled) {
            speakerBtn.innerHTML = '<i class="ri-volume-up-line"></i>';
            speakerBtn.classList.add('active-state');
            speakerBtn.style.color = 'var(--primary)';
        } else {
            speakerBtn.innerHTML = '<i class="ri-volume-mute-line"></i>';
            speakerBtn.classList.remove('active-state');
            speakerBtn.style.color = 'var(--text-color)';
        }
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


// --- Image Editing Helpers ---

function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
}

async function uploadImage(base64) {
    const blob = base64ToBlob(base64, 'image/png');

    // Strategy 1: Uguu.se (CORS friendly usually)
    try {
        const formData = new FormData();
        formData.append('files[]', blob, 'image.png');

        const response = await fetch('https://uguu.se/upload.php', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const json = await response.json();
            if (json.files && json.files.length > 0) {
                return json.files[0].url;
            }
        }
    } catch (e) { console.warn("Uguu failed", e); }

    // Strategy 2: Tmpfiles.org
    try {
        const formData = new FormData();
        formData.append('file', blob, 'image.png');

        const response = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const json = await response.json();
            if (json.status === 'success') {
                const url = json.data.url;
                return url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
            }
        }
    } catch (e) { console.warn("Tmpfiles failed", e); }

    throw new Error("Could not upload image. Browser blocked the request. Try running a local server.");
}

function updatePlaceholder() {
    if (isGenMode) {
        if (currentImageBase64) {
            userInput.placeholder = "Describe how to EDIT this image...";
        } else {
            userInput.placeholder = "Describe an image to generate...";
        }
    } else {
        userInput.placeholder = `Message ${selectedModel.split(':')[0]}...`;
    }
}

// --- Auth & Word Limit Logic ---

function updateWordCountDisplay() {
    wordCountVal.textContent = guestWordCount;
    if (currentUser) {
        wordCountBadge.classList.add('hidden');
    } else {
        wordCountBadge.classList.remove('hidden');
        if (guestWordCount >= GUEST_WORD_LIMIT) {
            wordCountBadge.style.borderColor = '#ef4444';
            wordCountBadge.style.color = '#ef4444';
        }
    }
}

// User Profile Click to Login/Logout
userProfile.addEventListener('click', () => {
    updateModalState();
    loginModal.classList.remove('hidden');
});

// --- NEW SIDEBAR LOGIC ---
const sidebarUpgradeBtn = document.getElementById('sidebarUpgradeBtn');
const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
const settingsBtn = document.getElementById('settingsBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');

if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', () => {
        if (confirm("⚠️ Are you sure you want to DELETE ALL chats?\n\nThis action cannot be undone.")) {
            chatHistory = [];
            saveHistory();
            startNewChat();
        }
    });
}

if (sidebarUpgradeBtn) {
    sidebarUpgradeBtn.addEventListener('click', () => {
        updateModalState();
        loginModal.classList.remove('hidden');
    });
}

if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out?')) {
            await auth.signOut();
        }
    });
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        // Show Profile/Login (which has Logout)
        updateModalState();
        loginModal.classList.remove('hidden');
    });
}

// New Elements
const userProfileSection = document.getElementById('userProfileSection');
const authSection = document.querySelector('.auth-section'); // The form wrapper
const logoutBtn = document.getElementById('logoutBtn');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileAvatarText = document.getElementById('profileAvatarText');

// Logout Handler
logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out?')) {
        await auth.signOut();
        loginModal.classList.add('hidden');
    }
});


function updateModalState() {
    if (currentUser) {
        // Show Profile View
        authSection.classList.add('hidden');
        userProfileSection.classList.remove('hidden');

        // Populate Data
        profileName.textContent = currentUser.displayName || 'Pro User';
        profileEmail.textContent = currentUser.email;
        profileAvatarText.textContent = (currentUser.displayName || currentUser.email)[0].toUpperCase();

        document.querySelector('.pricing-header h2').textContent = 'Your Subscription';
        document.querySelector('.pricing-header p').textContent = 'Manage your account settings';

    } else {
        // Show Login View
        authSection.classList.remove('hidden');
        userProfileSection.classList.add('hidden');

        // Reset Header
        if (isSignup) {
            document.querySelector('.pricing-header h2').textContent = 'Create Account';
            document.querySelector('.pricing-header p').textContent = 'Sign up for unlimited access';
        } else {
            document.querySelector('.pricing-header h2').textContent = 'Welcome Back';
            document.querySelector('.pricing-header p').textContent = 'Login to access your account';
        }
    }
}

closeLogin.addEventListener('click', () => {
    loginModal.classList.add('hidden');
    authError.style.display = 'none';
});



// Fix for toggle loop:
toggleAuthBtn.replaceWith(toggleAuthBtn.cloneNode(true));
document.getElementById('toggleAuthBtn').addEventListener('click', (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    const headerH2 = document.querySelector('.auth-header h2');
    const headerP = document.querySelector('.auth-header p');
    const submitBtn = document.querySelector('.auth-btn');
    const toggleText = document.getElementById('toggleAuthText');

    if (isSignup) {
        headerH2.textContent = 'Create Account';
        headerP.textContent = 'Sign up for unlimited access';
        submitBtn.textContent = 'Sign Up';
        toggleText.innerHTML = 'Already have an account? <button id="switchModeBtn" class="auth-link">Sign In</button>';
    } else {
        headerH2.textContent = 'Welcome Back';
        headerP.textContent = 'Login to access your account';
        submitBtn.textContent = 'Sign In';
        toggleText.innerHTML = 'Don\'t have an account? <button id="switchModeBtn" class="auth-link">Sign Up</button>';
    }

    document.getElementById('switchModeBtn').onclick = (e) => {
        e.preventDefault();
        // Trigger the main toggle again
        document.getElementById('toggleAuthBtn').click();
    };
});


// Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.style.display = 'none';

    try {
        if (!auth) throw new Error("Firebase Auth not initialized. Check config.");

        if (isSignup) {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
        loginModal.classList.add('hidden');
    } catch (error) {
        authError.textContent = error.message;
        authError.style.display = 'block';
    }
}); // End loginForm listener

async function performWebSearch(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search API Error');
        const data = await response.json();

        if (!data.results || data.results.length === 0) return null;

        return data.results.map(r => `- [${r.title}](${r.href}): ${r.body}`).join('\n');
    } catch (error) {
        console.error("Web Search Error:", error);
        return null; // Fail gracefully
    }
}

// Google Auth
googleBtn.addEventListener('click', async () => {
    try {
        if (!auth) throw new Error("Firebase Auth not initialized.");
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        loginModal.classList.add('hidden');
    } catch (error) {
        authError.textContent = error.message;
        authError.style.display = 'block';
    }
});

// Auth State Monitor
if (auth) {
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateWordCountDisplay();

        if (user) {
            // Logged In
            document.querySelector('.user-info .name').textContent = user.displayName || user.email.split('@')[0];
            document.querySelector('.user-info .status').textContent = 'Pro Plan (Unlimited)';
            document.querySelector('.avatar').textContent = (user.displayName || user.email)[0].toUpperCase();
            // Optional: User avatar image
            if (user.photoURL) {
                document.querySelector('.avatar').innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%;">`;
            }
        } else {
            // Logged Out
            document.querySelector('.user-info .name').textContent = 'Guest User';
            document.querySelector('.user-info .status').textContent = 'Free Plan (Limited)';
            document.querySelector('.avatar').innerHTML = 'U';
        }
    });
} else {
    updateWordCountDisplay(); // Initialize badge for no-firebase mode
}

// -------------------------------
// HELPER FUNCTIONS (THINKING UI & DECISION ENGINE)
// -------------------------------

// Helper: Create Thinking UI
function createThinkingUI() {
    const div = document.createElement('div');
    div.className = 'thought-process expanded'; // Start expanded
    div.innerHTML = `
        <div class="thought-header" onclick="this.parentElement.classList.toggle('expanded')">
            <span class="indicator">✨</span>
            <span class="status-text">Thinking...</span>
        </div>
        <div class="thought-content">
            <div class="thought-step working">Initializing...</div>
        </div>
    `;
    return div;
}

// Helper: Update Thinking UI
function updateThinkingStep(ui, text, status = 'working') {
    const content = ui.querySelector('.thought-content');
    const step = document.createElement('div');
    step.className = `thought-step ${status}`;
    step.textContent = '> ' + text;
    content.appendChild(step);

    // Update Header
    ui.querySelector('.status-text').textContent = text;
}

// Helper: Decide Intent
async function decideIntent(query, model) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Short-circuit for simple greetings
    if (query.length < 5 || ['hi', 'hello', 'hey'].includes(query.toLowerCase())) {
        return { action: 'DIRECT' };
    }

    // HARDCODED TRIGGERS (Force Search for specific keywords)
    // These keywords will ALWAYS trigger a web search
    const searchKeywords = [
        // Time-sensitive
        '2025', '2024', 'today', 'now', 'current', 'latest', 'recent',
        // Explicit search requests
        'search', 'google', 'find', 'lookup', 'check online', 'web', 'internet',
        // Real-time data
        'weather', 'temp', 'temperature', 'stock', 'price', 'news', 'live', 'score',
        // Sports/Events
        'ipl', 'match', 'winner', 'won', 'result',
        // Hindi search triggers
        'khojo', 'dhundho', 'batao', 'search karo'
    ];
    const lowerQuery = query.toLowerCase();
    if (searchKeywords.some(kw => lowerQuery.includes(kw))) {
        return { action: 'SEARCH', query: query };
    }

    const systemPrompt = `You are a Decision Engine. Current Date: ${today}.
Analyze the user query.
Does it require LIVE EXTERNAL DATA (news, weather, stock prices, sports scores)?
Or does it require knowledge of RECENT EVENTS (2024-present) which might be missing from your training data?

- If it's a coding question: DIRECT
- If it's general knowledge (history, science pre-2024): DIRECT
- If it's a greeting/chat: DIRECT
- SEARCH if the query mentions "2024", "2025", "current", "latest", "news", or "live".
- SEARCH if the answer changes dynamically or refers to recent events.

Reply ONLY in this format:
SEARCH: <concise_search_query>
or
DIRECT

Example:
"Bitcoin price?" -> SEARCH: Bitcoin price
"Who is Prime Minister of India?" -> SEARCH: India PM current
"How to write a loop in Python?" -> DIRECT
"Hi" -> DIRECT`;

    try {
        // ... (rest of function)
        // We use the same model as selected, or default to a fast one if possible.
        // Using fetch to CHAT_API_URL (Ollama) as it's local and fast.

        let responseText = "";

        if (model === 'gemini') {
            // For Gemini/Pro, we already checked keywords above, so return DIRECT for non-keyword queries
            return { action: 'DIRECT' };
        } else {
            // Ollama
            const resp = await fetch(CHAT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                    ],
                    stream: false
                })
            });
            const data = await resp.json();
            if (data.message && data.message.content) {
                responseText = data.message.content;
            }
        }

        if (responseText.includes('SEARCH:')) {
            let q = responseText.split('SEARCH:')[1].trim();
            // Sanitize: Remove quotes, logic placeholders
            q = q.replace(/["']/g, '');
            if (q.includes('<') || q.includes('concise_search_query')) {
                // Fallback if model parrots the prompt
                q = query;
            }
            return { action: 'SEARCH', query: q };
        }
        return { action: 'DIRECT' };

    } catch (e) {
        console.error("Intent Error", e);
        return { action: 'DIRECT' }; // Fail safe
    }
}
// --- VOICE MODE LOGIC ---
const micBtn = document.getElementById('micBtn');
let recognition;
let isVoiceActive = false; // Flag to track if the current interaction was voice-initiated

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; // Stop after one sentence for auto-send
    recognition.interimResults = false;
    recognition.lang = 'hi-IN'; // Default to Hindi as best attempt

    recognition.onstart = () => {
        micBtn.classList.add('recording-pulse');
        userInput.placeholder = "Listening...";
    };

    recognition.onend = () => {
        micBtn.classList.remove('recording-pulse');
        userInput.placeholder = `Message ${selectedModel.split(':')[0]}...`;
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        adjustTextareaHeight();

        // Auto-send logic
        isVoiceActive = true;
        sendMessage();
    };

    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('recording-pulse')) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
} else {
    micBtn.style.display = 'none';
    console.warn("Web Speech API not supported.");
}


async function playTTS(text) {
    if (!text) return;

    // Clean text for TTS (remove markdown)
    const cleanText = text.replace(/[*#`]/g, '').replace(/\n+/g, ' ');

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanText })
        });

        if (!response.ok) throw new Error("TTS Error");

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
        console.log("[TTS] Playing via Sarvam AI (Bulbul)");

    } catch (e) {
        console.error("TTS Playback Failed:", e);
        // No fallback - user requested to remove browser TTS
    }
}
