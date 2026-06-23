<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * الحقول القابلة للتعبئة (Mass Assignable).
     * أضفنا 'role' و 'phone' و 'bio' و 'avatar' لضمان عمل الـ API بشكل صحيح.
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'bio',
        'avatar',
        'role',      // مهم جداً للتحكم في الرتب
        'is_active',  // حالة الحساب
    ];

    /**
     * الحقول التي يجب إخفاؤها عند تحويل الموديل إلى JSON (للأمان).
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * تحويل أنواع البيانات (Casting).
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // =========================================================================
    // العلاقات (RELATIONS)
    // =========================================================================

    /**
     * علاقة المستخدم بالحجوزات (One to Many).
     * المستخدم الواحد يمكنه إجراء عدة حجوزات.
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'user_id');
    }

    /**
     * علاقة المنظم بالفعاليات التي أنشأها (One to Many).
     * تُستخدم فقط إذا كانت رتبة المستخدم 'organizer' أو 'admin'.
     */
    public function organizedEvents(): HasMany
    {
        return $this->hasMany(Event::class, 'organizer_id');
    }

    /**
     * علاقة المستخدم بالتقييمات (Reviews).
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    // =========================================================================
    // وظائف مساعدة (Helper Functions)
    // =========================================================================

    /**
     * فحص هل المستخدم مدير (Admin).
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * فحص هل المستخدم منظم (Organizer).
     */
    public function isOrganizer(): bool
    {
        return $this->role === 'organizer';
    }
}