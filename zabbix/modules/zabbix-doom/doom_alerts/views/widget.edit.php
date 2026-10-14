<?php

/**
 * DOOM: Alert Slayer – widget edit form.
 *
 * @var CView  $this
 * @var array  $data
 */

// $data['fields'] contains CWidgetField objects returned by WidgetForm::getFields().
// CWidgetFieldIntegerBoxView wraps each field object and renders label + input.
(new CWidgetFormView($data))
    ->addField(new CWidgetFieldIntegerBoxView($data['fields']['refresh_interval']))
    ->addField(new CWidgetFieldIntegerBoxView($data['fields']['min_severity']))
    ->show();
