<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Stripe\Stripe;
use Stripe\Checkout\Session;
use App\Models\Booking;

class PaymentController extends Controller
{
    public function createCheckoutSession(Request $request)
{
    try {
        Stripe::setApiKey(env('STRIPE_SECRET_KEY'));

        $event = \App\Models\Event::findOrFail($request->event_id);
        $user = $request->user();

        // التأكد من أن السعر أكبر من صفر
        if ($event->price <= 0) {
            return response()->json(['error' => 'Le prix de l\'événement est invalide.'], 400);
        }

        $session = Session::create([
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => 'eur', // <-- تأكد أنها يورو أو دولار للتجربة، وليس mad
                    'product_data' => [
                        'name' => $event->title,
                    ],
                    'unit_amount' => $event->price * 100, 
                ],
                'quantity' => 1,
            ]],
            'mode' => 'payment',
            'success_url' => url('index.html?payment=success&event_id=' . $event->id),
            'cancel_url' => url('index.html?payment=cancelled'),
        ]);

        return response()->json(['url' => $session->url]);

    } catch (\Exception $e) {
        // هذا السطر سيرسل الخطأ الحقيقي إلى الجافاسكربت
        return response()->json(['error' => $e->getMessage()], 500);
    }
}
}