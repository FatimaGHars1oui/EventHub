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
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();

            // --- المعرفات الفريدة ---
            // رقم الحجز (مثال: BK-2024-X89Z) وهو الذي يتحول لـ QR Code
            $table->string('booking_number')->unique();

            // --- العلاقات ---
            // المستخدم الذي قام بالحجز
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            // الفعالية المحجوزة
            $table->foreignId('event_id')->constrained()->onDelete('cascade');

            // --- تفاصيل الحجز ---
            $table->integer('quantity')->default(1); // عدد التذاكر
            $table->decimal('unit_price', 10, 2); // سعر التذكرة الواحدة وقت الحجز
            $table->decimal('total_amount', 10, 2); // المبلغ الإجمالي (سعر الوحدة × الكمية)
            $table->string('currency', 3)->default('MAD');

            // --- معلومات الحاضر (Attendee Info) ---
            // قد يحجز شخص لآخر، لذا نخزن بيانات الحاضر المستفيد من التذكرة
            $table->string('attendee_name');
            $table->string('attendee_email');
            $table->string('attendee_phone')->nullable();
            $table->text('special_requirements')->nullable(); // متطلبات خاصة (اختياري)

            // --- حالات الحجز (Workflow Status) ---
            // pending: في انتظار الدفع أو الموافقة
            // confirmed: حجز مؤكد (تذكرة صالحة)
            // canceled: حجز ملغى
            // attended: المستخدم حضر الفعالية وتم مسح تذكرته عند الباب (Check-in)
            $table->enum('status', ['pending', 'confirmed', 'canceled', 'attended'])
                  ->default('pending');

            // --- حالات الدفع (Payment Status) ---
            $table->enum('payment_status', ['pending', 'paid', 'failed', 'refunded'])
                  ->default('pending');
            
            $table->string('payment_method')->nullable(); // (Card, PayPal, Cash)
            $table->string('payment_reference')->nullable(); // رقم المعاملة البنكية

            // --- التوقيتات الهامة ---
            $table->timestamp('confirmed_at')->nullable(); // متى تم تأكيد الحجز
            $table->timestamp('canceled_at')->nullable();  // متى تم الإلغاء
            $table->timestamps(); // (created_at = تاريخ الطلب)

            // --- الفهارس لسرعة البحث والإحصائيات ---
            $table->index('booking_number');
            $table->index(['user_id', 'status']);
            $table->index(['event_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};