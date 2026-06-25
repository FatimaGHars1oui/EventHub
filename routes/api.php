<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\StatsController;

/*
|--------------------------------------------------------------------------
| API Routes - EventHub Project
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| 1. المسارات العامة (Public Routes)
| متاحة للزوار بدون تسجيل دخول - تمنع خطأ 401 في الصفحة الرئيسية
|--------------------------------------------------------------------------
*/
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// الفعاليات (البحث النصي + الفلترة بالتاريخ + الترقيم)
Route::get('/events', [EventController::class, 'index']);

// تفاصيل فعالية محددة (للمودال + الخريطة + التقييمات)
Route::get('/events/{event}', [EventController::class, 'show']);

// قائمة الأصناف (لعرض الأزرار في الواجهة)
Route::get('/categories', [CategoryController::class, 'index']);

// تسجيل حساب جديد ودخول
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);


/*
|--------------------------------------------------------------------------
| 2. المسارات المحمية (Protected Routes)
| تتطلب ترويسة (Authorization: Bearer {token})
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

Route::get('/stats/overview', [StatsController::class, 'overview']);

Route::get('/my-bookings', [BookingController::class, 'myBookings']);

Route::post('/bookings', [BookingController::class, 'store']);
    // --- الحساب الشخصي ---
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // --- نظام الحجز والتذاكر (للمستخدمين) ---
    Route::post('/bookings', [BookingController::class, 'store']);                 // حجز مكان (مجاني/مدفوع)
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);          // رؤية حجوزاتي
    Route::get('/bookings/ticket/{booking_number}', [BookingController::class, 'getTicketData']); // بيانات الـ QR والـ PDF

    // --- نظام التقييم (Reviews) ---
    Route::post('/reviews', [ReviewController::class, 'store']); // إضافة تقييم بالنجوم

    /*
    |--------------------------------------------------------------------------
    | 3. مسارات المنظمين والإدارة (Organizer & Admin)
    | تعتمد على Middleware الأدوار (Role Middleware)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin,organizer')->group(function () {

    
        
        // إدارة الفعاليات (نشر، تعديل، حذف)
        Route::post('/events', [EventController::class, 'store']);         // إضافة فعالية مع صورة
        Route::put('/events/{event}', [EventController::class, 'update']); // تعديل بيانات
        Route::delete('/events/{event}', [EventController::class, 'destroy']); // حذف

        // نظام التحقق Scanner (مسح QR Code عند الباب)
        Route::post('/bookings/check-in', [BookingController::class, 'checkIn']);
    });

    /*
    |--------------------------------------------------------------------------
    | 4. مسارات الإدارة العليا فقط (Admin Only)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin')->group(function () {
        
        // إحصائيات لوحة التحكم (Charts, Revenues, Active Users)
        Route::get('/admin/stats', [AdminController::class, 'getStats']);
        
        // إدارة المستخدمين (عرض وحذف)
        Route::get('/admin/users', [AdminController::class, 'usersIndex']);
        Route::delete('/admin/users/{user}', [AdminController::class, 'deleteUser']);
        
        // إدارة التصنيفات (CRUD)
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    });
    Route::get('/dashboard/overview', [AdminController::class, 'getStats']);
    // routes/api.php
Route::post('/auth/register', [AuthController::class, 'register']);

});