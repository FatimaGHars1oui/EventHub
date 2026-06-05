/**
 * EventHub Fès - Logiciel de gestion d'événements
 */

const API_URL = "http://127.0.0.1:8000/api";

// 1. إدارة الحالة (State Management)
const state = {
    token: localStorage.getItem('user_token'),
    user: JSON.parse(localStorage.getItem('user_data')),
    currentCategory: null
};

// 2. إعدادات الـ Headers
const getHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`; // [cite: 8]
    return headers;
};

// 3. جلب الأحداث (Events)
async function fetchEvents(filters = {}) {
    const container = document.getElementById('events-container');
    container.innerHTML = '<div class="text-center w-100"><div class="spinner-border text-primary"></div></div>';

    try {
        const params = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_URL}/events?${params}`); // [cite: 12]
        const result = await response.json();

        if (result.success) {
            renderEvents(result.data); // [cite: 12]
        }
    } catch (error) {
        container.innerHTML = '<div class="alert alert-danger w-100">Erreur de connexion au serveur.</div>';
    }
}

// 4. جلب الأصناف (Categories)
async function fetchCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`); // 
        const result = await response.json();
        if (result.success) renderCategories(result.data);
    } catch (error) { console.error("Categories error:", error); }
}

// 5. عرض الأحداث في الـ DOM
function renderEvents(events) {
    const container = document.getElementById('events-container');
    if (events.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5"><h5>Aucun événement trouvé à Fès.</h5></div>';
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="col-md-4 mb-4">
            <div class="card h-100 event-card shadow-sm">
                <img src="${event.image_url}" class="card-img-top" alt="${event.title}" style="height:200px; object-fit:cover;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge" style="background-color: ${event.category.color}">${event.category.name}</span>
                        <small class="text-muted"><i class="fas fa-map-marker-alt"></i> ${event.city}</small>
                    </div>
                    <h5 class="card-title text-truncate">${event.title}</h5>
                    <p class="card-text text-muted small">${event.short_description || 'Pas de description.'}</p>
                    <hr>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary">${event.formatted_price}</span>
                        <button onclick="bookingAction(${event.id})" class="btn btn-sm btn-primary px-3">Réserver</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategories(categories) {
    const nav = document.getElementById('categories-nav');
    nav.innerHTML += categories.map(cat => `
        <span class="badge bg-white text-dark border p-2 px-3 category-pill" 
              onclick="fetchEvents({category_id: ${cat.id}})">
              <i class="${cat.icon} me-1"></i> ${cat.name}
        </span>
    `).join('');
}

// 6. نظام الـ Auth (Login/UI)
function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    if (state.token && state.user) {
        authSection.innerHTML = `
            <span class="nav-link text-white me-3">Bonjour, ${state.user.name} (${state.user.role})</span>
            <button onclick="handleLogout()" class="btn btn-outline-danger btn-sm">Déconnexion</button>
        `;
    } else {
        authSection.innerHTML = `
            <button class="btn btn-outline-light btn-sm" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion</button>
            <button class="btn btn-primary btn-sm ms-2">Inscription</button>
        `;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, { // [cite: 8]
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();

        if (result.success) {
            localStorage.setItem('user_token', result.data.token);
            localStorage.setItem('user_data', JSON.stringify(result.data.user));
            location.reload();
        } else {
            alert("Identifiants incorrects");
        }
    } catch (error) { alert("Erreur serveur"); }
}

function handleLogout() {
    localStorage.clear();
    location.reload();
}

// 7. تشغيل عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    fetchEvents();
    fetchCategories();
    updateAuthUI();

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value;
        fetchEvents({ search: query }); // [cite: 12]
    });
});

function bookingAction(eventId) {
    if (!state.token) {
        new bootstrap.Modal(document.getElementById('loginModal')).show();
    } else {
        alert("Redirection vers la page de réservation pour l'événement #" + eventId);
    }
    // دالة لملء قائمة الأصناف في الفورم
async function populateCategorySelect() {
    const select = document.getElementById('category-select');
    if (!select) return;
    
    const response = await fetch(`${API_URL}/categories`);
    const result = await response.json();
    if (result.success) {
        select.innerHTML = result.data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    }
}

// دالة إرسال الحدث الجديد
async function handleEventSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target); // كنستعملو FormData حيت كاين رفع صورة

    try {
        const response = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`, //
                'Accept': 'application/json'
            },
            body: formData // ما كنديروش JSON.stringify حيت FormData كيتكلف بكلشي
        });

        const result = await response.json();
        if (result.success) {
            alert("Succès ! Votre événement est en attente de validation.");
            location.reload();
        } else {
            alert("Erreur: " + JSON.stringify(result.errors));
        }
    } catch (error) {
        console.error("Submit error:", error);
    }
}

// تحديث الـ Navbar لإظهار زر "Ajouter" للمنظمين
function updateAuthUI() {
    const authSection = document.getElementById('auth-section');
    if (state.token && state.user) {
        let actionBtn = '';
        if (state.user.role === 'organizer' || state.user.role === 'admin') { //
            actionBtn = `<button class="btn btn-warning btn-sm me-2" data-bs-toggle="modal" data-bs-target="#addEventModal">Créer Event</button>`;
        }
        
        authSection.innerHTML = `
            ${actionBtn}
            <span class="text-white me-3 d-none d-md-inline">👤 ${state.user.name}</span>
            <button onclick="handleLogout()" class="btn btn-outline-danger btn-sm">Déconnexion</button>
        `;
    } else {
        authSection.innerHTML = `<button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion / Inscription</button>`;
    }
}

// إضافة المستمعين للأحداث (Event Listeners)
document.addEventListener('DOMContentLoaded', () => {
    // ... الكود القديم
    populateCategorySelect();
    const eventForm = document.getElementById('event-form');
    if (eventForm) eventForm.addEventListener('submit', handleEventSubmit);
});
async function handleBooking(eventId) {
    if (!state.token) {
        alert("Veuillez vous connecter pour réserver.");
        new bootstrap.Modal(document.getElementById('loginModal')).show();
        return;
    }

    const qty = prompt("Combien de places ?", "1");
    if (!qty || isNaN(qty)) return;

    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: getHeaders(), //
            body: JSON.stringify({
                event_id: eventId,
                quantity: parseInt(qty),
                attendee_name: state.user.name,
                attendee_email: state.user.email
            })
        });

        const result = await response.json();
        if (result.success) {
            alert(`Succès ! Votre numéro de réservation est : ${result.booking_number}`);
            location.reload();
        } else {
            alert(result.message || "Erreur lors de la réservation");
        }
    } catch (error) {
        console.error("Booking error:", error);
    }
}
}
