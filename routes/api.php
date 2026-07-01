<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\UserController;

use App\Http\Controllers\PaymentController;
use App\Models\Event;

/*
|--------------------------------------------------------------------------
| 1. المسارات العامة (Public Routes)
|--------------------------------------------------------------------------
*/
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/events', [EventController::class, 'index']);
Route::get('/events/{event}', [EventController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);

// الويب هوك الخاص بسترب يجب أن يكون عام (Public) ولا يحتاج توكن
Route::post('/stripe-webhook', [PaymentController::class, 'handleWebhook']);

/*
|--------------------------------------------------------------------------
| 2. المسارات المحمية (Protected Routes - Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

// إذا كنتي كتستعمل Route::apiResource، زيد هاد السطر فقط:
Route::delete('my-bookings/{id}', [BookingController::class, 'destroyMyBooking'])->middleware('auth:sanctum');

// إذا كنتي كتبغي route عادية، هادكا يكفي:
Route::delete('/my-bookings/{id}', [BookingController::class, 'destroyMyBooking'])->middleware('auth:sanctum');

// بيانات المستخدم الحالي
    Route::get('/user', [UserController::class, 'show']);

    // قائمة المستخدمين
    Route::get('/users', [UserController::class, 'index']);

    // حذف مستخدم
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // إحصائيات
    Route::get('/admin/stats', [UserController::class, 'stats']);


// حجوزات المستخدم
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);
    
    // تحديث الملف الشخصي
    Route::put('/user/update', [UserController::class, 'updateProfile']);
    
    // حذف الحساب
    Route::delete('/user/delete', [UserController::class, 'deleteAccount']);

    // تم إصلاح هذا السطر (إزالة التكرار غير الضروري)
    Route::post('/pay', [PaymentController::class, 'createCheckoutSession']);

    // مسارات الإشعارات
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);

    // الملف الشخصي والحالة
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // الإحصائيات العامة للمستخدم
    Route::get('/stats/overview', [StatsController::class, 'overview']);

    // نظام الحجوزات للمستخدمين
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/ticket/{booking_number}', [BookingController::class, 'getTicketData']);

    // نظام التقييمات
    Route::get('/events/{event_id}/reviews', [ReviewController::class, 'index'])->where('event_id', '[0-9]+');
    Route::post('/events/{event_id}/reviews', [ReviewController::class, 'store'])->where('event_id', '[0-9]+');

    /*
    |--------------------------------------------------------------------------
    | 3. مسارات المنظمين (Organizer & Admin)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin,organizer')->group(function () {
        
        // جلب فعاليات المنظم مع عد الحجوزات (تحسين الأداء بـ withCount)
        Route::get('/organizer/events', function() {
            return response()->json([
                'success' => true, 
                'data' => Event::where('organizer_id', Auth::id())
                            ->withCount('bookings')
                            ->get()
            ]);
        });

        // إدارة الفعاليات
        Route::post('/events', [EventController::class, 'store']);
        Route::put('/events/{event}', [EventController::class, 'update']);
        Route::delete('/events/{event}', [EventController::class, 'destroy']);
        
        // نظام التحقق من التذاكر (Check-in)
        Route::post('/bookings/check-in', [BookingController::class, 'checkIn']);
    });

    /*
    |--------------------------------------------------------------------------
    | 4. مسارات الإدارة (Admin Only)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin')->group(function () {
        // إحصائيات لوحة التحكم الشاملة
        Route::get('/admin/stats', [AdminController::class, 'getStats']);
        
        // إدارة المستخدمين
        Route::get('/admin/users', [AdminController::class, 'usersIndex']);
        Route::delete('/admin/users/{user}', [AdminController::class, 'deleteUser']);
        
        // إدارة الأصناف (إضافة وحذف)
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    });
});