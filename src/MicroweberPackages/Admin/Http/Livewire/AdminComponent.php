<?php

namespace MicroweberPackages\Admin\Http\Livewire;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Livewire\Component;

class AdminComponent extends Component
{
    use AuthorizesRequests;

    public function __construct($id = null)
    {
        try {
            $this->authorize('isAdmin');
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            abort(401, 'Unauthorized action.');
        }

        parent::__construct($id);

    }
}
