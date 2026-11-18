import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { handleApiRequest } from "./src/backend/apiRouter";
import { getLocalAdapters } from "./src/backend/localAdapters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

const SYSTEM_INSTRUCTION = `You are the official studio assistant for SUN-NOVA PRINT SERVICE, a 300 PPI browser-based passport photo maker, formal outfit studio, and Aadhaar/PAN/Voter ID/DL Xerox sheet builder.

Key capabilities of SUN-NOVA PRINT SERVICE you can help users with:
1. Passport & Exam Photo Presets (all at true 300 PPI with JFIF metadata):
   - 1.2 × 1.5 inch (360 × 450 px) — standard local & shop passport size (fits 42 on A4, 9 on 4×6 with 3mm gap).
   - India Passport / Visa: 35 × 45 mm (413 × 531 px).
   - Passport Seva Digital: 630 × 810 px.
   - US Visa / OCI Card: 2 × 2 inch (600 × 600 px).
   - PAN Card (NSDL / UTIITSL): 25 × 35 mm (295 × 413 px).
   - Custom Inch Size: 0.5–6 in × 0.5–8 in.
2. Print Sheet Layout & Multi-Photo Queue:
   - Paper sizes: 4×6, 5×7, 6×8, A5, and A4 (2480 × 3508 px).
   - Uniform gap (0, 2, 3, 4, 5 mm) applied equally horizontally and vertically.
   - Quick row buttons: All, 1 Line (6 on A4), 2 Lines (12 on A4), Custom count, Add 1/2/3 Rows.
   - A4 1-Line (6 Different Photos): Use "A4 1-Line (6 Different)" + "+ Upload Multiple Photos" to place up to 6 different people in a single row.
3. Passport Dress Generator (On-Device High-Detail Outfits):
   - Categories for Student (School/College White Shirt & Tie, Navy Blazer & Crest Tie, Academic Graduation Gown), Officers & Govt (Khaki Police/Officer Uniform, IAS/Civil Charcoal Suit, Defence White Ceremonial Coat, Doctor White Coat), Men (Executive Black Suit, Navy Blazer, White Shirt), Women (Tailored Black Blazer, Navy Suit), and Formal Bandhgala / Nehru Coat.
   - Users can adjust Size, Move X, and Move Y sliders right inside the crop frame.
4. Outline & Border Customization:
   - Solid, Dashed, or Dotted cut outlines, 0–16 px thickness, flush or outer cut offset (+2 to +12 px), custom color, and optional Single Photo border.
5. Aadhaar, PAN, Voter ID & DL Xerox Sheet (A4 / 4×6):
   - Front Side & Back Side via Upload, Camera Click, or "Upload One & Crop Both" (crop Front and Back from a single photo or E-Aadhaar scan).
   - Arrangements: Side-by-Side, Up / Down (Front top, Back bottom), 2×2 Grid, and Front Only, plus Top/Mid/Bottom sheet anchor, 85.6×54 mm CR80 or Custom mm Document Size Maker, and B&W Xerox / Grayscale / Full Color polish.
6. PDF, XML & Text Converters Tab:
   - Photo to PDF: Combine multiple JPG/PNG/WEBP/Camera photos into a multi-page A4, Letter, 4×6, or Fit-to-Image PDF.
   - PDF to Photo: Convert PDF pages into 150–300 DPI JPG or PNG images and optionally run OCR on any page.
   - Text to Image: Render formatted notices, quotes, bio-data, or notes into custom PNG or 300 PPI JPG images.
   - Image to Text (OCR): Extract printed or handwritten text, ID card details, or tables from photos and scans into editable, copyable .txt output.
   - XML File Converter: Validate and convert XML files to JSON, CSV, formatted/pretty XML, minified XML, or plain text, and convert JSON/CSV back to XML.
7. Professional Resume Maker & Undo/Redo:
   - Role-ready presets for Business & Management, Teacher & Educator, Accountant & Finance, Software & IT, Healthcare, Sales, Fresh Graduate, and Custom/Any Profession.
   - 4 templates (Executive Classic, Modern Sidebar, Teacher & Academic CV, ATS Compact), custom accent colors, fonts, optional photo upload/camera click, reorderable/renamable sections, optional AI Summary Polish & Bullet Suggestions, and 300 PPI PDF / JPG / PNG download.
   - Full Undo & Redo controls (and Ctrl+Z / Ctrl+Y shortcuts) in both Passport Photo Studio and Resume Maker.
8. Privacy, KB Compression & Contact:
   - All photo & PDF processing stays on the user's device (OCR and optional Resume Polish send only the requested snippet).
   - Binary-search KB target exports (<20 KB, <50 KB, <100 KB, <200 KB) and Name + DOP strip for SSC/UPSC/Govt exams.
   - NEVER display or invent any phone number. All customer queries and print requests go strictly via Email (the Mail Query button / configured Print Desk Email).

Respond concisely, clearly, and practically in short paragraphs or bullet points.`;

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

