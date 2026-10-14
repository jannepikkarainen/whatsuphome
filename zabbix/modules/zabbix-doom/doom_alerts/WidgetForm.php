<?php

namespace Modules\DoomAlerts;

use Zabbix\Widgets\CWidgetForm;
use Zabbix\Widgets\Fields\CWidgetFieldIntegerBox;

class WidgetForm extends CWidgetForm {

    public function addFields(): static {
        return $this
            ->addField(
                (new CWidgetFieldIntegerBox('refresh_interval', _('Alert refresh interval (seconds)')))
                    ->setDefault(30)
            )
            ->addField(
                (new CWidgetFieldIntegerBox('min_severity', _('Min severity (0=all, 5=disaster only)')))
                    ->setDefault(0)
            );
    }
}
