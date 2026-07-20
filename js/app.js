const App = {
    isProcessing: false,
    requestCount: Security.getDailyCount(),
    
    init() {
        this.bindEvents();
        this.updateStats();
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    },
    
    bindEvents() {
        const input = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        sendBtn.addEventListener('click', () => this.sendMessage());
    },
    
    async sendMessage() {
        if (this.isProcessing) return;
        const input = document.getElementById('userInput');
        const text = input.value.trim();
        const validation = Security.validateRequest(text);
        if (!validation.valid) { this.showError(validation.error); return; }
        const sanitized = Security.sanitizeInput(text);
        input.value = ''; input.style.height = 'auto';
        this.addMessage(sanitized, 'user');
        this.showTyping(true);
        this.isProcessing = true;
        document.getElementById('sendBtn').disabled = true;
        try {
            const response = await this.callAPI(sanitized);
            this.showTyping(false);
            this.addMessage(response, 'assistant');
            this.requestCount = Security.incrementDailyCount();
            this.updateStats();
        } catch (error) {
            this.showTyping(false);
            this.showError(error.message || 'An error occurred. Please try again.');
        }
        this.isProcessing = false;
        document.getElementById('sendBtn').disabled = false;
        this.scrollToBottom();
    },
    
    async callAPI(message) {
        const url = `${CONFIG.API_URL}?key=${CONFIG.API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: message }] }],
            systemInstruction: { parts: [{ text: CONFIG.SYSTEM_PROMPT }] },
            generationConfig: { temperature: 0.7, topP: 0.9, topK: 40, maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': Security.getCSRFToken() },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            if (response.status === 429) throw new Error('Rate limit exceeded. Please wait.');
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) throw new Error('No response generated');
        return data.candidates[0].content.parts[0].text;
    },
    
    addMessage(text, role) {
        const chatBox = document.getElementById('chatBox');
        const div = document.createElement('div');
        div.className = `message ${role}`;
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = role === 'user' ? '👤' : '🤖';
        const content = document.createElement('div');
        content.className = 'content';
        const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
        content.innerHTML = formatted;
        div.appendChild(avatar); div.appendChild(content);
        chatBox.appendChild(div);
        this.scrollToBottom();
    },
    
    showError(message) {
        const chatBox = document.getElementById('chatBox');
        const div = document.createElement('div');
        div.className = 'error-message';
        div.textContent = '⚠️ ' + message;
        chatBox.appendChild(div);
        this.scrollToBottom();
        setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.5s'; setTimeout(() => div.remove(), 500); }, 5000);
    },
    
    showTyping(show) { document.getElementById('typingIndicator').style.display = show ? 'block' : 'none'; this.scrollToBottom(); },
    
    scrollToBottom() { const chatBox = document.getElementById('chatBox'); setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100); },
    
    updateStats() {
        document.getElementById('reqCount').textContent = this.requestCount;
        const status = document.getElementById('status');
        status.textContent = navigator.onLine ? 'Online' : 'Offline';
        status.className = navigator.onLine ? 'online' : 'offline';
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.addEventListener('online', () => App.updateStats());
window.addEventListener('offline', () => App.updateStats());
