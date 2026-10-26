# Then

**A Claude mod** for Claude Code: what's next, one keystroke away.

**English** · [Español](#español)

Every time Claude finishes a turn, it leaves **4 numbered next steps above the prompt**, plus a fifth one that is yours to write. Type the number and it goes. No more "what should I do next?" at the end of every answer.

```
◆ What next?   type the number · or "2 and 4" + Enter
                                                                        usage ▾
  1  Test it in the browser               open the page and check it    ▮▯▯ low
  2  Commit my own files     ★ suggested  only this session's files     ▮▮▯ med
  3  Write a check script                 a script that verifies it     ▮▮▮ high
  4  Leave it as is                       nothing else to do            ▯▯▯ none
  5  Something else                       none of these: type your own
```

- **One keystroke.** With the prompt empty, type `3` and option 3 is sent at once, no Enter.
- **Or say it.** `the 3`, `2 and 4`, `2 but skip the tests` + Enter also work (Spanish too: `quiero la 3`, `la 2 y la 4`).
- **Option 5 is free.** Type `5` and the band stays while you write your own request.
- **★ suggested** marks the one Claude recommends.
- **usage** shows what each option would spend in tokens and time: none, low, med, high.
- **Hover a long description** and it scrolls so you can read all of it (terminal fullscreen mode or the desktop app).
- **Forgot?** If Claude ends a turn of real work without options, the mod sends it back once to add them.

## Install

At the prompt of a Claude Code session:

```
/plugin install then --marketplace gaboxdev/then
```

Answer `y` to add the marketplace, then pick the user scope. It works from the next turn on.

## Change the color

Type it at the prompt; the band repaints at once and the choice is remembered:

```
/then color            → shows the current color and the list
/then color violet     → blue, violet, green, amber, pink, cyan
/then color #D97757    → any #RRGGBB
/then color default    → back to the one in /config
```

## Settings

Everything else lives in `/config`, under the plugin (`/then color` wins over the color set here):

| Option | Values | Default |
|---|---|---|
| Language | `auto`, `español`, `english` | `auto` (follows Claude Code's language setting) |
| Band color | `blue`, `violet`, `green`, `amber`, `pink`, `cyan`, `custom` | `blue` |
| Custom color | any `#RRGGBB` | `#D97757` |

Every palette color keeps white text at 5:1 contrast or better; a light custom color gets dark text instead.

`/then` turns it off and on (`/then on`, `/then off`); both are remembered across sessions.

## What it costs

Then runs on your machine and calls no model of its own. What it spends is Claude's own tokens, measured on a real session (20 turns with options):

| What | When | Tokens |
|---|---|---|
| Its rule in the system prompt | every request, cached after the first | ~245 |
| The `offer` tool's definition | every request, cached after the first | ~295 |
| Claude writing the 4 options | once per turn, output | ~145 |
| The band's answer to Claude | once per turn, input | ~35 |
| Your pick, sent along with your message | when you pick | ~35 |

The one cost worth knowing: since the options are a tool call, each turn has **one extra step** after it, and that step re-reads the conversation from the prompt cache (billed at a tenth of the input price). In a 40k-token conversation that is about the price of 4k fresh input tokens per turn, plus ~145 output tokens. If Claude forgets the options after real work, the mod asks once, which costs one more such step.

`/then off` removes all of it: no rule, no tool call, no extra step.

## How it works

It is a Claude mod (a Claude Code hooks module). It adds one short rule to the system prompt and one tool, `offer`, that Claude calls last in a turn with the 4 options. The band is drawn above the prompt; what you type is read before it reaches Claude, and the option you chose travels with your message as context. Nothing leaves your machine.

Made to sit next to [plan-progress](https://github.com/zycck/claude-mods), whose look it borrows.

---

## Español

**Then** es un Claude mod para Claude Code.

Cada vez que Claude termina un turno, deja **4 opciones numeradas para seguir encima del prompt**, más una quinta que escribes tú. Escribes el número y listo.

- **Una tecla.** Con el prompt vacío, escribe `3` y la opción 3 sale al instante, sin Enter.
- **O dilo.** `quiero la 3`, `la 2 y la 4`, `2 pero sin commit` + Enter también sirven.
- **La 5 es libre.** Escribe `5` y la banda se queda mientras escribes lo tuyo.
- **★ sugerida** marca la que Claude recomienda.
- **consumo** dice cuánto gastaría cada opción en tokens y tiempo: nada, bajo, medio, alto.
- **Pasa el mouse sobre una descripción larga** y se desplaza para leerla entera (modo pantalla completa de la terminal o la app de escritorio).

### Instalar

```
/plugin install then --marketplace gaboxdev/then
```

Responde `y` para agregar el mercado y elige el alcance de usuario.

### Ajustes

**Cambiar el color**, escribiéndolo en el prompt (se ve al instante y se recuerda):

```
/then color            → muestra el color actual y la lista
/then color violeta    → azul, violeta, verde, ámbar, rosa, cian
/then color #D97757    → cualquier #RRGGBB
/then color normal     → vuelve al de /config
```

En `/config` están el idioma (`auto`, `español`, `english`) y el color por defecto. `/then` lo apaga y lo prende (`/then on`, `/then off`).

### Cuánto consume

Then corre en tu máquina y no llama a ningún modelo propio. Gasta tokens de Claude, medidos en una sesión real:

- **Fijo, en el prompt de sistema:** ~540 tokens (la regla y la herramienta). Quedan en caché después de la primera petición.
- **Por turno:** ~145 tokens de salida (Claude escribiendo las 4 opciones) y ~35 de entrada (la respuesta de la banda).
- **Lo que más pesa:** como las opciones son una llamada a herramienta, cada turno tiene **un paso extra** que vuelve a leer la conversación desde la caché (cobrada a una décima del precio de entrada). En una conversación de 40k tokens equivale a unos 4k tokens de entrada por turno.
- Si Claude olvida las opciones después de trabajar, el mod le pide una vez que las ponga: un paso extra más.

`/then off` lo quita todo: sin regla, sin herramienta, sin paso extra.

## License

MIT
