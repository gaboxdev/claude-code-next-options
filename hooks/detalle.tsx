import type { ClientModule } from 'claude-code'

// an option's detail in its column: cut with an ellipsis at rest; under the pointer, a long one scrolls through its
// whole text and around again, and settles back at its start when the pointer leaves
type Props = { text: string; width: number; color: string; bg: string }
type State = { isOver: boolean; offset: number }

const TICK_MS = 140
// ticks the text holds still at its start before it moves, so the first words can be read
const PAUSE = 6
const GAP = '   ·   '

const cut = (s: string, w: number) => (s.length <= w ? s.padEnd(w) : `${s.slice(0, Math.max(0, w - 1)).trimEnd()}…`.padEnd(w))

const Detalle: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements
  const { text, width, color, bg } = props
  if (surface.state === undefined) {
    surface.onPointer(e => {
      if (e.type === 'enter' || (e.type === 'move' && !surface.state?.isOver)) surface.setState({ isOver: true, offset: -PAUSE })
      if (e.type === 'leave') surface.setState({ isOver: false, offset: 0 })
    })
    // one clock for the instance's life; it only redraws while the pointer is over a text that does not fit
    surface.every(TICK_MS, () => {
      const s = surface.state
      if (s?.isOver && text.length > width) surface.setState({ ...s, offset: s.offset + 1 })
    })
    surface.setState({ isOver: false, offset: 0 })
  }
  const s = surface.state ?? { isOver: false, offset: 0 }
  if (!s.isOver || text.length <= width) return <Text color={color} backgroundColor={bg}>{cut(text, width)}</Text>
  const loop = text + GAP
  const at = Math.max(0, s.offset) % loop.length
  const shown = (loop + loop).slice(at, at + width).padEnd(width)

  return <Text color={color} backgroundColor={bg} underline>{shown}</Text>
}

export default Detalle
