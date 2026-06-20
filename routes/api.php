<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\AdminController;
use Illuminate\Support\Facades\Route;

Route::get('test', function () {
    return response()->json(['message' => 'Notre API marche bien ']);
});

// Route publique pour récupérer les événements
Route::get('/events', [EventController::class, 'index']);

Route::get('/events/{event}', [EventController::class, 'show']);


Route::get('/categories', [CategoryController::class, 'index']);

Route::get('/categories/popular', [CategoryController::class, 'popular']);



// Auth
Route::post('/auth/register',[AuthController::class,'register']);
Route::post('/auth/login',[AuthController::class,'login']);

// Routes protégées (auth:sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/events', [EventController::class, 'store']);
    Route::get('/bookings/search', [BookingController::class, 'search']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);

    // مثال: حماية مسار إضافة الفعاليات ليكون للمنظمين والآدمين فقط
Route::middleware(['auth:sanctum', 'role:admin,organizer'])->group(function () {
    Route::post('/events', [EventController::class, 'store']);
});
// داخل الـ group الخاص بـ auth:sanctum
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/stats', [AdminController::class, 'getStats']);
});
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    // Use fully-qualified class name to avoid undefined-type issues in static analyzers
    Route::get('/admin/stats', [\App\Http\Controllers\Api\AdminController::class, 'getStats']);
    Route::post('/categories', [CategoryController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'role:organizer,admin'])->group(function () {
    Route::get('/organizer/events', [EventController::class, 'myEvents']);
});
Route::get('/bookings/ticket/{booking_number}', [BookingController::class, 'getTicketData']);

Route::middleware('auth:sanctum')->group(function () {
    // للحصول على حجوزات المستخدم الحالي
    Route::get('/my-bookings', [BookingController::class, 'myBookings']);
    
    // إحصائيات الآدمن (فقط للآدمن)
    Route::middleware('role:admin')->get('/admin/stats', [AdminController::class, 'getStats']);
});
    
});