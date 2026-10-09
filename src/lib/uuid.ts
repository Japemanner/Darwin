// RFC 4122 v4 UUID without external dependency.
export function randomUUID(): string {
  return crypto.randomUUID()
}