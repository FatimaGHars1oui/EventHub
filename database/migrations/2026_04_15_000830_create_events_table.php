<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            //information de base
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description');
            $table->text('short_description')->nullable();
            $table->string('image')->nullable();
            $table->json('gallery')->nullable();
            //organisateur
            $table->foreignId('organizer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('category_id')->constrained()->onDelete('cascade');

            //date et heure
            $table->dateTime('start_date');
            $table->dateTime('end_date');
            $table->string('timezone')->default('Africa/Casablanca');
            //lieu
            $table->string('venue_name');
            $table->text('venue_address');
            $table->string('city');
            $table->string('country')->default('Morocco');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();

            //tarification
            $table->decimal('price', 8, 2)->default(0);
            $table->boolean('is_free')->default(false);
            $table->string('currency', 3)->default('MAD');

            //Capacité 
            $table->integer('max_attendees')->nullable();
            $table->integer('current_attendees')->default(0);

            //statut
            $table->enum('status', ['draft', 'pending','published','rejected', 'cancelled','completed'])->default('draft');
            $table->boolean('is_featured')->default(false);
            $table->boolean('requires_approval')->default(true);
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->datetime('reviewed_at')->nullable();

            //SEO et métadonnées
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->json('tags')->nullable();

            $table->timestamps();
            //index pour les recherches 
            $table->index(['status', 'start_date']);
            $table->index(['city', 'start_date']);
            $table->index(['category_id', 'start_date']);
        });
    }
    
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
