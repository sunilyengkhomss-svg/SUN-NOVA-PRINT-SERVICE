import { onRequestPost as handleChatPost } from "../functions/api/chat";
import { onRequestPost as handleOcrPost } from "../functions/api/ocr";
import { onRequestPost as handleResumeAssistPost } from "../functions/api/resume-assist";

interface WorkerEnv {
  GEMINI_API_KEY?: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

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
      return Response.json(
        { error: "Unsupported API route or HTTP method." },
        { status: 405 }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
