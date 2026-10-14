# DOOM: Alert Slayer — a Zabbix dashboard widget

Active Zabbix problems spawn as demons. Shoot them to acknowledge the problem.

Two modes in one widget:

- **Alert mode** — a small built-in raycaster FPS. Every active problem becomes an enemy
  (Disaster = Cyberdemon, Information = Zombie). Killing one calls `event.acknowledge`.
- **Real DOOM** — id Software's actual engine ([doomgeneric](https://github.com/ozkl/doomgeneric))
  compiled to WebAssembly, booting straight into E1M1. Live monsters are linked to live
  alerts; killing one acknowledges the alert it carries.

Shown at Zabbix Summit 2026.

Author: Janne Pikkarainen / Forcepoint / What's up, home?

## Install

Developed and tested on Zabbix 8.0 (alpha 2).

1. Copy `doom_alerts/` to `<zabbix-ui>/modules/doom_alerts/` (e.g. `/usr/share/zabbix/ui/modules/`).
2. Administration → General → Modules → *Scan directory*, then enable **DOOM: Alert Slayer**.
3. Add the widget to a dashboard. Settings: alert refresh interval, minimum severity.

The widget talks to the Zabbix frontend's own `api_jsonrpc.php` using the logged-in user's
session, so it can only acknowledge problems that user may acknowledge.

## Layout

| Path | What |
|---|---|
| `doom_alerts/` | The Zabbix module (PHP, JS, and the prebuilt `doomwidget.{js,wasm,data}`) |
| `engine-src/` | Source of the WebAssembly build: doomgeneric plus the widget hooks |

## Rebuilding the WebAssembly engine

Requires [Emscripten](https://emscripten.org/). The WAD is bundled inside
`doomwidget.data`; extract it, build, and copy the output back:

```sh
cd engine-src
head -c 4196020 ../doom_alerts/assets/doomwasm/doomwidget.data > doom1.wad
./build_widget.sh
cp doomwidget.js doomwidget.wasm doomwidget.data ../doom_alerts/assets/doomwasm/
```

The widget-specific changes to upstream doomgeneric are in `doomgeneric_widget.c` (platform
layer and the monster/alert hooks), `p_mobj.h` (an alert tag on `mobj_t`) and `p_inter.c`
(callback to JS when a tagged monster dies).

## License and credits

- Engine and this widget: **GNU GPL v2 or later** — see `LICENSE`.
- DOOM © id Software. Source released under the GPL.
- [doomgeneric](https://github.com/ozkl/doomgeneric) by ozkl; Chocolate Doom by Simon Howard
  and contributors; `mus2mid.c` by Ben Ryves.
- `doomwidget.data` contains the **shareware** `doom1.wad` (v1.9), which remains id Software's
  and is distributed under its shareware terms. It is *not* GPL, and it is not the full game.
  This project is not affiliated with or endorsed by id Software or Zabbix SIA.
