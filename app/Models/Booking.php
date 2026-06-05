<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Booking extends Model
{
    use HasFactory;

    protected $fillable = [
        //identification
        'booking_number', //Numéro de réservation unique (ex: "BK-20240901-0001")
        'user_id', //ID de l'utilisateur qui a effectué la réservation (foreign key -> users.id)
        'event_id', //ID de l'événement réservé (foreign key -> events.id)

        //quantité et prix
        'quantity', //Nombre de billets réservés (ex: 2)
        'unit_price', //Prix unitaire au moment de la réservation (ex: "20.00")
        'total_amount', //Montant total de la réservation (calculé : quantity * unit_price)
        'currency', //Devise du montant (ex: "EUR", "USD")

        //information de participant
        'attendee_name', //Nom du participant (ex: "John Doe")
        'attendee_email', //Email du participant (ex: "john.doe@example.com")
        'attendee_phone', //Numéro de téléphone du participant (ex: "+1234567890")
        'special_requirements', //Besoins spécifiques du participant (ex: "Besoin d'un siège accessible")

        // === statut et workflow ===
        'status', //Statut de la réservation (ex: "pending", "confirmed", "cancelled")

        //=== Workflow de paiement ===
        'payment_status', //Statut du paiement (ex: "pending", "paid", "failed")
        'payment_method', //Méthode de paiement utilisée (ex: "credit_card", "paypal")
        'payment_reference', //Référence de paiement (ex: ID de transaction PayPal)

        //=== Timestamps ===
        'confirmed_at', //Date et heure de confirmation de la réservation (nullable)
        'cancelled_at', //Date et heure d'annulation de la réservation (nullable)
        'refunded_at', //Date et heure de remboursement de la réservation (nullable)
            ];

    protected $casts = [
        //prix avec 2 décimales
        'unit_price' => 'decimal:2', //Assure que le prix unitaire est traité comme un nombre décimal avec 2 décimales
        'total_amount' => 'decimal:2', //Assure que le montant total est traité comme un nombre décimal avec 2 décimales
        
        
        //timestamps
        'confirmed_at' => 'datetime', //Convertit en instance
        'cancelled_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];
    // === RELATIONS ===
    /**
     * Relation avec l'utilisateur qui a effectué la réservation
     * type: belongsTo (une réservation appartient à un utilisateur) Many to One
     * 
     * utilisation: $booking->user->name
     * Note: user_id peut être null
     */
    public function user(){
        return $this->belongsTo(User::class);
    }
    /**
     * Reltion: Une réservation appartient à un événement
     * type: belongsTo (une réservation appartient à un événement) Many to One
     * 
     */

    public function event(){
        return $this->belongsTo(Event::class);
        }

    /**
     * QUERY SCOPES (filtres réutilisables)
     * 
     * Scope pour les réservations confirmées
     * usage: Booking::confirmed()->get();
     */    
    public function scopeConfirmed($query){
        return $query->where('status', 'confirmed');
        }
    public function scopePending($query){
        return $query->where('status', 'pending');
        }
        
     public function scopeCancelled($query){
        return $query->where('status', 'cancelled');
        }
        
    public function scopePaid($query){
            return $query->where('payment_status', 'paid');
        }

      /**
       * Accessor pour le montant total formaté avec la devise
       * retourne une couleur bootstrap en fonction du statut de paiement
       * usage: $booking->status_badge->'success','warning','danger'
       */

    public function getPaymentStatusBadgeAttribute(){
        $badges = [
            'pending' => 'warning',
            'paid' => 'success',
            'failed' => 'danger',
            'refunded' => 'info',
        ];

        return $badges[$this->payment_status] ?? 'secondary'; //gris par défaut

        }

        public function getFormattedTotalAttribute(){
            return number_format($this->total_amount, 2, '.', ' ') . ' ' . $this->currency;
        }
        // === Méthodes business ===
        // Génère un numéro de réservation unique basé sur la date et l'ID
        public function generateBookingNumber(){
    do {
        $number = 'BK-' . date('Y') . '-' . strtoupper(Str::random(8));
    } while (self::where('booking_number', $number)->exists());
    
    $this->booking_number = $number;
    return $this->booking_number;
}
        public function confirm(){
            $this->update(['status' => 'confirmed',
            'confirmed_at' => now(),
            ]);
            //incrementer le nombre de réservations confirmées pour l'événement
            $this->event->incrementAttendees( $this->quantity);
        }
        public function cancel(){
    $wasConfirmed = $this->status === 'confirmed'; // ← احفظ القيمة أولاً
    $this->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    if($wasConfirmed){
        $this->event->decrementAttendees($this->quantity);
    }
}
        
        public function refund(){
            $this->update([
            'status' => 'cancelled',
            'payment_status' => 'refunded',
            'refunded_at' => now(),
            ]);
            //décrémenter le nombre de réservations confirmées pour l'événement
            //seulement si la réservation était confirmée avant
            if($this->status === 'confirmed'){
            $this->event->decrementAttendees( $this->quantity);
            }
        }
        
        //boot method pour générer automatiquement un numéro de réservation avant la création

        protected static function boot()
        {
            // Appel obligatoire pour le bon fonctionnement de Laravel
             parent::boot();
             /**
              * evenement "creating" : avant de créer une réservation, générer un numéro de réservation unique
              * on verfie si booking_number est déjà défini (ex: lors de tests unitaires) sinon on le génère            
              */
                static::creating(function ($booking) {
                    if (empty($booking->booking_number)) {
                        $booking->generateBookingNumber();
                    }
                });
                
        }
       

}


