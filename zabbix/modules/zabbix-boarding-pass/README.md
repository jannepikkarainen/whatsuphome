# Boarding Pass Countdown — Zabbix 7.0 Dashboard Widget

Turns a boring "seconds remaining" number into an airline boarding pass:
split-flap D/H/M/S clock, a route line with a taxiing plane, a ticket stub
with flight/gate/seat, and a status pill that flips itself between
`SCHEDULED` → `BOARDING NOW` → `DEPARTED` as the clock runs down.

Built for the `zabbixsummit.timeuntil` calculated item on the `Zabbix server`
host (see `parse_source.py`-adjacent history: this is the "Zabbix Summit 2026
begins in" item), but every label is config-driven — point it at any
calculated item whose value is *seconds remaining until X* and it becomes a
countdown to that instead.

![states](preview.html) — open in a browser, or see the three states below.

## Why not the stock countdown widgets

Zabbix's built-ins here are a plain "Item value" widget or a graph — a
number with a name next to it. This is a novelty item on a home Zabbix; it
deserved a novelty widget. The split-flap tiles only flip the characters
that actually changed (like a real Solari board), and the whole thing reuses
the flap-generation idea from the `zabbix-departures` widget in this repo,
just built for a single ticket instead of a table of rows.

## Install

1. Copy this directory to `<zabbix-frontend>/modules/boarding_pass/`.
2. Administration → General → Modules → Scan directory → enable
   "Boarding Pass Countdown".
3. Add the widget to a dashboard, point it at your host + item key.

## Config fields

| Field | Default | Notes |
|---|---|---|
| Host | `Zabbix server` | Host the countdown item lives on |
| Item key | `zabbixsummit.timeuntil` | Item's **value** must be seconds remaining (an item like `TARGET_EPOCH - now()`) |
| Event name | `ZABBIX SUMMIT 2026` | Shown under the airline header |
| Flight number | `ZBX 2026` | Ticket stub |
| Origin code / city | `HEL` / `Helsinki` | Left side of the route line |
| Destination code / city | `RIX` / `Riga` | Right side of the route line |
| Gate, Seat | `A26`, `1A` | Ticket stub, purely cosmetic |
| Passenger name | *(blank)* | Falls back to "ON-CALL ENGINEER" |
| Boarding threshold (hours) | `2` | Switches the status pill to `BOARDING NOW` this many hours before zero |

## How the countdown stays smooth

The widget only refreshes from Zabbix every `refresh_rate` (60s by default),
but the clock ticks every second. `WidgetView.php` reads the item's
`lastvalue` (seconds remaining) and `lastclock` (when that was computed) and
the JS anchors `target = lastclock + lastvalue`, then ticks
`remaining = target - now()` locally in the browser. Each refresh
re-anchors from the server, so any client clock drift self-corrects every
minute instead of accumulating.

If the item can't be resolved (wrong host/key, or it hasn't produced a
value yet), the widget falls back to a 16-day demo countdown rather than
showing an error — same pattern as the other widgets in this repo
(`zabbix-heartbeat`, `zabbix-departures`), so the dashboard editor preview
always renders something.

## Files

Standard module layout used across this repo's custom widgets:
`manifest.json`, `Module.php`, `includes/WidgetForm.php` (config fields),
`actions/WidgetView.php` (server-side fetch), `views/widget.view.php`
(base64-encoded JSON payload into the DOM), `assets/js/class.widget.js` +
`assets/css/widget.css` (render + flip animation), `preview.html`
(standalone render for local iteration, no Zabbix required).
