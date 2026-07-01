<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class ReviewController extends Controller
{
    /**
     * إضافة تقييم جديد أو تحديث تقييم سابق
     */
    public function store(Request $request): JsonResponse
    {
        // 1. التحقق من صحة البيانات
        $validator = Validator::make($request->all(), [
            'event_id' => 'required|exists:events,id',
            'rating'   => 'required|integer|min:1|max:5',
            'comment'  => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors()
            ], 422);
        }

        // 2. ميزة احترافية للـ PFE: التأكد أن المستخدم حجز فعلاً في هذا الحدث قبل التقييم
        $hasBooked = Booking::where('user_id', $request->user()->id)
            ->where('event_id', $request->event_id)
            ->where('status', 'confirmed')
            ->exists();

        if (!$hasBooked) {
            return response()->json([
                'success' => false,
                'message' => 'Désolé, vous devez avoir assisté à cet événement pour laisser un avis.'
            ], 403);
        }

        // 3. إضافة التقييم أو تحديثه إذا كان المستخدم قد قيم سابقاً (نفس الحدث)
        $review = Review::updateOrCreate(
            [
                'user_id'  => $request->user()->id,
                'event_id' => $request->event_id,
            ],
            [
                'rating'   => $request->rating,
                'comment'  => $request->comment,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Merci pour votre avis !',
            'data'    => $review
        ], 201);
    }

    /**
     * جلب تقييمات حدث معين (إذا أردت جلبها بشكل منفصل)
     */
    public function index($eventId): JsonResponse
    {
        $reviews = Review::with('user:id,name,avatar')
            ->where('event_id', $eventId)
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $reviews
        ]);
    }
    /**
     * جلب تقييمات المستخدم الحالي
     */
    public function myReviews(Request $request): JsonResponse
    {
        $reviews = Review::where('user_id', $request->user()->id)
            ->with('event:id,title')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $reviews
        ]);
    }

    /**
     * حذف تقييم المستخدم (يقدر يمسح غير تقييماتو)
     */
    public function deleteMyReview(Request $request, $id): JsonResponse
    {
        $review = Review::where('id', $id)
            ->where('user_id', $request->user()->id) // حماية: يمسح غير ديالو
            ->first();

        if (!$review) {
            return response()->json(['success' => false, 'message' => 'Avis introuvable'], 404);
        }

        $review->delete();

        return response()->json([
            'success' => true,
            'message' => 'Avis supprimé.'
        ]);
    }


}
