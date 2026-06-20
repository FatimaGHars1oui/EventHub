<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@example.com',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ],
            [
                'name' => 'Technology Organizer',
                'email' => 'technology@example.com',
                'password' => Hash::make('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Music Organizer',
                'email' => 'music@example.com',
                'password' => Hash::make('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Art Organizer',
                'email' => 'art@example.com',
                'password' => Hash::make('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Regular User',
                'email' => 'regular@example.com',
                'password' => Hash::make('password'),
                'role' => 'user',
            ],
            [
                'name' => 'Crafts Organizer', 
                'email' => 'crafts@example.com', 
                'password' => Hash::make('password'), // أضفنا كلمة المرور هنا
                'role' => 'organizer'
            ],
            [
                'name' => 'Film Organizer',   
                'email' => 'film@example.com',   
                'password' => Hash::make('password'), // أضفنا كلمة المرور هنا
                'role' => 'organizer'
            ]
        ];

        foreach ($users as $user) {
            User::create($user);
        }
    }
}
