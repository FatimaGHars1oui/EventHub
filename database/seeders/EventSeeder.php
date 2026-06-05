<?php

namespace Database\Seeders;

use DeepCopy\f013\C;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use App\Models\Category;
use App\Models\Organizer;
use App\Models\Event;
use App\Models\User;

class EventSeeder extends Seeder
{
     
    public function run(): void
        {
            $getCategoryId = function ($name) {
                return \App\Models\Category::firstOrCreate(['name' => $name])->id;
            };

            $getOrganizerId = function($email) {
        $user = \App\Models\User::where('email', $email)->first();
        return $user ? $user->id : \App\Models\User::first()->id; //Retourne l'ID de l'organisateur ou l'ID du premier utilisateur si l'organisateur n'existe pas
    };
    
            $events = [
                [
                    'title' => 'Conference Web Summit fez 2026',
                    'slug' => Str::slug('conference-web-summit-fes-2026'),
                    'description' => 'Rejoignez-nous pour la conférence Web Summit à Fès en 2026, où les esprits les plus brillants de la technologie et de l\'innovation se réuniront pour partager leurs idées et leurs visions du futur numérique.',
                    'short_description' => 'Rejoignez-nous pour la conférence Web Summit à Fès en 2026, où les esprits les plus brillants de la technologie et de l\'innovation se réuniront pour partager leurs idées et leurs visions du futur numérique.',
                    'category_id' => $getCategoryId('Technology'), //Assuming the category "Technology" has an ID of 1
                    'organizer_id' => $getOrganizerId('technology@example.com'), //Assuming the organizer "Technology" has an ID of 1
                    'start_date' => Carbon::now()->addDays(20)->setTime(14,0),
                    'end_date' => Carbon::now()->addDays(20)->setTime(18,0),
                    'venue_name' => 'Palais des Congrès de Fès',
                    'venue_address' => 'Avenue des FAR, Fès, Maroc',
                    'city' => 'Fès',
                    'price' => 150.00,
                    'max_attendees' => 20,
                    'status' => 'published',
                    'is_featured' => false,
                ],
                [
                    'title' => 'Festival Malhoun sous les étoiles',
                    'slug' => Str::slug('festival-malhoun-sous-les-etoiles'),
                    'description' => 'Vivez une expérience unique au Festival Malhoun sous les étoiles, un événement culturel qui célèbre la musique traditionnelle marocaine dans un cadre enchanteur à Fès.',
                    'short_description' => 'Vivez une expérience unique au Festival Malhoun sous les étoiles, un événement culturel qui célèbre la musique traditionnelle marocaine dans un cadre enchanteur à Fès.',
                    'category_id' => $getCategoryId('Music'), //Assuming the category "Music" has an ID of 2
                    'organizer_id' => $getOrganizerId('music@example.com'), //Assuming the organizer "Music" has an ID of 2
                    'city' => 'Fès',
                    'start_date' => Carbon::now()->addDays(30)->setTime(20,0),
                    'end_date' => Carbon::now()->addDays(30)->setTime(23,0),
                    'price' => 50.00,
                    'venue_name' => 'Place Seffarine',
                    'venue_address' => 'Place Seffarine, Fès, Maroc',
                    'max_attendees' => 100,
                    'status' => 'published',
                    'is_featured' => true,
                ],
                [
                    'title' => 'Exposition Art Contemporain Marocain',
                    'slug' => Str::slug('exposition-art-contemporain-marocain'),
                    'description' => 'Découvrez l\'exposition d\'art contemporain marocain à Fès, mettant en lumière les œuvres innovantes d\'artistes locaux et internationaux qui explorent les thèmes de l\'identité, de la culture et de la société.',
                    'short_description' => 'Découvrez l\'exposition d\'art contemporain marocain à Fès, mettant en lumière les œuvres innovantes d\'artistes locaux et internationaux qui explorent les thèmes de l\'identité, de la culture et de la société.',
                    'category_id' => $getCategoryId('Art'), //Assuming the category "Art" has an ID of 3
                    'organizer_id' => $getOrganizerId('art@example.com'), //Assuming the organizer "Art" has an ID of 3
                    'city' => 'Fès',
                    'start_date' => Carbon::now()->addDays(40)->setTime(10,0),
                    'end_date' => Carbon::now()->addDays(40)->setTime(18,0),
                    'price' => 20.00,
                    'venue_name' => 'Musée Royal',
                    'venue_address' => 'Musée Royal, Fès, Maroc',
                    'max_attendees' => 50,
                    'status' => 'published',
                    'is_featured' => false,
                ],
                [
                    'title' => 'Festival de Musique Gnaoua et Musiques du Monde',
                    'slug' => Str::slug('festival-musique-gnaoua-musiques-du-monde'),
                    'description' => 'Plongez dans l\'univers envoûtant du Festival de Musique Gnaoua et Musiques du Monde à Fès, où les rythmes hypnotiques de la musique gnaoua se mêlent aux sonorités du monde entier pour créer une expérience musicale inoubliable.',
                    'short_description' => 'Plongez dans l\'univers envoûtant du        Festival de Musique Gnaoua et Musiques du Monde à Fès, où les rythmes hypnotiques de la musique gnaoua se mêlent aux sonorités du monde entier pour créer une expérience musicale inoubliable.',
                    'category_id' => $getCategoryId('Music'), //Assuming the category "Music" has an ID of 2
                    'organizer_id' => $getOrganizerId('music@example.com'), //Assuming the organizer "Music" has an ID of 2            
                    'city' => 'Fès',
                    'start_date' => Carbon::now()->addDays(50)->setTime(20,0),
                    'end_date' => Carbon::now()->addDays(50)->setTime(23,0),
                    'price' => 60.00,
                    'venue_name' => 'Jardin Jnan Sbil',
                    'venue_address' => 'Jardin Jnan Sbil, Fès, Maroc',
                    'max_attendees' => 150,
                    'status' => 'published',
                    'is_featured' => true,
                
                ],
                [
                    'title' => 'Salon International',
                    'slug' => Str::slug('salon-international-artisanat-fes'),
                    'description' => 'Explorez le Salon International de l\'Artisanat de Fès, un événement incontournable qui met en avant le savoir-faire artisanal marocain à travers des expositions, des démonstrations et des ateliers interactifs.',
                    'short_description' => 'Explorez le Salon International de l\'Artisanat de Fès, un événement incontournable qui met en avant le savoir-faire artisanal marocain à travers des expositions, des démonstrations et des ateliers interactifs.',
                    'category_id' => $getCategoryId('Crafts'), //Assuming the category "Crafts" has an ID of 4
                    'organizer_id' => $getOrganizerId('crafts@example.com'), //Assuming the organizer "Crafts" has an ID of 4
                    'city' => 'Fès',
                    'start_date' => Carbon::now()->addDays(60)->setTime(10,0),
                    'end_date' => Carbon::now()->addDays(60)->setTime(18,0),
                    'price' => 10.00,
                    'venue_name' => 'Palais des Congrès de Fès',
                    'venue_address' => 'Avenue des FAR, Fès, Maroc',
                    'max_attendees' => 200,
                    'status' => 'published',
                    'is_featured' => false,
                ],
                [
                    'title' => 'Festival de Cinéma de Fès',
                    'slug' => Str::slug('festival-cinema-fes'),
                    'description' => 'Assistez au Festival de Cinéma de Fès, un événement cinématographique prestigieux qui célèbre le cinéma marocain et international à travers des projections, des rencontres avec les réalisateurs et des ateliers de formation.',
                    'short_description' => 'Assistez au Festival de Cinéma de Fès, un événement cinématographique prestigieux qui célèbre le cinéma marocain et international à travers des projections, des rencontres avec les réalisateurs et des ateliers de formation.',
                    'category_id' => $getCategoryId('Film'), //Assuming the category "Film" has an ID of 5
                    'organizer_id' => $getOrganizerId('film@example.com'), //Assuming the organizer "Film" has an ID of 5
                    'city' => 'Fès',
                    'start_date' => Carbon::now()->addDays(70)->setTime(19,0),
                    'end_date' => Carbon::now()->addDays(70)->setTime(22,0),
                    'price' => 0.00,
                    'is_free' => true,
                    'venue_name' => 'Cinéma du Centre',
                    'venue_address' => 'Rue Mohammed V, Fès, Maroc',
                    'max_attendees' => 50,
                    'status' => 'published',
                    'is_featured' => true,
                ],
            ];
    
            foreach ($events as $eventData) {
                \App\Models\Event::create($eventData);
            }
    
}
}
