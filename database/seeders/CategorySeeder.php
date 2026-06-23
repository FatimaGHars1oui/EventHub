<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Technologie',
                'description' => 'Conférences tech, hackathons et innovations numériques.',
                'color' => '#4361ee', // Indigo
                'icon' => 'fas fa-microchip',
            ],
            [
                'name' => 'Musique',
                'description' => 'Concerts, festivals et soirées musicales à Fès.',
                'color' => '#f72585', // Pink
                'icon' => 'fas fa-music',
            ],
            [
                'name' => 'Art & Culture',
                'description' => 'Expositions, galeries d\'art et patrimoine culturel.',
                'color' => '#ffb703', // Orange/Gold
                'icon' => 'fas fa-palette',
            ],
            [
                'name' => 'Sport & Fitness',
                'description' => 'Marathons, tournois et séances de bien-être.',
                'color' => '#4cc9f0', // Sky Blue
                'icon' => 'fas fa-running',
            ],
            [
                'name' => 'Gastronomie',
                'description' => 'Dégustations, cours de cuisine et festivals culinaires.',
                'color' => '#fb8500', // Deep Orange
                'icon' => 'fas fa-utensils',
            ],
            [
                'name' => 'Business',
                'description' => 'Networking, séminaires et opportunités professionnelles.',
                'color' => '#0f172a', // Dark Slate
                'icon' => 'fas fa-briefcase',
            ],
            [
                'name' => 'Éducation',
                'description' => 'Ateliers d\'apprentissage, cours et formations.',
                'color' => '#7209b7', // Purple
                'icon' => 'fas fa-graduation-cap',
            ],
            [
                'name' => 'Santé',
                'description' => 'Yoga, séminaires médicaux et bien-être mental.',
                'color' => '#2ec4b6', // Teal
                'icon' => 'fas fa-heartbeat',
            ]
        ];

        foreach ($categories as $cat) {
            // استخدام updateOrCreate يمنع خطأ التكرار (Duplicate Entry)
            Category::updateOrCreate(
                ['slug' => Str::slug($cat['name'])], // يبحث عن الصنف بواسطة الـ slug
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'color' => $cat['color'],
                    'icon' => $cat['icon'],
                    'is_active' => true,
                ]
            );
        }
    }
}