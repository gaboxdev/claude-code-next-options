import { expect, test } from 'claude-code/testing'

// a band of real length: long titles, a suggested one, a meter on each
const REPLY = `Listo.

<then>
1|Correr toda la suite de pruebas|que nada se rompa en ningún lado|low
2*|Subir mis cambios al repositorio|solo mis archivos, sin lo ajeno|med
3|Escribir un chequeo automático|revisar cada push en la integración|high
4|Dejarlo así por ahora|no falta nada|none
</then>`

const WIDTHS = [34, 50, 70, 100, 140]

for (const surface of ['terminal', 'desktop'] as const) {
  test(`every row fits the band and lines up, from 34 to 140 columns (${surface})`, { options: { language: 'español' } }, async ($, on) => {
    on('command.register', () => ({ value: { command: 'then' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('turn.step', async function* (_, e) {
      return { turnId: e.turnId, index: e.index, answer: REPLY, toolUses: [] }
    })
    on('store.get', () => ({ value: undefined }))
    on('clock.now', () => ({ value: 1000 }))
    on('config.list', () => ({ value: [] }))
    on('ui.render', ($, e) => {
      const { Box } = $.ui.resolve(e)

      return <Box />
    })

    await $.session.start({ cwd: '/', surface, isInteractive: true })
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 } as never)
    for await (const chunk of stream) void chunk
    await stream.result

    for (const cols of WIDTHS) {
      const ui = await $.ui.mount({ plugin: 'then', component: 'AbovePrompt', requestId: `band-${cols}`, surface, props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: cols } } as never)
      const widths: number[] = []
      for (const n of [1, 2, 3, 4, 5]) {
        const row = await ui.find({ type: 'Box', key: `opcion-${n}` })
        const client = await ui.find({ type: 'Client', key: `detalle-1000-${n}` })
        const detail = Number((client as unknown as { props?: { width?: number } } | undefined)?.props?.width ?? 0)
        widths.push([...(row?.text ?? '')].length + detail)
      }
      // two columns of margin on the left, the engine's five on the right are outside bodyColumns already
      expect({ cols, same: new Set(widths).size === 1, fits: Math.max(...widths) <= cols - 2 }).toEqual({ cols, same: true, fits: true })
      await ui.unmount()
    }
  })
}
