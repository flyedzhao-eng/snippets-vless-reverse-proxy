// 需要反代的地址
const hostname = "https://snippets.neib.cn"

function handleRequest(request) {
  let url = new URL(request.url);
  
  // 检查是否为 WebSocket 请求
  const upgrade = request.headers.get('Upgrade');
  
  try {
    // 无论是 WebSocket 还是普通请求，都转发
    return fetch(new Request(hostname + url.pathname + url.search, request));
  } catch (error) {
    return new Response('Proxy Error', { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
