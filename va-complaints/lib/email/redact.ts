/** j***@example.test: enough to trace a delivery, without the address itself. */
export function redactEmail(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
