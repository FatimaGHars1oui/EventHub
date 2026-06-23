<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasFactory;

    /**
     * الحقول القابلة للتعبئة (Fillable)
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'is_active'
    ];

    /**
     * تحويل أنواع البيانات (Casting)
     */
    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * علاقة الصنف بالفعاليات (One to Many)
     * كل صنف يحتوي على العديد من الفعاليات
     */
    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    /**
     * علاقة خاصة بالفعاليات المنشورة فقط
     * تُستخدم في حساب عدد الفعاليات النشطة المعروضة للزوار
     */
    public function activeEvents(): HasMany
    {
        return $this->hasMany(Event::class)->where('status', 'published');
    }

    /**
     * Scope لجلب الأصناف النشطة فقط
     * يُستخدم في الكنترولر هكذا: Category::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * استخدام الـ Slug في الروابط بدلاً من ID (اختياري للـ SEO)
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}