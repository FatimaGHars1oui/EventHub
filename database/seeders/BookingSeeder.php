<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
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
        $users = User::where('role', 'user')->get();
        $events = Event::published()->get();

        $booking = [
            [
                'user_id' => $users->random()->id,
                'event_id' => $events->where('title', 'Conference Web Summit fez 2026')->first()->id,
                'booking_number' => 'BK-2026-0001',
                'quantity' => 1,
                'attendee_name' => 'amin cherki',
                'attendee_email' => 'amincherki@example.com',
                'attendee_phone' => '  +212 642336921',
                'status' => 'confirmed',
                'payment_status' => 'paid',
                'payment_method' => 'card',
                'payment_reference' => 'PAY-2026-F56789AHR',
                'confirmed_at' => now(),
            ],
            [
                'user_id' => $users->random()->id,
                'event_id' => $events->where('title', 'Festival Malhoun sous les étoiles')->first()->id,
                'booking_number' => 'BK-2026-0002',
                'quantity' => 2,
                'attendee_name' => 'Sara El Amrani',
                'attendee_email' => 'saraelamrani@example.com',
                'attendee_phone' => ' +212 612345678',
                'status' => 'confirmed',
                'payment_status' => 'paid',
                'payment_method' => 'paypal',
                'payment_reference' => 'PAY-2026-F56789AHR',
                'confirmed_at' => now(),
            ],
             [
                'user_id' => $users->random()->id,
                'event_id' => $events->where('title', 'Exposition Art Contemporain Marocain')->first()->id,
                'booking_number' => 'BK-2026-00803',
                'quantity' => 1,
                'attendee_name' => 'Youssef El Idrissi',
                'attendee_email' => 'youssefelidrissi@example.com',
                'attendee_phone' => ' +212 698765432',
                'status' => 'confirmed',
                'payment_status' => 'paid',
                'payment_method' => 'free',
                'payment_reference' => 'PAY-2026-F56789AHR',
                'confirmed_at' => now(),
            ],[
                'user_id' => $users->random()->id,
                'event_id' => $events->where('title', 'Festival de Musique Gnaoua et Musiques du Monde')->first()->id,
                'booking_number' => 'BK-2026-0074',
                'quantity' => 1,
                'attendee_name' => 'Fatima Zahra El Amrani',
                'attendee_email' => 'fatimazahraelamrani@example.com',
                'attendee_phone' => ' +212 654321098',
                'status' => 'pending',
                'payment_status' => 'pending',
            ],[
                'user_id' => $users->random()->id,
                'event_id' => $events->where('title', 'Salon International')->first()->id,
                'booking_number' => 'BK-2026-00455',
                'quantity' => 1,
                'attendee_name' => 'Omar Benjelloun',
                'attendee_email' => 'omarbenjelloun@example.com',
                'attendee_phone' => ' +212 654321098',
                'status' => 'confirmed',
                'payment_status' => 'paid',
                'payment_method' => 'card',
                'payment_reference' => 'PAY-2026-F56789AHR',
                'confirmed_at' => now(),

            ]

        ];

        foreach ($booking as $bookingData) {
            $event = Event::find($bookingData['event_id']);
            $bookingData['unit_price'] = $event->price;
            $bookingData['total_amount'] = $event->price * $bookingData['quantity'];
            $bookingData['currency'] = $event->currency;

            $booking = Booking::create($bookingData);

            //Mettre à jour le nombre de participants pour les rservations confirmées
            if ($booking->status === 'confirmed') {
                $event->increment('current_attendees', $booking->quantity);
            }
        }
    }
}
