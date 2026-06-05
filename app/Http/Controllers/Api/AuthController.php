<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
class AuthController extends Controller
{
    
    public function register(Request $request) : JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required','string','max:255'],
            'email' => ['required','string','email','max:255','unique:users,email'],
            'password' => ['required','string','min:8','confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('api')->plainTextToken;
        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ], 201);
    }



    public function login(Request $request) : JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required','string','email'],
            'password' => ['required','string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['identifiants invalides'],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;
        return response()->json([
            'success' => true,
            'message' => 'connexion réussie',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ], 200);
    }



    public function logout(Request $request) : JsonResponse
    {
       $user = $request->user();
       if($user&& $user->currentAccessToken()){
        $user->currentAccessToken()->delete(); 
        }
        return response()->json([
            'success' => true,
            'message' => 'Déconnexion réussie',
        ], 200);
      
        
    }


    public function me(Request $request) : JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $request->user(),
        ], 200);
    }
}
