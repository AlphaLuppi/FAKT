/** Concatène des classes CSS en ignorant les valeurs falsy. */
export function classNames(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(" ");
}
