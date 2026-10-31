"use client";

export function PrintButton() {
  return (
    <button type="button" className="button-primary" onClick={() => window.print()}>
      Print
    </button>
  );
}
