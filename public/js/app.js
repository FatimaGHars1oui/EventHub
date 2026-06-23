/**
 * EventHub Fès - Système de Gestion d'Événements
 * Version: 2.0.0 - Premium Edition
 */

// ============ Configuration de l'API ============
const API_URL = "http://localhost:8000/api";

// ============ État Global ============
const state = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    currentEventId: null,
    events: [],
    categories: []
};

// ============ Assistant API ============
const api = {
    headers() {
        const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        if (state.token) h['Authorization'] = `Bearer ${state.token}`;
        return h;
    },

    async request(endpoint, method = 'GET', data = null) {
        const options = { method, headers: this.headers() };
        if (data) options.body = JSON.stringify(data);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (response.status === 401) {
                localStorage.clear();
                location.reload();
            }
            return await response.json();
        } catch (error) {
            console.error("Erreur API:", error);
            return { success: false, message: "Erreur de connexion au serveur" };
        }
    }
};

// ============ Authentification ============
const auth = {
    async login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            Swal.fire('Attention', 'Veuillez remplir tous les champs', 'warning');
            return;
        }

        const res = await api.request('/auth/login', 'POST', { email, password });

        if (res.success) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            state.token = res.data.token;
            state.user = res.data.user;
            
            ui.updateAuthUI();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            document.getElementById('login-form').reset();
            
            Swal.fire('Succès', 'Connexion réussie', 'success');
        } else {
            Swal.fire('Erreur', res.message || 'Identifiants incorrects', 'error');
        }
    },

    async register() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!name || !email || !password || password.length < 8) {
            Swal.fire('Attention', 'Veuillez vérifier les données (le mot de passe doit contenir au moins 8 caractères)', 'warning');
            return;
        }

        const res = await api.request('/auth/register', 'POST', { 
            name, email, password, password_confirmation: password 
        });

        if (res.success) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            state.token = res.data.token;
            state.user = res.data.user;
            
            ui.updateAuthUI();
            bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
            document.getElementById('register-form').reset();
            
            Swal.fire('Bienvenue', 'Votre compte a été créé avec succès', 'success');
        } else {
            Swal.fire('Erreur', res.message || 'Échec de la création du compte', 'error');
        }
    },

    logout() {
        localStorage.clear();
        state.token = null;
        state.user = null;
        ui.updateAuthUI();
        Swal.fire('Déconnexion', 'Vous avez été déconnecté avec succès', 'success').then(() => {
            location.reload();
        });
    }
};

// ============ Gestion des Événements ============
const events = {
    async getAll() {
        const res = await api.request('/events');
        if (res.success) {
            state.events = res.data;
            ui.renderEvents(state.events);
        }
    },

    async getByCategory(categoryId) {
        const endpoint = categoryId === 'all' ? '/events' : `/events?category_id=${categoryId}`;
        const res = await api.request(endpoint);
        if (res.success) {
            ui.renderEvents(res.data);
        }
    },

    async search(query, date) {
        let url = `/events?search=${query}`;
        if (date) url += `&date=${date}`;
        
        const res = await api.request(url);
        if (res.success) {
            ui.renderEvents(res.data);
        }
    },

    async getById(id) {
        const res = await api.request(`/events/${id}`);
        return res.success ? res.data : null;
    }
};

