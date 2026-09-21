/**
 * Boarding Pass Countdown — Zabbix 7.0 Dashboard Widget
 *
 * Renders a "seconds remaining" calculated item as an airline boarding
 * pass: split-flap D/H/M/S clock, live SCHEDULED / BOARDING / DEPARTED
 * status, ticket-stub styling. The DOM is built once; every second only
 * the digit tiles that actually changed value get flipped, the same way
 * a real split-flap board only turns the flaps that need to turn.
 */

'use strict';

class CWidgetBoardingPass extends CWidget {

    onInitialize() {
        this._container = null;
        this._cfg = {};
        this._targetEpoch = null;
        this._tickHandle = null;
        this._digitEls = null;
        this._lastStatusText = null;
    }

    hasPadding() { return false; }
    onResize() {}

    onDestroy() {
        this._stopTicking();
    }

    processUpdateResponse(response) {
        super.processUpdateResponse(response);

        this._container = this._body.querySelector('.bp-container');
        if (!this._container) return;

        const raw = this._container.getAttribute('data-payload');
        if (!raw) return;

        let p;
        try { p = JSON.parse(atob(raw)); } catch (e) { return; }

        this._cfg = p.cfg || {};
        const serverClock = Number(p.server_clock) || Math.floor(Date.now() / 1000);
        const secondsRemaining = Number(p.seconds_remaining) || 0;
        this._targetEpoch = serverClock + secondsRemaining;

        // The server round-trip replaces this._body's content with a fresh,
        // empty '.bp-container' every refresh (the PHP view never renders the
        // ticket markup — it's built here). So rebuild unconditionally on
        // every update, not just the first one, or refreshes go blank.
        this._build();
        this._lastStatusText = null;
        this._updateStaticFields();

        this._stopTicking();
        this._tick();
        this._tickHandle = setInterval(() => this._tick(), 1000);
    }

    _stopTicking() {
        if (this._tickHandle) {
            clearInterval(this._tickHandle);
            this._tickHandle = null;
        }
    }

    /* ── One-time DOM build ───────────────────────────────── */

    _build() {
        const c = this._container;
        c.innerHTML = '';

        const ticket = document.createElement('div');
        ticket.className = 'bp-ticket';
        c.appendChild(ticket);

        ticket.innerHTML =
            '<div class="bp-livery"></div>' +
            '<div class="bp-main">' +
                '<div class="bp-header">' +
                    '<div class="bp-airline">' +
                        '<span class="bp-airline-mark">Z</span>' +
                        '<span class="bp-airline-name">ZABBIX AIRWAYS</span>' +
                    '</div>' +
                    '<div class="bp-class">Observability Class</div>' +
                '</div>' +
                '<div class="bp-event" data-role="event">EVENT</div>' +
                '<div class="bp-route">' +
                    '<div class="bp-route-point">' +
                        '<div class="bp-route-code" data-role="origin-code">HEL</div>' +
                        '<div class="bp-route-city" data-role="origin-city">Helsinki</div>' +
                    '</div>' +
                    '<div class="bp-route-path">' +
                        '<div class="bp-route-line"></div>' +
                        '<div class="bp-route-plane">&#9992;&#65039;</div>' +
                    '</div>' +
                    '<div class="bp-route-point bp-route-point-end">' +
                        '<div class="bp-route-code" data-role="dest-code">RIX</div>' +
                        '<div class="bp-route-city" data-role="dest-city">Riga</div>' +
                    '</div>' +
                '</div>' +
                '<div class="bp-clock" data-role="clock"></div>' +
                '<div class="bp-status bp-status-scheduled" data-role="status">SCHEDULED</div>' +
            '</div>' +
            '<div class="bp-perforation"></div>' +
            '<div class="bp-stub">' +
                '<div class="bp-stub-row"><span class="bp-stub-label">FLIGHT</span><span class="bp-stub-val" data-role="flight">ZBX 2026</span></div>' +
                '<div class="bp-stub-row"><span class="bp-stub-label">GATE</span><span class="bp-stub-val" data-role="gate">A26</span></div>' +
                '<div class="bp-stub-row"><span class="bp-stub-label">SEAT</span><span class="bp-stub-val" data-role="seat">1A</span></div>' +
                '<div class="bp-stub-row"><span class="bp-stub-label">PASSENGER</span><span class="bp-stub-val" data-role="passenger">ON-CALL ENGINEER</span></div>' +
                '<div class="bp-barcode"></div>' +
            '</div>';

        const clockEl = ticket.querySelector('[data-role="clock"]');
        const dd = this._makeDigitGroup(3);
        const hh = this._makeDigitGroup(2);
        const mm = this._makeDigitGroup(2);
        const ss = this._makeDigitGroup(2);

        clockEl.appendChild(this._makeUnit('DAYS', dd.group));
        clockEl.appendChild(this._makeColon());
        clockEl.appendChild(this._makeUnit('HRS', hh.group));
        clockEl.appendChild(this._makeColon());
        clockEl.appendChild(this._makeUnit('MIN', mm.group));
        clockEl.appendChild(this._makeColon());
        clockEl.appendChild(this._makeUnit('SEC', ss.group));

        this._digitEls = { dd: dd.chars, hh: hh.chars, mm: mm.chars, ss: ss.chars };
    }

