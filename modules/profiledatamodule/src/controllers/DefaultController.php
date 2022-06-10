<?php
/**
 * profiledata module for Craft CMS 3.x
 *
 * gathering of website visitor profile data
 *
 * @link      https://brik.digital
 * @copyright Copyright (c) 2022 Michelle de Wit / John Ripmeester
 */

namespace modules\profiledatamodule\controllers;

use modules\profiledatamodule\ProfiledataModule;
use Craft;
use craft\web\Controller;
use craft\helpers\Json;

/**
 * Default Controller
 *
 * Generally speaking, controllers are the middlemen between the front end of
 * the CP/website and your module’s services. They contain action methods which
 * handle individual tasks.
 *
 * A common pattern used throughout Craft involves a controller action gathering
 * post data, saving it on a model, passing the model off to a service, and then
 * responding to the request appropriately depending on the service method’s response.
 *
 * Action methods begin with the prefix “action”, followed by a description of what
 * the method does (for example, actionSaveIngredient()).
 *
 * https://craftcms.com/docs/plugins/controllers
 *
 * @author    Michelle de Wit / John Ripmeester
 * @package   ProfiledataModule
 * @since     0.0.1
 */
class DefaultController extends Controller
{

    // Protected Properties
    // =========================================================================

    /**
     * @var    bool|array Allows anonymous access to this controller's actions.
     *         The actions must be in 'kebab-case'
     * @access protected
     */
    protected $allowAnonymous = ['index', 'write-msch'];

    // Public Methods
    // =========================================================================

    /**
     * Handle a request going to our module's index action URL,
     * e.g.: actions/profiledata-module/default
     *
     * @return mixed
     */
    public function actionWriteMsch()
    {
        $request = Craft::$app->getRequest();
        if(!$request->isPost) exit('not allowed');

        $statData = $request->getBodyParam('stats');
        $session = Craft::$app->session;
        $token = $request->getBodyParam('token');

        $dataService = ProfiledataModule::$instance->profiledataModuleService;

        $succes = true;
        $totalRecord = null;
        if($statData[0] != 0 || $statData[1] != 0 || $statData[2] != 0 || $statData[3] != 0 || $statData[4] != 0) {
            $succes = $dataService->writeScore($statData[0], $statData[1], $statData[2], $statData[3], $statData[4], $token);
        }
        if($succes) {
            $totalRecord = $dataService->updateTotalScore($token);
        }

        $result = ['succes' => $succes, 'data' => $totalRecord];

        return  Json::encode($result);
    }

    public function actionTotalItems()
    {

        $dataService = ProfiledataModule::$instance->profiledataModuleService;
        $dataScores = $dataService->getTotalScores();

        return  Json::encode($dataScores);
    }
}
