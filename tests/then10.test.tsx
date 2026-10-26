import { expect, test } from 'claude-code/testing'

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

async function offer($: any) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })
  for await (const chunk of stream) void chunk
  await stream.result
}

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
