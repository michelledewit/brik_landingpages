<?php
/**
 * profiledata module for Craft CMS 3.x
 *
 * gathering of website visitor profile data
 *
 * @link      https://brik.digital
 * @copyright Copyright (c) 2022 Michelle de Wit / John Ripmeester
 */

namespace modules\profiledatamodule\variables;

use modules\profiledatamodule\ProfiledataModule;

use Craft;

/**
 * profiledata Variable
 *
 * Craft allows modules to provide their own template variables, accessible from
 * the {{ craft }} global variable (e.g. {{ craft.profiledataModule }}).
 *
 * https://craftcms.com/docs/plugins/variables
 *
 * @author    Michelle de Wit / John Ripmeester
 * @package   ProfiledataModule
 * @since     0.0.1
 */
class ProfiledataModuleVariable
{
    // Public Methods
    // =========================================================================

    /**
     * Whatever you want to output to a Twig template can go into a Variable method.
     * You can have as many variable functions as you want.  From any Twig template,
     * call it like this:
     *
     *     {{ craft.profiledataModule.exampleVariable }}
     *
     * Or, if your variable requires parameters from Twig:
     *
     *     {{ craft.profiledataModule.exampleVariable(twigValue) }}
     *
     * @param null $optional
     * @return string
     */
    public function getTotalScores($optional = null)
    {
        $dataService = ProfiledataModule::$instance->profiledataModuleService;
        $dataScores = $dataService->getTotalScores();

        return $dataScores;
    }
}
