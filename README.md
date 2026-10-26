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

## Settings

In `/config`, under the plugin:

| Option | Values | Default |
|---|---|---|
| Language | `auto`, `español`, `english` | `auto` (follows Claude Code's language setting) |
| Band color | `blue`, `violet`, `green`, `amber`, `pink`, `cyan`, `custom` | `blue` |
| Custom color | any `#RRGGBB` | `#D97757` |

Every palette color keeps white text at 5:1 contrast or better; a light custom color gets dark text instead.

`/then` turns it off and on (remembered across sessions).

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

En `/config`: idioma (`auto`, `español`, `english`), color de la banda (`blue`, `violet`, `green`, `amber`, `pink`, `cyan`, `custom`) y color personalizado (`#RRGGBB`). `/then` lo apaga y lo prende.

## License

MIT
