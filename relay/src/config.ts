export interface RelayConfig {
  port: number
  databasePath: string
  sessionSecret: string
  githubClientId: string
  githubClientSecret: string
  publicUrl: string
}

export function loadConfig(): RelayConfig {
  const missing: string[] = []

  const env = (key: string, required = true): string => {
    const val = process.env[key]
    if (!val && required) missing.push(key)
    return val ?? ''
  }

  const config: RelayConfig = {
    port: parseInt(process.env.PORT ?? '3000', 10),
    databasePath: env('DATABASE_PATH'),
    sessionSecret: env('SESSION_SECRET'),
    githubClientId: env('GITHUB_CLIENT_ID'),
    githubClientSecret: env('GITHUB_CLIENT_SECRET'),
    publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`,
  }

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  return config
}
