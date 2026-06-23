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
            
            // --- المعلومات الأساسية ---
            $table->string('title');
            $table->string('slug')->unique(); // للروابط الصديقة لمحركات البحث SEO
            $table->text('description');
            $table->string('short_description', 255)->nullable();
            $table->string('image')->nullable(); // مسار الصورة الرئيسية
            $table->json('gallery')->nullable(); // لتخزين عدة صور إضافية (اختياري)
            
            // --- العلاقات ---
            // منظم الفعالية (يرتبط بجدول المستخدمين)
            $table->foreignId('organizer_id')->constrained('users')->onDelete('cascade');
            // صنف الفعالية (يرتبط بجدول الأصناف)
            $table->foreignId('category_id')->constrained('categories')->onDelete('cascade');

            // --- الزمان والمكان ---
            $table->dateTime('start_date');
            $table->dateTime('end_date')->nullable();
            $table->string('timezone')->default('Africa/Casablanca');
            $table->string('venue_name'); // اسم المكان (مثلاً: قصر المؤتمرات)
            $table->text('venue_address'); // العنوان الكامل
            $table->string('city'); // المدينة (لسهولة الفلترة)
            
            // إحداثيات الخريطة (Leaflet/Google Maps)
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();

            // --- المالية والطاقة الاستيعابية ---
            $table->decimal('price', 10, 2)->default(0.00);
            $table->boolean('is_free')->default(false);
            $table->string('currency', 3)->default('MAD');
            $table->integer('max_attendees'); // أقصى عدد للحضور
            $table->integer('current_attendees')->default(0); // العداد الحالي للمحجوزات

            // --- حالة الفعالية ونظام الموافقة ---
            // pending: في انتظار مراجعة الآدمن
            // published: معروضة للعموم
            // rejected: مرفوضة من قبل الإدارة
            // canceled: ملغاة من المنظم
            $table->enum('status', ['pending', 'published', 'rejected', 'canceled', 'completed'])
                  ->default('pending');
            
            $table->boolean('is_featured')->default(false); // هل تظهر في السلايدر الرئيسي؟
            $table->text('rejection_reason')->nullable(); // سبب الرفض في حال رفضها الآدمن
            
            // تتبع المراجعة
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();

            // --- الفهارس (Indexes) لتسريع البحث في قاعدة البيانات ---
            $table->index(['status', 'start_date']);
            $table->index('city');
            $table->index('slug');
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