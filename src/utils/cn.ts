/** Join class names, dropping falsy ones. clsx in one line, no dependency. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
