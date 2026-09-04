// Tiny classnames joiner — keeps conditional Tailwind class lists readable
// without pulling in a dependency. Falsy parts are dropped.
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}
