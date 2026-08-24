import { TarpitManager } from './TarpitManager'

describe('TarpitManager', () => {
  let manager: TarpitManager

  beforeEach(() => {
    manager = new TarpitManager()
  })

  it('allows normal traffic with zero delay when disabled or within limits', () => {
    const resDisabled = manager.evaluate('agent-1', { enabled: false })
    expect(resDisabled.delayMs).toBe(0)
    expect(resDisabled.isThrottled).toBe(false)

    const resNormal = manager.evaluate('agent-1', {
      enabled: true,
      maxRequestsPerMinute: 10,
      burst: 5,
      delayMs: 500
    })
    expect(resNormal.delayMs).toBe(0)
    expect(resNormal.isThrottled).toBe(false)
  })

  it('triggers progressive tarpitting delay when burst limit is exceeded', () => {
    const config = {
      enabled: true,
      burst: 3,
      maxRequestsPerMinute: 10,
      delayMs: 200
    }

    // 1 to 3 requests -> OK
    manager.evaluate('agent-2', config)
    manager.evaluate('agent-2', config)
    const res3 = manager.evaluate('agent-2', config)
    expect(res3.isThrottled).toBe(false)

    // 4th request -> Tarpit triggered (multiplier 1)
    const res4 = manager.evaluate('agent-2', config)
    expect(res4.isThrottled).toBe(true)
    expect(res4.delayMs).toBe(200)

    // 5th request -> Progressive multiplier 2
    const res5 = manager.evaluate('agent-2', config)
    expect(res5.isThrottled).toBe(true)
    expect(res5.delayMs).toBe(400)
  })

  it('triggers temporary blocking when repeated violations occur and blockDurationMs is configured', () => {
    const config = {
      enabled: true,
      burst: 1,
      maxRequestsPerMinute: 2,
      delayMs: 100,
      blockDurationMs: 5000
    }

    manager.evaluate('bad-bot', config) // 1 -> ok
    manager.evaluate('bad-bot', config) // 2 -> violation 1
    manager.evaluate('bad-bot', config) // 3 -> violation 2
    manager.evaluate('bad-bot', config) // 4 -> violation 3
    manager.evaluate('bad-bot', config) // 5 -> violation 4
    const resBlock = manager.evaluate('bad-bot', config) // 6 -> violation 5 => Blocked

    expect(resBlock.isThrottled).toBe(true)
    expect(resBlock.isBlocked).toBe(true)

    // Subsequent request while blocked
    const resWhileBlocked = manager.evaluate('bad-bot', config)
    expect(resWhileBlocked.isBlocked).toBe(true)
  })

  it('cleans history on reset', () => {
    const config = { enabled: true, burst: 1, delayMs: 100 }
    manager.evaluate('agent-3', config)
    manager.evaluate('agent-3', config) // Throttled

    manager.reset('agent-3')
    const fresh = manager.evaluate('agent-3', config)
    expect(fresh.isThrottled).toBe(false)
  })

  it('sleep executes without throwing', async () => {
    const start = Date.now()
    await manager.sleep(10)
    expect(Date.now() - start).toBeGreaterThanOrEqual(8)
  })
})
