<?php
/**
 * General Configuration
 *
 * All of your system's general configuration settings go in here. You can see a
 * list of the available settings in vendor/craftcms/cms/src/config/GeneralConfig.php.
 *
 * @see craft\config\GeneralConfig
 */

return [
    // Global settings
    'transformer' => 'imgix',
    'cacheDuration' => '31536000',
    'fillInterval' => '500',
    'imgixApiKey' => 'e9n88Xnbl6W7qmMJj0utxiXUdHrDLZjd',
    'imgixConfig' => [
        'default' => [
            'domains' => ['brik.imgix.net'],
            'useHttps' => true,
            'signKey' => 'a6v4HGjcGcZR44CZ',
            'sourceIsWebProxy' => false,
            'shardStrategy' => 'cycle',
            'getExternalImageDimensions' => true,
            'defaultParams' => ['auto'=>'compress,format', 'q'=>80],
        ]
    ]
];
