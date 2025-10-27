# System Patterns: Dynamic API Gateway

## Architecture Overview

### High-Level Architecture
```
Client Request → API Gateway → Authentication → Rate Limiting → URL Validation → Backend API
                                    ↓
                              Request Logging ←──┘
                                    ↓
                              Error Handling ←──┘
```

### Core Components

#### 1. Request Processing Pipeline
**Pattern**: Chain of Responsibility
- **Authentication Middleware**: Validates API keys
- **Request Validation**: Validates request body and parameters
- **Rate Limiting**: Applies rate limits based on IP + domain
- **URL Validation**: Security validation of target URLs
- **Request Forwarding**: Axios-based HTTP client with SSL configuration

#### 2. Security Layer
**Pattern**: Defense in Depth
- **API Key Authentication**: Header-based authentication
- **Domain Whitelisting**: Wildcard support (*.misa.local)
- **HTTPS Enforcement**: Only allows HTTPS outbound requests
- **Private IP Blocking**: Prevents access to internal networks
- **Rate Limiting**: Per-IP and per-domain limits

#### 3. Configuration Management
**Pattern**: Environment-Based Configuration
- **Environment Variables**: All config via .env file
- **Runtime Validation**: Validates critical config at startup
- **Graceful Degradation**: Continues with safe defaults where possible

## Key Technical Decisions

### 1. Technology Stack
**Node.js + Express**: Lightweight, fast, excellent middleware ecosystem
**Axios**: HTTP client with SSL agent support and connection pooling
**Express Rate Limit**: Industry-standard rate limiting with key generators
**Helmet**: Security headers for web application security
**CORS**: Cross-origin resource sharing support

### 2. Security Architecture
**API Key Authentication**: Simple but effective authentication mechanism
- Stored as environment variables (not database)
- Multiple keys supported for key rotation
- Validated against whitelist on each request

**Domain Whitelisting**: Prevents access to unauthorized APIs
- Wildcard support for subdomains (*.misa.local)
- Case-sensitive exact matching for security
- Configurable via environment variables

**Rate Limiting Strategy**: Multi-dimensional limits
- Per-IP limits to prevent abuse
- Per-domain limits to respect API quotas
- Combined key generation (IP + domain)
- Configurable windows and request counts

### 3. Request Forwarding
**Connection Management**: HTTPS agent with keep-alive
- Connection pooling for performance
- Configurable SSL settings
- Timeout handling for reliability

**Header Management**: Transparent proxy behavior
- Forwards all headers except sensitive ones
- Adds User-Agent for identification
- Preserves cookies when provided

**Error Handling**: Comprehensive error responses
- Network errors mapped to HTTP status codes
- Detailed error logging for debugging
- Consistent error response format

## Design Patterns in Use

### 1. Middleware Pattern
**Implementation**: Express middleware chain
```javascript
app.use(helmet())           // Security headers
app.use(cors())             // CORS support
app.use(express.json())     // Body parsing
app.use(apiKeyAuth)         // Custom authentication
app.use(validateRequest)    // Request validation
app.use(createRateLimiter()) // Dynamic rate limiting
```

### 2. Configuration Pattern
**Implementation**: Environment-based with validation
```javascript
const config = {
    security: {
        allowedDomains: process.env.ALLOWED_DOMAINS.split(',').filter(Boolean),
        validApiKeys: process.env.VALID_API_KEYS.split(',').filter(Boolean)
    }
}
```

### 3. Logging Pattern
**Implementation**: Structured logging with multiple outputs
```javascript
function log(level, message, data = {}) {
    // Console output
    console.log(`[${timestamp}] [${level}]: ${message}`, data)

    // File output (if enabled)
    if (config.logging.toFile) {
        fs.appendFileSync(config.logging.filePath, JSON.stringify(logEntry) + '\n')
    }
}
```

### 4. Validation Pattern
**Implementation**: Composable validation functions
```javascript
function validateUrl(url) {
    // HTTPS check
    // Private IP check
    // Whitelist check
    return { isValid: errors.length === 0, errors }
}
```

## Component Relationships

### Core Dependencies
```
server.js (main entry point)
├── express (web framework)
├── axios (HTTP client)
├── helmet (security middleware)
├── cors (CORS support)
├── express-rate-limit (rate limiting)
├── dotenv (environment config)
└── path, fs (Node.js built-ins)
```

### Configuration Flow
```
.env file → process.env → config object → runtime validation → application startup
```

### Request Flow
```
HTTP Request → Express → Middleware Chain → Route Handler → Response
```

### Error Flow
```
Error Occurs → Catch Block → Log Error → Structured Response → Client
```

## Critical Implementation Paths

### 1. Startup Sequence
1. Load environment variables
2. Validate critical configuration
3. Setup Express application
4. Configure middleware
5. Define routes
6. Start HTTP server
7. Log startup information

### 2. Request Processing
1. Receive HTTP request
2. Parse request body
3. Authenticate API key
4. Validate request format
5. Apply rate limiting
6. Validate target URL
7. Forward request to backend
8. Return response to client
9. Log request details

### 3. Security Validation
1. Check API key against whitelist
2. Validate URL format and protocol
3. Check against domain whitelist
4. Verify HTTPS enforcement
5. Block private IP addresses

## Performance Considerations

### Connection Pooling
- Axios HTTPS agent with keepAlive: true
- Connection reuse for multiple requests
- Configurable timeout settings

### Memory Management
- Streaming for large request/response bodies
- No caching of sensitive data
- Efficient logging without memory leaks

### Rate Limiting Strategy
- In-memory rate limiting (suitable for single instance)
- Key generation based on IP + domain
- Configurable sliding windows

## Security Patterns

### 1. Input Validation
- Strict URL validation with regex patterns
- Request body schema validation
- Header sanitization

### 2. Output Encoding
- JSON response formatting
- Error message sanitization
- Log data sanitization

### 3. Access Control
- API key whitelist approach
- Domain-based access control
- Rate limiting as DDoS protection

## Monitoring and Observability

### Logging Strategy
- Structured JSON logging
- Multiple output targets (console + file)
- Request/response correlation
- Performance metrics (duration, status codes)

### Health Checks
- Basic health endpoint (/api/health)
- Configuration visibility (/api/config)
- Dependency status monitoring

### Error Tracking
- Categorized error types
- Detailed error context
- Request tracing information
