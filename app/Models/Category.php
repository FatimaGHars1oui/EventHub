<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'slug',
        'description',
        'color',
        'icon',
        'is_active'
    ];
    
    protected $casts = [
        'is_active' => 'boolean',
    ];

    //relationships

    public function events()
    {
        return $this->hasMany(Event::class);
    }
    
    public function activeEvents()
    {
        return $this->hasMany(Event::class)->where('status', 'published');
    }

    //scope pour les catégories actives
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    //Route Model Binding
    public function getRouteKeyName(): string
    {
        return 'slug'; //Utilise le slug pour les URLs
    }
}
