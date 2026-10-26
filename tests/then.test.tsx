import { expect, test } from 'claude-code/testing'
import type { Mounted } from 'claude-code/testing'

const BAND = {
  plugin: 'then',
  component: 'AbovePrompt',
  requestId: 'band',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100 },
} as const


// the reply a turn ends on, with its <then> block, as Claude writes it
let reply = ''
const block = (opts: { title: string; detail?: string; usage?: string }[], suggested?: number) =>
  `Listo, quedó hecho.\n\n<then>\n${opts.map((o, i) => `${i + 1}${suggested === i + 1 ? '*' : ''}|${o.title}|${o.detail ?? ''}|${o.usage ?? ''}`).join('\n')}\n</then>`
// one step of the main loop answering with that reply, read through as the engine reads it
async function offer($: { turn: { step: (e: never) => AsyncGenerator<unknown, unknown> & { result: Promise<unknown> } } }, text: string) {
  reply = text
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)
  for await (const chunk of stream) void chunk
  await stream.result
}

const OPTIONS = [
  { title: 'Probar en el navegador', detail: 'abrir la pantalla y revisarla', usage: 'low' },
  { title: 'Commitear lo propio', detail: 'solo los archivos de esta sesión', usage: 'medium' },
  { title: 'Escribir el arnés', detail: 'un script que lo verifique solo' },
  { title: 'Dejarlo así' },
]

test('the band draws the four options and a typed pick reaches the model', { options: { language: 'español' } }, async ($, on) => {
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('tool.call', () => ({ result: 'engine' }))
  on('config.list', () => ({ value: [] }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS, 2))

  const ui = await $.ui.mount(BAND as never)
  expect((await ui.find({ type: 'Text', text: /Probar en el navegador/ }))?.text.trim()).toBe('Probar en el navegador')
  expect((await ui.findAll({ type: 'Button' })).length).toBe(5)
  // one star, on the suggested row; a meter on each option that says what it spends, blank on the others
  expect((await ui.findAll({ type: 'Text', text: /★ sugerida/ })).length).toBe(1)
  expect((await ui.find({ type: 'Button', key: 'opcion-btn-2' }))?.text).toContain('★ sugerida')
  expect((await ui.find({ type: 'Box', key: 'opcion-2' }))?.text).toContain('▮▮▯ medio')
  expect((await ui.find({ type: 'Box', key: 'opcion-1' }))?.text).toContain('▮▯▯ bajo')
  expect((await ui.find({ type: 'Box', key: 'opcion-4' }))?.text).not.toContain('▮')
  // each detail scrolls in a Client of its own, as wide as every other, so the columns line up
  expect((await ui.findAll({ type: 'Client' })).length).toBe(5)
  const widths = await Promise.all([1, 2, 3, 4, 5].map(async n => [...((await ui.find({ type: 'Box', key: `opcion-${n}` }))?.text ?? '')].length))
  expect(new Set(widths).size).toBe(1)
  // the meter column says what it is, and the band's own row 5 is there with no meter
  expect((await ui.find({ type: 'Text', text: /consumo/ }))?.text.trim()).toBe('consumo ▾')
  expect((await ui.find({ type: 'Button', key: 'opcion-btn-5' }))?.text).toContain('Otra cosa (libre)')
  await ui.unmount()

  const r = await $.prompt.submit({ text: 'quiero la 3 pero sin tests', wait: false, origin: { kind: 'composer' } } as never)
  const ctx = (r as { context?: readonly string[] }).context ?? []
  expect(ctx.join(' ')).toContain('option 3')
  expect(ctx.join(' ')).toContain('Escribir el arnés')
  expect(ctx.join(' ')).toContain('pero sin tests')

  // the offer is spent once the person answers
  const after = await $.ui.mount(BAND as never)
  expect(await after.find({ type: 'Text', text: /Probar/ })).toBe(undefined)
  await after.unmount()
})

