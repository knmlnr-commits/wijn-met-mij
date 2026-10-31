import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Rag } from "@/components/Rag";
import { RegulatoryClock } from "@/components/RegulatoryClock";
import { buildTimeline } from "@/lib/rules";
import { SEEDED_INSURERS } from "@/lib/rules/test-fixtures";

const timeline = (today: string, lifecycle = {}) =>
  buildTimeline({ receivedDate: "2026-06-01", profile: SEEDED_INSURERS["Lloyd's"], lifecycle, today });

describe("regulatory clock", () => {
  it("shows the five milestones with dd-mm-yyyy dates and the days left", () => {
    const html = renderToStaticMarkup(<RegulatoryClock timeline={timeline("2026-06-10", { acknowledgedDate: "2026-06-02" })} />);
    for (const label of ["Received", "Acknowledgement", "Day 3 summary", "Week 4 interim", "Final response deadline"]) expect(html).toContain(label);
    expect(html).toContain("27-07-2026");
    expect(html).toContain("47 days to the final response deadline");
    expect(html).toContain("--today:");
  });

  it("flags an overdue deadline and the FOS rights in the holding response", () => {
    const html = renderToStaticMarkup(<RegulatoryClock timeline={timeline("2026-07-30", { acknowledgedDate: "2026-06-02" })} />);
    expect(html).toContain("Final response deadline passed 3 days ago");
    expect(html).toContain("FOS referral rights");
    expect(html).toContain(">Red<");
  });
});

describe("RAG chip", () => {
  it("always carries the word, not colour alone", () => {
    expect(renderToStaticMarkup(<Rag value="amber" />)).toBe('<span class="rag rag-amber">Amber</span>');
  });
});
