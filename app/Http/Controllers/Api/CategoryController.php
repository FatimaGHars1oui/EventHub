<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    /**
     * 1. عرض الأصناف النشطة (للزوار في الصفحة الرئيسية)
     */
    public function index(): JsonResponse
    {
        try {
            // جلب الأصناف النشطة مع عد الفعاليات المنشورة في كل صنف
            $categories = Category::active()
                ->withCount('activeEvents')
                ->orderBy('name', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $categories
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des catégories.'
            ], 500);
        }
    }

    /**
     * 2. جلب الأصناف الأكثر شعبية (التي تحتوي على أكبر عدد فعاليات)
     */
    public function popular(): JsonResponse
    {
        $categories = Category::active()
            ->withCount('activeEvents')
            ->having('active_events_count', '>', 0)
            ->orderBy('active_events_count', 'desc')
            ->limit(8)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    /**
     * 3. جلب كافة الأصناف (للإدارة في لوحة التحكم)
     */
    public function all(): JsonResponse
    {
        $categories = Category::withCount('events')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    /**
     * 4. إضافة صنف جديد (للمشرفين فقط)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:categories,name',
            'icon' => 'nullable|string',
            'description' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:7',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $category = Category::create([
            'name' => $request->name,
            'slug' => Str::slug($request->name),
            'icon' => $request->icon ?? 'fas fa-tag',
            'description' => $request->description,
            'color' => $request->color ?? '#4361ee',
            'is_active' => true
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catégorie créée avec succès',
            'data' => $category
        ], 201);
    }

    /**
     * 5. تحديث صنف
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:categories,name,' . $category->id,
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $category->update($request->all());
        if ($request->has('name')) {
            $category->update(['slug' => Str::slug($request->name)]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Catégorie mise à jour',
            'data' => $category
        ]);
    }

    /**
     * 6. حذف صنف
     */
    public function destroy(Category $category): JsonResponse
    {
        // منع حذف صنف إذا كان مرتبطاً بفعاليات
        if ($category->events()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de supprimer : cette catégorie contient des événements.'
            ], 422);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Catégorie supprimée'
        ]);
    }
}