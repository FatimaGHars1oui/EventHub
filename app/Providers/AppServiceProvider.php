<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Resources\Json\JsonResource;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // حل مشكل طول المفاتيح في MySQL القديمة
        Schema::defaultStringLength(191);

        // إزالة الـ 'data' wrapper من الـ API Resources إذا استعملتيهم مستقبلاً
        JsonResource::withoutWrapping();
    }
}