async function startServer() {
  const app = express();
  const { db: localDb, bucket: localBucket } = getLocalAdapters(__dirname);
  const jsonParser = express.json({ limit: "12mb" });

  app.post("/api/chat", jsonParser, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          "AI assistant is not configured yet. Please check GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    const { messages, studioContext } = req.body as {
      messages?: ChatTurn[];
      studioContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Please enter a question to ask." });
      return;
    }

    const validTurns = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "model") &&
          typeof m.text === "string" &&
          m.text.trim().length > 0
      )
      .slice(-12);

    const lastTurn = validTurns[validTurns.length - 1];
    if (!lastTurn || lastTurn.role !== "user") {
      res.status(400).json({ error: "Latest message must be from user." });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const historyTurns = validTurns.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const fullInstruction = studioContext
        ? `${SYSTEM_INSTRUCTION}\n\nCurrent User Studio State:\n${studioContext}`
        : SYSTEM_INSTRUCTION;

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let reply = "";
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const chat = ai.chats.create({
              model: modelName,
              history: historyTurns,
              config: {
                systemInstruction: fullInstruction,
              },
            });
            const response = await chat.sendMessage({
              message: lastTurn.text,
            });
            reply = (response.text || "").trim();
            if (reply) break;
          } catch (attemptErr: unknown) {
            lastError = attemptErr;
            const errText =
              attemptErr instanceof Error
                ? attemptErr.message
                : String(attemptErr);
            const isTransient =
              errText.includes("503") ||
              errText.includes("UNAVAILABLE") ||
              errText.includes("429");
            if (!isTransient) break;
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
        if (reply) break;
      }

      if (!reply && lastError) {
        throw lastError;
      }

      res.json({
        reply:
          reply ||
          "I am ready to help with SUN-NOVA PRINT SERVICE photo sizes, outfits, or Aadhaar/PAN Xerox sheets.",
      });
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error ? err.message : "Failed to get AI response.";
      let friendlyMsg = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: { message?: string } };
        if (parsed?.error?.message) {
          friendlyMsg = parsed.error.message;
        }
      } catch {
        // Keep rawMsg when not JSON
      }
      console.error("Gemini chat error:", err);
      res.status(503).json({ error: friendlyMsg });
    }
  });

  app.post("/api/ocr", jsonParser, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          "OCR service is not configured yet. Please check GEMINI_API_KEY in Settings > Secrets.",
      });
      return;
    }

    const { imageBase64, mimeType, mode } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      mode?: "plain" | "paragraph" | "id_card" | "table";
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "Please upload an image first." });
      return;
    }

    const safeMime =
      typeof mimeType === "string" && mimeType.startsWith("image/")
        ? mimeType
        : "image/jpeg";

    const modeInstruction =
      mode === "paragraph"
        ? "Extract all text from this image as clean, readable paragraphs. Fix obvious OCR line breaks without changing wording."
        : mode === "id_card"
        ? "Extract all visible text, numbers, names, dates, and addresses from this document or ID card cleanly as labeled key-value lines."
        : mode === "table"
        ? "Extract all text and tabular rows from this image cleanly, preserving columns separated by ' | ' or Markdown table formatting."
        : "Transcribe all text visible in this image accurately, preserving line breaks and reading order. Return only the extracted text without commentary.";

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let extractedText = "";
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: safeMime,
                      data: imageBase64,
                    },
                  },
                  {
                    text: modeInstruction,
                  },
                ],
              },
            });
            extractedText = (response.text || "").trim();
            if (extractedText) break;
          } catch (attemptErr: unknown) {
            lastError = attemptErr;
            const errText =
              attemptErr instanceof Error
                ? attemptErr.message
                : String(attemptErr);
            const isTransient =
              errText.includes("503") ||
              errText.includes("UNAVAILABLE") ||
              errText.includes("429");
            if (!isTransient) break;
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
        if (extractedText) break;
      }

      if (!extractedText && lastError) {
        throw lastError;
      }

      res.json({
        text: extractedText || "No readable text detected in this image.",
      });
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error ? err.message : "Failed to extract text.";
      let friendlyMsg = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: { message?: string } };
        if (parsed?.error?.message) {
          friendlyMsg = parsed.error.message;
        }
      } catch {
        // Keep rawMsg when not JSON
      }
      console.error("Gemini OCR error:", err);
      res.status(503).json({ error: friendlyMsg });
    }
  });

  app.post("/api/resume-assist", jsonParser, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error:
          "AI Resume helper is not configured yet. You can still edit all resume fields directly.",
      });
      return;
    }

    const { task, jobTitle, currentText, role, organization } = req.body as {
      task?: "polish_summary" | "suggest_bullets";
      jobTitle?: string;
      currentText?: string;
      role?: string;
      organization?: string;
    };

    const prompt =
      task === "suggest_bullets"
        ? `Write 3 concise, high-impact resume bullet points (each starting with "• ") for a "${role || jobTitle || "Professional"}"${organization ? ` at "${organization}"` : ""}. Keep them realistic, action-oriented, and ready to paste into a resume. Do not include headings or explanations.${currentText ? `\n\nExisting notes/draft:\n${currentText}` : ""}`
        : `Polish and strengthen this resume professional summary for a "${jobTitle || "Professional"}" into 2–3 crisp, ATS-friendly sentences in third/implied first person without pronouns. Return only the polished summary text.${currentText ? `\n\nDraft:\n${currentText}` : ""}`;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let output = "";
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
            });
            output = (response.text || "").trim();
            if (output) break;
          } catch (attemptErr: unknown) {
            lastError = attemptErr;
            const errText =
              attemptErr instanceof Error
                ? attemptErr.message
                : String(attemptErr);
            const isTransient =
              errText.includes("503") ||
              errText.includes("UNAVAILABLE") ||
              errText.includes("429");
            if (!isTransient) break;
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
        if (output) break;
      }

      if (!output && lastError) {
        throw lastError;
      }

      res.json({ text: output });
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error ? err.message : "Failed to generate suggestion.";
      let friendlyMsg = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: { message?: string } };
        if (parsed?.error?.message) {
          friendlyMsg = parsed.error.message;
        }
      } catch {
        // Keep rawMsg
      }
      console.error("Gemini resume assist error:", err);
      res.status(503).json({ error: friendlyMsg });
    }
  });

  // Unified D1/R2 Backend API Router for CMS, Admin, Media, Quotes & Messages
  app.use(async (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    try {
      const protocol = req.protocol || "http";
      const host = req.get("host") || `localhost:${PORT}`;
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(", "));
      }

      let bodyBytes: Uint8Array | undefined;
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Buffer[] = [];
        let total = 0;
        const maxBody = 110 * 1024 * 1024;
        for await (const chunk of req) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buf.length;
          if (total > maxBody) {
            res.status(413).json({ error: "Payload exceeds maximum upload size." });
            return;
          }
          chunks.push(buf);
        }
        if (chunks.length > 0) {
          bodyBytes = new Uint8Array(Buffer.concat(chunks));
        }
      }

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body: bodyBytes ? (bodyBytes as unknown as BodyInit) : undefined,
      });

      const apiRes = await handleApiRequest(webReq, {
        DB: localDb,
        MEDIA_BUCKET: localBucket,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        ADMIN_SETUP_TOKEN: process.env.ADMIN_SETUP_TOKEN,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        EMAIL_FROM: process.env.EMAIL_FROM,
      });

      if (!apiRes) return next();

      res.status(apiRes.status);
      apiRes.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          const existing = res.getHeader("set-cookie");
          if (existing) {
            const arr = Array.isArray(existing) ? existing : [String(existing)];
            res.setHeader("set-cookie", [...arr, value]);
          } else {
            res.setHeader("set-cookie", value);
          }
        } else {
          res.setHeader(key, value);
        }
      });

      if (apiRes.body) {
        const arrayBuf = await apiRes.arrayBuffer();
        res.send(Buffer.from(arrayBuf));
      } else {
        res.end();
      }
    } catch (err) {
      next(err);
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SUN-NOVA PRINT SERVICE server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
