require('dotenv').config();
const express = require('express');
const axios = require('axios');
const https = require('https');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// CONFIGURATION
const config = {
    server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || 'localhost',
        env: process.env.NODE_ENV || 'development'
    },
    ssl: {
        acceptSelfSignedCerts: process.env.ACCEPT_SELF_SIGNED_CERTS === 'true',
        timeout: parseInt(process.env.SSL_TIMEOUT || '30000')
    },
    security: {
        allowedDomains: (process.env.ALLOWED_DOMAINS || '').split(',').map(d => d.trim()).filter(Boolean),
        validApiKeys: (process.env.VALID_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
    },
    rateLimiting: {
        maxRequests: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '60'),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        toFile: process.env.LOG_TO_FILE === 'true',
        filePath: process.env.LOG_FILE_PATH || './logs/gateway.log'
    }
};

// Validation: Check critical configuration
if (config.security.allowedDomains.length === 0) {
    console.error('ALLOWED_DOMAINS is required in .env file');
    console.error('Example: ALLOWED_DOMAINS=*.misa.local,api.partner.com');
    process.exit(1);
}

if (config.security.validApiKeys.length === 0) {
    console.error('VALID_API_KEYS is required in .env file');
    console.error('Example: VALID_API_KEYS=key1,key2,key3');
    process.exit(1);
}

// UTILITIES
// Validate URL against security rules
function validateUrl(url) {
    const errors = [];
    try {
        const parsedUrl = new URL(url);

        // 1. HTTPS only
        if (parsedUrl.protocol !== 'https:') {
            errors.push('Only HTTPS URLs are allowed');
        }

        // 2. Blacklist private IPs
        const hostname = parsedUrl.hostname;
        const privateIpPatterns = [
            /^127\./, // localhost
            /^10\./, // 10.x.x.x
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.x.x - 172.31.x.x
            /^192\.168\./, // 192.168.x.x
            /^localhost/, // localhost
            /^0\.0\.0\.0/ // 0.0.0.0
        ];

        if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
            errors.push(`Private IP/hostname not allowed: ${hostname}`);
        }

        // 3. Check whitelist
        const isWhitelisted = config.security.allowedDomains.some(allowed => {
            // Support Wildcard: *.misa.local
            if (allowed.startsWith('*.')) {
                const baseDomain = allowed.substring(2);
                return hostname.endsWith(baseDomain);
            }
            return hostname === allowed;
        });

        if (!isWhitelisted) {
            errors.push(`Domain not in whitelist: ${hostname}`);
        }
    } catch (err) {
        errors.push(`Invalid URL format: ${err.message}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Simple logging utility
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...data
    };

    // Console logging
    const logStr = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    if (level === 'error') {
        console.error(logStr, data);
    } else if (level === 'warn') {
        console.warn(logStr, data);
    } else {
        console.log(logStr, data);
    }

    // File logging
    if (config.logging.toFile) {
        try {
            const logDir = path.dirname(config.logging.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(config.logging.filePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
            console.error('Failed to write log to file:', err.message);
        }
    }
}

// MIDDLEWARE
// API Key Authentication Middleware
function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        log('warn', 'Missing API Key', { ip: req.ip, path: req.path });
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key is required',
            code: 'MISSING_API_KEY',
            hint: 'Add X-API-Key header to your request'
        });
    }

    if (!config.security.validApiKeys.includes(apiKey)) {
        console.log(config.security.validApiKeys);
        log('warn', 'Invalid API Key', { ip: req.ip, path: req.path, apiKey: apiKey.substring(0, 8) + '...' });
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key',
            code: 'INVALID_API_KEY'
        });
    }

    next();
}

// Validate request body
function validateRequest(req, res, next) {
    const { originApi, path, method, payload, headers, cookies } = req.body;
    const errors = [];

    // Required fields
    if (!originApi || typeof originApi !== 'string') {
        errors.push('originApi is required and must be a string');
    }
    if (!path || typeof path !== 'string') {
        errors.push('path is required and must be a string');
    } else if (!path.startsWith('/')) {
        errors.push('path must start with "/"');
    }
    if (!method || typeof method !== 'string') {
        errors.push('method is required and must be a string');
    } else {
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (!validMethods.includes(method.toUpperCase())) {
            errors.push(`method must be one of: ${validMethods.join(', ')}`);
        }
    }

    // Optional fields validation
    if (payload !== undefined && typeof payload !== 'object') {
        errors.push('payload must be an object');
    }
    if (headers !== undefined && typeof headers !== 'object') {
        errors.push('headers must be an object');
    }
    if (cookies !== undefined && typeof cookies !== 'string') {
        errors.push('cookies must be a string');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid request body',
            errors
        });
    }

    next();
}

// Create rate limiter
const createRateLimiter = () => {
    return rateLimit({
        windowMs: config.rateLimiting.windowMs,
        max: config.rateLimiting.maxRequests,
        keyGenerator: (req) => {
            // Key: IP + domain
            const originApi = req.body.originApi || 'unknown';
            try {
                const domain = new URL(originApi).hostname;
                return `${ipKeyGenerator(req)}-${domain}`;
            } catch {
                return ipKeyGenerator(req);
            }
        },
        handler: (req, res) => {
            const originApi = req.body.originApi || 'unknown';
            log('warn', 'Rate limit exceeded', { ip: req.ip, originApi });
            res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded for ${originApi}`,
                limit: config.rateLimiting.maxRequests,
                windowMs: config.rateLimiting.windowMs,
                retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
            });
        },
        standardHeaders: true,
        legacyHeaders: false
    });
};

