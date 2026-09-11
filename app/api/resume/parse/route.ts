import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type ParsedResume = {
  name: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  experience: {
    company: string;
    role: string;
    period: string;
    highlights: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    period: string;
  }[];
  keywords: string[];
};

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const form = await req.formData();

  const file = form.get("file");
  const pasted = String(form.get("text") || "").trim();

  let text = pasted;

  if (file instanceof File) {
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Resume must be 8 MB or smaller.",
        },
        { status: 400 }
      );
    }

    const type = file.type.toLowerCase();

    if (
      type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      const bytes = new Uint8Array(await file.arrayBuffer());

      text = await extractPdfText(bytes);

      console.log(
        "PDF extracted characters:",
        text.length
      );

      console.log(
        "PDF extracted text:",
        text.slice(0, 1000)
      );
    } else if (
      type.startsWith("text/") ||
      /\.(txt|md|csv)$/i.test(file.name)
    ) {
      text = await file.text();
    } else {
      return NextResponse.json(
        {
          error:
            "Use a PDF, TXT, MD, or paste the resume content. DOCX parsing is not enabled in this build.",
        },
        { status: 400 }
      );
    }
  }

  text = normalize(text).slice(0, 30000);

  if (text.length < 80) {
    return NextResponse.json(
      {
        error:
          "I could not read enough resume text. Try a text-based PDF or paste the resume content.",
      },
      { status: 400 }
    );
  }

  /*
   * No AI/Anthropic is used here.
   * Resume information is extracted using rule-based parsing.
   */
  const parsed = heuristicParse(text);

  return NextResponse.json({
    parsed: sanitize(parsed),
    source_chars: text.length,
  });
}

function normalize(input: string): string {
  return input
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract text from PDF using pdf-parse@2.4.5.
 */
async function extractPdfText(
  bytes: Uint8Array
): Promise<string> {
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({
    data: bytes,
  });

  try {
    const result = await parser.getText();

    return normalize(result.text || "");
  } finally {
    await parser.destroy();
  }
}

/**
 * Basic rule-based resume parser.
 *
 * No Anthropic or other AI API is used.
 */
function heuristicParse(
  text: string
): ParsedResume {
  const lines = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const first = lines[0] || null;

  const skillBank = [
    "python",
    "java",
    "javascript",
    "typescript",
    "sql",
    "excel",
    "power bi",
    "tableau",
    "machine learning",
    "deep learning",
    "pytorch",
    "tensorflow",
    "scikit-learn",
    "react",
    "next.js",
    "node.js",
    "flask",
    "fastapi",
    "aws",
    "gcp",
    "azure",
    "bigquery",
    "git",
    "docker",
    "data analytics",
    "data visualization",
    "statistics",
  ];

  const lower = text.toLowerCase();

  const skills = skillBank.filter((skill) =>
    lower.includes(skill)
  );

  const keywords = Array.from(
    new Set(
      text.toLowerCase().match(
        /[a-z][a-z0-9+#.-]{3,}/g
      ) || []
    )
  )
    .filter(
      (word) =>
        ![
          "with",
          "from",
          "that",
          "this",
          "have",
          "your",
          "using",
          "work",
          "worked",
        ].includes(word)
    )
    .slice(0, 35);

  const headline =
    lines.find((line) =>
      /data|software|developer|analyst|engineer|student/i.test(
        line
      )
    ) || null;

  const summary =
    lines
      .slice(1, 4)
      .join(" ")
      .slice(0, 500) || null;

  return {
    name:
      first && first.length < 70
        ? first
        : null,

    headline,

    summary,

    skills,

    experience: [],

    education: [],

    keywords,
  };
}

function sanitize(
  p: ParsedResume
): ParsedResume {
  return {
    name: p.name || null,

    headline: p.headline || null,

    summary: p.summary || null,

    skills: Array.isArray(p.skills)
      ? p.skills
          .filter(Boolean)
          .slice(0, 60)
      : [],

    experience: Array.isArray(p.experience)
      ? p.experience.slice(0, 15)
      : [],

    education: Array.isArray(p.education)
      ? p.education.slice(0, 10)
      : [],

    keywords: Array.isArray(p.keywords)
      ? Array.from(
          new Set(
            p.keywords.filter(Boolean)
          )
        ).slice(0, 60)
      : [],
  };
}