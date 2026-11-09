/**
 * Host half of the health-manager bundle.
 *
 * Owns the per-person data folders under `dataDir`, the `/health-manager/api`
 * route used by the panel, and the agent tools. Report recognition and advice
 * generation go through the live Harness `llm` service and the profile's
 * default model; nothing here needs an API key or a build step.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { HealthStore } from './host/store.js'
import { HealthAdvisor } from './host/llm.js'
import { createApiHandler } from './host/api.js'
import { registerHealthTools } from './host/tools.js'

/** Plugin name shown by the Loader. */
export const name = 'health-manager'

/**
 * Activate the plugin. Optional Host services are read through `ctx.get`, so a
 * profile without the web server or model service keeps the rest usable.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} [config] the row config from cordis.patch.yml
 */
export function apply(ctx, config) {
  const settings = config !== null && typeof config === 'object' ? config : {}
  const configuredDir = typeof settings.dataDir === 'string' ? settings.dataDir.trim() : ''
  const dataDir = configuredDir.length > 0 ? configuredDir : join(homedir(), '.dsh', 'health-manager')
  const store = new HealthStore(dataDir)
  const advisor = new HealthAdvisor({
    getLlm: () => ctx.get('llm'),
    getDefaultModel: () => ctx.get('agentDefaultModel'),
    getAttachments: () => ctx.get('attachments'),
    timeoutMs: () => (Number(settings.requestTimeoutMs) > 0 ? Number(settings.requestTimeoutMs) : 180_000),
    modelOverride: () => ({
      provider: typeof settings.provider === 'string' ? settings.provider : '',
      model: typeof settings.model === 'string' ? settings.model : '',
    }),
  })
  // The data root is created lazily; opening the panel or adding a member also
  // creates it, so a failure here is not fatal for tool-only use.
  void store.init().catch(() => {})

  const server = ctx.get('webServer')
  if (server !== undefined) {
    const handler = createApiHandler({ store, advisor, config: () => settings })
    ctx.effect(
      () => server.register({ kind: 'prefix', path: '/health-manager/api', handler }),
      'health-manager: api route',
    )
  }

  const tools = ctx.get('tools')
  if (tools !== undefined) {
    ctx.effect(() => registerHealthTools(ctx, tools, store, advisor), 'health-manager: tools')
  }
}
