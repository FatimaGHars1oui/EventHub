<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;


class Event extends Model
{
    use HasFactory; //Event :: factory();
    // ==== INFORMATION DE BASE ====
    protected $fillable = [
        'title', //Titre de l'événement(ex: "Concert de rock")
        'slug',//URL-friendly (ex: "concert-de-rock")
        'description', //Description complète de l'événement(peut inclure du HTML)
        'short_description',
        'image',
        'gallery',
        // ==== RELATIONS (Foreign Keys) ====
        'organizer_id', //ID de l'organisateur (foreign key -> users.id)
        'category_id', //ID de la catégorie (foreign key -> categories.id)
        // ==== DATES ET LOCALISATION ====
        'start_date', //Date et heure de début de l'événement(ex: "2024-12-31 20:00:00")
        'end_date', //Date et heure de fin de l'événement(nullable si pas de fin précisée)
        'timezone', //Fuseau horaire de l'événement(ex: "Europe/Paris")
        'venue_name', //Nom du lieu(ex: "Stade de France")
        'venue_address', //Adresse complète du lieu(ex: "Stade de France, 93216 Saint-Denis, France")
        'city', //Ville de l'événement(pour faciliter les recherches)
        'country', //Pays de l'événement(défaut à "Fez")
        'latitude', //Latitude GPS(pour Google Maps)
        'longitude', //Longitude GPS(pour Google Maps)
        // ==== PRIX ET CAPACITÉ ====
        'price', //Prix de l'événement(ex: "20.00" ou "Gratuit")
        'is_free', //Indique si l'événement est gratuit (boolean)
        'currency', //Devise du prix(ex: "EUR", "USD")
        'max_attendees', //Nombre maximum de participants (nullable si illimité)
        'current_attendees', //Nombre actuel de participants (calculé dynamiquement)
        // ==== STATUT ET workflow ====
        'status', //Statut de l'événement(ex: "draft", "published", "cancelled")
        'is_featured', //Indique si l'événement est mis en avant (boolean)
        'requires_approval', //Indique si les inscriptions nécessitent une approbation (boolean)
        'rejection_reason', //Raison du rejet (nullable, utilisé si l'événement est rejeté)
        'reviewed_by', //ID de l'administrateur qui a examiné l'événement (foreign key -> users.id, nullable)
        'reviewed_at', //Date et heure de l'examen de l'événement (nullable) (timestamp)

        // ==== MÉTADONNÉES ET SEO (search engine optimization)====
        'meta_title', //Titre SEO de l'événement (nullable)
        'meta_description', //Description SEO de l'événement (nullable)
        'tags', //JSON Mots-clés (ex: "musique, rock, concert", nullable)
    ];

        protected $casts = [
            //Dates
            'start_date' => 'datetime', //$event->start_date->addDays(7)
            'end_date' => 'datetime',//$event->end_date->isFuture()
            //JSON -> Array en PHP
            'gallery' => 'array', //tableau d'URLs d'images
            'tags' => 'array', //Tableau de mots-clés
            //TINYINT(1) -> boolean :MySQL stocke les booléens comme des entiers (0 ou 1), mais Laravel les convertit automatiquement en valeurs booléennes (true ou false) grâce à la propriété $casts.
            'is_free' => 'boolean',//Gratuit ou payant?
            'is_featured' => 'boolean',//Mis en avant?
            'requires_approval' => 'boolean',// Validation admin requise ?
            //Nombrs : Garantit la précision et le format
            'latitude' => 'decimal:8', //Latitude GPS (ex: 48.8566)
            'longitude' => 'decimal:8', //Longitude GPS (ex: 2.3522)
            'price' => 'decimal:2', //Prix de l'événement (ex: 19.99)
        ];

        protected $appends = [
            'image_url',
            'formatted_price',
            'available_spots'// place restant
        ];
        // relationships
        public function organizer()
        {
            return $this->belongsTo(User::class, 'organizer_id');
        }
        public function category()
        {
            return $this->belongsTo(Category::class, 'category_id');
        }

