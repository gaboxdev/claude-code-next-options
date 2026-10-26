import { expect, test } from 'claude-code/testing'

const REPLY = `Listo.

<then>
1|Correr las pruebas|que nada falle|low
2*|Subir mis cambios|solo lo mío|med
3|Escribir un chequeo|en cada push|high
4|Dejarlo así|no falta nada|none
</then>`

// what the band shows at each height: the four options always, then the header, the free row and the meter's heading
const CASES: [number, number, { header: boolean; free: boolean; column: boolean }][] = [
  [4, 0, { header: false, free: false, column: false }],
  [5, 0, { header: true, free: false, column: false }],
  [6, 0, { header: true, free: true, column: false }],
  [7, 0, { header: true, free: true, column: true }],
  // another plugin's three rows under the band, and the gap between, leave 6 of 10
  [10, 3, { header: true, free: true, column: false }],
]

test('the band fits the rows it is given instead of scrolling its options away', { options: { language: 'español' } }, async ($, on) => {
  let belowRows = 0
  on('command.register', () => ({ value: { command: 'then' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: REPLY, toolUses: [] }
  })
  on('store.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
  on('config.list', () => ({ value: [] }))
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (belowRows === 0) return <Box />

    return (
      <Box flexDirection="column">
        {Array.from({ length: belowRows }, (_, i) => (
          <Text key={i}>{`barra ${i}`}</Text>
        ))}
      </Box>
    )
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)
  for await (const chunk of stream) void chunk
  await stream.result

  for (const [maxRows, below, want] of CASES) {
    belowRows = below
    const ui = await $.ui.mount({ plugin: 'then', component: 'AbovePrompt', requestId: `band-${maxRows}`, surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows, bodyColumns: 100 } } as never)
    for (const n of [1, 2, 3, 4]) expect(await ui.find({ type: 'Box', key: `opcion-${n}` })).not.toBe(undefined)
    const got = {
      header: (await ui.find({ type: 'Text', text: /¿Cómo seguimos\?/ })) !== undefined,
      free: (await ui.find({ type: 'Box', key: 'opcion-5' })) !== undefined,
      column: (await ui.find({ type: 'Box', key: 'then-columnas' })) !== undefined,
    }
    expect({ maxRows, below, ...got }).toEqual({ maxRows, below, ...want })
    await ui.unmount()
  }
})
