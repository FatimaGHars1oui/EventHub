<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\Booking;

class BookingController extends Controller
{
    

    public function search(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'booking_number' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Numéro de réservation requis',
                'errors' => $validator->errors()
            ], 422);

            }

        $booking = Booking::with(['event','event.category', 'user'])
                ->where('booking_number', $request->booking_number)
                ->first();

         if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Réservation non trouvée'
            ], 404);       
    }
    
        return response()->json([
            'success' => true,
            'data' => $booking
        ]);
    }

    /**
     * إنشاء حجز جديد
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'event_id' => 'required|exists:events,id',
            'quantity' => 'required|integer|min:1',
            'attendee_name' => 'required|string|max:255',
            'attendee_email' => 'required|email',
            'attendee_phone' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        // جلب بيانات الحدث
        $event = \App\Models\Event::findOrFail($request->event_id);

        // التأكد من توفر المقاعد
        if ($event->max_attendees && ($event->current_attendees + $request->quantity) > $event->max_attendees) {
            return response()->json([
                'success' => false, 
                'message' => 'Désolé, places insuffisantes.'
            ], 400);
        }

        // إنشاء الحجز
        $booking = Booking::create([
            'user_id' => $request->user()->id, // المستخدم المتصل
            'event_id' => $event->id,
            'quantity' => $request->quantity,
            'unit_price' => $event->price,
            'total_amount' => $event->price * $request->quantity,
            'currency' => $event->currency,
            'attendee_name' => $request->attendee_name,
            'attendee_email' => $request->attendee_email,
            'attendee_phone' => $request->attendee_phone,
            'status' => 'confirmed',
            'payment_status' => $event->is_free ? 'paid' : 'pending',
        ]);

        // تحديث عدد الحاضرين في الحدث
        $event->incrementAttendees($request->quantity);

        return response()->json([
            'success' => true,
            'message' => 'Réservation réussie',
            'booking_number' => $booking->booking_number, // كيتولد تلقائياً
            'data' => $booking->load('event')
        ], 201);
    }

    /**
     * جلب حجوزات المستخدم المتصل
     */
    public function myBookings(Request $request): JsonResponse
    {
        $bookings = $request->user()->bookings()
            ->with(['event', 'event.category'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ]);
    }
}
