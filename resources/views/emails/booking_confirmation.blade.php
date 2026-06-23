<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
    <h2 style="color: #4361ee;">Merci pour votre réservation !</h2>
    <p>Bonjour <strong>{{ $booking->attendee_name }}</strong>,</p>
    <p>Votre place pour l'événement <strong>{{ $booking->event->title }}</strong> هو الآن مؤكد.</p>
    <div style="background: #f8fafc; padding: 15px; border-radius: 10px;">
        <p><strong>Numéro de réservation :</strong> {{ $booking->booking_number }}</p>
        <p><strong>Date :</strong> {{ $booking->event->start_date }}</p>
        <p><strong>Lieu :</strong> {{ $booking->event->venue_address }}</p>
    </div>
    <p>Présentez votre QR Code (disponible sur votre tableau de bord) à l'entrée.</p>
    <footer style="margin-top: 20px; font-size: 12px; color: #888;">L'équipe EventHub Fès</footer>
</div>