// Forward request function
async function forwardRequest({ originApi, path, method, payload, headers = {}, cookies = '' }) {
    const startTime = Date.now();

    try {
        // Create HTTPS agent with SSL config
        const httpsAgent = new https.Agent({
            rejectUnauthorized: !config.ssl.acceptSelfSignedCerts,
            keepAlive: true,
            timeout: config.ssl.timeout
        });

        // Build full URL
        const fullUrl = `${originApi}${path}`;

        // Prepare request config
        const axiosConfig = {
            method: method.toUpperCase(),
            url: fullUrl,
            httpsAgent,
            timeout: config.ssl.timeout,
            headers: {
                'User-Agent': 'Dynamic-API-Gateway/2.0.0',
                ...headers
            },
            validateStatus: () => true // Accept all status codes
        };

        // Add cookies if provided
        if (cookies) {
            axiosConfig.headers['Cookie'] = cookies;
        }

        // Add payload for POST, PUT, PATCH
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && payload) {
            axiosConfig.data = payload;
            if (!axiosConfig.headers['Content-Type']) {
                axiosConfig.headers['Content-Type'] = 'application/json';
            }
        }

        // Execute request
        log('info', 'Forwarding request', { method, url: fullUrl });
        const response = await axios(axiosConfig);

        const duration = Date.now() - startTime;
        log('info', 'Request completed', {
            method,
            url: fullUrl,
            status: response.status,
            duration: `${duration}ms`
        });

        return {
            success: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            duration: `${duration}ms`
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        log('error', 'Request failed', {
            method,
            originApi,
            path,
            error: error.message,
            duration: `${duration}ms`
        });

        throw {
            success: false,
            error: error.code || 'REQUEST_FAILED',
            message: error.message,
            duration: `${duration}ms`
        };
    }
}

// App setup
const app = express();

// Security & Basic Middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for admin UI
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (Admin UI)
app.use(express.static(path.join(__dirname, 'public')));

// ROUTES
app.get('/', (req, res) => {
  res.status(200).send(`Proxy Server is running host: ${config.server.host} env: ${config.server.env}`);
});
// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: {
            environment: config.server.env,
            whitelistedDomains: config.security.allowedDomains.length,
            rateLimiting: {
                maxRequests: config.rateLimiting.maxRequests,
                windowMs: config.rateLimiting.windowMs
            },
            ssl: {
                acceptSelfSignedCerts: config.ssl.acceptSelfSignedCerts,
                timeout: config.ssl.timeout
            }
        }
    });
});

// Config Endpoint
app.get('/api/config', apiKeyAuth, (req, res) => {
    res.json({
        whitelistedDomains: config.security.allowedDomains,
        rateLimiting: {
            maxRequests: config.rateLimiting.maxRequests,
            windowMs: config.rateLimiting.windowMs,
            description: `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000} seconds`
        },
        ssl: {
            acceptSelfSignedCerts: config.ssl.acceptSelfSignedCerts,
            timeout: config.ssl.timeout
        },
        apiKeys: {
            count: config.security.validApiKeys.length,
            note: 'API keys are hidden for security'
        }
    });
});

// Forward Request Endpoint (main gateway endpoint)
app.post('/api/forward', apiKeyAuth, validateRequest, createRateLimiter(), async (req, res) => {
    const { originApi, path, method, payload, headers, cookies } = req.body;

    // Validate URL
    const urlValidation = validateUrl(originApi);
    if (!urlValidation.isValid) {
        log('warn', 'URL validation failed', { originApi, errors: urlValidation.errors });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Origin API not allowed',
            originApi,
            reasons: urlValidation.errors
        });
    }

    try {
        // Forward request
        const result = await forwardRequest({
            originApi,
            path,
            method,
            payload,
            headers,
            cookies
        });

        // Return response
        res.status(result.status || 200).json({
            success: result.success,
            data: result.data,
            meta: {
                originApi,
                path,
                method,
                status: result.status,
                statusText: result.statusText,
                duration: result.duration
            }
        });
    } catch (error) {
        log('error', 'Failed to forward request', { originApi, path, error });
        res.status(502).json({
            error: 'Bad Gateway',
            message: 'Failed to forward request to origin API',
            details: {
                error: error.error || 'UNKNOWN',
                message: error.message,
                duration: error.duration
            }
        });
    }
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Endpoint not found',
        path: req.path,
        hint: 'Use POST /api/forward for API forwarding'
    });
});

// START SERVER
app.listen(config.server.port, config.server.host, () => {
    console.log('\n🚀 Dynamic API Gateway Started!');
    console.log(`🌐 Server: http://${config.server.host}:${config.server.port}`);
    console.log(`🔧 Admin UI: http://${config.server.host}:${config.server.port}`);
    console.log(`🌍 Environment: ${config.server.env}`);
    console.log(`${config.security.allowedDomains.length} domains allowed`);
    console.log(`${config.security.validApiKeys.length} keys configured`);
    console.log(`⏱️ Rate Limit: ${config.rateLimiting.maxRequests} req/${config.rateLimiting.windowMs / 1000}s`);
    console.log(`🔒 SSL Mode: ${config.ssl.acceptSelfSignedCerts ? 'Accept self-signed' : 'Strict'}`);
    console.log('---\n');
});
