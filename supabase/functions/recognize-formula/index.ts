import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type UnsupportedFormat = "wmf" | "emf" | "svg";

function jsonOk(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function splitDataUrl(input: string): { mime: string | null; base64: string } {
  if (!input.startsWith("data:")) return { mime: null, base64: input };
  const match = input.match(/^data:([^;,]+)?;base64,(.*)$/);
  if (!match) return { mime: null, base64: input };
  return {
    mime: match[1] ?? null,
    base64: match[2] ?? "",
  };
}

function decodeBase64Head(base64: string, bytesWanted = 96): Uint8Array {
  const clean = base64.replace(/\s/g, "");
  const charsNeeded = Math.ceil(bytesWanted / 3) * 4;
  const head = clean.slice(0, charsNeeded);
  const bin = atob(head);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sniffUnsupportedFormat(mime: string | null, base64: string): UnsupportedFormat | null {
  const m = (mime || "").toLowerCase();

  if (m.includes("image/svg") || m.includes("svg+xml")) return "svg";
  if (m.includes("wmf") || m.includes("x-wmf") || m.includes("msmetafile")) return "wmf";
  if (m.includes("emf") || m.includes("x-emf")) return "emf";

  // For octet-stream/unknown types, sniff magic bytes.
  try {
    const head = decodeBase64Head(base64, 128);

    // WMF placeable header: D7 CD C6 9A
    if (head.length >= 4 && head[0] === 0xd7 && head[1] === 0xcd && head[2] === 0xc6 && head[3] === 0x9a) {
      return "wmf";
    }

    // WMF standard header starts with WORD FileType (1 or 2) and WORD HeaderSize (9)
    if (
      head.length >= 4 &&
      (head[0] === 0x01 || head[0] === 0x02) &&
      head[1] === 0x00 &&
      head[2] === 0x09 &&
      head[3] === 0x00
    ) {
      return "wmf";
    }

    // EMF signature " EMF" (0x20 0x45 0x4D 0x46) appears in the header.
    for (let i = 0; i + 3 < head.length; i++) {
      if (head[i] === 0x20 && head[i + 1] === 0x45 && head[i + 2] === 0x4d && head[i + 3] === 0x46) {
        return "emf";
      }
    }
  } catch {
    // If sniffing fails, treat as unknown and allow downstream to try.
  }

  return null;
}

function sniffRasterMime(base64: string): string | null {
  try {
    const head = decodeBase64Head(base64, 32);

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      head.length >= 8 &&
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47 &&
      head[4] === 0x0d &&
      head[5] === 0x0a &&
      head[6] === 0x1a &&
      head[7] === 0x0a
    ) {
      return "image/png";
    }

    // JPEG: FF D8 FF
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
      return "image/jpeg";
    }

    // GIF: "GIF87a" / "GIF89a"
    if (
      head.length >= 6 &&
      head[0] === 0x47 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x38 &&
      (head[4] === 0x37 || head[4] === 0x39) &&
      head[5] === 0x61
    ) {
      return "image/gif";
    }

    // WebP: "RIFF" .... "WEBP"
    if (
      head.length >= 12 &&
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46 &&
      head[8] === 0x57 &&
      head[9] === 0x45 &&
      head[10] === 0x42 &&
      head[11] === 0x50
    ) {
      return "image/webp";
    }
  } catch {
    // ignore
  }

  return null;
}

function unsupportedMessage(format: UnsupportedFormat) {
  return `[UNSUPPORTED_FORMAT: ${format.toUpperCase()}]`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const imageBase64 = (body as { imageBase64?: unknown })?.imageBase64;

    if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
      return jsonOk({ latex: null, error: "MISSING_IMAGE_DATA" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonOk({ latex: null, error: "LOVABLE_API_KEY_NOT_CONFIGURED" });
    }

    const { mime, base64 } = splitDataUrl(imageBase64);
    const unsupported = sniffUnsupportedFormat(mime, base64);
    if (unsupported) {
      return jsonOk({ latex: null, error: unsupportedMessage(unsupported) });
    }

    const systemPrompt = `You are an expert at reading mathematical formulas from images and converting them to LaTeX code.

INSTRUCTIONS:
1. Carefully analyze the image containing a mathematical formula
2. Convert it to valid LaTeX code
3. Return ONLY the LaTeX code, no explanations or markdown formatting
4. Do not include \\begin{equation} or \\end{equation} wrappers
5. Use standard LaTeX math notation (\\frac, \\sqrt, \\sum, \\int, etc.)
6. If the image is unclear or doesn't contain a formula, return "ERROR: Unable to parse formula"

Examples of expected output:
- For a fraction: \\frac{x+1}{x-1}
- For an integral: \\int_{0}^{\\infty} e^{-x^2} dx
- For a sum: \\sum_{n=1}^{N} n^2`;

    // If a browser produced application/octet-stream (common for unknown blobs),
    // sniff the actual bytes and re-wrap as a supported raster MIME when possible.
    const effectiveMime = (() => {
      const m = (mime || "").toLowerCase();
      if (m && m.startsWith("image/") && !m.includes("octet-stream")) return mime;
      return sniffRasterMime(base64) || mime || "image/png";
    })();

    const imageUrl = imageBase64.startsWith("data:")
      ? `data:${effectiveMime};base64,${base64}`
      : `data:image/png;base64,${imageBase64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Convert the mathematical formula in this image to LaTeX code. Return only the LaTeX code, nothing else.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, errorText);
      return jsonOk({ latex: null, error: `AI_GATEWAY_ERROR:${response.status}` });
    }

    const data = await response.json().catch(() => ({}));
    const latex = (data as any)?.choices?.[0]?.message?.content?.trim?.() ?? "";

    return jsonOk({ latex });
  } catch (error) {
    console.error("Formula recognition error:", error);
    return jsonOk({
      latex: null,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
