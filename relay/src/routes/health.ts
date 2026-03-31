import { Hono } from 'hono'

const health = new Hono()

health.get('/health', (c) => c.text('OK'))

export { health }
