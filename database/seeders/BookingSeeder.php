<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Event;
use App\Models\Booking;

class BookingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // جلب المستخدمين العاديين
        $users = User::where('role', 'user')->get();
        // جلب الفعاليات المنشورة
        $events = Event::published()->get();

        if ($events->isEmpty() || $users->isEmpty()) {
            return; // توقف إذا لم تكن هناك بيانات كافية
        }

        $bookingsData = [
            [
                'target_event' => 'Web Summit Fès 2026',
                'attendee_name' => 'Amin Cherki',
                'attendee_email' => 'amin.cherki@example.com',
                'quantity' => 1,
                'status' => 'confirmed',
                'payment_status' => 'paid',
            ],
            [
                'target_event' => 'Festival Malhoun sous les étoiles',
                'attendee_name' => 'Sara El Amrani',
                'attendee_email' => 'sara.amrani@example.com',
                'quantity' => 2,
                'status' => 'confirmed',
                'payment_status' => 'paid',
            ],
            [
                'target_event' => 'Exposition Art Contemporain',
                'attendee_name' => 'Youssef El Idrissi',
                'attendee_email' => 'youssef.idrissi@example.com',
                'quantity' => 1,
                'status' => 'confirmed',
                'payment_status' => 'paid',
            ],
            [
                'target_event' => 'Networking Business Fès',
                'attendee_name' => 'Fatima Zahra',
                'attendee_email' => 'fatima@example.com',
                'quantity' => 1,
                'status' => 'pending',
                'payment_status' => 'pending',
            ]
        ];

        foreach ($bookingsData as $data) {
            // البحث عن الفعالية بالعنوان الصحيح
            $event = Event::where('title', $data['target_event'])->first();

            if ($event) {
                Booking::create([
                    'booking_number' => 'BK-' . date('Y') . '-' . strtoupper(\Illuminate\Support\Str::random(8)),
                    'user_id' => $users->random()->id,
                    'event_id' => $event->id,
                    'quantity' => $data['quantity'],
                    'unit_price' => $event->price,
                    'total_amount' => $event->price * $data['quantity'],
                    'currency' => $event->currency,
                    'attendee_name' => $data['attendee_name'],
                    'attendee_email' => $data['attendee_email'],
                    'status' => $data['status'],
                    'payment_status' => $data['payment_status'],
                    'confirmed_at' => $data['status'] === 'confirmed' ? now() : null,
                ]);

                // تحديث عدد الحضور في الفعالية
                if ($data['status'] === 'confirmed') {
                    $event->increment('current_attendees', $data['quantity']);
                }
            }
        }
    }
}