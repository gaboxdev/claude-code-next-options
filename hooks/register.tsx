import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Offer, Option, Usage } from '../types'

const TOOL = 'mcp__then__offer'
const offer = atom({ plugin: 'then', key: 'offer' } as const, null)
const isOn = atom({ plugin: 'then', key: 'isOn' } as const, true)
// the colour `/then color …` picked: a palette name or a #RRGGBB; null keeps the one in /config
const color = atom({ plugin: 'then', key: 'color' } as const, null)
const STORE_COLOR = 'color'
const STORE_ON = 'isOn'
const COUNT = 4
// the band's own last row: none of the four, the person writes what they want
const FREE = COUNT + 1

// every word the band draws, in the two languages it speaks; `language` in /config picks one, auto follows the
// session's own language setting
type Words = {
  title: string; hint: string; hintFree: string; badge: string; column: string; usage: Record<Usage, string>
  free: string; freeDetail: string; writing: string; writingDetail: string; option: string; off: string; on: string; command: string
  argumentHint: string; help: string; colors: Record<string, string>
  colorList: (current: string) => string; colorSet: (name: string) => string; colorBad: (arg: string) => string; colorReset: string
}
const WORDS_BY: Record<'es' | 'en', Words> = {
  es: {
    title: '¿Cómo seguimos?', hint: 'escribe el número · o «la 2 y la 4» + Enter', hintFree: 'escribe tu pedido y Enter',
    badge: '★ sugerida', column: 'consumo ▾', usage: { none: 'nada', low: 'bajo', medium: 'medio', high: 'alto' },
    free: 'Otra cosa (libre)', freeDetail: 'ninguna de estas: escribe lo que quieras',
    writing: '✎ Escribiendo lo tuyo', writingDetail: 'escribe abajo y Enter; me llega tal cual', option: 'Opción',
    off: 'Then apagado. /then lo prende de nuevo.', on: 'Then prendido: al final de cada turno vas a ver 4 opciones para elegir con un número.',
    command: 'Prender o apagar las opciones al final de cada turno, o cambiar su color',
    argumentHint: '[color <nombre|#RRGGBB>] | on | off',
    help: 'Uso: /then (prende o apaga) · /then color (ver colores) · /then color violeta · /then color #D97757',
    colors: { blue: 'azul', violet: 'violeta', green: 'verde', amber: 'ámbar', pink: 'rosa', cyan: 'cian' },
    colorList: c => `Color de Then: ${c}. Para cambiarlo: /then color azul | violeta | verde | ámbar | rosa | cian, o /then color #RRGGBB (por ejemplo #D97757). /then color normal vuelve al de /config.`,
    colorSet: c => `Then ahora es ${c}. La banda ya se dibuja con ese color.`,
    colorBad: a => `No conozco el color «${a}». Usa azul, violeta, verde, ámbar, rosa, cian o un #RRGGBB.`,
    colorReset: 'Then vuelve al color de /config.',
  },
  en: {
    title: 'What next?', hint: 'type the number · or "2 and 4" + Enter', hintFree: 'type your request and Enter',
    badge: '★ suggested', column: 'usage ▾', usage: { none: 'none', low: 'low', medium: 'med', high: 'high' },
    free: 'Something else', freeDetail: 'none of these: type your own',
    writing: '✎ Writing your own', writingDetail: 'type below and Enter; sent as is', option: 'Option',
    off: 'Then is off. /then turns it back on.', on: 'Options on: each turn ends with 4 to pick by number.',
    command: 'Turn the options at the end of each turn on or off, or change their color',
    argumentHint: '[color <name|#RRGGBB>] | on | off',
    help: 'Usage: /then (on/off) · /then color (list colors) · /then color violet · /then color #D97757',
    colors: { blue: 'blue', violet: 'violet', green: 'green', amber: 'amber', pink: 'pink', cyan: 'cyan' },
    colorList: c => `Then is ${c}. To change it: /then color blue | violet | green | amber | pink | cyan, or /then color #RRGGBB (e.g. #D97757). /then color default goes back to /config.`,
    colorSet: c => `Then is now ${c}. The band draws in it right away.`,
    colorBad: a => `Unknown color "${a}". Use blue, violet, green, amber, pink, cyan or a #RRGGBB.`,
    colorReset: 'Then is back to the color set in /config.',
  },
}
let T: Words = WORDS_BY.es
let languageSetting = 'auto'
const languageOf = (setting: string, sessionLanguage: unknown) =>
  setting === 'english' ? 'en' : setting === 'español' ? 'es' : /^(es|span|espa)/i.test(String(sessionLanguage ?? '')) ? 'es' : 'en'

