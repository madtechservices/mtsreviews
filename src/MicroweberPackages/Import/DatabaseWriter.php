<?php
namespace MicroweberPackages\Import;


use MicroweberPackages\Backup\Loggers\DefaultLogger;
use MicroweberPackages\Import\Loggers\ImportLogger;
use MicroweberPackages\Import\Traits\DatabaseCategoriesWriter;
use MicroweberPackages\Import\Traits\DatabaseCategoryItemsWriter;
use MicroweberPackages\Import\Traits\DatabaseContentDataWriter;
use MicroweberPackages\Import\Traits\DatabaseContentFieldsWriter;
use MicroweberPackages\Import\Traits\DatabaseContentWriter;
use MicroweberPackages\Import\Traits\DatabaseCustomFieldsWriter;
use MicroweberPackages\Import\Traits\DatabaseMediaWriter;
use MicroweberPackages\Import\Traits\DatabaseMenusWriter;
use MicroweberPackages\Import\Traits\DatabaseModuleWriter;
use MicroweberPackages\Import\Traits\DatabaseRelationWriter;
use MicroweberPackages\Import\Traits\DatabaseTaggingTaggedWriter;

/**
 * Microweber - Backup Module Database Writer
 * @namespace MicroweberPackages\Backup
 * @package DatabaseWriter
 * @author Bozhidar Slaveykov
 */
class DatabaseWriter
{
	use DatabaseMediaWriter;
	use DatabaseModuleWriter;
	use DatabaseMenusWriter;
	use DatabaseRelationWriter;
	use DatabaseCustomFieldsWriter;
	use DatabaseContentWriter;
	use DatabaseContentFieldsWriter;
	use DatabaseContentDataWriter;
	use DatabaseCategoriesWriter;
	use DatabaseCategoryItemsWriter;
	use DatabaseTaggingTaggedWriter;

	/**
	 * The current batch step.
	 * @var integer
	 */
	public $step = 0;

	/**
	 * The total steps for batch.
	 * @var integer
	 */
	public $totalSteps = 10;

	/**
	 * Overwrite by id
	 * @var string
	 */
	public $overwriteById = false;

    /**
     * Delete old content
     * @var bool
     */
	public $deleteOldContent = false;

	/**
	 * The content from backup file
	 * @var string
	 */
	public $content;

    public $logger;

	public function setContent($content)
	{
		$this->content = $content;
	}

	public function setStep($step) {
		$this->step = $step;
	}

	public function setOverwriteById($overwrite) {
		$this->overwriteById = $overwrite;
	}

	public function setDeleteOldContent($delete) {
	    $this->deleteOldContent = $delete;
    }

    public function setLogger(DefaultLogger $logger) {
        $this->logger = $logger;
    }

	/**
	 * Unset item fields
	 * @param array $item
	 * @return array
	 */
	private function _unsetItemFields($item) {
		$unsetFields = array('id', 'rel_id', 'order_id', 'parent_id', 'position');
		foreach($unsetFields as $field) {
			unset($item[$field]);
		}
		return $item;
	}

