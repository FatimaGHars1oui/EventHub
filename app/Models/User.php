<?php

namespace App\Models;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use  HasApiTokens,HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'bio',
        'avatar',
        'role',
        'email_verified_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
    // === RELATIONS ===
    /**
     * Evenement réservé par l'utilisateur (one to many)
     */
    public function organizedEvents()
    {
        return $this->hasMany(Event::class, 'organizer_id'); //Un utilisateur peut organiser plusieurs événements
    }
    /**
     * Réservations effectuées par l'utilisateur (one to many)
     */
    public function bookings(){
        return $this->hasMany(Booking::class, 'user_id'); //Un utilisateur peut faire plusieurs réservations
    }
}
