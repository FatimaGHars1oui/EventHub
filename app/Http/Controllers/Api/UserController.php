<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * عرض بيانات المستخدم الحالي
     */
    public function show(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $request->user()
        ]);
    }

    /**
     * تحديث الملف الشخصي
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name'     => 'required|string|max:255',
            'email'    => [
                'required',
                'email',
                'max:255',
                Rule::unique('users')->ignore($user->id)
            ],
            'password' => 'nullable|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors()
            ], 422);
        }

        $user->name  = $request->name;
        $user->email = $request->email;

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profil mis à jour avec succès.',
            'data'    => $user
        ]);
    }

    /**
     * حذف الحساب
     */
    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        // حذف الحجوزات
        $user->bookings()->delete();

                // حذف الإشعارات من قاعدة البيانات
        \Illuminate\Notifications\DatabaseNotification::where('notifiable_id', $user->id)
            ->where('notifiable_type', get_class($user))
            ->delete();

        // حذف التوكنات
        $user->tokens()->delete();

        // حذف الحساب
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Compte supprimé définitivement.'
        ]);
    }

    /**
     * عرض قائمة المستخدمين (للأدمن فقط)
     */
    public function index(Request $request)
    {
        // التحقق من أن المستخدم أدمن
        if (!$request->user()->is_admin && $request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Accès non autorisé.'
            ], 403);
        }

        $users = User::select('id', 'name', 'email', 'role', 'is_admin', 'created_at')
                     ->orderBy('created_at', 'desc')
                     ->get();

        return response()->json([
            'success' => true,
            'data'    => $users
        ]);
    }

    /**
     * حذف مستخدم (للأدمن فقط)
     */
    public function destroy(Request $request, $id)
    {
        if (!$request->user()->is_admin && $request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Accès non autorisé.'
            ], 403);
        }

        // منع الأدمن من حذف نفسه
        if ($request->user()->id == $id) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas supprimer votre propre compte ici.'
            ], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Utilisateur introuvable.'
            ], 404);
        }

        $user->bookings()->delete();
        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Utilisateur supprimé.'
        ]);
    }

    /**
     * إحصائيات الأدمن
     */
    public function stats(Request $request)
    {
        if (!$request->user()->is_admin && $request->user()->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Accès non autorisé.'
            ], 403);
        }

        $usersCount    = User::count();
        $eventsCount   = \App\Models\Event::count();
        $bookingsCount = \App\Models\Booking::count();
        $revenue       = \App\Models\Booking::sum('total_price') ?? 0;

        // حجوزات آخر 6 أشهر
        $monthlyBookings = \App\Models\Booking::selectRaw('MONTH(created_at) as month, COUNT(*) as count')
            ->whereYear('created_at', now()->year)
            ->groupBy('month')
            ->orderBy('month')
            ->pluck('count', 'month')
            ->toArray();

        // ملء الأشهر الفارغة بصفر
        $chartValues = [];
        for ($i = 1; $i <= 12; $i++) {
            $chartValues[] = $monthlyBookings[$i] ?? 0;
        }

        $monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

        return response()->json([
            'success'  => true,
            'users'    => $usersCount,
            'events'   => $eventsCount,
            'bookings' => $bookingsCount,
            'revenue'  => $revenue,
            'chart_data' => [
                'labels' => $monthNames,
                'values' => $chartValues
            ]
        ]);
    }
}