// plan-progress's recipe (one lightness, white on the colour at 4.5:1 or better, a tinted strip with pixel dots) in a
// colour of its own, blue by default so a choice never reads as a running plan (violet) or a question (amber). The
// person picks another in /config (the `color` option); every other colour of the band is drawn from it
const PALETTE: Record<string, number[]> = {
  blue: [43, 116, 170],
  violet: [120, 88, 202],
  green: [24, 128, 58],
  amber: [165, 94, 0],
  pink: [180, 56, 118],
  cyan: [13, 118, 134],
}
const DARK_BG = [24, 24, 27]
const LIGHT_BG = [255, 255, 255]
let ACCENT = PALETTE.blue as number[]
// the pills' text: white where it reads at 4.5:1 on the accent, a near black on a light custom colour
let INK = '#FFFFFF'
let isLight = false

const hex = (c: number[]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const mix = (a: number[], b: number[], m: number) => a.map((v, i) => v + ((b[i] ?? 0) - v) * m)
const relLum = (c: number[]) => {
  const l = c.map(v => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (l[0] ?? 0) + 0.7152 * (l[1] ?? 0) + 0.0722 * (l[2] ?? 0)
}
const contrast = (a: number[], b: number[]) => (Math.max(relLum(a), relLum(b)) + 0.05) / (Math.min(relLum(a), relLum(b)) + 0.05)

// what `/then color …` accepts, in either language, to the palette's own names
const COLOR_ALIASES: Record<string, string> = {
  azul: 'blue', violeta: 'violet', morado: 'violet', purple: 'violet', verde: 'green', ámbar: 'amber', ambar: 'amber',
  naranja: 'amber', orange: 'amber', rosa: 'pink', rosado: 'pink', cian: 'cyan', turquesa: 'cyan', teal: 'cyan',
}
// a colour the person typed after `/then color`: a palette name (either language) or a #RRGGBB; null when it is neither
export function parseColor(arg: string): string | null {
  const word = arg.trim().toLowerCase()
  if (/^#?[0-9a-f]{6}$/.test(word)) return `#${word.replace('#', '')}`
  const name = COLOR_ALIASES[word] ?? word
  return PALETTE[name] ? name : null
}
// a stored choice as pickAccent takes it: a #RRGGBB is the custom colour
const accentOf = (chosen: string) => (chosen.startsWith('#') ? pickAccent('custom', chosen) : pickAccent(chosen, null))

// a palette name, or with «custom» the #RRGGBB the person wrote; anything unreadable keeps the blue
export function pickAccent(name: unknown, custom: unknown): { accent: number[]; ink: string } {
  const typed = typeof custom === 'string' ? /^#?([0-9a-f]{6})$/i.exec(custom.trim())?.[1] : undefined
  const fromHex = typed ? [0, 2, 4].map(i => parseInt(typed.slice(i, i + 2), 16)) : undefined
  const accent = (name === 'custom' ? fromHex : PALETTE[String(name)]) ?? (PALETTE.blue as number[])
  return { accent, ink: contrast(accent, [255, 255, 255]) >= 4.5 ? '#FFFFFF' : '#1A1A1A' }
}
const accent = () => hex(ACCENT)
const tint = () => hex(mix(isLight ? LIGHT_BG : DARK_BG, ACCENT, isLight ? 0.12 : 0.2))
const dots = () => hex(mix(isLight ? LIGHT_BG : DARK_BG, ACCENT, isLight ? 0.45 : 0.55))
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}
// a braille trail that thickens toward the right edge, as plan-progress's fill thickens toward its head
function trail(width: number, row: number): string {
  let s = ''
  for (let col = 0; col < width; col++) {
    const dense = 0.15 + 0.6 * Math.pow((col + 1) / Math.max(1, width), 1.6)
    let bits = 0
    for (let k = 0; k < 8; k++) if (hash(col + row * 97, k) < dense * 0.5) bits |= 1 << k
    s += String.fromCharCode(0x2800 + bits)
  }
  return s
}
const fitText = (s: string, w: number) => (s.length <= w ? s.padEnd(w) : `${s.slice(0, Math.max(0, w - 1)).trimEnd()}…`.padEnd(w))
// how much an option would spend: a three-cell meter in plan-progress's done, waiting and error hues, the lighter
// set where they sit on a dark strip
const USAGES: Usage[] = ['none', 'low', 'medium', 'high']
const USAGE_COLOR: Record<'dark' | 'light', Record<Usage, string>> = {
  dark: { none: '#A7A5AE', low: '#4FA569', medium: '#C0883B', high: '#D67278' },
  light: { none: '#5B5B5E', low: '#157632', medium: '#905300', high: '#B13038' },
}
const meter = (u: Usage) => {
  const n = USAGES.indexOf(u)
  return `${'▮'.repeat(n)}${'▯'.repeat(3 - n)} ${T.usage[u].padEnd(5)}`
}
const METER_W = 9
// set while the band is on screen: a digit typed into the empty composer picks only then
let isBandShown = false

const RULES = `# Then (next options)
At the end of every turn where you did or answered something, call ${TOOL} as your LAST tool call, right before your final message, with exactly ${COUNT} options for how to continue, most useful first: concrete next actions you can start right away (title at most 6 words, detail at most 14 words, both in the user's language). Mark the one you recommend with suggested (its number), and give each option usage, what it would spend in tokens and time: none (nothing to run), low (a few reads or one command), medium (several edits or a build), high (many files, agents or long runs). The person picks by typing the number, so never list the options again in your message and never end by asking which one to do; the band above the prompt asks. Skip it only when you end on a question the person must answer in their own words, or you called AskUserQuestion.`

type Raw = Record<string, unknown>
// the cut drops half a character left at the edge (an emoji is two UTF-16 units)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max).replace(/[\uD800-\uDBFF]$/, '').trimEnd() : '')

// ---------- reading a pick out of what the person typed ----------

const WORDS: Record<string, number[]> = {
  uno: [1], una: [1], primera: [1], primero: [1],
  dos: [2], segunda: [2], segundo: [2],
  tres: [3], tercera: [3], tercero: [3],
  cuatro: [4], cuarta: [4], cuarto: [4],
  cinco: [5], quinta: [5], quinto: [5],
  todas: [1, 2, 3, 4], todo: [1, 2, 3, 4], todos: [1, 2, 3, 4],
  one: [1], first: [1], two: [2], second: [2], three: [3], third: [3], four: [4], fourth: [4], five: [5], fifth: [5],
  all: [1, 2, 3, 4],
}
const FILLER = new Set(
  'ok okay vale listo bueno pues entonces sí si dale va vamos ve haz hazme hace hacé quiero quisiera prefiero elijo escojo me gusta voy con por la el las los lo de y e opción opcion opciones número numero n i want lets go do pick take the and option options number'.split(' '),
)

// "3", "la 3", "quiero la 2 y la 4", "1, 3", "dale con la tercera", "2 pero sin commit": the numbers it names in the
// leading words and whatever it says after them; null when the message is not a pick
export function parsePick(text: string): { picks: number[]; rest: string } | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const isShort = tokens.length <= 5
  const picks: number[] = []
  let at = 0
  for (; at < tokens.length; at++) {
    const word = (tokens[at] ?? '').toLowerCase().replace(/^[«"'(]+|[».,;:!?)"'/+&-]+$/g, '')
    const digits = /^[1-5](?:[,/+&y-][1-5])*$/.test(word) ? word.match(/[1-5]/g)?.map(Number) : undefined
    // a number word counts only in a short message: "y dos cosas más…" is not a pick
    const named = digits ?? (isShort ? WORDS[word] : undefined)
    if (named) picks.push(...named)
    else if (!FILLER.has(word) && word !== '') break
  }
  if (picks.length === 0) return null
  const rest = tokens.slice(at).join(' ').replace(/^[,.;:\-–—\s]+/, '')
  return { picks: [...new Set(picks)], rest }
}

const joinNumbers = (n: number[]) => (n.length === 1 ? `${n[0]}` : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`)
const describe = (o: Option) => `«${o.title}»${o.detail ? ` (${o.detail})` : ''}`

function pickContext(o: Offer, picks: number[], rest: string): string {
  if (picks.includes(FREE)) return `The person passed on the options you offered with ${TOOL} and asked for this instead: «${rest}».`
  const chosen = picks.map(n => `${n}. ${describe(o.options[n - 1] as Option)}`).join('; ')
  const head = picks.length === 1 ? `The person picked option ${picks[0]}` : `The person picked options ${joinNumbers(picks)}, in that order`
  return `${head} of the ones you offered with ${TOOL}: ${chosen}. Do that now.${rest ? ` They added: «${rest}».` : ''}`
}

// ---------- the offer ----------

function normalize(raw: Raw, now: number): Offer | string {
  const list = Array.isArray(raw.options) ? (raw.options as unknown[]) : []
  const options = list
    .map(x => (x && typeof x === 'object' ? (x as Raw) : { title: x }))
    .map(x => ({ title: str(x.title, 60), detail: str(x.detail, 110), ...(USAGES.includes(x.usage as Usage) ? { usage: x.usage as Usage } : {}) }))
    .filter(x => x.title)
  if (options.length !== COUNT) return `then: send exactly ${COUNT} options with a title each; got ${options.length}.`
  const suggested = typeof raw.suggested === 'number' && raw.suggested >= 1 && raw.suggested <= COUNT ? Math.round(raw.suggested) : null
  return { title: str(raw.title, 40) || T.title, options, at: now, suggested }
}

async function clear($: EngineInterface) {
  await update($, offer, () => null)
}

// the free row keeps the band up while the person writes, and a digit then types as a digit
async function startFree($: EngineInterface) {
  await update($, offer, o => (o ? { ...o, isFree: true } : o))
}

// a press on the band submits the pick as the person's own message, so the transcript reads what was chosen
async function pressPick($: EngineInterface, n: number) {
  if (n === FREE) return startFree($)
  const o = await read($, offer)
  const chosen = o?.options[n - 1]
  if (!chosen) return
  await clear($)
  await $.prompt.submit({ text: `${T.option} ${n}: ${chosen.title}${chosen.detail ? ` — ${chosen.detail}` : ''}`, asUser: true })
}

export const register: Register = (on, options) => {
  const picked = pickAccent(options?.color, options?.customColor)
  const configColor = options?.color === 'custom' ? String(options?.customColor ?? '') : String(options?.color ?? 'blue')
  languageSetting = String(options?.language ?? 'auto')
  ACCENT = picked.accent
  INK = picked.ink

  // per-turn bookkeeping; a reload just starts a fresh count
  let workCalls = 0
  let hasOffered = false
  let hasAsked = false
  let hasNudged = false

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) {
      workCalls = 0
      hasOffered = false
      hasAsked = false
      hasNudged = false
    }

    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'offer',
      description: `Shows ${COUNT} numbered options above the prompt for how to continue; the person answers with a number. Call it last in a turn.`,
      inputSchema: {
        type: 'object',
        required: ['options'],
        properties: {
          title: { type: 'string', description: 'Short header, default "¿Cómo seguimos?"' },
          suggested: { type: 'integer', minimum: 1, maximum: COUNT, description: 'The number of the option you recommend' },
          options: {
            type: 'array',
            minItems: COUNT,
            maxItems: COUNT,
            items: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string', description: 'The action, at most 6 words' },
                detail: { type: 'string', description: 'What it does or why, at most 14 words' },
                usage: { enum: USAGES, description: 'What it would spend: none, low, medium or high' },
              },
            },
          },
        },
      },
    })
    const rows = await $.config.list().catch(() => [])
    T = WORDS_BY[languageOf(languageSetting, rows.find(row => row.key === 'language')?.value)]
    await $.command.register({ name: 'then', description: T.command, argumentHint: T.argumentHint })
    const storedColor = await $.store.get(STORE_COLOR)
    if (typeof storedColor === 'string' && parseColor(storedColor)) await update($, color, () => storedColor)
    const stored = await $.store.get(STORE_ON)
    if (stored === false) await update($, isOn, () => false)
    const theme = rows.find(row => row.key === 'theme')
    isLight = /light/i.test(String(theme?.value ?? 'dark'))

    return next(e)
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined) isLight = /light/i.test(String(r.value))

    return r
  })

  // a bare digit typed into the empty composer while the band is up picks that option at once, no Enter; the band's
  // Buttons carry no hotkey, which would draw its own "1:" in front of the pill
  on('prompt.edit', async ($, e, next) => {
    if (!isBandShown || e.text !== '' || !/^[1-9]$/.test(e.inputText)) return next(e)
    const o = await read($, offer)
    const n = Number(e.inputText)
    if (!o || o.isFree || (n > o.options.length && n !== FREE)) return next(e)
    void pressPick($, n)

    return { text: e.text, cursor: e.cursor }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (!(await read($, isOn))) return result

    return { sections: [...result.sections, { id: 'then:rules', text: RULES, scope: 'session' as const }] }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId) return { deny: 'then: only the main session offers options to the person.' }
    if (!(await read($, isOn))) return { result: 'then is off; nothing shown.' }
    const made = normalize(e as unknown as Raw, await $.clock.now())
    if (typeof made === 'string') return { deny: made }
    await update($, offer, () => made)
    hasOffered = true

    return { result: `Shown above the prompt as 1-${COUNT}, with ${FREE} for the person's own request. Now end with a short final message that does not repeat them.` }
  })

  on('tool.call', async ($, e, next) => {
    if (!e.agentId && e.tool !== TOOL) {
      workCalls += 1
      if (e.tool === 'AskUserQuestion') hasAsked = true
    }

    return next(e)
  })

  // a number typed in the composer while an offer is up becomes that option; anything else just moves on
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || e.origin.kind !== 'composer') return next(e)
    const o = await read($, offer)
    if (!o) return next(e)
    await clear($)
    const pick = parsePick(e.text)
    if (!pick || pick.picks.some(n => n > o.options.length && n !== FREE)) return next(e)
    // "5" alone says nothing yet; "5 haz X" is the free request
    if (pick.picks.includes(FREE) && !pick.rest) return next(e)

    return next({ ...e, context: [...(e.context ?? []), pickContext(o, pick.picks, pick.rest)] })
  })

  // a turn that did work and ended without options is sent back once to offer them
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (!(await read($, isOn))) return result
    if (e.stop_hook_active || result.block || hasOffered || hasAsked || hasNudged || workCalls === 0) return result
    if ((e.background_tasks?.length ?? 0) > 0) return result
    if (/\?\s*$/.test(e.last_assistant_message ?? '')) return result
    hasNudged = true

    return { ...result, block: `then: call ${TOOL} with ${COUNT} options for how to continue, then end with one short line.` }
  })

  // `/then` turns it on or off; `/then on|off` says which; `/then color …` lists, sets or resets the band's colour
  on('command.run', { command: 'then' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const word = verb.toLowerCase()
    const arg = rest.join(' ')
    if (word === 'color' || word === 'colour' || word === 'colores') {
      const current = (await read($, color)) ?? configColor
      const nameOf = (c: string) => (c.startsWith('#') ? c : (T.colors[c] ?? c))
      if (!arg) return { text: T.colorList(nameOf(current)) }
      if (/^(normal|default|reset|config)$/i.test(arg)) {
        await update($, color, () => null)
        await $.store.delete(STORE_COLOR)
        return { text: T.colorReset }
      }
      const chosen = parseColor(arg)
      if (!chosen) return { text: T.colorBad(arg) }
      await update($, color, () => chosen)
      await $.store.set(STORE_COLOR, chosen)
      return { text: T.colorSet(nameOf(chosen)) }
    }
    if (word && !/^(on|off|prender|apagar)$/.test(word)) return { text: T.help }
    const was = await read($, isOn)
    const next = word ? /^(on|prender)$/.test(word) : !was
    await update($, isOn, () => next)
    await $.store.set(STORE_ON, next)
    if (!next) await clear($)

    return { text: next ? T.on : T.off }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const o = await read($, offer)
    isBandShown = false
    if (!o || e.props.hasSurvey || e.props.isWorking || !(await read($, isOn))) return next(e)
    isBandShown = true
    // the colour `/then color` picked wins over /config; reading it here redraws the band when it changes
    const chosen = await read($, color)
    const painted = chosen ? accentOf(chosen) : picked
    ACCENT = painted.accent
    INK = painted.ink
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    // the detail scrolls under the pointer where the surface runs a Client of ours (terminal, desktop); elsewhere it
    // is cut as plain text
    const Client = 'Client' in els ? els.Client : null
    const hasClicks = e.surface !== 'terminal' || e.viewport?.isFullscreen === true
    // every row is one strip of the same width, so the pills, titles and details line up in columns
    const W = Math.min(110, Math.max(40, (e.props.bodyColumns || 100) - 4))
    const free = o.isFree
      ? { title: T.writing, detail: T.writingDetail }
      : { title: T.free, detail: T.freeDetail }
    const titleW = Math.min(34, Math.max(free.title.length, ...o.options.map(op => op.title.length)))
    const TRAIL = 4
    const hasBadge = o.suggested != null
    const hasMeter = o.options.some(op => op.usage)
    // pill, gap, title, the badge column, gap, detail, trail, meter, end
    const fixed = 3 + 1 + titleW + (hasBadge ? 1 + T.badge.length : 0) + 2 + TRAIL + (hasMeter ? 1 + METER_W : 0) + 1
    const detailW = W - fixed
    const bg = tint()
    const ink = isLight ? '#222226' : '#F0EEFC'
    const dim = isLight ? '#5B5B5E' : '#A7A5AE'
    // the accent lifted toward white on a dark strip, deepened on a light one, so the star reads on either
    const star = hex(isLight ? mix(ACCENT, [0, 0, 0], 0.15) : mix(ACCENT, [255, 255, 255], 0.45))
    // the free row's pill is the accent faded into the strip until it is chosen: it is the band's, not an option
    const freePill = o.isFree ? accent() : hex(mix(isLight ? LIGHT_BG : DARK_BG, ACCENT, 0.5))
    type Row = { n: number; title: string; detail: string; pill: string; isSuggested: boolean; usage?: Usage; hasTrail: boolean }
    const row = (r: Row) => {
      const detail = detailW >= 10 ? fitText(r.detail, detailW) : ''
      // the trail takes what the detail leaves: TRAIL cells beside a full one, the whole gap beside none
      const trailW = Math.max(0, W - (fixed - TRAIL) - detail.length)
      return (
        <Box key={`opcion-${r.n}`} flexDirection="row" marginLeft={2}>
          <Button key={`opcion-btn-${r.n}`} label={`${r.n}. ${r.title}`} plain onPress={() => pressPick($, r.n)}>
            <Text color={INK} backgroundColor={r.pill} weight="bold">{` ${r.n} `}</Text>
            <Text backgroundColor={bg}> </Text>
            <Text color={ink} backgroundColor={bg} weight="semibold">{fitText(r.title, titleW)}</Text>
            {hasBadge ? (
              <Text color={r.isSuggested ? star : bg} backgroundColor={bg} weight="semibold">{` ${r.isSuggested ? T.badge : ' '.repeat(T.badge.length)}`}</Text>
            ) : (
              ''
            )}
            <Text backgroundColor={bg}>{'  '}</Text>
          </Button>
          {detail && Client ? (
            // keyed by the offer too, so a new offer starts a fresh instance rather than scrolling the last one's text
            <Client key={`detalle-${o.at}-${r.n}`} module="./detalle.tsx" props={{ text: r.detail, width: detail.length, color: dim, bg }} width={detail.length} />
          ) : (
            <Text color={dim} backgroundColor={bg}>{detail}</Text>
          )}
          <Text color={dots()} backgroundColor={bg}>{r.hasTrail ? trail(trailW, r.n) : ' '.repeat(trailW)}</Text>
          {hasMeter ? (
            <Text color={r.usage ? USAGE_COLOR[isLight ? 'light' : 'dark'][r.usage] : bg} backgroundColor={bg}>{` ${r.usage ? meter(r.usage) : ' '.repeat(METER_W)}`}</Text>
          ) : null}
          <Text backgroundColor={bg}> </Text>
        </Box>
      )
    }
    const tree = (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color={accent()}>◆</Text>
          <Text color={INK} backgroundColor={accent()} weight="semibold">{` ${o.title} `}</Text>
          <Text dimColor wrap="truncate">{o.isFree ? T.hintFree : T.hint}</Text>
          <Box flexGrow={1} />
          {hasClicks ? <Button key="then-cerrar" plain dimColor label="✕" onPress={() => clear($)} /> : null}
        </Box>
        {hasMeter ? (
          // the meter column's own heading, right over it, so the bars read as what each option spends
          <Box key="then-columnas" flexDirection="row" marginLeft={2}>
            <Text>{' '.repeat(W - 1 - METER_W)}</Text>
            <Text color={star} weight="semibold">{T.column.padEnd(METER_W)}</Text>
          </Box>
        ) : null}
        {o.options.map((op, i) =>
          row({ n: i + 1, title: op.title, detail: op.detail, pill: accent(), isSuggested: o.suggested === i + 1, usage: op.usage, hasTrail: true }),
        )}
        {row({ n: FREE, title: free.title, detail: free.detail, pill: freePill, isSuggested: false, hasTrail: false })}
      </Box>
    )
    // what the host and the plugins after this one draw here stays, under the options
    const below = await next(e)

    return below ? (
      <Box flexDirection="column" gap={1}>
        {tree}
        {below}
      </Box>
    ) : (
      tree
    )
  })
}
