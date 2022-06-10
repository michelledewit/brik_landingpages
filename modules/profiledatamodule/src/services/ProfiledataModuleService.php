<?php
/**
 * profiledata module for Craft CMS 3.x
 *
 * gathering of website visitor profile data
 *
 * @link      https://brik.digital
 * @copyright Copyright (c) 2022 Michelle de Wit / John Ripmeester
 */

namespace modules\profiledatamodule\services;

use Craft;
use craft\base\Component;
use modules\profiledatamodule\records\ProfiledataModuleRecord;
use modules\profiledatamodule\records\ProfiledataTotalModuleRecord;

/**
 * ProfiledataModuleService Service
 *
 * All of your module’s business logic should go in services, including saving data,
 * retrieving data, etc. They provide APIs that your controllers, template variables,
 * and other modules can interact with.
 *
 * https://craftcms.com/docs/plugins/services
 *
 * @author    Michelle de Wit / John Ripmeester
 * @package   ProfiledataModule
 * @since     0.0.1
 */
class ProfiledataModuleService extends Component
{
    // Public Methods
    // =========================================================================

    /**
     * This function can literally be anything you want, and you can have as many service
     * functions as you want
     *
     * From any other plugin/module file, call it like this:
     *
     *     ProfiledataModule::$instance->profiledataModuleService->exampleService()
     *
     * @return mixed
     */
    public function writeScore($leadScore,$mScore,$sScore,$cScore,$hScore, $token)
    {
        $request = Craft::$app->getRequest();

        $record = new ProfiledataModuleRecord();
        $record->leadScore = $leadScore;
        $record->mScore = $mScore;
        $record->sScore = $sScore;
        $record->cScore = $cScore;
        $record->hScore = $hScore;
        $record->sessionKey = $token;
        $record->userAgent = $request->getUserAgent();

        return $record->save();
    }

    public function updateTotalScore($token) {

        $request = Craft::$app->getRequest();

        $dataRecords = ProfiledataModuleRecord::find()
            ->select([
                'SUM(leadScore) as leadScore',
                'SUM(mScore) as mScore',
                'SUM(sScore) as sScore',
                'SUM(cScore) as cScore',
                'SUM(hScore) as hScore',
                'sessionKey'
            ])
            ->where(['sessionKey'=>$token])
            ->asArray(true)
            ->one();

        $totalRecord = ProfiledataTotalModuleRecord::find()
            ->where(['sessionKey'=>$token])
            ->one();

        if($totalRecord == null) {
            $totalRecord = new ProfiledataTotalModuleRecord();
            $totalRecord->sessionKey = $token;
        }
        $totalRecord->leadScore = $dataRecords['leadScore'];
        $totalRecord->mScore = $dataRecords['mScore'];
        $totalRecord->sScore = $dataRecords['sScore'];
        $totalRecord->cScore = $dataRecords['cScore'];
        $totalRecord->hScore = $dataRecords['hScore'];

        $totalRecord->save();

        return $totalRecord;
    }

    public function getTotalScores() {

        $totalRecord = ProfiledataTotalModuleRecord::find()
            ->limit(100)
            ->all();

        return $totalRecord;
    }
}
