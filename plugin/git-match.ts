import { $ } from 'bun'

let cachedRepo: string | null = null

export async function matchesLocalRepo(eventRepo: string, eventSha: string): Promise<boolean> {
  try {
    const localSha = (await $`git rev-parse HEAD`.text()).trim()
    if (localSha !== eventSha) return false

    const localRepo = await getLocalRepo()
    if (!localRepo) return false

    return normalizeRepo(localRepo) === normalizeRepo(eventRepo)
  } catch {
    return false
  }
}

async function getLocalRepo(): Promise<string | null> {
  if (cachedRepo) return cachedRepo
  try {
    const url = (await $`git config --get remote.origin.url`.text()).trim()
    cachedRepo = normalizeRepo(url)
    return cachedRepo
  } catch {
    return null
  }
}

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