    _makeDigitGroup(n) {
        const group = document.createElement('div');
        group.className = 'bp-flap-group';
        const chars = [];
        for (let i = 0; i < n; i++) {
            const flap = document.createElement('span');
            flap.className = 'bp-flap';
            const ch = document.createElement('span');
            ch.className = 'bp-flap-char';
            ch.textContent = '0';
            flap.appendChild(ch);
            group.appendChild(flap);
            chars.push(ch);
        }
        return { group, chars };
    }

    _makeUnit(labelText, digitGroupEl) {
        const wrap = document.createElement('div');
        wrap.className = 'bp-unit';
        wrap.appendChild(digitGroupEl);
        const label = document.createElement('div');
        label.className = 'bp-unit-label';
        label.textContent = labelText;
        wrap.appendChild(label);
        return wrap;
    }

    _makeColon() {
        const el = document.createElement('div');
        el.className = 'bp-colon';
        el.innerHTML = '<span></span><span></span>';
        return el;
    }

    /* ── Config-driven static text ────────────────────────── */

    _updateStaticFields() {
        const cfg = this._cfg || {};
        this._setText('event', (cfg.event_name || 'THE EVENT').toUpperCase());
        this._setText('origin-code', (cfg.origin_code || 'HEL').toUpperCase());
        this._setText('origin-city', cfg.origin_city || 'Helsinki');
        this._setText('dest-code', (cfg.dest_code || 'RIX').toUpperCase());
        this._setText('dest-city', cfg.dest_city || 'Riga');
        this._setText('flight', (cfg.flight_no || 'ZBX 2026').toUpperCase());
        this._setText('gate', (cfg.gate || 'A26').toUpperCase());
        this._setText('seat', (cfg.seat || '1A').toUpperCase());
        this._setText('passenger', (cfg.passenger_name && String(cfg.passenger_name).trim())
            ? String(cfg.passenger_name).toUpperCase()
            : 'ON-CALL ENGINEER');
    }

    _setText(role, text) {
        const el = this._container.querySelector('[data-role="' + role + '"]');
        if (el) el.textContent = text;
    }

    /* ── Per-second tick ───────────────────────────────────── */

    _tick() {
        if (this._targetEpoch === null || !this._digitEls) return;

        let remaining = Math.floor(this._targetEpoch - (Date.now() / 1000));
        const boardingHours = Number(this._cfg.boarding_hours || 2);

        let statusText, statusClass;
        if (remaining <= 0) {
            statusText = 'DEPARTED ✈ ' + this._fmtElapsed(-remaining) + ' AGO';
            statusClass = 'bp-status-departed';
            remaining = 0;
        } else if (remaining <= boardingHours * 3600) {
            statusText = 'BOARDING NOW';
            statusClass = 'bp-status-boarding';
        } else {
            statusText = 'SCHEDULED';
            statusClass = 'bp-status-scheduled';
        }

        if (statusText !== this._lastStatusText) {
            const statusEl = this._container.querySelector('[data-role="status"]');
            const ticketEl = this._container.querySelector('.bp-ticket');
            if (statusEl) {
                statusEl.textContent = statusText;
                statusEl.className = 'bp-status ' + statusClass;
            }
            if (ticketEl) {
                ticketEl.classList.toggle('bp-ticket-boarding', statusClass === 'bp-status-boarding');
                ticketEl.classList.toggle('bp-ticket-departed', statusClass === 'bp-status-departed');
            }
            this._lastStatusText = statusText;
        }

        const days = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        const secs = Math.floor(remaining % 60);

        this._setDigits(this._digitEls.dd, String(Math.min(days, 999)).padStart(3, '0'));
        this._setDigits(this._digitEls.hh, String(hours).padStart(2, '0'));
        this._setDigits(this._digitEls.mm, String(mins).padStart(2, '0'));
        this._setDigits(this._digitEls.ss, String(secs).padStart(2, '0'));
    }

    _setDigits(els, str) {
        for (let i = 0; i < els.length; i++) {
            const ch = str[i] || '0';
            if (els[i].textContent !== ch) {
                els[i].textContent = ch;
                const flap = els[i].parentElement;
                flap.classList.remove('flipping');
                void flap.offsetWidth; // restart the CSS animation
                flap.classList.add('flipping');
            }
        }
    }

    _fmtElapsed(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return d + 'D ' + h + 'H';
        if (h > 0) return h + 'H ' + m + 'M';
        return m + 'M';
    }
}
