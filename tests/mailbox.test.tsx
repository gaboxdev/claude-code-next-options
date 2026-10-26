import { expect, mock, test } from 'claude-code/testing'

import { mailboxOf } from '../hooks/register'

const OPTIONS = ['Probar en el navegador', 'Commitear lo propio', 'Escribir el arnés', 'Dejarlo así']
const REPLY = `Listo.\n\n<then>\n${OPTIONS.map((t, i) => `${i + 1}${i === 1 ? '*' : ''}|${t}|detalle ${i + 1}|low`).join('\n')}\n</then>`
const TRANSCRIPT = '/Users/ana/.claude/projects/-Users-ana-app/abc-123.jsonl'
const BASE = '/Users/ana/.claude/then/abc-123'

async function offer($: { turn: { step: (e: never) => AsyncGenerator<unknown, unknown> & { result: Promise<unknown> } } }) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)
  for await (const chunk of stream) void chunk
  await stream.result
}

test('the mailbox sits beside the transcript config dir', async () => {
  expect(mailboxOf(TRANSCRIPT, 'abc-123')).toBe(BASE)
  expect(mailboxOf('C:\\Users\\ana\\.claude\\projects\\x\\abc.jsonl', 'abc')).toBe('C:\\Users\\ana\\.claude/then/abc')
  expect(mailboxOf('/tmp/no-config.jsonl', 'abc')).toBeNull()
  expect(mailboxOf(TRANSCRIPT, '../../etc')).toBeNull()
})

test('a turn sent back for its options is not heard as a stop by the hooks beneath', { options: { language: 'español' } }, async ($, on) => {
  let heard = 0
  on('classic.Stop', () => {
    heard += 1
    return {}
  })
  on('store.get', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'engine' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  const first = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Hecho.' } as never)
  expect(String(first.block)).toContain('<then>')
  expect(heard).toBe(0)

  // the reply that comes back is a real stop, heard once
  await $.classic.Stop({ stop_hook_active: true, last_assistant_message: 'Hecho.' } as never)
  expect(heard).toBe(1)
})

test('a turn that ends with options writes them to the mailbox, and a pick there is sent', { options: { language: 'español' } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const files: Record<string, string> = {}
  let offerAtStop: string | undefined
  const sent: string[] = []
  on('fs.write', (_, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('fs.read', (_, e) => {
    if (!(e.path in files)) throw new Error('ENOENT')
    return { value: files[e.path] }
  })
  on('classic.Stop', () => {
    offerAtStop = files[`${BASE}.offer.json`]
    return {}
  })
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: REPLY, toolUses: [] }
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('store.get', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($)
  await $.classic.Stop({ stop_hook_active: false, transcript_path: TRANSCRIPT, session_id: 'abc-123', last_assistant_message: REPLY } as never)

  // written before the hooks beneath heard the stop
  const published = JSON.parse(offerAtStop ?? '{}')
  expect(published.id).toBe(1000)
  expect(published.suggested).toBe(2)
  expect(published.options.map((o: { title: string }) => o.title)).toEqual(OPTIONS)

  // a pick for another offer is left alone
  files[`${BASE}.pick.json`] = JSON.stringify({ id: 999, pick: 3 })
  await clock.advance(600)
  expect(sent).toEqual([])

  files[`${BASE}.pick.json`] = JSON.stringify({ id: 1000, pick: 3 })
  await clock.advance(600)
  expect(sent).toEqual(['Opción 3: Escribir el arnés — detalle 3'])
  // the offer is gone from the mailbox once picked, and the watch stops with it
  expect(JSON.parse(files[`${BASE}.offer.json`] ?? '{}').id).toBeNull()
  await clock.advance(2000)
  expect(sent.length).toBe(1)
})

// the bare session a Stop test needs: no offer stored, the mod on
function bareSession(on: (name: never, fn: never) => void) {
  on('store.get' as never, (() => ({ value: undefined })) as never)
  on('config.list' as never, (() => ({ value: [] })) as never)
  on('command.register' as never, (() => ({ value: { command: 'then' } })) as never)
  on('session.start' as never, ((_: unknown, e: { cwd: string }) => ({ cwd: e.cwd })) as never)
  on('tool.call' as never, (() => ({ result: 'engine' })) as never)
  on('turn.start' as never, ((_: unknown, e: { turnId: string }) => ({ turnId: e.turnId })) as never)
  // what answers a stop the mod lets through
  on('classic.Stop' as never, (() => ({})) as never)
}

test('work still running in the background does not excuse a turn from its options', { options: { language: 'español' } }, async ($, on) => {
  bareSession(on as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm run typecheck' } as never)
  const stop = await $.classic.Stop({
    stop_hook_active: false,
    last_assistant_message: 'El typecheck sigue corriendo; te aviso cuando termine.',
    background_tasks: [{ id: 'b1' }],
  } as never)
  expect(String(stop.block)).toContain('<then>')
})

test('a reply with no tools is sent back too, but a question and an empty stop are not', { options: { language: 'español' } }, async ($, on) => {
  bareSession(on as never)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't1' } as never)
  const answered = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Fue error mío.' } as never)
  expect(String(answered.block)).toContain('<then>')

  await $.turn.start({ turnId: 't2' } as never)
  const asked = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: '¿Cuál preferís?' } as never)
  expect(asked.block).toBeUndefined()

  await $.turn.start({ turnId: 't3' } as never)
  const empty = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: '' } as never)
  expect(empty.block).toBeUndefined()
})
