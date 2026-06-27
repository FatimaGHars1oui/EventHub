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
use App\Models\Event;

/*
|--------------------------------------------------------------------------
| 1. المسارات العامة (بدون توكن)
|--------------------------------------------------------------------------
*/
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/events', [EventController::class, 'index']);
Route::get('/events/{event}', [EventController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);

/*
|--------------------------------------------------------------------------
| 2. المسارات المحمية (تتطلب Authorization: Bearer {token})
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // الملف الشخصي
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // الإحصائيات (التي يطلبها الـ Dashboard)
    Route::get('/stats/overview', [StatsController::class, 'overview']);

    // الحجوزات
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/ticket/{booking_number}', [BookingController::class, 'getTicketData']);

    // التقييمات
    Route::post('/reviews', [ReviewController::class, 'store']);

    /*
    |--------------------------------------------------------------------------
    | 3. مسارات المنظمين (Organizer & Admin)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin,organizer')->group(function () {
        
        // جلب فعاليات المنظم
        Route::get('/organizer/events', function() {
            return response()->json([
                'success' => true, 
                'data' => Event::where('organizer_id', Auth::id())->withCount('bookings')->get()
            ]);
        });

        Route::post('/events', [EventController::class, 'store']);
        Route::put('/events/{event}', [EventController::class, 'update']);
        Route::delete('/events/{event}', [EventController::class, 'destroy']);
        Route::post('/bookings/check-in', [BookingController::class, 'checkIn']);
    });

    /*
    |--------------------------------------------------------------------------
    | 4. مسارات الإدارة (Admin Only)
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/stats', [AdminController::class, 'getStats']);
        Route::get('/admin/users', [AdminController::class, 'usersIndex']);
        Route::delete('/admin/users/{user}', [AdminController::class, 'deleteUser']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
    });
});