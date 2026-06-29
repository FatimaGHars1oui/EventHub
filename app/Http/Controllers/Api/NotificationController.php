<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    /**
     * جلب الإشعارات (غير المقروءة أولاً)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $notifications = $user->notifications()
            ->orderBy('read_at', 'asc') // غير المقروءة تأتي أولاً
            ->paginate(10);

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
            'data' => $notifications->items(),
        ]);
    }

    /**
     * تحديد إشعار كـ "مقروء"
     */
    public function markAsRead(Request $request, $id): JsonResponse
    {
        $notification = $request->user()->notifications()->find($id);
        
        if ($notification) {
            $notification->markAsRead();
        }

        return response()->json(['success' => true]);
    }
}