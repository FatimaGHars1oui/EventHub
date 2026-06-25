<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\User;
use App\Models\Booking;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminController extends Controller
{
    /**
     * جلب إحصائيات شاملة للوحة التحكم (Overview)
     */
    public function getStats(): JsonResponse
    {
        try {
            // 1. الإحصائيات الرقمية السريعة
            $stats = [
                'total_events'   => Event::count(),
                'total_users'    => User::count(),
                'total_bookings' => Booking::count(),
                'total_revenue'  => round(Booking::where('payment_status', 'paid')->sum('total_amount'), 2),
            ];

            // 2. توزيع الأحداث حسب الفئة (للرسم البياني الدائري Pie Chart)
            $eventsByCategory = Category::withCount('events')
                ->get()
                ->map(function ($category) {
                    return [
                        'label' => $category->name,
                        'value' => $category->events_count,
                    ];
                });

            // 3. إحصائيات الحجوزات في آخر 7 أيام (للرسم البياني الخطي Line Chart)
            $lastSevenDays = collect(range(6, 0))->map(function ($days) {
                $date = Carbon::today()->subDays($days);
                return [
                    'date'  => $date->format('d M'),
                    'count' => Booking::whereDate('created_at', $date)->count(),
                ];
            });

            // 4. أحدث الحجوزات (لجدول النشاط الأخير)
            $recentBookings = Booking::with(['user:id,name', 'event:id,title'])
                ->latest()
                ->limit(5)
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'counters'           => $stats,
                    'events_by_category' => $eventsByCategory,
                    'bookings_trend'     => $lastSevenDays,
                    'recent_bookings'    => $recentBookings
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du chargement des statistiques',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * إدارة المستخدمين: جلب كافة المستخدمين مع الترقيم
     */
    public function usersIndex(): JsonResponse
    {
        try {
            $users = User::select('id', 'name', 'email', 'role', 'created_at')
                ->orderBy('created_at', 'desc')
                ->paginate(10);

            return response()->json([
                'success' => true,
                'data'    => $users
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur de chargement'], 500);
        }
    }

    /**
     * حذف مستخدم (مع حماية المسؤولين)
     */
    public function deleteUser(User $user): JsonResponse
    {
        // منع حذف النفس أو حذف أدمن آخر لزيادة الأمان
        if ($user->role === 'admin') {
            return response()->json([
                'success' => false, 
                'message' => 'Impossible de supprimer un administrateur.'
            ], 403);
        }

        try {
            $user->delete();
            return response()->json([
                'success' => true,
                'message' => 'Utilisateur supprimé avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur lors de la suppression'], 500);
        }
    }

    /**
     * تغيير دور المستخدم (من مستخدم عادي لمنظم مثلاً)
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        $request->validate(['role' => 'required|in:user,organizer,admin']);

        try {
            $user->update(['role' => $request->role]);
            return response()->json([
                'success' => true,
                'message' => 'Rôle mis à jour avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur'], 500);
        }
    }
}