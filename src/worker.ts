import { onRequestPost as handleChatPost } from "../functions/api/chat";
import { onRequestPost as handleOcrPost } from "../functions/api/ocr";
import { onRequestPost as handleResumeAssistPost } from "../functions/api/resume-assist";
import { handleApiRequest } from "./backend/apiRouter";
import { resolveStorageBindings } from "./backend/cloudflareStorage";
import { AppWorkerEnv } from "./backend/d1Types";

export default {
  async fetch(request: Request, env: AppWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method === "POST") {
      if (url.pathname === "/api/chat") {
        return handleChatPost({ request, env });
      }
      if (url.pathname === "/api/ocr") {
        return handleOcrPost({ request, env });
      }
      if (url.pathname === "/api/resume-assist") {
        return handleResumeAssistPost({ request, env });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      const apiRes = await handleApiRequest(request, env);
      if (apiRes) {
        if (url.pathname === "/api/health") {
          const { storageStatus } = resolveStorageBindings(env);
          const headers = new Headers(apiRes.headers);
          headers.set("X-SunNova-Storage-Mode", storageStatus.mode);
          return new Response(apiRes.body, {
            status: apiRes.status,
            statusText: apiRes.statusText,
            headers,
          });
        }
        return apiRes;
      }
      return Response.json(
        { error: "Unsupported API route or HTTP method." },
        { status: 404 }
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
