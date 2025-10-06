// ====== 配置区 ======
const ORIGIN = "https://cfxr.eu.org";
const SECRET = "101500";
const ALLOWED_ORIGINS = [];
const ENABLE_HTTPS = true;
// =====================

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 1. 健康检查端点
  if (url.pathname === "/health" && url.searchParams.get("key") === SECRET) {
    return new Response(JSON.stringify({ 
      status: "ok", 
      timestamp: Date.now(),
      version: "1.0"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // 2. 防盗链验证
  const key = url.searchParams.get("key");
  if (!key || key !== SECRET) {
    return new Response("403 Forbidden - Invalid Key", { 
      status: 403,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 3. Origin 白名单验证（如果配置了）
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = ALLOWED_ORIGINS.some(domain => 
      origin.includes(domain)
    );
    
    if (!isAllowed && origin) {
      return new Response("403 Forbidden - Invalid Origin", { 
        status: 403,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }

  // 4. 检查是否为 WebSocket 升级请求
  const upgradeHeader = request.headers.get('Upgrade');
  const isWebSocket = upgradeHeader === 'websocket';

  // 5. 如果不是 WebSocket 且未启用 HTTPS 支持
  if (!isWebSocket && !ENABLE_HTTPS) {
    return new Response('403 Access Denied - WebSocket Only', { 
      status: 403,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 6. 屏蔽明显的爬虫（可选）
  const ua = request.headers.get("User-Agent") || "";
  if (/bot|crawler|spider|scrapy/i.test(ua) && !isWebSocket) {
    return new Response("404 Not Found", { 
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // 7. 移除 key 参数并构造目标 URL
  url.searchParams.delete("key");
  const targetPath = url.pathname + (url.search ? url.search : "");
  const targetUrl = ORIGIN + targetPath;

  // 8. 构造转发请求
  const headers = new Headers(request.headers);
  
  // 清理可能暴露代理信息的头
  headers.delete("CF-Connecting-IP");
  headers.delete("CF-Ray");
  headers.delete("CF-Visitor");
  headers.delete("X-Forwarded-For");
  headers.delete("X-Forwarded-Proto");

  try {
    // 9. 转发请求到源站
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      // WebSocket 不能使用 cf 缓存选项
      ...(isWebSocket ? {} : { 
        cf: { 
          cacheTtl: 0,
          cacheEverything: false 
        } 
      })
    });

    // 10. 处理响应
    if (isWebSocket) {
      // WebSocket 连接：直接返回响应（包含升级协议）
      return response;
    } else {
      // HTTP 请求：添加安全头并返回
      const newHeaders = new Headers(response.headers);
      
      // 添加安全响应头
      newHeaders.set("X-Content-Type-Options", "nosniff");
      newHeaders.set("X-Frame-Options", "DENY");
      newHeaders.set("Referrer-Policy", "no-referrer");
      
      // 移除可能泄露源站信息的头
      newHeaders.delete("Server");
      newHeaders.delete("X-Powered-By");
      
      // 如果需要 CORS 支持，取消下面注释
      // const origin = request.headers.get("Origin");
      // if (origin) {
      //   newHeaders.set("Access-Control-Allow-Origin", origin);
      //   newHeaders.set("Access-Control-Allow-Credentials", "true");
      // }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(`502 Bad Gateway\nUnable to connect to origin\n${err.message}`, { 
      status: 502,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

// ============ 使用说明 ============
// 原始订阅: https://cfxr.eu.org/getSub?host=55c358c8.gityun.pages.dev
// 
// 部署后的新订阅地址（替换 YOUR-WORKER.workers.dev 为您的实际域名）:
// https://YOUR-WORKER.workers.dev/getSub?host=55c358c8.gityun.pages.dev&key=101500
// 
// 健康检查:
// https://YOUR-WORKER.workers.dev/health?key=101500
// ==================================
