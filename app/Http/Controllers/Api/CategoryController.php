<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        // Logique pour récupérer les catégories
        $categories = Category::active()
            ->withCount(['activeEvents'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true, 
            'data' => $categories
        ]);
    }

    public function all(): JsonResponse
    {
        $categories = Category::withCount(['activeEvents'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    public function popular(): JsonResponse
    {
        $categories = Category::active()
        ->withCount(['activeEvents'])
        ->having('active_events_count', '>', 0)
            ->orderBy('active_events_count','desc')
            ->limit(8)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }
}
