<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StatsController extends Controller
{
    public function overview(Request $request)
    {
        $user = Auth::user();

        if ($user->role === 'admin') {
            // الأدمن يرى جميع الحجوزات
            $totalBookings = Booking::count();
            $totalEvents = Event::count();
        } else {
            // المستخدم يرى حجوزاته فقط
            $totalBookings = Booking::where('user_id', $user->id)->count();
            $totalEvents = Event::count();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total_bookings' => $totalBookings,
                'total_events' => $totalEvents,
                'followers' => 150
            ]
        ]);
    }
}