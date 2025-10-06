const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file in be/ directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Cấu hình CORS với nguồn gốc động từ biến môi trường
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

/**
 * Hàm thực hiện thử lại yêu cầu Axios với cơ chế exponential backoff
 * @param {Object} config - Cấu hình yêu cầu Axios
 * @param {number} maxRetries - Số lần thử lại tối đa
 * @returns {Promise} - Kết quả của yêu cầu
 */
async function axiosWithRetry(config, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error; // Ném lỗi nếu đã thử hết số lần
      }
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.log(`Thử lại lần ${attempt + 1}/${maxRetries} sau ${delay / 1000} giây do lỗi: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Route proxy để chuyển tiếp yêu cầu tới MISA
app.all('/proxy/*', async (req, res) => {
  const url = 'https://misajsc.amis.vn' + req.url.replace('/proxy', '');
  // Lấy cookie từ header tùy chỉnh X-Custom-Cookie của yêu cầu client
  const cookie = req.headers['x-custom-cookie'] || '';

  try {
    const response = await axiosWithRetry({
      method: req.method,
      url: url,
      data: req.body,
      timeout: 30000, // Tăng thời gian chờ lên 30 giây
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'Host': 'misajsc.amis.vn',
        'Origin': 'https://misajsc.amis.vn',
        'User-Agent': req.headers['user-agent'] || ''
      }
    });
    // Middleware CORS đã được thiết lập toàn cục, không cần thêm thủ công
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', {
      message: error.message,
      requestUrl: url,
      requestMethod: req.method,
      requestBody: req.body,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      stack: error.stack
    });
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Proxy error', details: error.message });
  }
});

// Xử lý yêu cầu OPTIONS cho CORS preflight
// Không cần thiết lập thủ công vì middleware CORS đã xử lý

// Thêm tuyến đường gốc để xác nhận server đang chạy
app.get('/', (req, res) => {
  res.status(200).send('Proxy Server is running');
});

app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
