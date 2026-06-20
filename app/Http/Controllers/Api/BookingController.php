<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class BookingController extends Controller
{
    /**
     * البحث عن حجز معين بواسطة الرقم الفريد
     */
    public function search(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'booking_number' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $booking = Booking::with(['event', 'user'])
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
     * إنشاء حجز جديد (معالجة الأحداث المجانية والمدفوعة)
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
                'message' => 'Désolé, il n\'y a plus de places disponibles.'
            ], 400);
        }

        // 2. تحديد حالة الدفع (إذا كان السعر 0 تصبح "paid" مباشرة)
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

        return response()->json([
            'success' => true,
            'message' => 'Réservation réussie',
            'booking_number' => $booking->booking_number,
            'data' => $booking
        ], 201);
    }

    /**
     * جلب بيانات التذكرة مع الـ QR Code بصيغة SVG
     */
    public function getTicketData(Request $request, $booking_number): JsonResponse
    {
        $booking = Booking::with(['event', 'event.category'])
            ->where('booking_number', $booking_number)
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Ticket introuvable'], 404);
        }

        // تأمين: لا يمكن لأي مستخدم رؤية تذكرة غيره (إلا إذا كان أدمن)
        $user = $request->user();
        if (!$user || ($user->id !== $booking->user_id && $user->role !== 'admin')) {
            return response()->json(['success' => false, 'message' => 'Accès non autorisé'], 403);
        }

        // توليد الـ QR Code يحتوي على رابط التحقق أو رقم الحجز
        $qrCode = QrCode::size(150)
            ->color(0, 51, 102) // لون أزرق غامق احترافي
            ->generate($booking->booking_number);

        return response()->json([
            'success' => true,
            'data' => [
                'booking' => $booking,
                'qr_code' => (string) $qrCode // إرساله كـ SVG ليتم عرضه في الـ HTML
            ]
        ]);
    }

    /**
     * جلب حجوزات المستخدم المتصل
     */
    public function myBookings(Request $request): JsonResponse
    {
        $bookings = $request->user()->bookings()
            ->with(['event'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ]);
    }
}