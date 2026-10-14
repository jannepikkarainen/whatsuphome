<?php

namespace Modules\DoomAlerts\Actions;

use CController as CAction;
use CControllerResponseData;
use CRoleHelper;

class WidgetView extends CAction {

    public function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        $fields = [
            'name'      => 'string',
            'edit_mode' => 'in 0,1',
            'view_mode' => 'in 0,1',
            'uniqueid'  => 'string',
            'fields'    => 'array',
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
        $fields = $this->getInput('fields', []);

        $this->setResponse(new CControllerResponseData([
            'name'      => $this->getInput('name', ''),
            'edit_mode' => (int) $this->getInput('edit_mode', 0),
            'view_mode' => (int) $this->getInput('view_mode', 0),
            'uniqueid'  => $this->getInput('uniqueid', uniqid('doom')),
            'fields'    => [
                'refresh_interval' => (int) ($fields['refresh_interval'] ?? 30),
                'min_severity'     => (int) ($fields['min_severity']     ?? 0),
            ],
            'user'      => [
                'debug_mode' => $this->getDebugMode(),
            ],
        ]));
    }
}
