interface PagesContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI Resume helper is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables.",
      },
      { status: 500 }
    );
  }

  let body: {
    task?: "polish_summary" | "suggest_bullets";
    jobTitle?: string;
    currentText?: string;
    role?: string;
    organization?: string;
  };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const prompt =
    body.task === "suggest_bullets"
      ? `Write 3 concise, high-impact resume bullet points (each starting with "• ") for a "${body.role || body.jobTitle || "Professional"}"${body.organization ? ` at "${body.organization}"` : ""}. Keep them realistic, action-oriented, and ready to paste into a resume. Do not include headings or explanations.${body.currentText ? `\n\nExisting notes/draft:\n${body.currentText}` : ""}`
      : `Polish and strengthen this resume professional summary for a "${body.jobTitle || "Professional"}" into 2–3 crisp, ATS-friendly sentences in third/implied first person without pronouns. Return only the polished summary text.${body.currentText ? `\n\nDraft:\n${body.currentText}` : ""}`;

  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to generate suggestion.";

  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "User-Agent": "aistudio-build",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };

      if (!res.ok) {
        lastErrMsg = data?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const text = (
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || ""
      ).trim();

      if (text) {
        return Response.json({ text });
      }
    } catch (err: unknown) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return Response.json({ error: lastErrMsg }, { status: 503 });
}
