<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Event;
use App\Mail\BookingConfirmation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Exception;

class BookingController extends Controller
{
    /**
     * جلب حجوزات المستخدم الحالي (History)
     */
    public function myBookings(Request $request): JsonResponse
    {
        $bookings = $request->user()->bookings()
            ->with(['event:id,title,start_date,venue_name,image,city'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $bookings
        ]);
    }

    /**
     * عملية الحجز الاحترافية (Store Booking)
     * ميزة رائعة: استخدام Transaction لمنع تجاوز العدد المسموح
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

        return DB::transaction(function () use ($request) {
            // استخدام lockForUpdate لمنع التلاعب بالعدد في اللحظات المتزامنة
            $event = Event::where('id', $request->event_id)->lockForUpdate()->first();

            // 1. التحقق من توفر الأماكن
            if ($event->max_attendees && ($event->current_attendees + $request->quantity) > $event->max_attendees) {
                return response()->json([
                    'success' => false, 
                    'message' => 'Désolé, cet événement est complet ou les places sont insuffisantes.'
                ], 400);
            }

            // 2. إنشاء الحجز
            $booking = Booking::create([
                'user_id' => Auth::id(),
                'event_id' => $event->id,
                'quantity' => $request->quantity,
                'unit_price' => $event->price,
                'total_amount' => $event->price * $request->quantity,
                'currency' => $event->currency ?? 'MAD',
                'attendee_name' => $request->attendee_name,
                'attendee_email' => $request->attendee_email,
                'status' => 'confirmed',
                'payment_status' => ($event->price == 0) ? 'paid' : 'pending',
                'confirmed_at' => now(),
            ]);

            // 3. تحديث عداد الحاضرين في الفعالية
            $event->increment('current_attendees', $request->quantity);

            // 4. إرسال إيميل التأكيد (اختياري/محمي)
            try {
                Mail::to($booking->attendee_email)->send(new BookingConfirmation($booking));
            } catch (Exception $e) {
                // نسجل الخطأ في اللوج ولا نعطل الحجز
                Log::warning("Email booking failed: " . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Réservation réussie ! Votre billet est prêt.',
                'booking_number' => $booking->booking_number,
                'data' => $booking->load('event')
            ], 201);
        });
    }

    /**
     * جلب بيانات التذكرة مع الـ QR Code للعرض في المودال
     */
    public function getTicketData(string $booking_number): JsonResponse
    {
        $booking = Booking::with(['event', 'user:id,name'])
            ->where('booking_number', $booking_number)
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Billet introuvable'], 404);
        }

        // الأمان: التأكد أن صاحب التذكرة أو الأدمن هو من يطلبها
        $currentUser = Auth::user();
        if ($currentUser->id !== $booking->user_id && $currentUser->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Accès refusé'], 403);
        }

        // توليد الـ QR Code بصيغة SVG ليتم عرضه في الـ HTML مباشرة
        $qrCode = QrCode::size(200)
            ->color(83, 34, 0) // لون بني ملكي
            ->margin(1)
            ->generate($booking->booking_number);

        return response()->json([
            'success' => true,
            'data' => [
                'booking' => $booking,
                'qr_code' => (string) $qrCode
            ]
        ]);
    }

    /**
     * ميزة "أفضل من Atlas Haven": نظام الـ Scanner للمنظمين
     * يتم استدعاؤه من تطبيق الهاتف أو كاميرا الحاسوب في لوحة التحكم
     */
    public function checkIn(Request $request): JsonResponse
    {
        $request->validate(['booking_number' => 'required|string']);

        $booking = Booking::where('booking_number', $request->booking_number)->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Ticket invalide ou inexistant.'], 404);
        }

        if ($booking->status === 'attended') {
            return response()->json([
                'success' => false, 
                'message' => 'Attention: Ce ticket a déjà été utilisé à ' . $booking->updated_at->format('H:i')
            ], 422);
        }

        // تحديث حالة الحضور
        $booking->update(['status' => 'attended']);

        return response()->json([
            'success' => true, 
            'message' => 'Bienvenue ! Accès autorisé pour: ' . $booking->attendee_name,
            'attendee' => $booking->attendee_name
        ]);
    }
}