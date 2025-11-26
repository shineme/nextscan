addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 支持 GET 和 POST
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({
      error: '仅支持 GET 或 POST 请求',
      usage: {
        GET: '?url=https://example.com&method=head&timeout=10',
        POST: '{"urls": ["https://example.com"], "method": "head", "timeout": 10, "retry": 2}'
      }
    }, 405, corsHeaders)
  }

  try {
    let config = {}
    
    // 解析请求参数
    if (request.method === 'GET') {
      const url = new URL(request.url)
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) {
        return jsonResponse({
          error: 'URL 参数缺失',
          usage: '?url=https://example.com&method=head&timeout=10'
        }, 400, corsHeaders)
      }
      config = {
        urls: [targetUrl],
        method: url.searchParams.get('method') || 'head',
        timeout: parseInt(url.searchParams.get('timeout')) || 10,
        retry: parseInt(url.searchParams.get('retry')) || 2,
        preview: url.searchParams.get('preview') === 'true'
      }
    } else {
      const body = await request.json()
      config = {
        urls: Array.isArray(body.urls) ? body.urls : [body.url],
        method: body.method || 'head',
        timeout: body.timeout || 10,
        retry: body.retry || 2,
        preview: body.preview || false,
        customHeaders: body.headers || {}
      }
    }

    // 验证配置
    if (!config.urls || config.urls.length === 0) {
      return jsonResponse({
        error: 'URLs 参数缺失'
      }, 400, corsHeaders)
    }

    if (config.urls.length > 10) {
      return jsonResponse({
        error: '批量请求最多支持 10 个 URL'
      }, 400, corsHeaders)
    }

    // 批量检测
    const results = await Promise.all(
      config.urls.map(url => checkUrl(url, config))
    )

    const response = {
      success: true,
      total: results.length,
      results: results,
      timestamp: new Date().toISOString()
    }

    return jsonResponse(response, 200, corsHeaders)

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500, corsHeaders)
  }
}

async function checkUrl(targetUrl, config) {
  const result = {
    url: targetUrl,
    method: config.method.toUpperCase(),
    success: false,
    error: null
  }

  // 验证 URL 格式
  try {
    new URL(targetUrl)
  } catch (e) {
    result.error = 'URL 格式无效'
    return result
  }

  // 重试逻辑
  let lastError = null
  for (let attempt = 0; attempt <= config.retry; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(1000 * attempt) // 递增延迟
      }

      const checkResult = await performCheck(targetUrl, config)
      return { ...result, ...checkResult, success: true, attempts: attempt + 1 }
    } catch (error) {
      lastError = error
      if (attempt === config.retry) {
        result.error = error.message
        result.errorType = error.name
        result.attempts = attempt + 1
      }
    }
  }

  return result
}

async function performCheck(targetUrl, config) {
  const method = config.method.toLowerCase()
  const startTime = Date.now()
  
  // 构建请求头
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    ...config.customHeaders
  }

  // 如果是 GET 且需要预览，添加 Range 头
  if (method === 'get' && config.preview) {
    headers['Range'] = 'bytes=0-1023' // 只获取前 1KB
  }

  // 创建 AbortController 实现超时
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout * 1000)

  try {
    const response = await fetch(targetUrl, {
      method: method === 'head' ? 'HEAD' : 'GET',
      headers: headers,
      redirect: 'follow', // 自动跟随重定向获取最终状态
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    // 收集所有响应头
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // 提取关键信息
    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type')
    const lastModified = response.headers.get('last-modified')
    const etag = response.headers.get('etag')
    const server = response.headers.get('server')
    const acceptRanges = response.headers.get('accept-ranges')
    const cacheControl = response.headers.get('cache-control')

    // 处理重定向
    let redirectInfo = null
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      redirectInfo = {
        status: response.status,
        location: response.headers.get('location'),
        permanent: [301, 308].includes(response.status)
      }
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseTime: `${responseTime}ms`,
      timing: {
        total: responseTime,
        fast: responseTime < 200,
        moderate: responseTime >= 200 && responseTime < 1000,
        slow: responseTime >= 1000
      },
      summary: {
        contentLength: formatFileSize(contentLength),
        contentLengthBytes: contentLength ? parseInt(contentLength) : null,
        contentType: contentType || 'Not provided',
        lastModified: lastModified || 'Not provided',
        etag: etag || 'Not provided',
        server: server || 'Not provided',
        supportResume: acceptRanges === 'bytes',
        cacheControl: cacheControl || 'Not provided'
      },
      headers: responseHeaders
    }

    // 添加重定向信息
    if (redirectInfo) {
      result.redirect = redirectInfo
    }

    // 如果是 GET 请求且需要预览
    if (method === 'get' && config.preview) {
      try {
        const buffer = await response.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const preview = Array.from(bytes.slice(0, 200))
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 200))
        
        result.preview = {
          bytes: preview.length,
          hex: Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '),
          text: text.replace(/[^\x20-\x7E]/g, '.'), // 替换不可打印字符
          isText: isLikelyText(bytes.slice(0, 200)),
          isBinary: isLikelyBinary(bytes.slice(0, 200))
        }
      } catch (e) {
        result.preview = { error: 'Failed to read preview' }
      }
    }

    // 添加下载建议
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / 1024 / 1024
      result.downloadAdvice = {
        size: formatFileSize(contentLength),
        estimatedTime: estimateDownloadTime(parseInt(contentLength)),
        resumable: acceptRanges === 'bytes',
        recommendation: sizeInMB > 100 ? '大文件建议使用支持断点续传的下载工具' : '可以直接下载'
      }
    }

    return result

  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${config.timeout}秒)`)
    }
    throw error
  }
}

// 辅助函数
function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  const size = parseInt(bytes)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function estimateDownloadTime(bytes) {
  const speedMbps = [1, 10, 100, 1000] // 不同网速
  const speedNames = ['1 Mbps', '10 Mbps', '100 Mbps', '1 Gbps']
  const estimates = speedMbps.map((speed, i) => {
    const seconds = (bytes * 8) / (speed * 1024 * 1024)
    return `${speedNames[i]}: ${formatTime(seconds)}`
  })
  return estimates
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.ceil(seconds)}秒`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`
  return `${(seconds / 3600).toFixed(1)}小时`
}

function isLikelyText(bytes) {
  let textChars = 0
  for (let i = 0; i < Math.min(bytes.length, 200); i++) {
    if ((bytes[i] >= 0x20 && bytes[i] <= 0x7E) || bytes[i] === 0x09 || bytes[i] === 0x0A || bytes[i] === 0x0D) {
      textChars++
    }
  }
  return textChars / Math.min(bytes.length, 200) > 0.85
}

function isLikelyBinary(bytes) {
  return !isLikelyText(bytes)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  })
}