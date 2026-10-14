<?php

/**
 * DOOM: Alert Slayer – widget view.
 *
 * @var CView  $this
 * @var array  $data
 */

// Guard: if validation failed upstream, $data may lack required keys.
if (!array_key_exists('uniqueid', $data)) {
    return;
}

$uniqueid     = $data['uniqueid'];
$refresh      = (int) ($data['fields']['refresh_interval'] ?? 30);
$min_severity = (int) ($data['fields']['min_severity']     ?? 0);

(new CWidgetView($data))
    ->addItem(
        (new CDiv())
            ->setId('doom-wrap-' . $uniqueid)
            ->addClass('doom-alerts-widget')
            ->setAttribute('data-uniqueid',    $uniqueid)
            ->setAttribute('data-refresh',     $refresh)
            ->setAttribute('data-min-severity', $min_severity)
            ->addItem(
                (new CTag('canvas', true))
                    ->addClass('doom-canvas')
                    ->setAttribute('tabindex', '0')
            )
            ->addItem(
                (new CDiv())
                    ->addClass('doom-overlay-msg')
                    ->addStyle('display:none')
            )
    )
    ->show();
