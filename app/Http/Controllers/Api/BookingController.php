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
use Illuminate\Support\Facades\DB;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Exception;

class BookingController extends Controller
{
    /**
     * 1. جلب حجوزات المستخدم الحالي (History)
     */
    public function myBookings(Request $request): JsonResponse
    {
        try {
            $bookings = $request->user()->bookings()
                ->with(['event:id,title,start_date,venue_name,image,city,price,currency'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $bookings
            ]);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur de chargement'], 500);
        }
    }

    /**
     * 2. عملية الحجز الاحترافية (Store Booking)
     * تستخدم DB Transaction و lockForUpdate لمنع تجاوز العدد المسموح في اللحظات المتزامنة
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'event_id'       => 'required|exists:events,id',
            'quantity'       => 'required|integer|min:1|max:10',
            'attendee_name'  => 'required|string|max:255',
            'attendee_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            return DB::transaction(function () use ($request) {
                // استخدام lockForUpdate لحماية عداد المقاعد من التضارب
                $event = Event::where('id', $request->event_id)->lockForUpdate()->first();

                // التحقق من توفر الأماكن
                if ($event->max_attendees && ($event->current_attendees + $request->quantity) > $event->max_attendees) {
                    return response()->json([
                        'success' => false, 
                        'message' => 'Désolé, places insuffisantes (Reste: ' . ($event->max_attendees - $event->current_attendees) . ')'
                    ], 400);
                }

                // تحديد حالة الدفع (إذا كان مجاني يكون Paid فوراً)
                $isFree = ($event->price == 0);
                
                $booking = Booking::create([
                    'user_id'         => Auth::id(),
                    'event_id'        => $event->id,
                    'quantity'        => $request->quantity,
                    'unit_price'      => $event->price,
                    'total_amount'    => $event->price * $request->quantity,
                    'currency'        => $event->currency ?? 'MAD',
                    'attendee_name'   => $request->attendee_name,
                    'attendee_email'  => $request->attendee_email,
                    'status'          => 'confirmed',
                    'payment_status'  => $isFree ? 'paid' : 'pending',
                    'confirmed_at'    => now(),
                ]);

                // تحديث عداد الحاضرين في الحدث
                $event->increment('current_attendees', $request->quantity);

                // توليد الـ QR Code (SVG) لإرجاعه فوراً في الرد
                $qrCode = (string) QrCode::size(200)->color(99, 102, 241)->generate($booking->booking_number);

                // إرسال إيميل التأكيد
                try {
                    Mail::to($booking->attendee_email)->send(new BookingConfirmation($booking));
                } catch (Exception $e) {
                    Log::warning("Email booking failed: " . $e->getMessage());
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Réservation réussie !',
                    'booking_number' => $booking->booking_number,
                    'qr_code' => $qrCode, // مهم جداً للفرونت إند
                    'data' => $booking->load('event')
                ], 201);
            });
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 3. جلب بيانات التذكرة مع الـ QR Code (للمودال أو الطباعة)
     */
    public function getTicketData(string $booking_number): JsonResponse
    {
        $booking = Booking::with(['event', 'user:id,name'])
            ->where('booking_number', $booking_number)
            ->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Billet introuvable'], 404);
        }

        // الأمان: صاحب التذكرة أو الأدمن فقط
        if (Auth::id() !== $booking->user_id && Auth::user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Accès refusé'], 403);
        }

        $qrCode = (string) QrCode::size(200)->color(30, 41, 59)->generate($booking->booking_number);

        return response()->json([
            'success' => true,
            'data' => [
                'booking' => $booking,
                'qr_code' => $qrCode
            ]
        ]);
    }

    /**
     * 4. نظام الـ Check-In (Scanner للمنظمين والآدمن)
     */
    public function checkIn(Request $request): JsonResponse
    {
        $request->validate(['booking_number' => 'required|string']);

        $booking = Booking::where('booking_number', $request->booking_number)->first();

        if (!$booking) {
            return response()->json(['success' => false, 'message' => 'Ticket invalide.'], 404);
        }

        if ($booking->status === 'attended') {
            return response()->json([
                'success' => false, 
                'message' => 'Attention: Déjà utilisé le ' . $booking->updated_at->format('d/m à H:i')
            ], 422);
        }

        // تحديث حالة الحضور
        $booking->update(['status' => 'attended']);

        return response()->json([
            'success' => true, 
            'message' => 'Bienvenue ! Accès autorisé pour: ' . $booking->attendee_name
        ]);
    }

    /**
     * 5. إلغاء الحجز (Cancellation)
     */
    public function destroy(Booking $booking): JsonResponse
    {
        // حماية: لا يمكن للمستخدم إلغاء حجز غيره
        if (Auth::id() !== $booking->user_id && Auth::user()->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Action non autorisée'], 403);
        }

        try {
            DB::transaction(function () use ($booking) {
                // تقليل عدد الحاضرين في الفعالية قبل حذف الحجز
                $booking->event->decrement('current_attendees', $booking->quantity);
                $booking->delete();
            });

            return response()->json(['success' => true, 'message' => 'Réservation annulée']);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => 'Erreur'], 500);
        }
    }
}