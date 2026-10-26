// Then for Codex: the same protocol as the mod, as a Codex command hook run by Node (23.6 or newer runs this file as
// is). Codex has no band to draw, so the hook does what is left: the rule goes in at SessionStart, a reply's block
// is read at Stop and published to the mailbox (`<CODEX_HOME>/then/<session>.offer.json`) for an app beside the
// terminal to draw, a turn that forgot it is sent back once, and a pick typed at the prompt (`3`, `la 2 y la 4`)
// reaches the model as the options it names. Nothing leaves the machine
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { FREE, NUDGE, RULES, mailboxOf, offerBody, parseBlock, parsePick, pickContext } from '../hooks/protocol.ts'

type HookInput = {
  hook_event_name?: string
  session_id?: string
  transcript_path?: string | null
  prompt?: string
  stop_hook_active?: boolean
  last_assistant_message?: string | null
}

const say = (out: object) => process.stdout.write(JSON.stringify(out))

function readOffer(base: string): ReturnType<typeof offerBody> | null {
  try {
    return JSON.parse(readFileSync(`${base}.offer.json`, 'utf8'))
  } catch {
    return null
  }
}

function writeOffer(base: string, body: ReturnType<typeof offerBody>) {
  mkdirSync(dirname(base), { recursive: true })
  writeFileSync(`${base}.offer.json`, JSON.stringify(body))
}

export function handle(e: HookInput, now = Date.now()): object | null {
  const base = e.transcript_path && e.session_id ? mailboxOf(e.transcript_path, e.session_id) : null
  switch (e.hook_event_name) {
    case 'SessionStart':
      return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: RULES } }

    // whatever is sent ends the offer; a pick among it travels with the prompt as the options it names
    case 'UserPromptSubmit': {
      if (!base) return null
      const o = readOffer(base)
      if (!o || o.id === null || !('options' in o)) return null
      writeOffer(base, offerBody('codex', null))
      const pick = parsePick(e.prompt ?? '')
      if (!pick || pick.picks.some(n => n > o.options.length && n !== FREE)) return null
      if (pick.picks.includes(FREE) && !pick.rest) return null
      return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: pickContext(o, pick.picks, pick.rest) } }
    }

    // a reply with its block is published; one without, that is not a question or empty, is sent back once
    case 'Stop': {
      const said = (e.last_assistant_message ?? '').trim()
      const parsed = parseBlock(said)
      if (!parsed && !e.stop_hook_active && said && !/[?？]\s*$/.test(said)) return { decision: 'block', reason: NUDGE }
      if (base) writeOffer(base, offerBody('codex', parsed ? { id: now, options: parsed.options, suggested: parsed.suggested } : null))
      return null
    }
  }
  return null
}

if (import.meta.main) {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => (input += chunk))
  process.stdin.on('end', () => {
    try {
      const out = handle(JSON.parse(input))
      if (out) say(out)
    } catch {
      // a hook that fails must not hold the turn: Codex goes on as if there were none
    }
  })
}
