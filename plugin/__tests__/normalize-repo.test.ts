import { describe, test, expect } from 'bun:test'

/**
 * Copy of normalizeRepo from git-match.ts for unit testing purposes.
 * The original is not exported, so we replicate it here to verify its logic.
 */
function normalizeRepo(input: string): string {
  // Handle SSH: git@github.com:owner/repo.git
  let match = input.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
  if (match) return match[1]!.toLowerCase()

  // Handle HTTPS: https://github.com/owner/repo.git
  match = input.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
  if (match) return match[1]!.toLowerCase()

  // Already owner/repo format
  return input.toLowerCase()
}

describe('normalizeRepo', () => {
  test('SSH URL with .git suffix', () => {
    expect(normalizeRepo('git@github.com:owner/repo.git')).toBe('owner/repo')
  })

  test('SSH URL without .git suffix', () => {
    expect(normalizeRepo('git@github.com:owner/repo')).toBe('owner/repo')
  })

  test('HTTPS URL with .git suffix', () => {
    expect(normalizeRepo('https://github.com/owner/repo.git')).toBe('owner/repo')
  })

  test('HTTPS URL without .git suffix', () => {
    expect(normalizeRepo('https://github.com/owner/repo')).toBe('owner/repo')
  })

  test('already normalized owner/repo format', () => {
    expect(normalizeRepo('owner/repo')).toBe('owner/repo')
  })

  test('case insensitive - mixed case is lowercased', () => {
    expect(normalizeRepo('Owner/Repo')).toBe('owner/repo')
  })

  test('case insensitive - SSH URL with mixed case', () => {
    expect(normalizeRepo('git@github.com:Owner/Repo.git')).toBe('owner/repo')
  })

  test('case insensitive - HTTPS URL with mixed case', () => {
    expect(normalizeRepo('https://github.com/Owner/Repo.git')).toBe('owner/repo')
  })

  test('SSH URL with longer repo name', () => {
    expect(normalizeRepo('git@github.com:my-org/my-cool-repo.git')).toBe('my-org/my-cool-repo')
  })

  test('HTTPS URL with longer repo name', () => {
    expect(normalizeRepo('https://github.com/my-org/my-cool-repo')).toBe('my-org/my-cool-repo')
  })

  test('first regex handles both SSH colon and HTTPS slash', () => {
    // The first regex uses [:/] so it matches both SSH (colon) and HTTPS (slash)
    // This verifies that HTTPS URLs are also caught by the first regex
    const result = normalizeRepo('https://github.com/foo/bar.git')
    expect(result).toBe('foo/bar')
  })
})
