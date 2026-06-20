/**
 * EventHub Fès - Logiciel de gestion d'événements
 * Version: 4.0.0 (Final Stable Release)
 */

const API_URL = "http://127.0.0.1:8000/api";

// 1. إدارة الحالة (State Management)
const state = {
    get token() { return localStorage.getItem('user_token'); },
    get user() { 
        const data = localStorage.getItem('user_data');
        try { return data ? JSON.parse(data) : null; } catch(e) { return null; }
    },
    events: [],
    categories: []
};

// 2. مساعدات الـ API (API Helpers)
const api = {
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
            
            // التعامل مع الجلسة المنتهية
            if (response.status === 401) {
                if (state.token) {
                    localStorage.clear();
                    alert("Votre session a expiré. Veuillez vous reconnecter.");
                    window.location.reload();
                }
                return { success: false, message: "Non authentifié" };
            }

            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return { success: false, message: "Erreur de connexion au serveur." };
        }
    }
};

// 3. التحكم في الواجهة (UI Controller)
const ui = {
    renderEvents(eventsList) {
        const container = document.getElementById('events-container');
        if (!container) return;

        if (!eventsList || eventsList.length === 0) {
            container.innerHTML = '<div class="col-12 text-center py-5"><h5 class="text-muted">Aucun événement trouvé à Fès.</h5></div>';
            return;
        }

        container.innerHTML = eventsList.map(event => `
            <div class="col-md-4 mb-4" data-aos="fade-up">
                <div class="card h-100 event-card border-0 shadow-sm">
                    <div class="position-relative">
                        <img src="${event.image_url}" class="card-img-top" style="height:220px; object-fit:cover;">
                        ${event.price == 0 ? '<span class="badge bg-success position-absolute top-0 end-0 m-3 shadow">GRATUIT</span>' : ''}
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-primary rounded-pill px-3">${event.category?.name || 'Général'}</span>
                            <small class="text-muted"><i class="fas fa-map-marker-alt me-1"></i>${event.city}</small>
                        </div>
                        <h5 class="card-title fw-bold text-truncate">${event.title}</h5>
                        <p class="card-text text-muted small text-truncate-2">${event.description.substring(0, 100)}...</p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <div>
                                <span class="d-block fw-bold text-primary fs-5">${event.formatted_price}</span>
                                <small class="text-muted" style="font-size: 11px;">${event.available_spots || 0} places restantes</small>
                            </div>
                            <button onclick="bookingFlow.initiateBooking(${event.id})" class="btn btn-primary rounded-pill px-4 btn-sm fw-bold shadow-sm">
                                ${event.price == 0 ? 'Réserver' : 'Acheter'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderCategories(categories) {
        const nav = document.getElementById('categories-nav');
        if (!nav) return;
        const catsHtml = categories.map(cat => `
            <div class="category-pill shadow-sm" onclick="events.filterByCategory(${cat.id})">
                ${cat.name}
            </div>
        `).join('');
        nav.innerHTML = `<div class="category-pill active shadow-sm" onclick="events.fetchAll()">Tout</div>` + catsHtml;
    },

    updateAuthUI() {
        const authSection = document.getElementById('auth-section');
        const fab = document.getElementById('add-event-fab');
        if (!authSection) return;

        const user = state.user;

        if (state.token && user) {
            // حماية ضد الأخطاء: إذا لم يوجد دور نضع 'USER'
            const roleDisplay = (user.role || 'user').toUpperCase();
            
            if (user.role !== 'user') fab?.classList.remove('d-none');

            authSection.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-light dropdown-toggle rounded-pill shadow-sm border px-3" data-bs-toggle="dropdown">
                        <i class="fas fa-user-circle me-1 text-primary"></i> ${user.name}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                        <li><h6 class="dropdown-header text-dark">Rôle: ${roleDisplay}</h6></li>
                        <li><a class="dropdown-item" href="dashboard.html"><i class="fas fa-chart-line me-2 text-primary"></i>Tableau de Bord</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="auth.logout()">
                            <i class="fas fa-sign-out-alt me-2"></i>Déconnexion
                        </a></li>
                    </ul>
                </div>`;
        } else {
            fab?.classList.add('d-none');
            authSection.innerHTML = `
                <button class="btn btn-outline-light btn-sm me-2 rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion</button>
                <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm" data-bs-toggle="modal" data-bs-target="#registerModal">S'inscrire</button>`;
        }
    },

    showEventModal() { new bootstrap.Modal(document.getElementById('addEventModal')).show(); }
};

