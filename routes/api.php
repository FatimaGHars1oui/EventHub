<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\BookingController;
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
    
});