/**
 * EventHub Fès - PFE ULTIMATE
 * Correction: الأزرار والوظائف العالمية
 */

const API_URL = "http://127.0.0.1:8000/api";

// 1. إدارة الحالة (State)
window.state = {
    get token() { return localStorage.getItem('user_token'); },
    get user() { 
        const data = localStorage.getItem('user_data');
        try { return data ? JSON.parse(data) : null; } catch(e) { return null; }
    },
    leafletMap: null,
    currentEventId: null
};

// 2. مساعد الـ API
window.api = {
    headers(isFormData = false) {
        const h = { 'Accept': 'application/json' };
        if (!isFormData) h['Content-Type'] = 'application/json';
        if (state.token) h['Authorization'] = `Bearer ${state.token}`;
        return h;
    },
    async request(endpoint, method = 'GET', data = null, isFormData = false) {
        const options = { method, headers: this.headers(isFormData) };
        if (data) options.body = isFormData ? data : JSON.stringify(data);
        
        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (response.status === 401) {
                localStorage.clear();
                return { success: false, message: "Session expirée" };
            }
            return await response.json();
        } catch (error) {
            return { success: false, message: "Erreur serveur." };
        }
    }
};

// 3. نظام التقييمات
window.reviewManager = {
    selectedRating: 5,
    initStars() {
        const stars = document.querySelectorAll('.rating-stars i');
        stars.forEach(star => {
            star.onclick = (e) => {
                this.selectedRating = e.target.dataset.val;
                this.updateStarsUI(this.selectedRating);
            };
        });
    },
    updateStarsUI(val) {
        document.querySelectorAll('.rating-stars i').forEach(star => {
            star.className = star.dataset.val <= val ? 'fas fa-star text-warning' : 'far fa-star text-warning';
        });
    },
    renderReviews(reviews) {
        const list = document.getElementById('reviews-list');
        if (!list) return;
        if (!reviews || reviews.length === 0) {
            list.innerHTML = '<p class="small text-muted">Aucun avis.</p>';
            return;
        }
        list.innerHTML = reviews.map(r => `
            <div class="mb-2 p-2 bg-light rounded shadow-sm">
                <div class="d-flex justify-content-between">
                    <strong style="font-size:12px">${r.user?.name || 'Anonyme'}</strong>
                    <span class="text-warning" style="font-size:10px">${'★'.repeat(r.rating)}</span>
                </div>
                <p class="mb-0 small" style="font-size:11px">${r.comment || ''}</p>
            </div>
        `).join('');
    },
    async submit() {
        const comment = document.getElementById('review-comment').value;
        const res = await api.request('/reviews', 'POST', {
            event_id: state.currentEventId,
            rating: this.selectedRating,
            comment: comment
        });
        if (res.success) {
            Swal.fire('Merci !', 'Avis ajouté.', 'success');
            document.getElementById('review-comment').value = "";
            ui.showEventDetails(state.currentEventId);
        } else {
            Swal.fire('Info', res.message, 'info');
        }
    }
};

// 4. التحكم في الواجهة
window.ui = {
    renderEvents(list) {
        const container = document.getElementById('events-container');
        if (!container) return;
        container.innerHTML = list.map(e => `
            <div class="col-md-4 mb-4">
                <div class="card event-card h-100 shadow-sm border-0">
                    <img src="${e.image_url}" class="card-img-top" style="height:200px; object-fit:cover;">
                    <div class="card-body">
                        <span class="badge bg-primary rounded-pill mb-2">${e.category?.name || 'Culture'}</span>
                        <h6 class="fw-bold text-truncate">${e.title}</h6>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="fw-bold text-primary small">${e.formatted_price}</span>
                            <div>
                                <button onclick="ui.showEventDetails(${e.id})" class="btn btn-outline-primary btn-sm rounded-pill px-3">Détails</button>
                                <button onclick="bookingFlow.initiateBooking(${e.id})" class="btn btn-primary btn-sm rounded-pill px-3">Réserver</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async showEventDetails(eventId) {
        state.currentEventId = eventId;
        const res = await api.request(`/events/${eventId}`);
        if (res.success) {
            const event = res.data;
            document.getElementById('detail-title').innerText = event.title;
            document.getElementById('detail-image').src = event.image_url;
            document.getElementById('detail-description').innerText = event.description;
            document.getElementById('detail-venue').innerText = event.venue_address;
            document.getElementById('detail-price').innerText = event.formatted_price;

            reviewManager.renderReviews(event.reviews);

            document.getElementById('detail-reserve-btn').onclick = () => {
                bootstrap.Modal.getOrCreateInstance(document.getElementById('eventDetailsModal')).hide();
                bookingFlow.initiateBooking(event.id);
            };

            const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
            modal.show();

            setTimeout(() => this.initMap(event.latitude || 34.03, event.longitude || -5.00, event.title), 500);
        }
    },

    initMap(lat, lng, title) {
        if (state.leafletMap) state.leafletMap.remove();
        state.leafletMap = L.map('map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.leafletMap);
        L.marker([lat, lng]).addTo(state.leafletMap).bindPopup(title).openPopup();
        setTimeout(() => state.leafletMap.invalidateSize(), 200);
    },

    updateAuthUI() {
        const authSec = document.getElementById('auth-section');
        const fab = document.getElementById('add-event-fab');
        if (state.token && state.user) {
            if (state.user.role !== 'user') fab?.classList.remove('d-none');
            authSec.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-light dropdown-toggle rounded-pill btn-sm px-3" data-bs-toggle="dropdown">
                        Hi, ${state.user.name}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        <li><a class="dropdown-item" href="dashboard.html">Dashboard</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="auth.logout()">Déconnexion</a></li>
                    </ul>
                </div>`;
        } else {
            fab?.classList.add('d-none');
            authSec.innerHTML = `
                <button class="btn btn-outline-light btn-sm me-2 rounded-pill px-3" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion</button>
                <button class="btn btn-primary btn-sm rounded-pill px-3" data-bs-toggle="modal" data-bs-target="#registerModal">S'inscrire</button>`;
        }
    },

    showEventModal() { new bootstrap.Modal(document.getElementById('addEventModal')).show(); }
};

