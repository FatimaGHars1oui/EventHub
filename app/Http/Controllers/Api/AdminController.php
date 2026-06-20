<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\User;
use App\Models\Booking;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /**
     * جلب إحصائيات شاملة للمنصة (Admin Dashboard)
     */
    public function getStats(): JsonResponse
    {
        // إحصائيات عامة
        $stats = [
            'total_events' => Event::count(),
            'total_users' => User::count(),
            'total_bookings' => Booking::count(),
            'total_revenue' => Booking::where('payment_status', 'paid')->sum('total_amount'),
            
            // توزيع الأحداث حسب الفئة
            'events_by_category' => Category::withCount('events')->get()->map(function($cat) {
                return [
                    'name' => $cat->name,
                    'count' => $cat->events_count
                ];
            }),

            // آخر حجوزات تمت على المنصة
            'recent_bookings' => Booking::with(['user', 'event'])
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get(),

            // الأحداث الأكثر شعبية (حسب عدد الحجوزات)
            'popular_events' => Event::orderBy('current_attendees', 'desc')
                ->limit(5)
                ->get(['title', 'current_attendees', 'max_attendees'])
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}
