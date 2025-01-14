<?php $module_template = get_module_option('template', $params['id']);
if ($module_template == false and isset($params['template'])) {
    $module_template = $params['template'];
}
if ($module_template != false) {
    $template_file = module_templates($config['module'], $module_template);
} else {
    $template_file = module_templates($config['module'], 'default');
}


$settings = get_module_option('settings', $params['id']);

$json = array();

if ($settings == false) {
    if (isset($params['settings'])) {
        $settings = $params['settings'];
        $json = json_decode($settings, true);
    } else {
        $json[] = array(
            'title' => 'Title 1',
            'id' => 'accordion-' .  $params['id']. '-1',
            'icon' => '<i class="fa fa-home"></i>'
        );


    }
} else {
    $json = json_decode($settings, true);
}

$data = array();
$count = 0;
if ($json and is_array($json) and !empty($json)) {
    foreach ($json as $slide) {
        $count++;
        if (!isset($slide['id'])) {
            $slide['id'] = 'accordion-' .  $params['id']. '-'.$count;
        }
        array_push($data, $slide);
    }
}


if (is_file($template_file)) {
    include($template_file);
}
