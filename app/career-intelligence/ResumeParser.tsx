"use client";

import { useMemo, useState } from "react";

type Resume = {
  name: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  experience: { company: string; role: string; period: string; highlights: string[] }[];
  education: { institution: string; degree: string; period: string }[];
  keywords: string[];
};

const STOP = new Set(["and","the","for","with","from","that","this","your","you","our","are","will","into","have","has","their","they","using","work","years","role","team","job","jobs","about","looking"]);

function tokens(text: string) {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [])
      .filter(t => !STOP.has(t))
  );
}

function scoreJob(resume: Resume, job: string) {
  const a = tokens([
    resume.headline || "",
    resume.summary || "",
    resume.skills.join(" "),
    resume.keywords.join(" "),
    resume.experience.map(x => `${x.role} ${x.company} ${x.highlights.join(" ")}`).join(" ")
  ].join(" "));
  const b = tokens(job);
  if (!a.size || !b.size) return { score: 0, matches: [] as string[] };
  const matches = [...b].filter(x => a.has(x));
  const score = Math.min(99, Math.round((matches.length / Math.max(1, Math.min(b.size, 45))) * 100));
  return { score, matches: matches.slice(0, 18) };
}

export function ResumeParser() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobName, setJobName] = useState("Opportunity");
  const [fit, setFit] = useState<{score:number;matches:string[]}|null>(null);
  const [status, setStatus] = useState("");
  const [pastedResume, setPastedResume] = useState("");
  const [busy, setBusy] = useState(false);

  async function parse(file?: File) {
    setBusy(true); setStatus("Reading resume…"); setFit(null);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (!file && pastedResume.trim()) form.append("text", pastedResume.trim());
      const res = await fetch("/api/resume/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resume parsing failed.");
      setResume(data.parsed);
      setStatus(data.fallback ? "Parsed with local fallback. Review the fields before saving." : "Resume parsed and structured successfully.");
    } catch (e:any) {
      setStatus(e.message || "Could not parse the resume.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!resume) return;
    setStatus("Saving to your AI context…");
    const res = await fetch("/api/resume/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parsed: resume })
    });
    const data = await res.json();
    setStatus(res.ok ? "Saved. Your resume signals are now part of your SyncedIn context." : (data.error || "Save failed."));
  }

  const readiness = useMemo(() => {
    if (!resume) return 0;
    let n = 0;
    if (resume.name) n++;
    if (resume.headline) n++;
    if (resume.summary) n++;
    if (resume.skills.length) n++;
    if (resume.experience.length) n++;
    if (resume.education.length) n++;
    return Math.round((n / 6) * 100);
  }, [resume]);

  return (
    <div className="career-shell">
      <section className="career-hero">
        <div>
          <span className="premium-eyebrow">Resume intelligence</span>
          <h1>Turn your resume into a living career profile.</h1>
          <p>Upload a text-based PDF or paste your resume. SyncedIn extracts skills, experience, education, keywords, and a reusable professional summary.</p>
        </div>
        <div className="career-upload-wrap">
          <label className="career-upload">
            <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" onChange={e => e.target.files?.[0] && parse(e.target.files[0])} />
            <strong>{busy ? "Analyzing…" : "Choose resume"}</strong>
            <span>PDF, TXT, or MD · up to 8 MB</span>
          </label>
          <div className="career-paste">
            <textarea value={pastedResume} onChange={e => setPastedResume(e.target.value)} placeholder="Or paste your resume text here…" rows={4} />
            <button type="button" className="premium-secondary" disabled={busy || pastedResume.trim().length < 80} onClick={() => parse()}>{busy ? "Analyzing…" : "Parse pasted resume"}</button>
          </div>
        </div>
      </section>

      <div className="career-grid">
        <section className="career-card">
          <div className="career-card-head">
            <div><span className="premium-label">01 · Parsed profile</span><h2>Structured career signals</h2></div>
            {resume && <span className="career-score">{readiness}% ready</span>}
          </div>
          {!resume ? (
            <div className="career-empty">Upload your resume to see the parsed profile here.</div>
          ) : (
            <div className="career-profile">
              <div className="career-profile-title"><strong>{resume.name || "Profile name not detected"}</strong><span>{resume.headline || "Headline not detected"}</span></div>
              {resume.summary && <p>{resume.summary}</p>}
              <div className="career-section"><span className="premium-label">Skills</span><div className="career-tags">{resume.skills.map(s => <span key={s}>{s}</span>)}</div></div>
              <div className="career-section"><span className="premium-label">Experience</span>
                {resume.experience.length ? resume.experience.map((x,i) => <article key={i} className="career-item"><strong>{x.role}</strong><span>{x.company} · {x.period}</span>{x.highlights?.length > 0 && <p>{x.highlights.join(" · ")}</p>}</article>) : <div className="career-muted">No structured experience detected. Review the source text and retry if needed.</div>}
              </div>
              <div className="career-actions"><button className="premium-primary" onClick={save}>Save to AI context <span>✓</span></button></div>
            </div>
          )}
        </section>

        <section className="career-card">
          <div className="career-card-head"><div><span className="premium-label">02 · Job fair matching</span><h2>Compare an opportunity</h2></div></div>
          <p className="career-muted">Paste a job-fair listing, company role, or job description. Matching uses transparent content similarity between the parsed resume and the opportunity text.</p>
          <input className="retro-input" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Opportunity name" />
          <textarea className="retro-input career-job-text" value={jobText} onChange={e => setJobText(e.target.value)} placeholder="Paste the job description, required skills, or job-fair listing here…" />
          <button className="retro-btn retro-btn-primary" disabled={!resume || jobText.trim().length < 30} onClick={() => resume && setFit(scoreJob(resume, jobText))}>Calculate fit</button>
          {fit && (
            <div className="career-fit">
              <div className="career-fit-score"><strong>{fit.score}%</strong><span>content fit</span></div>
              <div><b>{jobName}</b><p>{fit.matches.length ? `Matched signals: ${fit.matches.join(", ")}` : "No strong shared keywords detected yet."}</p></div>
            </div>
          )}
        </section>
      </div>

      {status && <div className="career-status" role="status">{status}</div>}
    </div>
  );
}
