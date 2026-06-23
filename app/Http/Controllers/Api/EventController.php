<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str; 
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class EventController extends Controller
{
    /**
     * عرض قائمة الفعاليات مع نظام فلترة متقدم (البحث، الأصناف، التاريخ)
     */
    public function index(Request $request): JsonResponse
    {
        // الاستعلام الأساسي: الفعاليات المنشورة فقط مع فئاتها ومنظميها
        $query = Event::with(['category', 'organizer'])->published();

        // 1. الفلترة حسب البحث النصي (العنوان، الوصف، المدينة)
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // 2. الفلترة حسب الصنف (Category)
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // 3. الفلترة حسب المدينة
        if ($request->filled('city')) {
            $query->where('city', 'like', '%' . $request->city . '%');
        }

        // 4. الفلترة حسب السعر (مجاني / مدفوع)
        if ($request->has('free')) {
            $query->where('is_free', $request->free === 'true');
        }

        // 5. الفلترة حسب التاريخ (ميزة جديدة للـ PFE)
        if ($request->filled('date')) {
            try {
                $date = $request->date;
                // إذا أرسل المستخدم كلمات دلالية بدل تاريخ محدد
                if ($date === 'today') {
                    $query->whereDate('start_date', Carbon::today());
                } elseif ($date === 'tomorrow') {
                    $query->whereDate('start_date', Carbon::tomorrow());
                } else {
                    // فلترة حسب التاريخ المختار من الـ Date Picker
                    $query->whereDate('start_date', Carbon::parse($date));
                }
            } catch (\Exception $e) {
                // في حال كان تنسيق التاريخ خاطئاً، نتجاهل الفلترة
            }
        }

        // 6. الترتيب (الأقرب تاريخاً يظهر أولاً)
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
     * عرض تفاصيل فعالية واحدة (بما في ذلك التقييمات)
     */
    public function show(Event $event): JsonResponse
    {
        // جلب العلاقات اللازمة لعرض صفحة التفاصيل والخريطة والتقييمات
        $event->load(['organizer', 'category', 'reviews.user:id,name']);

        return response()->json([
            'success' => true,
            'data' => $event
        ]);
    }

    /**
     * إنشاء فعالية جديدة (للمنظمين والآدمن)
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

        // رفع الصورة وتخزينها
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('events', 'public');
            $data['image'] = $path;
        }

        // بيانات المنظم والروابط
        $data['organizer_id'] = $request->user()->id;
        $data['slug'] = Str::slug($request->title) . '-' . Str::random(5);
        $data['is_free'] = ($request->price == 0);
        $data['status'] = 'published';

        $event = Event::create($data);

        return response()->json([
            'success' => true,
            'message' => 'L\'événement a été publié avec succès !',
            'data' => $event
        ], 201);
    }

    /**
     * تحديث فعالية (مع فحص الصلاحية)
     */
    public function update(Request $request, Event $event): JsonResponse
    {
        if ($request->user()->id !== $event->organizer_id && $request->user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Action non autorisée'], 403);
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
        if ($event->image) {
            Storage::disk('public')->delete($event->image);
        }

        $event->delete();

        return response()->json([
            'success' => true,
            'message' => 'Événement supprimé'
        ]);
    }
}