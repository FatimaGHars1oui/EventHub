<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
// زدت هاد الجوج باش تخدم إضافة الأحداث والترقيع ديال الصور
use Illuminate\Support\Str; 
use Illuminate\Support\Facades\Storage;

class EventController extends Controller
{
    public function index(Request $request):JsonResponse
    {
        // base query avec easy eager loading pour les relations (evite les N+1 queries)
        $query = Event::with(['organizer', 'category'])->published();
        //gestion des evenements passés selon le role
        //$user = auth('sanctum')->user();
        //$includePast = $request->has('include_past') && $request->include_past === 'true';
        //admins et organisateurs peuvent voir les événements passés avec les paramètres
        //$canSeePast = $user && in_array($user->role, ['admin', 'organizer']) && $includePast;
        //par défaut: seulement les événements à venir (pour le public)
       // if(!$canSeePast){
          //  $query->upcoming();
       // }

       // Application des filtres (tous optionnels ,  chainable)

       // ?serch=concert -> Recherche full text (titre, description, lieu)
        if($request->has('search') && $request->search){
           $query->search($request->search);
        }

        // ?category=3 ou category_id=3 -> Filtre par catégorie
        $categoryId = $request->category ?? $request->category_id;
        if($categoryId){
            $query->inCategory($categoryId);
        }

        // ?city=Rabat -> Filtre par ville
        if($request->has('city') && $request->city){
            $query->inCity($request->city);
        }

        // ?price_min=50&price_max=200 -> Filtre par fourchette de prix
        if($request->has('price_min') || $request->has('price_max')){
            $query->inPriceRange($request->price_min, $request->price_max);
        }

        // ?free=true -> Filtre les événements gratuits
        // ?free=false -> Filtre les événements payants
        if($request->has('free')){
            if($request->free == 'true'){
                $query->where('is_free', true);
            }elseif($request->free == 'false'){
                $query->where('is_free', false);
            }
        }

        // ?date=tody -> Filtre les événements d'aujourd'hui
        // ?date=week -> Filtre les événements de la semaine

          if($request->has('date')){
            if($request->date == 'today'){
                $query->whereDate('start_date', today());
            }elseif($request->date == 'week'){
                $query->whereBetween('start_date', [now()->startOfWeek(), now()->endOfWeek()]);
            }
        }

        // ?featured=true -> Filtre les événements en vedette
        // ?featured=false -> Filtre les événements non en vedette
        if($request->has('featured')){
            if($request->featured == 'true'){
                $query->featured(); //scope: Where is_featured = 1
            }elseif($request->featured == 'false'){
                $query->where('is_featured', false); //exlure les featured
            }
        }

        // TRI : ?sort_by=start_date&sort_order=asc
        $sortBy = $request->get('sort_by', 'created_at'); //par défaut trié par date de début
        $sortOrder = $request->get('sort_order', 'desc'); //par défaut trié par ordre croissant

        // whitelist des champs triables (sécurité)
        if(in_array($sortBy, ['start_date', 'price', 'created_at', 'title'])){
            $query->orderBy($sortBy, $sortOrder);
        }

        //Pagination : ?per_page=20 (par défaut 12 , max 50)
        $perPage = min($request->get('per_page', 12), 50);
        $events = $query->paginate($perPage);

       return response()->json([
            'success' => true,
            'data' => $events->items(),
            'pagination' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'per_page' => $events->perPage(),
                'total' => $events->total(),
                'from' => $events->firstItem(),
                'to' => $events->lastItem()
            ]
        ]);
    }

    public function show(Event $event): JsonResponse
    {
        // eager loading pour les relations pour éviter les N+1 queries
        $event->load(['organizer', 'category', 'confirmedBookings']);

        return response()->json([
            'success' => true,
            'data' => $event
        ]);
        
    }

    /**
     * زدنا هاد الدالة باش المنظمين يقدروا يزيدوا Event جديد
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'required|exists:categories,id', //
            'description' => 'required|string',
            'short_description' => 'nullable|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'venue_name' => 'required|string',
            'venue_address' => 'required|string',
            'city' => 'required|string',
            'price' => 'required|numeric|min:0',
            'max_attendees' => 'required|integer|min:1',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        // رفع الصورة وتخزين المسار
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('events', 'public');
            $validated['image'] = 'storage/' . $path;
        }

        $validated['organizer_id'] = $request->user()->id; //
        $validated['status'] = 'published'; // غادي يولي published نيشان حيت نتا خدام بـ Admin/Organizer
        $validated['slug'] = Str::slug($request->title) . '-' . Str::random(6); //
        $validated['is_free'] = $request->price == 0;

        $event = Event::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'L\'événement a été créé avec succès.',
            'data' => $event
        ], 201);
    }
}

