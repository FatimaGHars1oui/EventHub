<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Technology',
                'slug' => 'technology',
                'description' => 'Explore the latest trends and innovations in technology with our curated selection of tech events.',
                'color' => '#007BFF',
                'icon' => 'fa-solid fa-microchip',
                'is_active' => true,
            ],
            [
                'name' => 'Music',
                'slug' => 'music',
                'description' => 'Discover a world of music events, from intimate concerts to large festivals, across various genres.',
                'color' => '#28A745',
                'icon' => 'fa-solid fa-music',
                'is_active' => true,
            ],
            [
                'name' => 'Art',
                'slug' => 'art',
                'description' => 'Immerse yourself in the vibrant art scene with exhibitions, galleries, and creative workshops.',
                'color' => '#DC3545',
                'icon' => 'fa-solid fa-palette',
                'is_active' => true,
            ],
            [
                'name' =>'Crafts',
                'slug' => 'crafts',
                'description' => 'Explore the world of crafts with workshops, fairs, and exhibitions showcasing handmade creations.',
                'color' => '#FFC107',
                'icon' => 'fa-solid fa-hand-sparkles',
                'is_active' => true,
            ],
            [
                'name' => 'Sports',
                'slug' => 'sports',
                'description' => 'Get active with our selection of sports events, from local matches to international tournaments.',
                'color' => '#17A2B8',
                'icon' => 'fa-solid fa-basketball',
                'is_active' => true,
            ],
             [
                'name' => 'Food & Drink',
                'slug' => 'food-drink',
                'description' => 'Savor the flavors of our food and drink events, featuring tastings, festivals, and culinary workshops.',
                'color' => '#E83E8C',
                'icon' => 'fa-solid fa-utensils',
                'is_active' => true,
            ],
             [
                'name' => 'Health & Wellness',
                'slug' => 'health-wellness',
                'description' => 'Prioritize your well-being with our health and wellness events, including fitness classes, retreats, and seminars.',
                'color' => '#20C997',
                'icon' => 'fa-solid fa-heart-pulse',
                'is_active' => true,
            ],
             [
                'name' => 'Education',
                'slug' => 'education',
                'description' => 'Expand your knowledge with our education events, featuring workshops, lectures, and conferences on various topics.',
                'color' => '#6F42C1',
                'icon' => 'fa-solid fa-graduation-cap',
                'is_active' => true,
            ],
             [
                'name' => 'Business & Networking',
                'slug' => 'business-networking',
                'description' => 'Connect with professionals and grow your network at our business and networking events, including conferences, meetups, and workshops.',
                'color' => '#343A40',
                'icon' => 'fa-solid fa-briefcase',
                'is_active' => true,
            ],
             [
                'name' => 'Film',
                'slug' => 'film-theater',
                'description' => 'Experience the magic of cinema and live performances with our film and theater events, including screenings, festivals, and plays.',
                'color' => '#FD7E14',
                'icon' => 'fa-solid fa-film',
                'is_active' => true,
            ],
        ];

        foreach ($categories as $category) {
            \App\Models\Category::create($category);
        }

    }
}
