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
          "OCR service is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables.",
      },
      { status: 500 }
    );
  }

  let body: {
    imageBase64?: string;
    mimeType?: string;
    mode?: "plain" | "paragraph" | "id_card" | "table";
  };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return Response.json({ error: "Please upload an image first." }, { status: 400 });
  }

  const safeMime =
    typeof body.mimeType === "string" && body.mimeType.startsWith("image/")
      ? body.mimeType
      : "image/jpeg";

  const modeInstruction =
    body.mode === "paragraph"
      ? "Extract all text from this image as clean, readable paragraphs. Fix obvious OCR line breaks without changing wording."
      : body.mode === "id_card"
      ? "Extract all visible text, numbers, names, dates, and addresses from this document or ID card cleanly as labeled key-value lines."
      : body.mode === "table"
      ? "Extract all text and tabular rows from this image cleanly, preserving columns separated by ' | ' or Markdown table formatting."
      : "Transcribe all text visible in this image accurately, preserving line breaks and reading order. Return only the extracted text without commentary.";

  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to extract text.";

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
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: safeMime,
                      data: body.imageBase64,
                    },
                  },
                  { text: modeInstruction },
                ],
              },
            ],
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

      return Response.json({
        text: text || "No readable text detected in this image.",
      });
    } catch (err: unknown) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return Response.json({ error: lastErrMsg }, { status: 503 });
}
