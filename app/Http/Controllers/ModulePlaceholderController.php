<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ModulePlaceholderController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('modules/coming-soon', [
            'title' => $request->route('title'),
        ]);
    }
}
