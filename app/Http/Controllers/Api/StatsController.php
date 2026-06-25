<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use Illuminate\Http\Request;

class StatsController extends Controller
{
    public function overview(Request $request)
    {
        // جلب الإحصائيات (يمكنك تعديلها حسب احتياجك)
        $totalBookings = Booking::count(); 
        $totalEvents = Event::count();
        $followers = 150; // قيمة تجريبية

        return response()->json([
            'success' => true,
            'data' => [
                'total_bookings' => $totalBookings,
                'total_events' => $totalEvents,
                'followers' => $followers
            ]
        ]);
    }
}