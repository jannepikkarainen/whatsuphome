<?php declare(strict_types=1);

$view = new CWidgetView($data);

$payload = json_encode([
    'cfg'               => $data['cfg']               ?? [],
    'seconds_remaining' => $data['seconds_remaining']  ?? 0,
    'server_clock'      => $data['server_clock']       ?? time(),
    'source_ok'         => $data['source_ok']          ?? false,
], JSON_UNESCAPED_UNICODE);

$body = (new CDiv())
    ->addClass('bp-container')
    ->setAttribute('data-payload', base64_encode($payload));

$view->addItem($body);
$view->show();
