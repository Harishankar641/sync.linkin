import { AppShell } from "../AppShell";
import { ResumeParser } from "./ResumeParser";

export default function CareerIntelligencePage() {
  return (
    <AppShell maxWidth="max-w-7xl">
      <ResumeParser />
    </AppShell>
  );
}
