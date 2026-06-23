<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use App\Models\Category;
use App\Models\User;
use App\Models\Event;

class EventSeeder extends Seeder
{
    public function run(): void
    {
        // دالة مساعدة لجلب معرف الصنف بأمان
        $getCat = function ($name) {
            return Category::where('name', 'like', "%$name%")->first()->id ?? Category::first()->id;
        };

        // دالة مساعدة لجلب معرف المنظم
        $getOrg = function($email) {
            return User::where('email', $email)->first()->id ?? User::where('role', 'admin')->first()->id;
        };

        $events = [
            // --- تكنولوجيا ---
            [
                'title' => 'Fès Tech Hackathon 2026',
                'description' => 'Un marathon de programmation de 48h pour résoudre les problèmes urbains de la médina.',
                'short_description' => '48h de code intensif.',
                'category_id' => $getCat('Techno'),
                'organizer_id' => $getOrg('technology@example.com'),
                'start_date' => Carbon::now()->addDays(10)->setTime(9,0),
                'venue_name' => 'Technopark Fès',
                'venue_address' => 'Quartier Industriel, Fès',
                'city' => 'Fès', 'price' => 0.00, 'is_free' => true, 'max_attendees' => 100, 'status' => 'published',
            ],
            [
                'title' => 'Intelligence Artificielle & Patrimoine',
                'description' => 'Conférence sur l\'utilisation de l\'IA pour la restauration des monuments historiques.',
                'short_description' => 'L\'avenir du passé.',
                'category_id' => $getCat('Techno'),
                'organizer_id' => $getOrg('technology@example.com'),
                'start_date' => Carbon::now()->addDays(25)->setTime(14,30),
                'venue_name' => 'Université Al Quaraouiyine',
                'venue_address' => 'Médina de Fès',
                'city' => 'Fès', 'price' => 50.00, 'max_attendees' => 200, 'status' => 'published',
            ],

            // --- موسيقى ---
            [
                'title' => 'Festival des Musiques Sacrées',
                'description' => 'Le rendez-vous mondial incontournable de la spiritualité et de la musique à Fès.',
                'short_description' => 'Musique et spiritualité.',
                'category_id' => $getCat('Musique'),
                'organizer_id' => $getOrg('music@example.com'),
                'start_date' => Carbon::now()->addDays(60)->setTime(20,0),
                'venue_name' => 'Bab Makina',
                'venue_address' => 'Place Lalla Yeddouna',
                'city' => 'Fès', 'price' => 300.00, 'max_attendees' => 1500, 'status' => 'published',
            ],
            [
                'title' => 'Nuit du Jazz au Riad',
                'description' => 'Une soirée intime de Jazz fusion dans un riad traditionnel du 14ème siècle.',
                'short_description' => 'Jazz et architecture.',
                'category_id' => $getCat('Musique'),
                'organizer_id' => $getOrg('music@example.com'),
                'start_date' => Carbon::now()->addDays(12)->setTime(21,0),
                'venue_name' => 'Riad Sheherazade',
                'venue_address' => 'Douh, Médina de Fès',
                'city' => 'Fès', 'price' => 150.00, 'max_attendees' => 40, 'status' => 'published',
            ],

            // --- فن وثقافة ---
            [
                'title' => 'Exposition Peinture : Couleurs de Fès',
                'description' => 'Exposition des oeuvres de jeunes artistes locaux inspirés par les ruelles de la ville.',
                'short_description' => 'Art pictural local.',
                'category_id' => $getCat('Art'),
                'organizer_id' => $getOrg('art@example.com'),
                'start_date' => Carbon::now()->addDays(5)->setTime(10,0),
                'venue_name' => 'Galerie Mohamed El Kacimi',
                'venue_address' => 'Ville Nouvelle, Fès',
                'city' => 'Fès', 'price' => 0.00, 'is_free' => true, 'max_attendees' => 300, 'status' => 'published',
            ],
            [
                'title' => 'Atelier Calligraphie Arabe',
                'description' => 'Apprenez les bases de la calligraphie avec un maître artisan.',
                'short_description' => 'Atelier pratique.',
                'category_id' => $getCat('Art'),
                'organizer_id' => $getOrg('art@example.com'),
                'start_date' => Carbon::now()->addDays(18)->setTime(15,0),
                'venue_name' => 'Centre Culturel Les Étoiles de la Médina',
                'venue_address' => 'Sidi Moussa, Médina',
                'city' => 'Fès', 'price' => 80.00, 'max_attendees' => 15, 'status' => 'published',
            ],

            // --- رياضة ---
            [
                'title' => 'Marathon de la Médina',
                'description' => 'Une course unique à travers les portes historiques de la ville de Fès.',
                'short_description' => 'Sport et Histoire.',
                'category_id' => $getCat('Sport'),
                'organizer_id' => $getOrg('admin@example.com'),
                'start_date' => Carbon::now()->addDays(40)->setTime(07,0),
                'venue_name' => 'Place Boujloud (Départ)',
                'venue_address' => 'Bab Boujloud',
                'city' => 'Fès', 'price' => 20.00, 'max_attendees' => 500, 'status' => 'published',
            ],

            // --- طبخ (Gastronomie) ---
            [
                'title' => 'Festival Culinaire de la Pastilla',
                'description' => 'Concours et dégustations de la célèbre pastilla de Fès.',
                'short_description' => 'Saveurs fassies.',
                'category_id' => $getCat('Gastro'),
                'organizer_id' => $getOrg('admin@example.com'),
                'start_date' => Carbon::now()->addDays(32)->setTime(12,0),
                'venue_name' => 'Jardin Jnan Sbil',
                'venue_address' => 'Avenue de l\'Unesco',
                'city' => 'Fès', 'price' => 100.00, 'max_attendees' => 200, 'status' => 'published',
            ],

            // --- بيزنس ---
            [
                'title' => 'Invest in Fès Forum',
                'description' => 'Forum sur les opportunités d\'investissement dans la région Fès-Meknès.',
                'short_description' => 'Économie et Business.',
                'category_id' => $getCat('Business'),
                'organizer_id' => $getOrg('admin@example.com'),
                'start_date' => Carbon::now()->addDays(50)->setTime(9,0),
                'venue_name' => 'Fès Marriott Hotel Jnan Palace',
                'venue_address' => 'Avenue Ahmed Chaouki',
                'city' => 'Fès', 'price' => 500.00, 'max_attendees' => 300, 'status' => 'published',
            ],

            // أحداث إضافية عشوائية لتعبئة الصفحة
            [
                'title' => 'Atelier Poterie Traditionnelle',
                'description' => 'Découvrez le secret de la poterie bleue de Fès.',
                'short_description' => 'Artisanat local.',
                'category_id' => $getCat('Art'),
                'organizer_id' => $getOrg('art@example.com'),
                'start_date' => Carbon::now()->addDays(8)->setTime(14,0),
                'venue_name' => 'Quartier des potiers',
                'venue_address' => 'Ain Nokbi',
                'city' => 'Fès', 'price' => 60.00, 'max_attendees' => 20, 'status' => 'published',
            ],
            [
                'title' => 'Conférence Marketing Digital',
                'description' => 'Comment booster son business à l\'ère du numérique.',
                'short_description' => 'Digital Business.',
                'category_id' => $getCat('Techno'),
                'organizer_id' => $getOrg('technology@example.com'),
                'start_date' => Carbon::now()->addDays(15)->setTime(16,0),
                'venue_name' => 'Chambre de Commerce',
                'venue_address' => 'Ville Nouvelle',
                'city' => 'Fès', 'price' => 0.00, 'is_free' => true, 'max_attendees' => 100, 'status' => 'published',
            ],
        ];

        foreach ($events as $eventData) {
            // توليد الـ slug آلياً من العنوان لضمان عمل الروابط
            $eventData['slug'] = Str::slug($eventData['title']) . '-' . Str::random(5);
            
            // إحداثيات عشوائية في فاس لظهورها على الخريطة بشكل جميل
            $eventData['latitude'] = 34.01 + (mt_rand(0, 50) / 1000);
            $eventData['longitude'] = -5.00 - (mt_rand(0, 50) / 1000);
            
            Event::create($eventData);
        }
    }
}