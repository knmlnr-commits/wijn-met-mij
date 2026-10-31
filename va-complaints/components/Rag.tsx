import type { Rag as RagValue } from "@/lib/rules";

const LABELS: Record<RagValue, string> = { red: "Red", amber: "Amber", green: "Green" };

/** RAG status chip; always shows the word, never colour alone. */
export function Rag({ value }: { value: RagValue }) {
  return <span className={`rag rag-${value}`}>{LABELS[value]}</span>;
}
