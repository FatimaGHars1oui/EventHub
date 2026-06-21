<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ReviewController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| 1. المسارات العامة (Public Routes)
| لا تحتاج إلى تسجيل دخول - متاحة للزوار
|--------------------------------------------------------------------------
*/

// عرض الفعاليات (البحث، الفلترة، الترقيم)
Route::get('/events', [EventController::class, 'index']);

// عرض تفاصيل فعالية واحدة (بما في ذلك التقييمات والخرائط)
Route::get('/events/{event}', [EventController::class, 'show']);

// عرض قائمة الأصناف (لفلترة البحث)
Route::get('/categories', [CategoryController::class, 'index']);

// نظام المصادقة الأساسي
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);


/*
|--------------------------------------------------------------------------
| 2. المسارات المحمية (Protected Routes)
| تحتاج إلى Token صالح (Authorization: Bearer {token})
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    
    // --- الملف الشخصي ---
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // --- نظام الحجز والتذاكر ---
    Route::post('/bookings', [BookingController::class, 'store']); // حجز جديد
    Route::get('/my-bookings', [BookingController::class, 'myBookings']); // قائمة حجوزاتي
    Route::get('/bookings/ticket/{booking_number}', [BookingController::class, 'getTicketData']); // بيانات التذكرة والـ QR

    // --- نظام التقييم والمراجعات ---
    Route::post('/reviews', [ReviewController::class, 'store']); // إضافة تقييم بالنجوم

    // --- نظام التحقق Scanner (للمنظم والآدمن فقط) ---
    Route::post('/bookings/check-in', [BookingController::class, 'checkIn']);

    // --- إدارة الفعاليات (للمنظم والآدمن) ---
    Route::post('/events', [EventController::class, 'store']); // إنشاء فعالية جديدة
    Route::put('/events/{event}', [EventController::class, 'update']); // تحديث
    Route::delete('/events/{event}', [EventController::class, 'destroy']); // حذف

    // --- إحصائيات لوحة التحكم (Dashboard Stats) ---
    Route::get('/admin/stats', [AdminController::class, 'getStats']);
});