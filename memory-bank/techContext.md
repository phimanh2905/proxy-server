# Technical Context: Dynamic API Gateway

## Technology Stack

### Core Technologies
- **Runtime**: Node.js (v16+ recommended)
- **Web Framework**: Express.js v4.18.2
- **HTTP Client**: Axios v1.6.2 with HTTPS agent
- **Security**: Helmet v8.1.0, CORS v2.8.5
- **Rate Limiting**: express-rate-limit v8.1.0
- **Configuration**: dotenv v16.6.0
- **Development**: nodemon v3.1.10

### Development Tools
- **Package Manager**: npm (Node Package Manager)
- **Version Control**: Git with GitHub integration
- **Deployment**: Vercel platform compatible
- **Process Management**: PM2 (for production)
- **Containerization**: Docker ready

## Development Environment Setup

### Prerequisites
- Node.js v16 or higher
- npm (comes with Node.js)
- Git for version control
- Text editor (VS Code recommended)

### Installation Steps
```bash
# Clone the repository
git clone https://github.com/phimanh2905/proxy-server.git
cd proxy-server

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env  # (if example file exists)
# Edit .env with your configuration

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Configuration
**Required Environment Variables:**
```env
# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# SSL Configuration
ACCEPT_SELF_SIGNED_CERTS=true
SSL_TIMEOUT=30000

# Security Configuration
ALLOWED_DOMAINS=*.misa.local,store.misa.local,api.partner.com
VALID_API_KEYS=abc123def456ghi789,xyz789uvw456rst123

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/gateway.log
```

## Dependencies Analysis

### Production Dependencies
- **express**: Web application framework
  - Purpose: HTTP server, routing, middleware
  - Version: ^4.18.2 (stable, widely adopted)
  - Security: Regular security updates

- **axios**: HTTP client for outbound requests
  - Purpose: Forward requests to backend APIs
  - Version: ^1.6.2 (promise-based, excellent error handling)
  - Features: HTTPS agent, connection pooling, interceptors

- **helmet**: Security middleware
  - Purpose: Set security headers
  - Version: ^8.1.0 (OWASP recommended)
  - Features: XSS protection, content security policy

- **cors**: Cross-origin resource sharing
  - Purpose: Handle preflight requests
  - Version: ^2.8.5 (stable, configurable)
  - Security: Configurable origins

- **express-rate-limit**: Rate limiting middleware
  - Purpose: Prevent API abuse
  - Version: ^8.1.0 (Redis and in-memory support)
  - Features: Custom key generators, sliding windows

- **dotenv**: Environment variable loading
  - Purpose: Configuration management
  - Version: ^16.6.0 (zero-dependency, secure)
  - Security: Loads from .env file (gitignored)

### Development Dependencies
- **nodemon**: Development server auto-restart
  - Purpose: Development convenience
  - Version: ^3.1.10 (stable, fast)
  - Features: File watching, auto-restart

## Technical Constraints

### Performance Constraints
- **Memory Usage**: In-memory rate limiting (single instance)
- **Connection Limits**: Axios connection pooling
- **Request Size**: 10MB JSON payload limit
- **Timeout**: 30-second default timeout

### Security Constraints
- **Authentication**: API key only (no OAuth/JWT)
- **Rate Limiting**: In-memory only (no Redis clustering)
- **Logging**: File system storage (no external log aggregation)
- **Configuration**: Environment variables only

### Scalability Constraints
- **Single Instance**: No built-in clustering
- **State Management**: All state in memory
- **Database**: No persistent storage
- **Caching**: No response caching

## Tool Usage Patterns

### Development Workflow
```bash
# Install dependencies
npm install

# Run in development mode (with auto-restart)
npm run dev

# Run in production mode
npm start

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update
```

### Configuration Management
- All configuration via environment variables
- No database or external configuration store
- Runtime validation of critical settings
- Graceful handling of missing optional config

### Logging Patterns
- Structured JSON logging for file output
- Human-readable console logging
- Request/response correlation with timestamps
- Multiple log levels (error, warn, info)

### Error Handling Patterns
- Centralized error logging
- Consistent error response format
- Detailed error context for debugging
- Graceful degradation for non-critical failures

## Deployment Considerations

### Production Deployment
```bash
# Set production environment
export NODE_ENV=production

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name "api-gateway"

# Enable auto-start on system reboot
pm2 startup
pm2 save
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Vercel Deployment
- Serverless function compatible
- Environment variables via Vercel dashboard
- Automatic HTTPS and CDN
- Cold start optimization needed

## Monitoring and Maintenance

### Health Monitoring
- **Endpoint**: `/api/health` - Basic health status
- **Endpoint**: `/api/config` - Configuration visibility (authenticated)
- **Metrics**: Request count, error rates, response times
- **Logs**: Structured logging with correlation IDs

### Security Monitoring
- Failed authentication attempts
- Rate limit violations
- Invalid domain access attempts
- SSL certificate validation errors

### Performance Monitoring
- Request duration tracking
- Memory usage monitoring
- Connection pool status
- Error rate by endpoint

## Testing Strategy

### Manual Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Test API forwarding (requires valid API key)
curl -X POST http://localhost:3000/api/forward \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "originApi": "https://api.example.com",
    "path": "/users",
    "method": "GET"
  }'
```

### Automated Testing
- Unit tests for validation functions
- Integration tests for request forwarding
- Security tests for authentication
- Performance tests for rate limiting

## Troubleshooting

### Common Issues
1. **Configuration Errors**: Check .env file and environment variables
2. **Network Issues**: Verify SSL settings and domain whitelisting
3. **Rate Limiting**: Check IP and domain combination limits
4. **Authentication**: Verify API key in request headers

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
export LOG_TO_FILE=true

# Check logs
tail -f logs/gateway.log
```

### Performance Issues
- Monitor memory usage with process monitoring
- Check connection pool exhaustion
- Verify rate limiting configuration
- Monitor backend API response times