// 4. نظام الحجز والدفع والتذاكر (Booking Flow)
const bookingFlow = {
    selectedEvent: null,

    async initiateBooking(eventId) {
        if (!state.token) {
            new bootstrap.Modal(document.getElementById('loginModal')).show();
            return;
        }
        
        const res = await api.request(`/events/${eventId}`);
        if (res.success) {
            this.selectedEvent = res.data;
            const price = parseFloat(this.selectedEvent.price);

            if (price === 0 || this.selectedEvent.is_free) {
                if (confirm(`Confirmer votre réservation GRATUITE pour : ${this.selectedEvent.title} ?`)) {
                    this.executeBooking();
                }
            } else {
                document.getElementById('payment-event-info').innerHTML = `
                    <strong>${this.selectedEvent.title}</strong><br>
                    Total: <span class="text-primary">${this.selectedEvent.formatted_price}</span>
                `;
                new bootstrap.Modal(document.getElementById('paymentModal')).show();
            }
        }
    },

    async handlePayment(e) {
        e.preventDefault();
        const btn = document.getElementById('pay-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verification...';
        setTimeout(() => this.executeBooking(), 1500);
    },

    async executeBooking() {
        const data = {
            event_id: this.selectedEvent.id,
            quantity: 1,
            attendee_name: state.user.name,
            attendee_email: state.user.email
        };

        const res = await api.request('/bookings', 'POST', data);
        if (res.success) {
            const payModal = document.getElementById('paymentModal');
            const instance = bootstrap.Modal.getInstance(payModal);
            if(instance) instance.hide();
            this.showTicket(res.booking_number);
        } else {
            alert(res.message || "Erreur lors de la réservation.");
        }
    },

    async showTicket(bookingNumber) {
        const res = await api.request(`/bookings/ticket/${bookingNumber}`);
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
        const element = document.getElementById('ticket-to-print');
        const bookingNo = document.getElementById('ticket-number').innerText;
        const opt = {
            margin: 10,
            filename: `Ticket-${bookingNo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }
};

// 5. موديول المصادقة (Auth Logic)
const auth = {
    async login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const res = await api.request('/auth/login', 'POST', { email, password });
        if (res.success) {
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_data', JSON.stringify(res.data.user));
            window.location.reload();
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
        if (data.password !== data.password_confirmation) { alert("Mots de passe non identiques."); return; }

        const res = await api.request('/auth/register', 'POST', data);
        if (res.success) {
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_data', JSON.stringify(res.data.user));
            window.location.reload();
        } else alert("Erreur d'inscription.");
    },

    logout() {
        localStorage.clear();
        window.location.reload();
    }
};

// 6. موديول الأحداث (Events)
const events = {
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
    },
    async create(e) {
        e.preventDefault();
        const res = await api.request('/events', 'POST', new FormData(e.target), true);
        if (res.success) {
            alert("Publié !");
            window.location.reload();
        }
    }
};

// 7. التهيئة عند التحميل
document.addEventListener('DOMContentLoaded', async () => {
    ui.updateAuthUI();
    events.fetchAll();
    
    const catRes = await api.request('/categories');
    if (catRes.success) {
        ui.renderCategories(catRes.data);
        const select = document.getElementById('category-select');
        if (select) select.innerHTML = catRes.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    document.getElementById('login-form')?.addEventListener('submit', auth.login);
    document.getElementById('register-form')?.addEventListener('submit', auth.register);
    document.getElementById('payment-form')?.addEventListener('submit', (e) => bookingFlow.handlePayment(e));
    document.getElementById('event-form')?.addEventListener('submit', events.create);
    document.getElementById('search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        events.search(document.getElementById('search-input').value);
    });
});