<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use App\Mail\BookingConfirmation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Exception;

class BookingController extends Controller
{
    /**
     * جلب حجوزات المستخدم الحالي
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

    /**
     * إنشاء حجز جديد (مع إرسال إيميل محمي)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'event_id' => 'required|exists:events,id',
            'quantity' => 'required|integer|min:1',
            'attendee_name' => 'required|string|max:255',
            'attendee_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $event = Event::findOrFail($request->event_id);

        // 1. التحقق من توفر الأماكن
        if ($event->max_attendees && ($event->current_attendees + $request->quantity) > $event->max_attendees) {
            return response()->json([
                'success' => false, 
                'message' => 'Désolé, places insuffisantes.'
            ], 400);
        }

        // 2. إنشاء الحجز
        $isFree = ($event->price == 0 || $event->is_free);
        
        $booking = Booking::create([
            'user_id' => $request->user()->id,
            'event_id' => $event->id,
            'quantity' => $request->quantity,
            'unit_price' => $event->price,
            'total_amount' => $event->price * $request->quantity,
            'currency' => $event->currency ?? 'MAD',
            'attendee_name' => $request->attendee_name,
            'attendee_email' => $request->attendee_email,
            'status' => 'confirmed',
            'payment_status' => $isFree ? 'paid' : 'pending',
            'confirmed_at' => now(),
        ]);

        // 3. تحديث عدد الحاضرين في الحدث
        $event->increment('current_attendees', $request->quantity);

        // 4. إرسال إيميل التأكيد (محمي بـ try-catch لتجنب خطأ 500)
        try {
            Mail::to($booking->attendee_email)->send(new BookingConfirmation($booking));
        } catch (Exception $e) {
            // نسجل الخطأ في ملف laravel.log ولكن لا نوقف العملية
            Log::error("Erreur d'envoi d'email : " . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Réservation réussie',
            'booking_number' => $booking->booking_number,
            'data' => $booking->load('event')
        ], 201);
    }

    /**
     * جلب بيانات التذكرة مع الـ QR Code
     */
    public function getTicketData(string $booking_number): JsonResponse
    {
        $booking = Booking::with(['event', 'user'])
            ->where('booking_number', $booking_number)
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Réservation introuvable'], 404);
        }

        // حماية: صاحب التذكرة أو الآدمن فقط
        if (Auth::id() !== $booking->user_id && Auth::user()?->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Accès refusé'], 403);
        }

        $qrCode = QrCode::size(150)->color(0, 51, 102)->generate($booking->booking_number);

        return response()->json([
            'success' => true,
            'data' => [
                'booking' => $booking,
                'qr_code' => (string) $qrCode
            ]
        ]);
    }

    /**
     * نظام التحقق عند الباب (Scanner)
     */
    public function checkIn(Request $request): JsonResponse
    {
        $request->validate(['booking_number' => 'required|string']);

        $booking = Booking::where('booking_number', $request->booking_number)->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Ticket invalide'], 404);
        }

        if ($booking->status === 'attended') {
            return response()->json(['success' => false, 'message' => 'Déjà utilisé'], 422);
        }

        $booking->update(['status' => 'attended']);

        return response()->json([
            'success' => true, 
            'message' => 'Bienvenue, accès autorisé !'
        ]);
    }
}