// 5. نظام الحجز
window.bookingFlow = {
    selectedEvent: null,
    async initiateBooking(id) {
        if (!state.token) { new bootstrap.Modal(document.getElementById('loginModal')).show(); return; }
        const res = await api.request(`/events/${id}`);
        if (res.success) {
            this.selectedEvent = res.data;
            if (parseFloat(this.selectedEvent.price) === 0) {
                if (confirm("Réserver cette place GRATUITE ?")) this.executeBooking();
            } else {
                document.getElementById('payment-event-info').innerText = this.selectedEvent.title;
                new bootstrap.Modal(document.getElementById('paymentModal')).show();
            }
        }
    },
    async executeBooking() {
        const res = await api.request('/bookings', 'POST', {
            event_id: this.selectedEvent.id,
            quantity: 1,
            attendee_name: state.user.name,
            attendee_email: state.user.email
        });
        if (res.success) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentModal')).hide();
            this.showTicket(res.booking_number);
        }
    },
    async showTicket(num) {
        const res = await api.request(`/bookings/ticket/${num}`);
        if (res.success) {
            const { booking, qr_code } = res.data;
            document.getElementById('ticket-event-title').innerText = booking.event.title;
            document.getElementById('ticket-qrcode').innerHTML = qr_code;
            document.getElementById('ticket-number').innerText = booking.booking_number;
            document.getElementById('ticket-user').innerText = booking.attendee_name;
            document.getElementById('ticket-date').innerText = new Date(booking.event.start_date).toLocaleDateString();
            new bootstrap.Modal(document.getElementById('ticketModal')).show();
        }
    },
    downloadPDF() {
        const el = document.getElementById('ticket-to-print');
        html2pdf().set({ margin: 10, filename: 'ticket.pdf', html2canvas: { scale: 2, useCORS: true, scrollY:0 } }).from(el).save();
    }
};

// 6. المصادقة والأحداث
window.auth = {
    async login(e) {
        e.preventDefault();
        const res = await api.request('/auth/login', 'POST', { 
            email: document.getElementById('login-email').value, 
            password: document.getElementById('login-password').value 
        });
        if (res.success) {
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_data', JSON.stringify(res.data.user));
            location.reload();
        } else alert("Identifiants incorrects.");
    },
    async register(e) {
        e.preventDefault();
        const data = {
            name: document.getElementById('register-name').value,
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value,
            password_confirmation: document.getElementById('register-password-confirm').value
        };
        const res = await api.request('/auth/register', 'POST', data);
        if (res.success) {
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_data', JSON.stringify(res.data.user));
            location.reload();
        }
    },
    logout() { localStorage.clear(); location.reload(); }
};

window.events = {
    async fetchAll() {
        const res = await api.request('/events');
        if (res.success) ui.renderEvents(res.data);
    },
    async filterByCategory(id) {
        const res = await api.request(`/events?category_id=${id}`);
        if (res.success) ui.renderEvents(res.data);
    },
    async search(query) {
        const res = await api.request(`/events?search=${query}`);
        if (res.success) ui.renderEvents(res.data);
    }
};

// 7. البداية
document.addEventListener('DOMContentLoaded', () => {
    ui.updateAuthUI();
    reviewManager.initStars();
    events.fetchAll();
    
    // تحميل التصنيفات
    api.request('/categories').then(res => {
        if (res.success) {
            const nav = document.getElementById('categories-nav');
            if(nav) nav.innerHTML = `<div class="category-pill active" onclick="events.fetchAll()">Tout</div>` + 
                res.data.map(c => `<div class="category-pill" onclick="events.filterByCategory(${c.id})">${c.name}</div>`).join('');
        }
    });

    document.getElementById('login-form')?.addEventListener('submit', auth.login);
    document.getElementById('register-form')?.addEventListener('submit', auth.register);
    document.getElementById('payment-form')?.addEventListener('submit', (e) => { e.preventDefault(); bookingFlow.executeBooking(); });
    document.getElementById('search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        events.search(document.getElementById('search-input').value);
    });
});