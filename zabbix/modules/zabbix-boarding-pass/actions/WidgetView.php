<?php declare(strict_types=1);

namespace Modules\BoardingPass\Actions;

use CControllerDashboardWidgetView,
    CControllerResponseData;

/**
 * Boarding Pass Countdown — widget shell.
 *
 * Resolves the configured host + item key to a "seconds remaining" value
 * and the server clock at the time it was last polled. The JS ticks the
 * countdown locally between refreshes so the flap clock stays smooth
 * (down to the second) instead of jumping once per refresh_rate.
 */
class WidgetView extends CControllerDashboardWidgetView {

    protected function doAction(): void {
        $fields = $this->getForm()->getFieldsValues();

        $cfg = [
            'event_name'      => (string)($fields['event_name']      ?? 'ZABBIX SUMMIT 2026'),
            'flight_no'       => (string)($fields['flight_no']       ?? 'ZBX 2026'),
            'origin_code'     => (string)($fields['origin_code']     ?? 'HEL'),
            'origin_city'     => (string)($fields['origin_city']     ?? 'Helsinki'),
            'dest_code'       => (string)($fields['dest_code']       ?? 'RIX'),
            'dest_city'       => (string)($fields['dest_city']       ?? 'Riga'),
            'gate'            => (string)($fields['gate']            ?? 'A26'),
            'seat'            => (string)($fields['seat']            ?? '1A'),
            'passenger_name'  => (string)($fields['passenger_name']  ?? ''),
            'boarding_hours'  => (float)($fields['boarding_hours']   ?? 2),
        ];

        $data = $this->fetchCountdown(
            (string)($fields['host_name'] ?? 'Zabbix server'),
            (string)($fields['item_key']  ?? 'zabbixsummit.timeuntil')
        );

        $this->setResponse(new CControllerResponseData([
            'name'             => $this->getInput('name', $this->widget->getDefaultName()),
            'cfg'              => $cfg,
            'seconds_remaining'=> $data['seconds_remaining'],
            'server_clock'     => $data['server_clock'],
            'source_ok'        => $data['source_ok'],
            'user'             => ['debug_mode' => $this->getDebugMode()],
        ]));
    }

    private function fetchCountdown(string $host_name, string $item_key): array {
        try {
            $hosts = \API::Host()->get([
                'output' => ['hostid'],
                'filter' => ['host' => $host_name],
            ]);
            if (!is_array($hosts) || empty($hosts)) {
                return $this->staticCountdown();
            }

            $items = \API::Item()->get([
                'output'   => ['itemid', 'lastvalue', 'lastclock'],
                'hostids'  => [$hosts[0]['hostid']],
                'filter'   => ['key_' => $item_key],
            ]);
            if (!is_array($items) || empty($items) || $items[0]['lastclock'] === '0') {
                return $this->staticCountdown();
            }

            return [
                'seconds_remaining' => (int)$items[0]['lastvalue'],
                'server_clock'      => (int)$items[0]['lastclock'],
                'source_ok'         => true,
            ];
        } catch (\Throwable $e) {
            return $this->staticCountdown();
        }
    }

    /** Demo data — used in the dashboard editor preview and if the item can't be resolved yet. */
    private function staticCountdown(): array {
        return [
            'seconds_remaining' => 16 * 86400 + 9 * 3600 + 42 * 60 + 7,
            'server_clock'      => time(),
            'source_ok'         => false,
        ];
    }
}