	private function _saveItemDatabase($item) {

		if ($this->overwriteById) {
            if (isset($item['price'])) {
                $itemIdDatabase = DatabaseSave::saveProduct($item);
                $this->logger->setLogInfo('Saving product.. item id: ' . $itemIdDatabase);

                return array('item'=>$item, 'itemIdDatabase'=>$itemIdDatabase);
            }
        }

		if ($this->overwriteById && isset($item['id'])) {

            $itemIdDatabase = DatabaseSave::save($item['save_to_table'], $item);
            $this->logger->setLogInfo('Saving in table "' . $item['save_to_table'] . '"  Item id: ' . $itemIdDatabase);

            return array('item'=>$item, 'itemIdDatabase'=>$itemIdDatabase);
		}

		if ($item['save_to_table'] == 'options') {
			if (isset($item['option_key']) && $item['option_key'] == 'current_template') {
				if (!is_dir(userfiles_path().'/templates/'.$item['option_value'])) {
					// Template not found
					return;
				}
			}
		}

		if ($item['save_to_table'] == 'custom_fields') {
			$this->_saveCustomField($item);
			return;
		}

		if ($item['save_to_table'] == 'content_data') {
			$this->_saveContentData($item);
			return;
		}

		if ($item['save_to_table'] == 'tagging_tagged') {
			$this->_taggingTagged($item);
			return;
		}

		if (isset($item['rel_type']) && $item['rel_type'] == 'modules' && $item['save_to_table'] == 'media') {
			$this->_saveModule($item);
			return;
		}

		if ($item['save_to_table'] == 'media' && empty($item['title'])) {
			$this->_saveMedia($item);
			return;
		}

		if ($item['save_to_table'] == 'menus') {
			if($this->_saveMenuItem($item)) {
				$this->_fixMenuParents();
			}
			return;
		}

		if ($item['save_to_table'] == 'categories_items') {
			if ($this->_saveCategoriesItems($item)) {
				$this->_fixCategoryParents();
				return;
			}
		}

		if ($item['save_to_table'] == 'categories') {
			$this->_fixCategoryParents();
		}

		// Dont import menus without title
		if ($item['save_to_table'] == 'content_fields' && empty($item['title'])) {
			$this->_saveContentField($item);
			return;
		}

		$dbSelectParams = array();
		$dbSelectParams['no_cache'] = true;
		$dbSelectParams['limit'] = 1;
		$dbSelectParams['single'] = true;
		$dbSelectParams['do_not_replace_site_url'] = 1;
		$dbSelectParams['fields'] = 'id';

		foreach(DatabaseDublicateChecker::getRecognizeFields($item['save_to_table']) as $tableField) {
			if (isset($item[$tableField])) {
				$dbSelectParams[$tableField] = $item[$tableField];
			}
		}

		$checkItemIsExists = db_get($item['save_to_table'], $dbSelectParams);
		if ($checkItemIsExists) {
            $this->logger->setLogInfo('Update item ' . $this->_getItemFriendlyName($item) . ' in ' . $item['save_to_table']);
		} else {
            $this->logger->setLogInfo('Save item ' . $this->_getItemFriendlyName($item) . ' in ' . $item['save_to_table']);
		}

		$saveItem = $this->_unsetItemFields($item);
		if ($checkItemIsExists) {
			$saveItem['id'] = $checkItemIsExists['id'];
		}

		$saveAsContent = false;
		if ($saveItem['save_to_table'] == 'content') {
			$saveAsContent = true;
			if (isset($saveItem['content_type']) && $saveItem['content_type'] == 'page') {
				$saveAsContent = false;
			}
		}

		if ($saveAsContent) {
			$itemIdDatabase = DatabaseSaveContent::save($saveItem['save_to_table'], $saveItem);
		} else {
			$itemIdDatabase = DatabaseSave::save($saveItem['save_to_table'], $saveItem);
		}

		return array('item'=>$item, 'itemIdDatabase'=>$itemIdDatabase);
	}

	private function _getItemFriendlyName($item) {
		$name = '';
		if (isset($item['title'])) {
			$name = $item['title'];
		}
		if (isset($item['name'])) {
			$name = $item['name'];
		}
		return $name;
	}

	/**
	 * Save item in database
	 * @param string $table
	 * @param array $item
	 */
	private function _saveItem($item) {

		$savedItem = $this->_saveItemDatabase($item);
        if ($this->overwriteById) {
            return true;
        }

		if ($savedItem) {
			$this->_fixRelations($savedItem);
			$this->_fixParentRelationship($savedItem);
		}

	}

	/**
	 * Run database writer.
	 * @return string[]
	 */
	public function runWriter()
	{
        $this->step = 1;
        $this->totalSteps= 1;

        if (isset($this->content->__table_structures)) {
            $this->logger->setLogInfo('Building database tables');

            app()->database_manager->build_tables($this->content->__table_structures);
        }

		foreach ($this->content as $table=>$items) {

            if (!\Schema::hasTable($table)) {
                continue;
            }

            $this->logger->setLogInfo('Importing in table: ' . $table);

			if (!empty($items)) {
				foreach($items as $item) {
					$item['save_to_table'] = $table;
					$this->_saveItem($item);
				}
			}
		}

		$this->_finishUp('runWriterBottom');

	}

