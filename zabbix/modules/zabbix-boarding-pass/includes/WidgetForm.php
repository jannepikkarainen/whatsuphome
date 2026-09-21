<?php declare(strict_types=1);

namespace Modules\BoardingPass\Includes;

use Zabbix\Widgets\CWidgetForm;
use Zabbix\Widgets\Fields\{
    CWidgetFieldTextBox,
    CWidgetFieldNumericBox
};

/**
 * Configuration form for the Boarding Pass Countdown widget.
 *
 * Points at any calculated/trapper item whose value is "seconds remaining"
 * (e.g. a "TARGET_EPOCH - now()" calculated item) and renders it as an
 * airline boarding pass instead of a bare number. Everything about the
 * livery text is config-driven so the same widget works for any deadline,
 * not just this one conference.
 */
class WidgetForm extends CWidgetForm {

    public function addFields(): self {
        return $this
            ->addField(
                (new CWidgetFieldTextBox('host_name', _('Host')))
                    ->setDefault('Zabbix server')
                    ->setFlags(CWidgetFieldTextBox::FLAG_NOT_EMPTY)
            )
            ->addField(
                (new CWidgetFieldTextBox('item_key', _('Item key (value = seconds remaining)')))
                    ->setDefault('zabbixsummit.timeuntil')
                    ->setFlags(CWidgetFieldTextBox::FLAG_NOT_EMPTY)
            )
            ->addField(
                (new CWidgetFieldTextBox('event_name', _('Event name')))
                    ->setDefault('ZABBIX SUMMIT 2026')
            )
            ->addField(
                (new CWidgetFieldTextBox('flight_no', _('Flight number')))
                    ->setDefault('ZBX 2026')
            )
            ->addField(
                (new CWidgetFieldTextBox('origin_code', _('Origin airport code')))
                    ->setDefault('HEL')
            )
            ->addField(
                (new CWidgetFieldTextBox('origin_city', _('Origin city')))
                    ->setDefault('Helsinki')
            )
            ->addField(
                (new CWidgetFieldTextBox('dest_code', _('Destination airport code')))
                    ->setDefault('RIX')
            )
            ->addField(
                (new CWidgetFieldTextBox('dest_city', _('Destination city')))
                    ->setDefault('Riga')
            )
            ->addField(
                (new CWidgetFieldTextBox('gate', _('Gate')))
                    ->setDefault('A26')
            )
            ->addField(
                (new CWidgetFieldTextBox('seat', _('Seat')))
                    ->setDefault('1A')
            )
            ->addField(
                (new CWidgetFieldTextBox('passenger_name', _('Passenger name (blank = "ON-CALL ENGINEER")')))
                    ->setDefault('')
            )
            ->addField(
                (new CWidgetFieldNumericBox('boarding_hours', _('Switch to BOARDING this many hours before departure')))
                    ->setDefault(2)
            );
    }
}
