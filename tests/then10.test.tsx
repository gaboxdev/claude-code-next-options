import { expect, test } from 'claude-code/testing'

import { ringStop } from '../hooks/register'

const REPLY = `Listo.

<then>
1|Correr las pruebas|que nada falle|low
2*|Subir mis cambios|solo lo mío|med
3|Escribir un chequeo|en cada push|high
4|Dejarlo así|no falta nada|none
</then>`

const BAND = { plugin: 'then', component: 'AbovePrompt', requestId: 'band', surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100 } } as const

function engine(on: Parameters<Parameters<typeof test>[2] extends (...a: infer A) => unknown ? (...a: A) => unknown : never>[1] | any, extra: (on: any) => void = () => {}) {
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_: unknown, e: { turnId: string; index: number }) {
    return { turnId: e.turnId, index: e.index, answer: REPLY, toolUses: [] }
  })
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('command.run', () => ({ text: 'engine' }))
  extra(on)
}

// the ring moving onto a row as the person moves it, in the shape the engine raises ui.focus with
const focusRow = ($: any, n: number) =>
  $.ui.focus({ component: 'AbovePrompt', requestId: 'band', plugin: 'then', element: `opcion-btn-${n}`, origin: { kind: 'person' } })

async function offer($: any) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })
  for await (const chunk of stream) void chunk
  await stream.result
}

test('the ring makes one stop a row: down lands on the next row, up on the one above', () => {
  // moving down from row 2 meets row 3's box first
  expect(ringStop('casilla-3', 'opcion-btn-2')).toBe('opcion-btn-3')
  // moving up from row 3 meets its own box first
  expect(ringStop('casilla-3', 'opcion-btn-3')).toBe('opcion-btn-2')
  expect(ringStop('casilla-1', 'opcion-btn-1')).toBe('opcion-btn-1')
  expect(ringStop('opcion-btn-4', 'opcion-btn-3')).toBe('opcion-btn-4')
})

test('keyboard: with the ring on a row, x ticks it and e sends the ticked rows', { options: { language: 'español' } }, async ($, on) => {
  const sent: string[] = []
  const filled: string[] = []
  engine(on, o => {
    o('prompt.submit', (_: unknown, e: { text: string }) => {
      sent.push(e.text)
      return { text: e.text }
    })
    o('prompt.fill', (_: unknown, e: { text: string }) => {
      filled.push(e.text)
      return { isFilled: true, text: e.text, cursor: 0 }
    })
    o('ui.focus', () => ({}))
    o('ui.render', ($$: any, e: any) => {
      const { Box } = $$.ui.resolve(e)
      return <Box />
    })
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($)
  const ui = await $.ui.mount(BAND as never)
  // the suggested row takes the ring first
  const row2 = await ui.find({ type: 'Button', key: 'opcion-btn-2' })
  expect((row2 as unknown as { props: { autoFocus?: boolean } }).props.autoFocus).toBe(true)

  // the ring moves onto row 3 while the band is drawn: the header turns into the keys, x ticks row 3
  await focusRow($, 3)
  expect(await ui.find({ type: 'Text', text: /↑↓ mover/ })).not.toBe(undefined)
  await ui.press({ key: 'then-marcar' } as never)
  expect(filled.at(-1)).toBe('+3')

  await focusRow($, 1)
  await ui.press({ key: 'then-marcar' } as never)
  expect(filled.at(-1)).toBe('+3 1')
  await ui.press({ key: 'then-enviar' } as never)
  expect(sent.at(-1)).toBe('Opciones 3, 1: 3. Escribir un chequeo · 1. Correr las pruebas')
  await ui.unmount()
})

test('plan-progress bars drawn above leave the band fewer rows', { options: { language: 'español' } }, async ($, on) => {
  engine(on, o => {
    // plan-progress's state as it would hold two bars; this mod's own state goes on to the kit's store
    o('state.get', (_: unknown, e: { plugin: string; key: string }, next: (e: unknown) => unknown) =>
      e.plugin === 'plan-progress'
        ? { value: { value: e.key === 'plans' ? [{ state: 'running' }, { state: 'done', note: 'listo' }] : true, version: 1 } }
        : next(e),
    )
    o('ui.render', ($$: any, e: any) => {
      const { Box } = $$.ui.resolve(e)
      return <Box />
    })
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await offer($)
  // two bars, one with a note, and the gap: 4 rows of 10 leave 6, so no meter heading
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 10 } } as never)
  expect(await ui.find({ type: 'Box', key: 'opcion-5' })).not.toBe(undefined)
  expect(await ui.find({ type: 'Box', key: 'then-columnas' })).toBe(undefined)
  await ui.unmount()
})

test('/then otra vez brings the last options back', { options: { language: 'español' } }, async ($, on) => {
  engine(on, o => {
    o('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
    o('ui.render', ($$: any, e: any) => {
      const { Box } = $$.ui.resolve(e)
      return <Box />
    })
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const run = (args: string) => $.command.run({ command: 'then', args } as never) as Promise<{ text: string }>
  expect((await run('otra vez')).text).toContain('Todavía no hay')
  await offer($)
  // the person writes something else: the band goes
  await $.prompt.submit({ text: 'mejor otra cosa', wait: false, origin: { kind: 'composer' } } as never)
  const gone = await $.ui.mount(BAND as never)
  expect(await gone.find({ type: 'Box', key: 'opcion-1' })).toBe(undefined)
  await gone.unmount()
  expect((await run('otra vez')).text).toContain('otra vez')
  const back = await $.ui.mount(BAND as never)
  expect((await back.find({ type: 'Box', key: 'opcion-3' }))?.text).toContain('Escribir un chequeo')
  await back.unmount()
})
