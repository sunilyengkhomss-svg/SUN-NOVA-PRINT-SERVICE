import { handleApiRequest } from "../../src/backend/apiRouter";
import { AppWorkerEnv } from "../../src/backend/d1Types";

interface PagesCatchAllContext {
  request: Request;
  env: AppWorkerEnv;
}

export async function onRequest(context: PagesCatchAllContext): Promise<Response> {
  const res = await handleApiRequest(context.request, context.env);
  if (res) return res;
  return Response.json({ error: "API route not found." }, { status: 404 });
}