         public function bookings()
        {
            return $this->hasMany(Booking::class);
       }
       //relation pour recupérer les réservations confirmées (status = "confirmed")
       public function confirmedBookings()
       {    
            return $this->hasMany(Booking::class)->where('status', 'confirmed');
        }
    //relation pour les participants (users) via la table bookings
    //type: many to many (un événement peut avoir plusieurs participants et un utilisateur peut participer à plusieurs événements)
    public function attendees()
    {
        return $this->belongsToMany(User::class, 'bookings', 'event_id', 'user_id')
                    ->withPivot(['quantity','total_amount', 'status']) //Inclut le statut de la réservation dans les résultats
                    ->wherePivot('status', 'confirmed'); //Ne récupère que les participants avec une réservation confirmée
    }

    
        //Accessors (getters)
        public function getImageUrlAttribute()
        {
            if ($this->image && Storage::disk('public')->exists($this->image)) {
              return asset('storage/' . $this->image);
            }
            //Image par defaut SVG
            //Génère une image SVG de remplacement avec le titre de l'événement
            $title  = mb_substr($this->title, 0, 50); //Limite le titre à 50 caractères pour éviter les débordements
            $svg ='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">' .
                '<rect width="800" height="400" fill="#007bff"/>' .
                '<text fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" x="400" y="200" >' .
                 htmlspecialchars($this->title) . '</text>' .
                '<text x="400" y="230" text-anchor="middle" fill="#aaa" font-size="16" font-family="Arial, sans-serif" opacity="0.8">Eventhub</text>' .
                '</svg>';
                return 'data:image/svg+xml;base64,' . base64_encode($svg);
        }

        public function getFormattedPriceAttribute()
        {
            if ($this->is_free) {
                return 'Gratuit';
            }
            return number_format($this->price, 2, '.', ' ') . ' ' . $this->currency;
        }

        public function getAvailableSpotsAttribute()
        {
            if (!$this->max_attendees ) {
                return null;
            }
           return max(0, $this->max_attendees - $this->current_attendees); // Ne jamais retourner un nombre négatif
        }

        //Query Scopes (pour les requêtes fréquentes)
        //Scope pour les événements publiés
        public function scopePublished($query)
        {
            return $query->where('status', 'published');
        }

        //Scope pour les événements à venir (start_date > now)
        public function scopeUpcoming($query)
        {
            return $query->where('start_date', '>', now());
        }
        //scope mis en avant
        public function scopeFeatured($query)
        {
            return $query->where('is_featured', true);
        }

        //scope filtre par ville
        public function scopeInCity($query, $city)
        {
            return $query->where('city', 'like', '%' . $city . '%');
        }

        //scope filtre par catégorie
        public function scopeInCategory($query, $categoryId)
        {
            return $query->where('category_id', $categoryId);
        }
        //scope pour les événements en attente de validation
        public function scopePending($query)
        {
            return $query->where('status', 'pending');
        }

        //scope pour les événements rejetés
        public function scopeRejected($query)
        {
            return $query->where('status', 'rejected');
        }

        //scope : brouillon (draft)
        //SQL : WHERE status = 'draft'
        public function scopeDraft($query)
        {
            return $query->where('status', 'draft');
        }
        //Scope : Filtre par fourchette de prix
        public function scopeInPriceRange($query, $min=null, $max=null)
        {
            if ($min !== null) {
                $query->where('price', '>=', $min);
            }
            if ($max !== null) {
                $query->where('price', '<=', $max);
            }
            return $query;
        }

        //Scope :Recherche multi-champs (title, description, city)
        public function scopeSearch($query, $search)
        {
        
            return $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%")
                  ->orWhere('venue_name', 'like', "%{$search}%");
            });
        }

        //MUTATORS (setters) - pour formater ou valider les données avant de les enregistrer en base
        public function setTitleAttribute($value)
        {
            $this->attributes['title'] = $value;
            //Génère automatiquement le slug à partir du titre
            $this->attributes['slug'] = Str::slug($value).'-'.Str::random(6); //Ajoute une chaîne aléatoire pour garantir l'unicité du slug
        }

        public function getRouteKeyName(): string
        {
            return 'id'; //Utilise l'ID au lieu du slug pour API
        }

        //method utilitaire pour vérifier si l'événement est complet
    public function incrementAttendees($quantity = 1)
    {
        $this->increment('current_attendees', $quantity);
       
    }
    public function decrementAttendees($quantity = 1)
    {
        $this->decrement('current_attendees', $quantity);
       
    }
    // داخل ملف app/Models/Event.php

public function reviews()
{
    return $this->hasMany(Review::class);
}
        
       
}