test('a bare digit in the empty composer picks at once', { options: { language: 'español' } }, async ($, on) => {
  const sent: string[] = []
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('prompt.edit', (_, e) => ({ text: e.text + e.inputText, cursor: e.cursor + 1 }))
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'engine' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS))
  const ui = await $.ui.mount(BAND as never)

  // a digit inside a draft types as usual
  // the composer's edits, as the engine raises them; the testing $ does not type this call
  const edit = ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string }> }).edit
  const typed = await edit({ origin: { kind: 'composer' }, text: 'hola ', cursor: 5, start: 5, end: 5, inputText: '2' } as never)
  expect(typed.text).toBe('hola 2')

  const r = await edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: '2' } as never)
  expect(r.text).toBe('')
  // the pick is submitted after the key is consumed
  for (let i = 0; i < 50 && sent.length === 0; i++) await Promise.resolve()
  expect(sent[0]).toContain('Opción 2: Commitear lo propio')
  await ui.unmount()
})

test('row 5 is free: the band stays while the person writes their own', { options: { language: 'español' } }, async ($, on) => {
  const sent: { text: string; context?: readonly string[] }[] = []
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('prompt.submit', (_, e) => {
    sent.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  on('prompt.edit', (_, e) => ({ text: e.text + e.inputText, cursor: e.cursor + 1 }))
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'engine' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS))
  const ui = await $.ui.mount(BAND as never)
  const edit = ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string }> }).edit
  const key = (text: string, inputText: string) => edit({ origin: { kind: 'composer' }, text, cursor: text.length, start: text.length, end: text.length, inputText })

  expect((await key('', '5')).text).toBe('')
  for (let i = 0; i < 50; i++) await Promise.resolve()
  expect(sent.length).toBe(0)
  await ui.unmount()
  const again = await $.ui.mount(BAND as never)
  expect((await again.find({ type: 'Button', key: 'opcion-btn-5' }))?.text).toContain('Escribiendo')
  // once writing, a digit is a digit
  expect((await key('', '3')).text).toBe('3')
  await again.unmount()

  // typed with Enter, "5 …" is the free request
  await $.prompt.submit({ text: '5 mejor revisa los logs', wait: false, origin: { kind: 'composer' } } as never)
  expect(sent[0]?.context?.join(' ')).toContain('«mejor revisa los logs»')
})

const LONG = 'una descripción bastante larga que no entra entera en la columna del detalle y hay que leerla'

test('a long detail scrolls under the pointer and settles back when it leaves', async ($, on) => {
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'engine' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block([{ title: 'Larga', detail: LONG }, ...OPTIONS.slice(1)]))
  const ui = (await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 70 } } as never)) as unknown as Mounted<'terminal', 'AbovePrompt'>
  const key = 'detalle-1000-1'
  const shown = async () => (await ui.find({ type: 'Text', in: key }))?.text ?? ''

  const atRest = await shown()
  expect(atRest.trimEnd().endsWith('…')).toBe(true)
  await ui.pointer({ type: 'enter', x: 0, y: 0, in: key } as never)
  await ui.advance(140 * 6 + 140 * 10)
  const moved = await shown()
  expect(moved).not.toBe(atRest)
  expect(moved.startsWith(LONG.slice(10, 14))).toBe(true)
  await ui.pointer({ type: 'leave', x: 0, y: 0, in: key } as never)
  await ui.advance(140)
  expect(await shown()).toBe(atRest)
  await ui.unmount()
})

test('the color option paints the band', { options: { color: 'custom', customColor: '#D97757', language: 'english' } }, async ($, on) => {
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'engine' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS))
  const ui = await $.ui.mount(BAND as never)
  const pill = await ui.find({ type: 'Text', text: /^ 1 $/ })
  expect((pill as unknown as { props: { backgroundColor: string } }).props.backgroundColor).toBe('#d97757')
  // and the language option writes it in English
  expect(await ui.find({ type: 'Text', text: /What next\?/ })).not.toBe(undefined)
  expect((await ui.find({ type: 'Button', key: 'opcion-btn-5' }))?.text).toContain('Something else')
  await ui.unmount()
})

