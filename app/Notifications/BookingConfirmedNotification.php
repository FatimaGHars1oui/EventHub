<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class BookingConfirmedNotification extends Notification
{
    use Queueable;

    public $event;

    // نمرر الفعالية عند استدعاء الإشعار
    public function __construct($event) {
        $this->event = $event;
    }

    // نحفظ الإشعار في قاعدة البيانات
    public function via($notifiable)
    {
        return ['database'];
    }

    // شكل الإشعار الذي سيظهر في الجدول
    public function toArray($notifiable)
    {
        return [
            'message' => 'Votre réservation pour "' . $this->event->title . '" a été confirmée avec succès !',
            'event_id' => $this->event->id,
            'icon' => 'fa-ticket-alt',
            'color' => 'success'
        ];
    }
}