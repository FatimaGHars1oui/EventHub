# EventHub - Plateforme de Gestion d'Événements

## Présentation

EventHub est une application web développée avec Laravel 10 et JavaScript Vanilla permettant la gestion et la réservation d'événements.

## Fonctionnalités

- Authentification utilisateur (Sanctum)
- CRUD événements
- Gestion des catégories
- Système de réservation
- Gestion des rôles (Admin / Organisateur / Utilisateur)
- Recherche et filtres
- Dashboard par rôle

## Technologies

**Backend :**
- Laravel 10
- MySQL
- API REST
- Sanctum

**Frontend :**
- JavaScript ES6+
- Bootstrap 5
- AOS Animation

## Installation

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
