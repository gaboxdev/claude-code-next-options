import { expect, test } from 'claude-code/testing'

import { parseBlock, parsePick, rowsOf, stripBlock } from '../hooks/register'

test('what counts as a pick', () => {
  expect(parsePick('3')).toEqual({ picks: [3], rest: '' })
  expect(parsePick('la 3')).toEqual({ picks: [3], rest: '' })
  expect(parsePick('quiero la 2 y la 4')).toEqual({ picks: [2, 4], rest: '' })
  expect(parsePick('1, 3')).toEqual({ picks: [1, 3], rest: '' })
  expect(parsePick('dale con la tercera')).toEqual({ picks: [3], rest: '' })
  expect(parsePick('2 pero sin commit')).toEqual({ picks: [2], rest: 'pero sin commit' })
  expect(parsePick('opción 1.')).toEqual({ picks: [1], rest: '' })
  expect(parsePick('la verdad no me gustó')).toBe(null)
  expect(parsePick('y dos cosas más que quiero cambiar acá')).toBe(null)
  expect(parsePick('10 cosas')).toBe(null)
  expect(parsePick('5 mejor revisa los logs')).toEqual({ picks: [5], rest: 'mejor revisa los logs' })
  expect(parsePick('la quinta')).toEqual({ picks: [5], rest: '' })
  expect(parsePick("lets do 2 and 4")).toEqual({ picks: [2, 4], rest: '' })
  expect(parsePick('the third one')).toEqual({ picks: [3, 1], rest: '' })
  expect(parsePick('no, 3 is wrong')).toBe(null)
  expect(parsePick('+2 4')).toEqual({ picks: [2, 4], rest: '' })
})

test('the <then> block: read, and cut from what is drawn', () => {
  const reply = 'Hecho.\n\n<then>\n1|Correr las pruebas|que nada se rompa|low\n2*|Subir mis cambios|solo mis archivos|med\n3|Escribir un chequeo|revisar cada push|alto\n4|Dejarlo así||nada\n</then>'
  expect(parseBlock(reply)).toEqual({
    options: [
      { title: 'Correr las pruebas', detail: 'que nada se rompa', usage: 'low' },
      { title: 'Subir mis cambios', detail: 'solo mis archivos', usage: 'medium' },
      { title: 'Escribir un chequeo', detail: 'revisar cada push', usage: 'high' },
      { title: 'Dejarlo así', detail: '', usage: 'none' },
    ],
    suggested: 2,
  })
  // the star is the model's to misplace: wherever it lands on a row, that row is the suggested one, and the field it
  // was stuck to still reads (a `low*` usage is still low)
  const rows = (row2: string) => `<then>\n1|Uno|a|low\n${row2}\n3|Tres|c|high\n4|Cuatro|d|none\n</then>`
  for (const row2 of ['2|Dos|b|low*', '2|Dos|b|low *', '2|Dos*|b|low', '2|Dos|b*|low', '2 *|Dos|b|low', '2|★ Dos|b|low', '*2|Dos|b|low']) {
    const parsed = parseBlock(rows(row2))
    expect(parsed?.suggested).toBe(2)
    expect(parsed?.options[1]).toEqual({ title: 'Dos', detail: 'b', usage: 'low' })
  }
  // a star inside the words is not a mark
  expect(parseBlock(rows('2|Revisar a*b|b|low'))?.suggested).toBe(null)
  expect(parseBlock('no block here')).toBe(null)
  expect(parseBlock('<then>\n1|solo una\n</then>')).toBe(null)
  expect(stripBlock(reply)).toBe('Hecho.')
  // while it streams: a block not closed yet, and a tag half typed
  expect(stripBlock('Hecho.\n\n<then>\n1|Correr')).toBe('Hecho.')
  expect(stripBlock('Hecho.\n\n<th')).toBe('Hecho.')
  expect(stripBlock('a <thing> stays')).toBe('a <thing> stays')
})

test('rowsOf counts a drawn tree as the terminal lays it out', () => {
  const text = (s: string) => ({ type: 'Text', children: [s] })
  expect(rowsOf(text('a'))).toBe(1)
  expect(rowsOf({ type: 'Box', props: { flexDirection: 'column', gap: 1 }, children: [text('a'), text('b'), text('c')] })).toBe(5)
  expect(rowsOf({ type: 'Box', props: { flexDirection: 'row' }, children: [text('a'), { type: 'Raster', props: { rows: 3 } }] })).toBe(3)
  expect(rowsOf({ type: 'Box', props: { display: 'none' }, children: [text('a')] })).toBe(0)
})
