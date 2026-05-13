import { headers } from 'next/headers'

// Reads user_id injected by middleware — avoids duplicate getUser() call
// Falls back to null if header not present (e.g. direct access without middleware)
export async function getUserIdFromHeader(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-user-id')
}

export async function getUserRoleFromHeader(): Promise<string> {
  const headersList = await headers()
  return headersList.get('x-user-role') ?? 'student'
}
