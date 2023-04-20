<?php

namespace MicroweberPackages\Marketplace;

use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Livewire\Livewire;
use MicroweberPackages\Marketplace\Http\Livewire\Admin\Marketplace;
use MicroweberPackages\Marketplace\Http\Livewire\Admin\MarketplaceItemModal;

class MarketplaceServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        Livewire::component('admin-marketplace', Marketplace::class);
        Livewire::component('admin-marketplace-item-modal', MarketplaceItemModal::class);

        View::addNamespace('marketplace', __DIR__ . '/resources/views');

      //  $this->loadRoutesFrom(__DIR__ . '/routes/api.php');
        $this->loadRoutesFrom(__DIR__ . '/routes/web.php');
    }

}