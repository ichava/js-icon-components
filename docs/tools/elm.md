# Elm

`dist/elm/` is the Elm flavour: one `Ichava.Icons.<Pack>` module per pack, one function per icon, shipped as Elm source.

## Modules

| Module | File | Exposes |
|---|---|---|
| `Ichava.Icons.Tabler` | `dist/elm/Ichava/Icons/Tabler.elm` | `iconMug : List (Svg.Attribute msg) -> Svg msg`, … |
| `Ichava.Icons.Flag` | `dist/elm/Ichava/Icons/Flag.elm` | `iconKe`, … |
| `Ichava.Icons.Emoji`, `Ichava.Icons.Openmoji` | the same layout | |

Function names are the export names with a lower-case first letter: `IconMugFilled` is `iconMugFilled`.

## Setup

Elm has no npm runtime, so the modules are source an Elm compiler reads. Add the directory to your
`elm.json`, and depend on `elm/svg` and `elm/virtual-dom`:

```json
{
  "source-directories": ["src", "node_modules/@ichava/js-icon-components/dist/elm"],
  "dependencies": { "direct": { "elm/svg": "1.0.1", "elm/virtual-dom": "1.0.3" } }
}
```

## Usage

```elm
import Ichava.Icons.Tabler as Tabler
import Svg.Attributes

view =
    Tabler.iconMug [ Svg.Attributes.width "20", Svg.Attributes.height "20", Svg.Attributes.color "#7c3aed" ]
```

Your attributes come after the defaults, so they win. The root carries `role="img"` and
`aria-hidden="true"`; to name an icon, pass `VirtualDom.attribute "aria-hidden" "false"` and an
`aria-label`. Elm's compiler drops every icon you do not call, so a program carries only those.

## The 16-bit column limit

Elm's parser keeps line and column positions in 16 bits, so a line of 65,536 characters or more
fails with `UNFINISHED LIST` even though the code is valid. The flag pack's 1x1 `bo` flag broke it
at its 329th path when an icon was written on one line. So every element and attribute is on its
own line, and a string over 2,000 characters is split into `++` pieces; a test asserts no
generated line reaches the limit.

## Tests

`tests/elm.test.ts` compiles the generated modules, the whole flag and Tabler packs included, with
the real compiler (`elm make`, from npm's `elm` package), runs the compiled program in jsdom and
snapshots what Elm rendered. It also proves the compiler refuses a call that does not type-check.
The first run fetches `elm/core`, `elm/svg` and `elm/virtual-dom` from package.elm-lang.org into
`.cache/elm-home`.

## Format id

`elm`, listed in icon-browser's format registry since schema 1.6.0 and required by the registry guard.

---

[← Docs index](../../README.md#documentation)
