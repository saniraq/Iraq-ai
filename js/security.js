const Security = {
    rateLimits: new Map(),
    
    checkRateLimit(userId) {
        const now = Date.now();
        const limits = this.rateLimits.get(userId) || [];
        const recentRequests = limits.filter(t => now - t < CONFIG.RATE_LIMIT_WINDOW);
        if (recentRequests.length >= CONFIG.MAX_REQUESTS_PER_MINUTE) return false;
        recentRequests.push(now);
        this.rateLimits.set(userId, recentRequests);
        return true;
    },
    
    getDailyCount() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.REQUEST_DATE);
        if (stored !== today) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.REQUEST_COUNT, '0');
            localStorage.setItem(CONFIG.STORAGE_KEYS.REQUEST_DATE, today);
            return 0;
        }
        return parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.REQUEST_COUNT) || '0');
    },
    
    incrementDailyCount() {
        const count = this.getDailyCount() + 1;
        localStorage.setItem(CONFIG.STORAGE_KEYS.REQUEST_COUNT, count.toString());
        return count;
    },
    
    checkDailyLimit() {
        return this.getDailyCount() < CONFIG.MAX_REQUESTS_PER_DAY;
    },
    
    sanitizeInput(text) {
        text = text.replace(/<[^>]*>/g, '');
        text = text.replace(/javascript:/gi, '');
        text = text.replace(/on\w+=/gi, '');
        text = text.trim().substring(0, CONFIG.MAX_MESSAGE_LENGTH);
        return text;
    },
    
    containsBlockedKeywords(text) {
        const lower = text.toLowerCase();
        return CONFIG.BLOCKED_KEYWORDS.some(keyword => lower.includes(keyword));
    },
    
    generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    },
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    getCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');
        if (!token) {
            token = this.generateNonce();
            sessionStorage.setItem('csrf_token', token);
        }
        return token;
    },
    
    validateRequest(text) {
        if (!text || typeof text !== 'string') return { valid: false, error: 'Invalid input' };
        if (text.length === 0) return { valid: false, error: 'Empty message' };
        if (text.length > CONFIG.MAX_MESSAGE_LENGTH) return { valid: false, error: 'Message too long' };
        if (this.containsBlockedKeywords(text)) return { valid: false, error: 'Request blocked for security reasons' };
        if (!this.checkDailyLimit()) return { valid: false, error: 'Daily request limit reached. Try again tomorrow.' };
        if (!this.checkRateLimit('user')) return { valid: false, error: 'Too many requests. Please wait.' };
        return { valid: true };
    },
};