// ============ Système de Réservation ============
const booking = {
    async book(eventId) {
        if (!state.token) {
            Swal.fire('Attention', 'Veuillez d\'abord vous connecter', 'warning');
            new bootstrap.Modal(document.getElementById('loginModal')).show();
            return;
        }

        const res = await api.request('/bookings', 'POST', {
            event_id: eventId,
            quantity: 1,
            attendee_name: state.user.name,
            attendee_email: state.user.email
        });

        if (res.success) {
            Swal.fire('Succès', 'Billet réservé avec succès', 'success');
            this.showTicket(res.booking);
        } else {
            Swal.fire('Erreur', res.message || 'Échec de la réservation', 'error');
        }
    },

    showTicket(bookingData) {
        const qrCode = bookingData.qr_code ? `<div>${bookingData.qr_code}</div>` : '';
        
        Swal.fire({
            title: 'Votre billet est prêt !',
            html: `
                <div class="p-4 text-center">
                    <h5 class="mb-3">${bookingData.event.title}</h5>
                    ${qrCode}
                    <p class="mt-3"><strong>N° Réservation:</strong> ${bookingData.booking_number}</p>
                    <p><strong>Nom:</strong> ${bookingData.attendee_name}</p>
                    <p><strong>Date:</strong> ${new Date(bookingData.event.start_date).toLocaleDateString('fr-FR')}</p>
                </div>
            `,
            confirmButtonText: 'Télécharger PDF',
            cancelButtonText: 'Fermer'
        }).then((result) => {
            if (result.isConfirmed) {
                this.downloadPDF(bookingData);
            }
        });
    },

    downloadPDF(bookingData) {
        const htmlContent = `
            <div style="text-align: center; padding: 20px; border: 2px dashed #ccc; border-radius: 10px;">
                <h2>EventHub Fès</h2>
                <h3>${bookingData.event.title}</h3>
                <p><strong>N° Réservation:</strong> ${bookingData.booking_number}</p>
                <p><strong>Nom:</strong> ${bookingData.attendee_name}</p>
                <p><strong>Email:</strong> ${bookingData.attendee_email}</p>
                <p><strong>Date:</strong> ${new Date(bookingData.event.start_date).toLocaleDateString('fr-FR')}</p>
                <p><strong>Lieu:</strong> ${bookingData.event.venue_address}</p>
            </div>
        `;

        const opt = {
            margin: 10,
            filename: `ticket-${bookingData.booking_number}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(htmlContent).save();
    }
};

// ============ Gestion de l'Interface (UI) ============
const ui = {
    renderEvents(eventsList) {
        const container = document.getElementById('events-container');
        const loadingSpinner = document.getElementById('loading-spinner');

        if (!container) return;

        loadingSpinner.classList.remove('active');

        if (!eventsList || eventsList.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 20px; display: block;"></i>
                    <h4 class="text-muted">Aucun événement trouvé</h4>
                    <p class="text-muted">Essayez de rechercher avec d'autres mots-clés</p>
                </div>
            `;
            return;
        }

        container.innerHTML = eventsList.map(event => this.createEventCard(event)).join('');
        AOS.refresh();
    },

    createEventCard(event) {
        const date = new Date(event.start_date);
        const day = date.getDate();
        const month = date.toLocaleDateString('fr-FR', { month: 'short' });
        const formattedPrice = event.price === 0 ? 'Gratuit' : `${event.price} DH`;

        return `
            <div class="col-lg-4 col-md-6" data-aos="fade-up">
                <div class="event-card" onclick="showEventDetails(${event.id})">
                    <div class="card-img-wrapper">
                        <img src="${event.image_url || 'https://via.placeholder.com/400x300'}" alt="${event.title}">
                        <div class="date-badge">
                            <span class="day">${day}</span>
                            <span class="month">${month}</span>
                        </div>
                        <div class="category-badge">${event.category?.name || 'Événement'}</div>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">${event.title}</h5>
                        <p class="card-location">
                            <i class="fas fa-map-marker-alt"></i>
                            ${event.venue_address || 'Fès'}
                        </p>
                        <div class="card-footer">
                            <span class="price-badge">${formattedPrice}</span>
                            <span class="rating">
                                <i class="fas fa-star"></i> ${event.rating || '4.5'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    updateAuthUI() {
        const authButtons = document.getElementById('auth-buttons');
        if (!authButtons) return;

        if (state.token && state.user) {
            authButtons.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-user-circle me-2"></i>${state.user.name}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="dashboard.html"><i class="fas fa-tachometer-alt me-2"></i>Tableau de bord</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="auth.logout(); return false;">
                            <i class="fas fa-sign-out-alt me-2"></i>Déconnexion
                        </a></li>
                    </ul>
                </div>
            `;
        } else {
            authButtons.innerHTML = `
                <button class="btn btn-primary btn-sm me-2" data-bs-toggle="modal" data-bs-target="#loginModal">
                    <i class="fas fa-sign-in-alt me-2"></i>Connexion
                </button>
                <button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#registerModal">
                    <i class="fas fa-user-plus me-2"></i>Inscription
                </button>
            `;
        }
    },

    async loadCategories() {
        const res = await api.request('/categories');
        if (res.success) {
            state.categories = res.data;
            const nav = document.getElementById('categories-nav');
            if (nav) {
                nav.innerHTML = `<div class="category-pill active" onclick="filterByCategory('all', this)">Tout</div>` +
                    res.data.map(cat => `
                        <div class="category-pill" onclick="filterByCategory(${cat.id}, this)">
                            <i class="fas fa-${this.getCategoryIcon(cat.name)}"></i> ${cat.name}
                        </div>
                    `).join('');
            }
        }
    },

    getCategoryIcon(categoryName) {
        const icons = {
            'Art': 'palette',
            'Musique': 'music',
            'Sport': 'futbol',
            'Technologie': 'laptop',
            'Éducation': 'graduation-cap',
            'Autre': 'calendar'
        };
        return icons[categoryName] || 'calendar';
    }
};

// ============ Fonctions Globales ============
function filterByCategory(categoryId, element) {
    document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
    if (element) element.classList.add('active');
    
    if (categoryId === 'all') {
        events.getAll();
    } else {
        events.getByCategory(categoryId);
    }
}

async function showEventDetails(eventId) {
    const event = await events.getById(eventId);
    if (!event) {
        Swal.fire('Erreur', 'Impossible de charger l\'événement', 'error');
        return;
    }

    state.currentEventId = eventId;

    document.getElementById('detail-title').textContent = event.title;
    document.getElementById('detail-image').src = event.image_url || 'https://via.placeholder.com/400x300';
    document.getElementById('detail-description').textContent = event.description || '';
    document.getElementById('detail-venue').textContent = event.venue_address || 'Fès';
    document.getElementById('detail-date').textContent = new Date(event.start_date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('detail-price').textContent = event.price === 0 ? 'Gratuit' : `${event.price} DH`;

    document.getElementById('book-btn').onclick = () => booking.book(eventId);

    new bootstrap.Modal(document.getElementById('eventDetailsModal')).show();
}

function handleSearch(e) {
    e.preventDefault();
    const query = document.getElementById('search-input').value;
    const date = document.getElementById('date-input').value;
    events.search(query, date);
}

// ============ Écouteurs d'Événements des Formulaires ============
document.addEventListener('DOMContentLoaded', async () => {
    // Mettre à jour l'UI au chargement
    ui.updateAuthUI();
    await ui.loadCategories();
    await events.getAll();

    // Liaisons des formulaires
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        auth.login();
    });

    document.getElementById('register-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        auth.register();
    });

    document.getElementById('search-form')?.addEventListener('submit', handleSearch);
});