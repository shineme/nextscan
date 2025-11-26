# Cloudflare Worker URL 检测工具 - 完整文档

## 📋 目录
- [概述](#概述)
- [部署地址](#部署地址)
- [请求方式](#请求方式)
- [参数说明](#参数说明)
- [返回格式](#返回格式)
- [使用示例](#使用示例)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)

---

## 概述

这是一个强大的 URL 检测工具，支持：
- ✅ HEAD 请求（快速获取元信息）
- ✅ GET 请求（支持部分内容预览）
- ✅ 批量检测（最多 10 个 URL）
- ✅ 自动重试机制
- ✅ 超时控制
- ✅ 重定向追踪
- ✅ 文件预览和类型判断
- ✅ 下载建议

---

## 部署地址

```
https://your-worker-name.your-subdomain.workers.dev
```

将上面的地址替换为你的实际 Worker 地址。

---

## 请求方式

### 方式一：GET 请求（推荐用于快速测试）

**基础用法：**
```
GET https://your-worker.dev?url=https://example.com/file.zip
```

**完整参数：**
```
GET https://your-worker.dev?url=<URL>&method=<METHOD>&timeout=<SECONDS>&retry=<COUNT>&preview=<BOOLEAN>
```

### 方式二：POST 请求（推荐用于批量或复杂配置）

**Content-Type:** `application/json`

**请求体：**
```json
{
  "urls": ["https://example.com/file.zip"],
  "method": "head",
  "timeout": 10,
  "retry": 2,
  "preview": false,
  "headers": {}
}
```

---

## 参数说明

### URL 参数（必填）

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | String | 单个 URL（GET 请求使用） |
| `urls` | Array | URL 数组（POST 请求使用，最多 10 个） |

**示例：**
```javascript
// GET 请求
?url=https://example.com/file.zip

// POST 请求
{
  "urls": [
    "https://example1.com/file1.zip",
    "https://example2.com/file2.zip"
  ]
}
```

### 可选参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `method` | String | `"head"` | 请求方法：`"head"` 或 `"get"` |
| `timeout` | Number | `10` | 超时时间（秒），范围 1-30 |
| `retry` | Number | `2` | 失败重试次数，范围 0-5 |
| `preview` | Boolean | `false` | 是否获取内容预览（仅 GET 请求有效） |
| `headers` | Object | `{}` | 自定义请求头（仅 POST 请求） |

**说明：**
- `method="head"`：只获取响应头，速度最快
- `method="get"`：获取完整响应（配合 `preview=true` 时只获取前 1KB）
- `preview=true`：文件预览包含十六进制、文本内容、类型判断

---

## 返回格式

### 成功响应结构

```json
{
  "success": true,
  "total": 1,
  "results": [
    {
      "url": "https://example.com/file.zip",
      "method": "HEAD",
      "success": true,
      "attempts": 1,
      "status": 200,
      "statusText": "OK",
      "ok": true,
      "responseTime": "93ms",
      "timing": {},
      "summary": {},
      "headers": {},
      "redirect": {},
      "preview": {},
      "downloadAdvice": {}
    }
  ],
  "timestamp": "2025-11-24T01:53:51.447Z"
}
```

### 字段详解

#### 1. 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | Boolean | 请求是否成功 |
| `total` | Number | 检测的 URL 总数 |
| `results` | Array | 每个 URL 的检测结果 |
| `timestamp` | String | ISO 8601 时间戳 |

#### 2. results[i] - 基础信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | String | 被检测的 URL |
| `method` | String | 使用的 HTTP 方法 |
| `success` | Boolean | 该 URL 检测是否成功 |
| `attempts` | Number | 实际尝试次数 |
| `status` | Number | HTTP 状态码 |
| `statusText` | String | 状态文本 |
| `ok` | Boolean | 状态码是否在 200-299 范围 |
| `responseTime` | String | 响应时间（如 "93ms"） |

#### 3. timing - 性能分析

```json
{
  "total": 93,
  "fast": true,
  "moderate": false,
  "slow": false
}
```

| 字段 | 说明 |
|------|------|
| `total` | 总响应时间（毫秒） |
| `fast` | < 200ms 为 true |
| `moderate` | 200-1000ms 为 true |
| `slow` | > 1000ms 为 true |

#### 4. summary - 核心摘要

```json
{
  "contentLength": "5.23 MB",
  "contentLengthBytes": 5485760,
  "contentType": "application/zip",
  "lastModified": "Wed, 16 Apr 2025 12:57:03 GMT",
  "etag": "W/\"67ffa91f-4dbf\"",
  "server": "cloudflare",
  "supportResume": true,
  "cacheControl": "public, max-age=3600"
}
```

| 字段 | 说明 |
|------|------|
| `contentLength` | 人性化的文件大小 |
| `contentLengthBytes` | 字节数（数字） |
| `contentType` | MIME 类型 |
| `lastModified` | 最后修改时间 |
| `etag` | 缓存标识 |
| `server` | 服务器类型 |
| `supportResume` | 是否支持断点续传 |
| `cacheControl` | 缓存策略 |

#### 5. headers - 完整响应头

包含服务器返回的所有原始响应头，格式为键值对：

```json
{
  "content-type": "application/zip",
  "content-length": "5485760",
  "last-modified": "Wed, 16 Apr 2025 12:57:03 GMT",
  "etag": "W/\"67ffa91f-4dbf\"",
  "accept-ranges": "bytes",
  "cache-control": "public, max-age=3600",
  "server": "cloudflare",
  "cf-ray": "9a354668101537a2-IAD"
}
```

#### 6. redirect - 重定向信息（仅当发生重定向时）

```json
{
  "status": 301,
  "location": "https://new-location.com/file.zip",
  "permanent": true
}
```

| 字段 | 说明 |
|------|------|
| `status` | 重定向状态码（301/302/307/308） |
| `location` | 重定向目标 URL |
| `permanent` | 是否为永久重定向（301/308） |

#### 7. preview - 内容预览（仅 GET + preview=true）

```json
{
  "bytes": 200,
  "hex": "50 4b 03 04 14 00 00 00 08 00 ...",
  "text": "PK..............................",
  "isText": false,
  "isBinary": true
}
```

| 字段 | 说明 |
|------|------|
| `bytes` | 预览的字节数 |
| `hex` | 前 32 字节的十六进制表示 |
| `text` | 尝试解码为文本（不可打印字符显示为 `.`） |
| `isText` | 是否可能是文本文件 |
| `isBinary` | 是否可能是二进制文件 |

#### 8. downloadAdvice - 下载建议

```json
{
  "size": "5.23 MB",
  "estimatedTime": [
    "1 Mbps: 43秒",
    "10 Mbps: 5秒",
    "100 Mbps: 1秒",
    "1 Gbps: 1秒"
  ],
  "resumable": true,
  "recommendation": "可以直接下载"
}
```

| 字段 | 说明 |
|------|------|
| `size` | 文件大小 |
| `estimatedTime` | 不同网速下的预计下载时间 |
| `resumable` | 是否支持断点续传 |
| `recommendation` | 下载建议（大文件会提醒使用专用工具） |

### 错误响应结构

```json
{
  "url": "https://example.com/file.zip",
  "method": "HEAD",
  "success": false,
  "error": "请求超时 (10秒)",
  "errorType": "AbortError",
  "attempts": 3
}
```

---

## 使用示例

### 示例 1：快速检测单个文件（HEAD）

**请求：**
```bash
curl "https://your-worker.dev?url=https://www.affadsense.com/affadsense.zip"
```

**响应：**
```json
{
  "success": true,
  "total": 1,
  "results": [{
    "url": "https://www.affadsense.com/affadsense.zip",
    "method": "HEAD",
    "success": true,
    "status": 200,
    "responseTime": "93ms",
    "summary": {
      "contentLength": "5.23 MB",
      "contentType": "application/zip",
      "supportResume": true
    }
  }]
}
```

### 示例 2：获取文件预览（GET）

**请求：**
```bash
curl "https://your-worker.dev?url=https://example.com/data.json&method=get&preview=true"
```

**响应：**
```json
{
  "results": [{
    "status": 200,
    "preview": {
      "bytes": 200,
      "hex": "7b 22 6e 61 6d 65 22 3a 20 22 74 65 73 74 22 ...",
      "text": "{\"name\": \"test\", \"value\": 123}",
      "isText": true,
      "isBinary": false
    }
  }]
}
```

### 示例 3：批量检测多个文件

**请求：**
```bash
curl -X POST https://your-worker.dev \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip",
      "https://downloads.majestic.com/majestic_million.csv",
      "https://builtwith.com/dl/builtwith-top1m.zip"
    ],
    "timeout": 15,
    "retry": 3
  }'
```

**响应：**
```json
{
  "success": true,
  "total": 3,
  "results": [
    {
      "url": "https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip",
      "success": true,
      "status": 200,
      "summary": {
        "contentLength": "2.34 MB"
      }
    },
    {
      "url": "https://downloads.majestic.com/majestic_million.csv",
      "success": true,
      "status": 200,
      "summary": {
        "contentLength": "15.67 MB"
      }
    },
    {
      "url": "https://builtwith.com/dl/builtwith-top1m.zip",
      "success": false,
      "error": "请求超时 (15秒)"
    }
  ]
}
```

### 示例 4：自定义请求头

**请求：**
```bash
curl -X POST https://your-worker.dev \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/data",
    "method": "head",
    "headers": {
      "Authorization": "Bearer your-token",
      "X-Custom-Header": "value"
    }
  }'
```

### 示例 5：检测重定向

**请求：**
```bash
curl "https://your-worker.dev?url=https://bit.ly/shortened-url"
```

**响应：**
```json
{
  "results": [{
    "status": 301,
    "redirect": {
      "status": 301,
      "location": "https://actual-destination.com/page",
      "permanent": true
    }
  }]
}
```

### 示例 6：大文件下载建议

**请求：**
```bash
curl "https://your-worker.dev?url=https://releases.ubuntu.com/24.04/ubuntu-24.04-desktop-amd64.iso"
```

**响应：**
```json
{
  "results": [{
    "summary": {
      "contentLength": "4.56 GB"
    },
    "downloadAdvice": {
      "size": "4.56 GB",
      "estimatedTime": [
        "1 Mbps: 10.2小时",
        "10 Mbps: 1.0小时",
        "100 Mbps: 6分钟",
        "1 Gbps: 37秒"
      ],
      "resumable": true,
      "recommendation": "大文件建议使用支持断点续传的下载工具"
    }
  }]
}
```

---

## 错误处理

### 常见错误类型

#### 1. URL 格式错误（400）

```json
{
  "url": "invalid-url",
  "success": false,
  "error": "URL 格式无效"
}
```

#### 2. 请求超时（500）

```json
{
  "url": "https://slow-server.com/file",
  "success": false,
  "error": "请求超时 (10秒)",
  "errorType": "AbortError",
  "attempts": 3
}
```

#### 3. 网络错误（500）

```json
{
  "url": "https://non-existent-domain.com",
  "success": false,
  "error": "getaddrinfo ENOTFOUND non-existent-domain.com",
  "errorType": "TypeError"
}
```

#### 4. 批量请求超限（400）

```json
{
  "error": "批量请求最多支持 10 个 URL"
}
```

#### 5. 参数缺失（400）

```json
{
  "error": "URL 参数缺失",
  "usage": "?url=https://example.com&method=head&timeout=10"
}
```

---

## HTTP 状态码说明

### 成功状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功（文件存在且可访问） |
| 206 | 部分内容（Range 请求成功） |

### 重定向状态码

| 状态码 | 说明 |
|--------|------|
| 301 | 永久重定向 |
| 302 | 临时重定向 |
| 307 | 临时重定向（保持方法） |
| 308 | 永久重定向（保持方法） |

### 客户端错误

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 需要认证 |
| 403 | 禁止访问 |
| 404 | 文件不存在 |
| 405 | 方法不允许 |
| 416 | Range 请求范围错误 |

### 服务器错误

| 状态码 | 说明 |
|--------|------|
| 500 | 服务器内部错误 |
| 502 | 网关错误 |
| 503 | 服务不可用 |
| 504 | 网关超时 |

---

## 最佳实践

### 1. 选择合适的请求方法

```javascript
// ✅ 只需要检查文件是否存在、大小等元信息
?url=https://example.com/file.zip&method=head

// ✅ 需要预览文件内容、判断文件类型
?url=https://example.com/data.json&method=get&preview=true

// ❌ 避免：不需要预览时使用 GET（浪费带宽）
?url=https://example.com/large-file.zip&method=get
```

### 2. 合理设置超时时间

```javascript
// 国内服务器，网络良好
{ "timeout": 5 }

// 国际服务器，可能较慢
{ "timeout": 15 }

// 已知服务器响应慢
{ "timeout": 30 }
```

### 3. 批量检测优化

```javascript
// ✅ 推荐：分批检测，每批 5-10 个
const urls = [...100个URL];
const batches = chunk(urls, 10);

for (const batch of batches) {
  await fetch(workerUrl, {
    method: 'POST',
    body: JSON.stringify({ urls: batch })
  });
  await sleep(1000); // 避免频繁请求
}

// ❌ 避免：一次检测过多 URL
{ "urls": [...100个URL] } // 会被拒绝
```

### 4. 错误处理

```javascript
const response = await fetch(workerUrl + '?url=' + encodeURIComponent(targetUrl));
const data = await response.json();

if (data.success) {
  const result = data.results[0];
  
  if (result.success) {
    // 成功获取信息
    console.log('文件大小:', result.summary.contentLength);
  } else {
    // URL 检测失败
    console.error('检测失败:', result.error);
    
    // 根据错误类型处理
    if (result.error.includes('超时')) {
      // 增加超时时间重试
    } else if (result.error.includes('格式无效')) {
      // 修正 URL 格式
    }
  }
} else {
  // 请求本身失败
  console.error('请求失败:', data.error);
}
```

### 5. 使用自定义请求头

```javascript
// 需要认证的 API
{
  "url": "https://api.example.com/resource",
  "headers": {
    "Authorization": "Bearer your-token"
  }
}

// 伪装成特定浏览器
{
  "url": "https://example.com",
  "headers": {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
  }
}
```

### 6. 性能监控

```javascript
// 记录响应时间，发现慢速服务器
const results = data.results;
const slowUrls = results.filter(r => 
  r.timing && r.timing.slow
);

console.log('慢速 URL:', slowUrls.map(r => r.url));
```

---

## 集成示例

### JavaScript/Node.js

```javascript
async function checkUrl(url, options = {}) {
  const workerUrl = 'https://your-worker.dev';
  
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [url],
      method: options.method || 'head',
      timeout: options.timeout || 10,
      preview: options.preview || false
    })
  });
  
  const data = await response.json();
  return data.results[0];
}

// 使用
const result = await checkUrl('https://example.com/file.zip');
console.log(result.summary.contentLength);
```

### Python

```python
import requests

def check_url(url, method='head', timeout=10):
    worker_url = 'https://your-worker.dev'
    
    response = requests.post(worker_url, json={
        'urls': [url],
        'method': method,
        'timeout': timeout
    })
    
    data = response.json()
    return data['results'][0]

# 使用
result = check_url('https://example.com/file.zip')
print(f"文件大小: {result['summary']['contentLength']}")
```

### cURL

```bash
#!/bin/bash

WORKER_URL="https://your-worker.dev"
TARGET_URL="https://example.com/file.zip"

curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d "{\"urls\": [\"$TARGET_URL\"], \"method\": \"head\"}" \
  | jq '.results[0].summary.contentLength'
```

---

## 限制说明

| 限制项 | 值 | 说明 |
|--------|-----|------|
| 批量请求数量 | 10 | 单次请求最多检测 10 个 URL |
| 超时时间 | 1-30 秒 | 建议 10-15 秒 |
| 重试次数 | 0-5 次 | 建议 2-3 次 |
| 预览大小 | 1 KB | GET 请求预览限制 |
| 请求频率 | 无硬性限制 | 建议控制在合理范围 |

---

## 版本信息

- **当前版本**: 2.0
- **更新日期**: 2025-11-24
- **兼容性**: 支持所有现代浏览器和 HTTP 客户端

---

## 支持与反馈

如有问题或建议，请通过以下方式反馈：
- 💬 GitHub Issues
- 📧 Email
- 🐛 Bug Report

---

## 许可证

MIT License