<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

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
                'password' => bcrypt('password'),
                'role' => 'admin',
            ],
            [
                'name' => 'Technology Organizer',
                'email' => 'technology@example.com',
                'password' => bcrypt('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Music',
                'email' => 'music@example.com',
                'password' => bcrypt('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Art Organizer',
                'email' => 'art@example.com',
                'password' => bcrypt('password'),
                'role' => 'organizer',
            ],
            [
                'name' => 'Regular User',
                'email' => 'regular@example.com',
                'password' => bcrypt('password'),
                'role' => 'user',
            ],
['name' => 'Crafts Organizer', 'email' => 'crafts@example.com', 'role' => 'organizer'],
['name' => 'Film Organizer',   'email' => 'film@example.com',   'role' => 'organizer']

        ];

        foreach ($users as $user) {
            \App\Models\User::create($user);
        }

    }
}
