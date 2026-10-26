import type { ClientModule } from 'claude-code'

// the suggested option's star, twinkling in gold: bright, warm, dim, warm, on a clock of its own, so the band itself
// never redraws for it
type Props = { text: string; bg: string; dim: string }
type State = { phase: number }

const TICK_MS = 420
const GOLD = ['#FFE9A8', '#F2C14E', '', '#F2C14E']

const Estrella: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements
  if (surface.state === undefined) {
    surface.every(TICK_MS, () => surface.setState({ phase: ((surface.state?.phase ?? 0) + 1) % GOLD.length }))
    surface.setState({ phase: 0 })
  }
  const phase = surface.state?.phase ?? 0
  const color = GOLD[phase] || props.dim

  return (
    <Text color={color} backgroundColor={props.bg} weight="bold">
      {props.text}
    </Text>
  )
}

export default Estrella
