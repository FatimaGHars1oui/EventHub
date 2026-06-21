<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class BookingController extends Controller
{
    /**
     * جلب حجوزات المستخدم المتصل (للملف الشخصي والـ Dashboard)
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
     * إنشاء حجز جديد (معالجة الأحداث المجانية والمدفوعة)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'event_id' => 'required|exists:events,id',
            'quantity' => 'required|integer|min:1|max:10',
            'attendee_name' => 'required|string|max:255',
            'attendee_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $event = Event::findOrFail($request->event_id);

        // 1. التحقق من توفر المقاعد
        if ($event->max_attendees && ($event->current_attendees + $request->quantity) > $event->max_attendees) {
            return response()->json([
                'success' => false,
                'message' => 'Désolé, places insuffisantes pour cet événement.'
            ], 400);
        }

        // 2. استخدام Transaction لضمان سلامة البيانات
        return DB::transaction(function () use ($request, $event) {
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

            // تحديث عداد الحضور في الحدث
            $event->increment('current_attendees', $request->quantity);

            return response()->json([
                'success' => true,
                'message' => 'Réservation effectuée avec succès',
                'booking_number' => $booking->booking_number,
                'data' => $booking->load('event')
            ], 201);
        });
    }

    /**
     * جلب بيانات التذكرة مع الـ QR Code (بصيغة SVG للـ PDF)
     */
    public function getTicketData($booking_number): JsonResponse
    {
        $booking = Booking::with(['event', 'user'])
            ->where('booking_number', $booking_number)
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Réservation introuvable'], 404);
        }

        // حماية: صاحب التذكرة أو الآدمن فقط يمكنهم رؤيتها
        $user = request()->user();
        if (!$user || ($user->id !== $booking->user_id && $user->role !== 'admin')) {
            return response()->json(['success' => false, 'message' => 'Accès refusé'], 403);
        }

        // توليد الـ QR Code (يحتوي فقط على رقم الحجز للتحقق منه لاحقاً)
        $qrCode = QrCode::size(150)
            ->color(0, 51, 102)
            ->margin(1)
            ->generate($booking->booking_number);

        return response()->json([
            'success' => true,
            'data' => [
                'booking' => $booking,
                'qr_code' => (string) $qrCode // نرسله كـ String ليتم حقنه كـ HTML/SVG
            ]
        ]);
    }

    /**
     * نظام التحقق (Check-in) - مسح الـ QR Code عند مدخل القاعة
     */
    public function checkIn(Request $request): JsonResponse
    {
        // التحقق من الصلاحيات (يجب أن يكون المنظم أو الآدمن)
        if (!in_array($request->user()->role, ['admin', 'organizer'])) {
            return response()->json(['success' => false, 'message' => 'Action non autorisée'], 403);
        }

        $request->validate(['booking_number' => 'required|string']);

        $booking = Booking::where('booking_number', $request->booking_number)->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Ticket invalide ou inexistant'], 404);
        }

        // منع الدخول المكرر بنفس التذكرة
        if ($booking->status === 'attended') {
            return response()->json([
                'success' => false,
                'message' => 'Attention: Ce ticket a déjà été scanné le ' . $booking->updated_at->format('d/m à H:i')
            ], 422);
        }

        // تحديث حالة الحجز إلى "حضر" (Attended)
        $booking->update([
            'status' => 'attended'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Accès Autorisé. Bienvenue ' . $booking->attendee_name,
            'data' => $booking
        ]);
    }

    /**
     * البحث عن حجز (لأغراض إدارية)
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate(['booking_number' => 'required']);

        $booking = Booking::with(['event', 'user'])
            ->where('booking_number', 'like', "%{$request->booking_number}%")
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Aucun résultat'], 404);
        }

        return response()->json(['success' => true, 'data' => $booking]);
    }
}