<?php

namespace craft\contentmigrations;

use Craft;
use craft\db\Migration;
use modules\profiledatamodule\records\ProfiledataModuleRecord;
use modules\profiledatamodule\records\ProfiledataTotalModuleRecord;

/**
 * m220601_134305_add_profiledata_table migration.
 */
class m220601_134305_add_profiledata_table extends Migration
{
    /**
     * @inheritdoc
     */
    public function safeUp()
    {
        // Place migration code here...
        $table = ProfiledataModuleRecord::tableName();
        $tableTotal = ProfiledataTotalModuleRecord::tableName();

        if(!$this->db->tableExists($table)){
            $this->createTable($table, [
                'id' => $this->primaryKey(),
                'leadScore' => $this->integer()->notNull()->defaultValue(0),
                'mScore' => $this->integer()->notNull()->defaultValue(0),
                'sScore' => $this->integer()->notNull()->defaultValue(0),
                'cScore' => $this->integer()->notNull()->defaultValue(0),
                'hScore' => $this->integer()->notNull()->defaultValue(0),
                'sessionKey' => $this->text(),
                'userAgent' => $this->tinyText(),
                'dateCreated' => $this->dateTime()->notNull(),
                'dateUpdated' => $this->dateTime()->notNull(),
                'uid' => $this->uid()
            ]);

            $this->createIndex(null, $table, 'sessionKey', false);
        }

        if(!$this->db->tableExists($tableTotal)){
            $this->createTable($tableTotal, [
                'id' => $this->primaryKey(),
                'leadScore' => $this->integer()->notNull()->defaultValue(0),
                'mScore' => $this->integer()->notNull()->defaultValue(0),
                'sScore' => $this->integer()->notNull()->defaultValue(0),
                'cScore' => $this->integer()->notNull()->defaultValue(0),
                'hScore' => $this->integer()->notNull()->defaultValue(0),
                'sessionKey' => $this->text(),
                'dateCreated' => $this->dateTime()->notNull(),
                'dateUpdated' => $this->dateTime()->notNull(),
                'uid' => $this->uid()
            ]);

            $this->createIndex(null, $tableTotal, 'sessionKey', true);
        }

        Craft::$app->db->schema->refresh();

        return true;
    }

    /**
     * @inheritdoc
     */
    public function safeDown()
    {
        $table = ProfiledataModuleRecord::tableName();
        $tableTotal = ProfiledataTotalModuleRecord::tableName();
        // profiledatamodule_profiledatamodulerecord table
        $this->dropTableIfExists($table);
        $this->dropTableIfExists($tableTotal);

        return true;
    }
}
