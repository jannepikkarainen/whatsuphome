<?php

namespace Modules\DoomAlerts\Actions;

use CController as CAction;
use CControllerResponseData;
use CRoleHelper;
use Modules\DoomAlerts\WidgetForm;

class WidgetEdit extends CAction {

    public function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        $fields = [
            'name'             => 'string',
            'type'             => 'string',
            'view_mode'        => 'in 0,1',
            'known_types'      => 'array',
            'deprecated_types' => 'array',
            'fields'           => 'array',
        ];

        $ret = $this->validateInput($fields);

        if (!$ret) {
            $this->setResponse(new CControllerResponseData(['main_block' => '']));
        }

        return $ret;
    }

    protected function checkPermissions(): bool {
        return $this->checkAccess(CRoleHelper::UI_MONITORING_DASHBOARD);
    }

    protected function doAction(): void {
        // In Zabbix 8.0, CWidgetForm::__construct() stores values but does NOT call
        // addFields() or setFieldsValues() — those are normally called by CWidget::getForm().
        // Since we have a custom action controller we must call them explicitly.
        $form = new WidgetForm($this->getInput('fields', []));
        $form->addFields();
        $form->setFieldsValues();

        // Module widgets may not appear in the known_types sent by the Zabbix frontend.
        // Ensure our own type is always present so the Type dropdown is not empty.
        $known_types = $this->getInput('known_types', []);
        if (!array_key_exists('doom_alerts', $known_types)) {
            $known_types['doom_alerts'] = _('DOOM: Alert Slayer');
        }

        $this->setResponse(new CControllerResponseData([
            'name'             => $this->getInput('name', ''),
            'type'             => $this->getInput('type', 'doom_alerts'),
            'view_mode'        => $this->getInput('view_mode', 0),
            'known_types'      => $known_types,
            'deprecated_types' => $this->getInput('deprecated_types', []),
            'fields'           => $form->getFields(),
            'user'             => [
                'debug_mode' => $this->getDebugMode(),
            ],
        ]));
    }
}
