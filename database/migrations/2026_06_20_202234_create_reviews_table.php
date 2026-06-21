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
    Schema::create('reviews', function (Blueprint $table) {
        $table->id();
        
        // يربط التقييم بالمستخدم (من الذي كتب التقييم؟)
        $table->foreignId('user_id')->constrained()->onDelete('cascade');
        
        // يربط التقييم بالحدث (أي حدث نقوم بتقييمه؟)
        $table->foreignId('event_id')->constrained()->onDelete('cascade');
        
        // حقل الرقم (عدد النجوم من 1 إلى 5)
        $table->integer('rating')->default(5);
        
        // حقل النص (التعليق) - يمكن أن يكون فارغاً (nullable)
        $table->text('comment')->nullable();
        
        $table->timestamps(); // تاريخ الكتابة
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
