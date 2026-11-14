interface PagesContext {
  request: Request;
  env: {
    GEMINI_API_KEY?: string;
  };
}

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

const SYSTEM_INSTRUCTION = `You are the official studio assistant for SUN-NOVA PRINT SERVICE, a 300 PPI browser-based passport photo maker, formal outfit studio, Aadhaar/PAN/Voter ID/DL Xerox sheet builder, PDF/Text converter, and Professional Resume Maker.

Key capabilities of SUN-NOVA PRINT SERVICE:
1. Passport & Exam Photo Presets (300 PPI with JFIF metadata): 1.2×1.5 in (360×450 px), India Passport 35×45 mm (413×531 px), Passport Seva 630×810 px, US Visa/OCI 2×2 in, PAN 25×35 mm, Custom Inch Size.
2. Print Sheet Layout & Multi-Photo Queue: 4×6, 5×7, 6×8, A5, A4 (2480×3508 px), uniform 0–5 mm gap, A4 1-Line (6 Different Photos), Undo & Redo controls.
3. Passport Dress Generator: Student, Officer, Men, Women, and Formal outfits with Size/X/Y adjustment.
4. Outline & Border Customization: Solid/Dashed/Dotted styles, 0–16 px width, Flush or Outer Cut Offset, custom color.
5. Aadhaar, PAN, Voter ID & DL Xerox Sheet: Front/Back via Upload, Camera, or Upload One & Crop Both, Side-by-Side / Up-Down / 2×2 Grid / Front Only, Custom mm size, B&W Xerox polish.
6. PDF & Text Converters: Photo to PDF, PDF to Photo (150–300 DPI), Text to Image, Image to Text (OCR).
7. Professional Resume Maker: Presets for Business, Teacher, Finance, IT, Healthcare, Sales, Student, and Custom roles with 4 templates, Undo/Redo, and 300 PPI PDF/JPG/PNG export.
8. Contact Policy: NEVER display or invent any phone number. All customer queries go strictly via Email.

Respond concisely, clearly, and practically in short paragraphs or bullet points.`;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI assistant is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables.",
      },
      { status: 500 }
    );
  }

  let body: { messages?: ChatTurn[]; studioContext?: string };
  try {
    body = (await context.request.json()) as {
      messages?: ChatTurn[];
      studioContext?: string;
    };
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validTurns = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string" &&
        m.text.trim().length > 0
    )
    .slice(-12);

  if (validTurns.length === 0 || validTurns[validTurns.length - 1].role !== "user") {
    return Response.json({ error: "Please enter a question to ask." }, { status: 400 });
  }

  const fullInstruction = body.studioContext
    ? `${SYSTEM_INSTRUCTION}\n\nCurrent User Studio State:\n${body.studioContext}`
    : SYSTEM_INSTRUCTION;

  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to get AI response.";

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
            systemInstruction: { parts: [{ text: fullInstruction }] },
            contents: validTurns.map((m) => ({
              role: m.role,
              parts: [{ text: m.text }],
            })),
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

      const reply = (
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") || ""
      ).trim();

      if (reply) {
        return Response.json({ reply });
      }
    } catch (err: unknown) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }

  return Response.json({ error: lastErrMsg }, { status: 503 });
}