	public function runWriterWithBatch()
	{
		if ($this->step == 0) {
			$this->logger->clearLog();
			$this->_deleteOldContent();
		}

		$this->logger->setLogInfo('Importing database batch: ' . ($this->step) . '/' . $this->totalSteps);

		if (empty($this->content)) {
			$this->_finishUp('runWriterWithBatchNothingToImport');
			return array("success"=>"Nothing to import.");
		}

		if (isset($this->content->__table_structures)) {
		    app()->database_manager->build_tables($this->content->__table_structures);
        }

		$excludeTables = array();

		// All db tables
        $topItemsForSave = array();
        $otherItemsForSave = array();
		foreach ($this->content as $table=>$items) {

            if (!\Schema::hasTable($table)) {
                continue;
            }

			if (in_array($table, $excludeTables)) {
				continue;
			}

			if (!empty($items)) {
				foreach($items as $item) {
					$item['save_to_table'] = $table;
                    if (isset($item['content_type']) && $item['content_type'] == 'page') {
                        $topItemsForSave[] = $item;
                    } else {
                        $otherItemsForSave[] = $item;
                    }
				}
			}
			$this->logger->setLogInfo('Save content to table: ' . $table);
		}

        $itemsForSave = array_merge($topItemsForSave, $otherItemsForSave);

		if (!empty($itemsForSave)) {

			$totalItemsForSave = sizeof($itemsForSave);
			$totalItemsForBatch = ($totalItemsForSave / $this->totalSteps);
            $totalItemsForBatch = ceil($totalItemsForBatch);

			if ($totalItemsForBatch > 0) {
				$itemsBatch = array_chunk($itemsForSave, $totalItemsForBatch);
			} else {
				$itemsBatch[0] = $itemsForSave;
			}

			if (!isset($itemsBatch[$this->step])) {

                $this->logger->setLogInfo('No items in batch for current step.');

				return array("success"=>"Done! All steps are finished.");
			}

			$success = array();
			foreach($itemsBatch[$this->step] as $item) {
                try {
                    $success[] = $this->_saveItem($item);
                } catch (\Exception $e) {
                    $this->logger->setLogInfo('Save content to table: ' . $item['save_to_table']);
                }
			}
		}

	}

	public function getImportLog() {

		$log = array();
		$log['current_step'] = $this->step;
		$log['next_step'] = $this->step + 1;
		$log['total_steps'] = $this->totalSteps;
		$log['precentage'] = ($this->step * 100) / $this->totalSteps;

		if ($this->step >= $this->totalSteps) {
			$log['done'] = true;

			// Finish up
			$this->_finishUp('getImportLog');

			// Clear log file
            $this->logger->clearLog();
		}

		return $log;
	}

	private function _deleteOldContent()
    {
        // Delete old content
        if (!empty($this->content) && $this->deleteOldContent) {
            foreach ($this->content as $table=>$items) {
                if ($table == 'users' || $table == 'users_oauth' || $table == 'system_licenses') {
                    continue;
                }
                if (\Schema::hasTable($table)) {
                    $this->logger->setLogInfo('Truncate table: ' . $table);
                    try {
                        \DB::table($table)->truncate();
                    } catch (\Exception $e) {
                        $this->logger->setLogInfo('Can\'t truncate table: ' . $table);
                    }
                }
            }
        }
    }

	/**
	 * Clear all cache on framework
	 */
	private function _finishUp($callFrom = '') {

        $this->logger->setLogInfo('Call from: ' . $callFrom);

		if (function_exists('mw_post_update')) {
			mw_post_update();
		}

        $this->logger->setLogInfo('Cleaning up system cache');

		mw()->cache_manager->clear();

        $this->logger->setLogInfo('Done!');
	}
}