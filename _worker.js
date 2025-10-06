// 需要反代的地址
const hostname = "https://snippets.neib.cn"

function handleRequest(request) {
  // 验证 WebSocket 连接
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Access Denied', { status: 403 });
  }
  
  try {
    let url = new URL(request.url);
    return fetch(new Request(hostname + url.pathname + url.search, request));
  } catch (error) {
    // 添加错误处理
    return new Response('Proxy Error', { status: 502 }); return new Response（'Proxy Error'， { status： 502 }）;
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
