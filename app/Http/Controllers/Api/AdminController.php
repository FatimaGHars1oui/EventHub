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
     * جلب إحصائيات شاملة للمنصة (Admin Dashboard Stats)
     */
    public function getStats(): JsonResponse
    {
        try {
            // 1. الإحصائيات العامة (الخانات العلوية)
            $stats = [
                'total_events'   => Event::count(),
                'total_users'    => User::count(),
                'total_bookings' => Booking::count(),
                'total_revenue'  => round(Booking::where('payment_status', 'paid')->sum('total_amount'), 2),
            ];

            // 2. توزيع الأحداث حسب الفئة (للرسم البياني الدائري Pie Chart)
            // نستخدم withCount لجلب عدد الأحداث المرتبطة بكل فئة
            $eventsByCategory = Category::withCount('events')
                ->get()
                ->map(function ($category) {
                    return [
                        'name'  => $category->name,
                        'count' => $category->events_count,
                    ];
                });

            // 3. الأحداث الأكثر شعبية (للرسم البياني بالأعمدة Bar Chart)
            // نرتب الأحداث حسب عدد الحاضرين الفعليين
            $popularEvents = Event::orderBy('current_attendees', 'desc')
                ->limit(5)
                ->get(['title', 'current_attendees', 'max_attendees']);

            // 4. أحدث الحجوزات (لجدول النشاط الأخير)
            $recentBookings = Booking::with(['user:id,name', 'event:id,title'])
                ->latest()
                ->limit(6)
                ->get();

            // 5. إحصائيات المستخدمين حسب الأدوار
            $userRolesDist = User::select('role', DB::raw('count(*) as total'))
                ->groupBy('role')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_events'       => $stats['total_events'],
                    'total_users'        => $stats['total_users'],
                    'total_bookings'     => $stats['total_bookings'],
                    'total_revenue'      => $stats['total_revenue'],
                    'events_by_category' => $eventsByCategory,
                    'popular_events'     => $popularEvents,
                    'recent_bookings'    => $recentBookings,
                    'user_roles'         => $userRolesDist
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des statistiques',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * جلب قائمة المستخدمين للإدارة
     */
    public function usersIndex(): JsonResponse
    {
        $users = User::orderBy('created_at', 'desc')->paginate(10);
        return response()->json([
            'success' => true,
            'data'    => $users
        ]);
    }

    /**
     * ميزة إضافية: حذف مستخدم (للمشرف فقط)
     */
    public function deleteUser(User $user): JsonResponse
    {
        if ($user->role === 'admin') {
            return response()->json(['success' => false, 'message' => 'Impossible de supprimer un administrateur'], 403);
        }

        $user->delete();
        return response()->json(['success' => true, 'message' => 'Utilisateur supprimé avec succès']);
    }
}