test('/then color changes the band at once, in either language', { options: { language: 'español' } }, async ($, on) => {
  const stored: Record<string, unknown> = {}
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('store.get', () => ({ value: undefined }))
  on('store.set', (_, e) => {
    stored[(e as { key: string }).key] = (e as { value: unknown }).value
    return { value: undefined }
  })
  on('store.delete', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'engine' }))
  on('command.run', () => ({ text: 'engine' }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS))
  const run = (args: string) => $.command.run({ command: 'then', args } as never) as Promise<{ text: string }>

  expect((await run('color')).text).toContain('Color de Then: azul')
  expect((await run('color morado')).text).toContain('violeta')
  expect(stored.color).toBe('violet')
  const ui = await $.ui.mount(BAND as never)
  const pill = await ui.find({ type: 'Text', text: /^ 1 $/ })
  expect((pill as unknown as { props: { backgroundColor: string } }).props.backgroundColor).toBe('#7858ca')
  await ui.unmount()
  expect((await run('color #ffcc00')).text).toContain('#ffcc00')
  expect((await run('color fucsia')).text).toContain('No conozco')
  expect((await run('color normal')).text).toContain('/config')
  expect((await run('lo que sea')).text).toContain('Uso: /then')
})

test('the reply is drawn without its block, and a turn with options chimes', { options: { language: 'español' } }, async ($, on) => {
  const played: string[] = []
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('turn.complete', () => ({ text: '' }))
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
  on('audio.play', (_, e) => {
    played.push((e as { asset: string }).asset)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    played.push(JSON.stringify(e))
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{(e.props as { text?: string }).text ?? ''}</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hola', turnId: 't1' } as never)
  await offer($, block(OPTIONS, 2))
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: reply } as never)
  expect(played.length).toBe(1)
  expect(played[0]).toContain('listo.wav')

  const msg = await $.ui.mount({ plugin: 'then', component: 'AssistantMessage', requestId: 'm1', surface: 'terminal', props: { text: block(OPTIONS, 2), isFirstOfReply: true } } as never)
  expect((await msg.find({ type: 'Text' }))?.text).toBe('Listo, quedó hecho.')
  await msg.unmount()
})

test('+ picks several: the rows mark as the numbers are typed, Enter sends them in order', { options: { language: 'español' } }, async ($, on) => {
  const sent: { text: string; context?: readonly string[] }[] = []
  const filled: string[] = []
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: reply, toolUses: [] }
  })
  on('prompt.submit', (_, e) => {
    sent.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  on('prompt.fill', (_, e) => {
    filled.push((e as { text: string }).text)
    return { isFilled: true, text: (e as { text: string }).text, cursor: 0 }
  })
  on('prompt.edit', (_, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($, block(OPTIONS, 2))
  const first = await $.ui.mount(BAND as never)
  await first.unmount()
  const edit = ($.prompt as unknown as { edit: (e: unknown) => Promise<{ text: string }> }).edit
  let draft = ''
  for (const ch of ['+', '4', ' ', '2']) {
    draft = (await edit({ origin: { kind: 'composer' }, text: draft, cursor: draft.length, start: draft.length, end: draft.length, inputText: ch })).text
  }
  // the digits were typed, not picked at once
  expect(draft).toBe('+4 2')
  expect(sent.length).toBe(0)
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ type: 'Text', text: /varias: escribe los números/ })).not.toBe(undefined)
  expect((await ui.find({ type: 'Box', key: 'opcion-4' }))?.text).toContain('✓')
  expect((await ui.find({ type: 'Box', key: 'opcion-2' }))?.text).toContain('✓')
  expect((await ui.find({ type: 'Box', key: 'opcion-1' }))?.text).not.toContain('✓')
  // a click on a row adds it to the draft
  await ui.press({ key: 'opcion-btn-3' } as never)
  expect(filled.at(-1)).toBe('+4 2 3')
  await ui.unmount()

  await $.prompt.submit({ text: draft, wait: false, origin: { kind: 'composer' } } as never)
  const ctx = sent[0]?.context?.join(' ') ?? ''
  expect(ctx).toContain('options 4 and 2, in that order')
  expect(ctx).toContain('Dejarlo así')
  expect(ctx).toContain('Commitear lo propio')
})
