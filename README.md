# Proxy Server

Dự án này là một proxy server dựa trên Node.js, được thiết kế để forward các yêu cầu HTTP đến các API bên ngoài một cách an toàn và hiệu quả. Nó hỗ trợ xác thực, giới hạn tốc độ, validation URL và logging chi tiết.

## Mô tả

Proxy server này cho phép bạn gửi yêu cầu đến các API bên ngoài thông qua một endpoint duy nhất, giúp tránh các vấn đề như CORS, xử lý headers/cookies phức tạp và bảo mật. Nó sử dụng Express.js và Axios để forward yêu cầu, với các tính năng bảo mật như whitelist domain, API key authentication và rate limiting.

## Tính năng

- **Forward HTTP Requests**: Hỗ trợ GET, POST, PUT, DELETE, PATCH đến các API bên ngoài.
- **Bảo mật**: Xác thực bằng API key, whitelist domain, ngăn chặn IP private.
- **Giới hạn tốc độ**: Rate limiting dựa trên IP và domain.
- **Validation**: Kiểm tra URL, headers, payload trước khi forward.
- **Logging**: Ghi log chi tiết vào console và file (tùy chọn).
- **SSL Support**: Hỗ trợ self-signed certificates và timeout tùy chỉnh.
- **CORS**: Cho phép cross-origin requests.

## Cài đặt

1. **Yêu cầu**: Node.js (v14 trở lên).

2. **Clone dự án**:
   ```bash
   git clone <repository-url>
   cd proxy-server
   ```

3. **Cài đặt dependencies**:
   ```bash
   npm install
   ```

4. **Cấu hình**: Chỉnh sửa file `.env` (xem phần Configuration).

5. **Chạy server**:
   ```bash
   npm start
   ```
   Hoặc trong chế độ development:
   ```bash
   npm run dev
   ```

   Server sẽ chạy trên `http://localhost:3000` (mặc định).

## Cấu hình

Tạo file `.env` trong thư mục gốc với các biến sau:

```env
# Server
PORT=3000
HOST=localhost
NODE_ENV=development

# SSL
ACCEPT_SELF_SIGNED_CERTS=true
SSL_TIMEOUT=30000

# Security
ALLOWED_DOMAINS=*.misa.local,store.misa.vn,api.example.com  # Whitelist domains (support wildcards)
VALID_API_KEYS=abc123def456ghi789,xyz789uvw456rst123  # Comma-separated API keys

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/gateway.log
```

- **ALLOWED_DOMAINS**: Danh sách domain được phép (có thể dùng wildcard như `*.misa.local`).
- **VALID_API_KEYS**: Các API key để xác thực yêu cầu.

## Sử dụng

### API Endpoints

#### POST /api/forward
Endpoint chính để forward yêu cầu. Yêu cầu POST JSON với các trường sau:

- `originApi` (string): URL gốc của API (e.g., "https://api.example.com").
- `path` (string): Đường dẫn con (e.g., "/users").
- `method` (string): HTTP method (GET, POST, PUT, DELETE, PATCH).
- `payload` (object, optional): Body cho POST/PUT/PATCH.
- `headers` (object, optional): Custom headers.
- `cookies` (string, optional): Chuỗi cookie.

Headers yêu cầu:
- `X-API-Key`: Một trong các API key từ VALID_API_KEYS.

Ví dụ sử dụng curl:
```bash
curl -X POST http://localhost:3000/api/forward \
  -H "X-API-Key: abc123def456ghi789" \
  -H "Content-Type: application/json" \
  -d '{
    "originApi": "https://store.misa.vn/APIs/store/Products",
    "path": "/home",
    "method": "GET",
    "headers": {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 ..."
    },
    "cookies": "session=abc123; ..."
  }'
```

Phản hồi:
```json
{
  "success": true,
  "data": { ... },  // Dữ liệu từ API gốc
  "meta": {
    "originApi": "https://store.misa.vn/APIs/store/Products",
    "path": "/home",
    "method": "GET",
    "status": 200,
    "duration": "136ms"
  }
}
```

#### GET /api/health
Kiểm tra trạng thái server.

#### GET /api/config
Xem cấu hình (yêu cầu API key).

### Ví dụ

#### Ví dụ 1: Gọi API MISA Store
Tạo file `request.json`:
```json
{
  "originApi": "https://store.misa.vn/APIs/store/Products",
  "path": "/home",
  "method": "GET",
  "headers": {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ..."
  },
  "cookies": "x-store-deviceid=...; _ga=..."
}
```

Gửi yêu cầu:
```bash
curl -X POST http://localhost:3000/api/forward -H "X-API-Key: abc123def456ghi789" -d @request.json
```

#### Ví dụ 2: POST Request
```json
{
  "originApi": "https://api.example.com",
  "path": "/users",
  "method": "POST",
  "payload": { "name": "John" },
  "headers": { "Content-Type": "application/json" }
}
```

## Logging

Logs được ghi vào console và file (nếu bật LOG_TO_FILE). Các level: info, warn, error.

Ví dụ log:
```
[2023-10-27T04:18:48.315Z] [INFO]: Forwarding request { method: 'GET', url: 'https://store.misa.vn/APIs/store/Products/home' }
```

## Bảo mật

- Chỉ cho phép HTTPS URLs.
- Whitelist domain để tránh SSRF.
- Xác thực bằng API key.
- Rate limiting để ngăn lạm dụng.

## Đóng góp

1. Fork dự án.
2. Tạo branch feature: `git checkout -b feature/new-feature`.
3. Commit changes: `git commit -am 'Add new feature'`.
4. Push: `git push origin feature/new-feature`.
5. Tạo Pull Request.

## Giấy phép

ISC


kill -9 $(lsof -t -i:3000)