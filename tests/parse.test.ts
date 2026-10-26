import { expect, test } from 'claude-code/testing'

import { parsePick } from '../hooks/register'

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
})
