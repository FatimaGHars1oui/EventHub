<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str; 
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class EventController extends Controller
{
    /**
     * ملاحظة هامة لـ PFE: 
     * لا تضع middleware('auth:sanctum') في الـ constructor هنا 
     * لكي يتمكن الزوار من رؤية الأحداث دون تسجيل دخول.
     */

    /**
     * عرض قائمة الفعاليات (للزوار والمستخدمين)
     */
    public function index(Request $request): JsonResponse
    {
        // جلب الأحداث المنشورة فقط مع فئاتها ومنظميها
        $query = Event::with(['category', 'organizer'])->published();

        // الفلترة حسب البحث النصي
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // الفلترة حسب الصنف (Category)
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // الفلترة حسب المدينة
        if ($request->filled('city')) {
            $query->where('city', 'like', '%' . $request->city . '%');
        }

        // الترتيب حسب التاريخ الأقرب
        $query->orderBy('start_date', 'asc');

        // الترقيم (Pagination)
        $events = $query->paginate(12);

        return response()->json([
            'success' => true,
            'data' => $events->items(),
            'pagination' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'total' => $events->total(),
            ]
        ]);
    }

    /**
     * عرض تفاصيل فعالية واحدة (للزوار والمستخدمين)
     */
    public function show(Event $event): JsonResponse
    {
        // جلب الحدث مع التقييمات وأسماء أصحابها
        $event->load(['organizer', 'category', 'reviews.user:id,name']);

        return response()->json([
            'success' => true,
            'data' => $event
        ]);
    }

    /**
     * إنشاء فعالية جديدة (للمنظمين والآدمن فقط)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'category_id' => 'required|exists:categories,id',
            'description' => 'required|string',
            'start_date' => 'required|date|after:now',
            'venue_address' => 'required|string',
            'city' => 'required|string',
            'price' => 'required|numeric|min:0',
            'max_attendees' => 'required|integer|min:1',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $data = $request->all();

        // معالجة رفع الصورة وتخزينها في المجلد العام
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('events', 'public');
            $data['image'] = $path;
        }

        // إعداد البيانات التلقائية للمنظم
        $data['organizer_id'] = $request->user()->id;
        $data['slug'] = Str::slug($request->title) . '-' . Str::random(5);
        $data['is_free'] = ($request->price == 0);
        $data['status'] = 'published'; // يتم النشر مباشرة

        $event = Event::create($data);

        return response()->json([
            'success' => true,
            'message' => 'L\'événement a été créé et publié avec succès.',
            'data' => $event
        ], 201);
    }

    /**
     * تحديث فعالية (لصاحب الفعالية أو الآدمن)
     */
    public function update(Request $request, Event $event): JsonResponse
    {
        // حماية برمجية لضمان أن المنظم يعدل أحداثه فقط
        if ($request->user()->id !== $event->organizer_id && $request->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Accès non autorisé.'], 403);
        }

        $event->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Événement mis à jour.',
            'data' => $event
        ]);
    }

    /**
     * حذف فعالية
     */
    public function destroy(Event $event): JsonResponse
    {
        // حذف الصورة المرتبطة من السيرفر لتوفير المساحة
        if ($event->image) {
            Storage::disk('public')->delete($event->image);
        }

        $event->delete();

        return response()->json([
            'success' => true,
            'message' => 'Événement supprimé avec succès.'
        ]);
    }
}