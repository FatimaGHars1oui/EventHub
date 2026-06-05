<?php

namespace Database\Seeders;

use App\Models\User;
use DeepCopy\f001\B;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

       $this->call([
        UserSeeder::class,
        CategorySeeder::class,
        EventSeeder::class,
        BookingSeeder::class,
        ]);
    }
}
