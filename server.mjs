import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  port: process.env.PORT || 8080,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2'),
  cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  debug: process.env.DEBUG === 'true'
};

const log = (...args) => {
  if (config.debug) {
    console.log('[DEBUG]', ...args);
  }
};

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 已移除 renderPage 和 sha256 逻辑

app.get(['/', '/index.html', '/player.html'], async (req, res) => {
  try {
    let filePath;
    switch (req.path) {
      case '/player.html':
        filePath = path.join(__dirname, 'player.html');
        break;
      default: // '/' 和 '/index.html'
        filePath = path.join(__dirname, 'index.html');
        break;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (error) {
    console.error('页面读取错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

app.get('/s=:keyword', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (error) {
    console.error('搜索页面读取错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];

    // 从环境变量获取阻止的主机名列表
    const blockedHostnames = (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(',');

    // 从环境变量获取阻止的 IP 前缀
    const blockedPrefixes = (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(',');

    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHostnames.includes(parsed.hostname)) return false;

    for (const prefix of blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// 验证代理请求的鉴权（可选保留或根据新逻辑重构，此处先关闭旧密码硬验证以保持连通）
function validateProxyAuth(req) {
  return true; // 暂时直接返回 true，后续如需通过账号 Token 鉴权可在此按需扩展
}

app.get('/proxy/:encodedUrl', async (req, res) => {
  try {
    // 验证鉴权
    if (!validateProxyAuth(req)) {
      return res.status(401).json({
        success: false,
        error: '代理访问未授权：请检查密码配置或鉴权参数'
      });
    }

    const encodedUrl = req.params.encodedUrl;
    const targetUrl = decodeURIComponent(encodedUrl);

    // 安全验证
    if (!isValidUrl(targetUrl)) {
      console.warn(`[Proxy] 拒绝无效的 URL: ${targetUrl}`);
      return res.status(400).send('无效的 URL');
    }

    log(`[Proxy] 处理请求: ${targetUrl}`);

    // 添加请求超时和重试逻辑
    const maxRetries = config.maxRetries;
    let retries = 0;

    const makeRequest = async () => {
      try {
        return await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'stream',
          timeout: config.timeout,
          headers: {
            'User-Agent': config.userAgent,
            'Referer': new URL(targetUrl).origin + '/'
          }
        });
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          log(`[Proxy] 重试请求 (${retries}/${maxRetries}): ${targetUrl}`);
          return makeRequest();
        }
        throw error;
      }
    };

    const response = await makeRequest();
    log(`[Proxy] 目标响应成功: ${targetUrl} [${response.status}]`);

    // 转发响应头（过滤敏感头）
    const headers = { ...response.headers };
    const sensitiveHeaders = (
      process.env.FILTERED_HEADERS ||
      'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin'
    ).split(',');

    sensitiveHeaders.forEach(header => delete headers[header]);
    res.set(headers);

    // 管道传输响应流
    response.data.pipe(res);
  } catch (error) {
    console.error(`[Proxy] 代理请求失败 (${req.params.encodedUrl}):`, error.message);
    if (error.response) {
      console.error(`[Proxy] 目标服务器响应错误: ${error.response.status}`);
      res.status(error.response.status || 500);
      error.response.data.pipe(res);
    } else {
      res.status(500).send(`请求失败: ${error.message}`);
    }
  }
});

app.use(express.static(path.join(__dirname), {
  maxAge: config.cacheMaxAge
}));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).send('服务器内部错误');
});

app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 启动服务器
app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
  if (config.debug) {
    console.log('调试模式已启用');
    console.log('配置:', config);
  }
});
