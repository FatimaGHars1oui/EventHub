/**
 * EventHub Fès - Logiciel de gestion d'événements
 * Version: 13.0.0 (Ultimate PFE Edition - Verified & Corrected)
 */

const API_URL = "http://127.0.0.1:8000/api";

// 1. إدارة الحالة العامة (State)
window.state = {
    get token() { return localStorage.getItem('user_token'); },
    get user() { 
        const data = localStorage.getItem('user_data');
        try { return data ? JSON.parse(data) : null; } catch(e) { return null; }
    },
    leafletMap: null,
    currentEventId: null
};

// 2. مساعد الـ API الأساسي
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
            if (response.status === 401 && state.token) {
                localStorage.clear();
                window.location.reload();
                return { success: false };
            }
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return { success: false, message: "Erreur de connexion au serveur." };
        }
    }
};

// 3. نظام التقييم والمراجعات (Stars & Reviews)
window.reviewManager = {
    selectedRating: 5,
    initStars() {
        const stars = document.querySelectorAll('.rating-stars i');
        stars.forEach(star => {
            star.style.cursor = 'pointer';
            star.onclick = (e) => {
                this.selectedRating = e.target.dataset.val;
                this.updateStarsUI(this.selectedRating);
            };
            star.onmouseover = (e) => this.updateStarsUI(e.target.dataset.val);
            star.onmouseout = () => this.updateStarsUI(this.selectedRating);
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
            list.innerHTML = '<p class="small text-muted fst-italic">Aucun avis pour le moment.</p>';
            return;
        }
        list.innerHTML = reviews.map(r => `
            <div class="mb-3 p-2 bg-light rounded-3 shadow-sm border-0">
                <div class="d-flex justify-content-between align-items-center">
                    <strong style="font-size:12px">${r.user?.name || 'Anonyme'}</strong>
                    <span class="text-warning" style="font-size:10px">${'★'.repeat(r.rating)}</span>
                </div>
                <p class="mb-0 text-muted" style="font-size:11px">${r.comment || ''}</p>
            </div>`).join('');
    },
    async submit() {
        if (!state.token) { bootstrap.Modal.getOrCreateInstance('#loginModal').show(); return; }
        const comment = document.getElementById('review-comment').value;
        const res = await api.request('/reviews', 'POST', {
            event_id: state.currentEventId, rating: this.selectedRating, comment: comment
        });
        if (res.success) {
            Swal.fire('Succès', 'Merci pour votre avis !', 'success');
            document.getElementById('review-comment').value = "";
            ui.showEventDetails(state.currentEventId);
        }
    }
};

// 4. نظام بوت الدردشة الصوتي (AI Chatbot)
window.botManager = {
    toggle() { document.getElementById('chat-window').style.display = (document.getElementById('chat-window').style.display === 'flex') ? 'none' : 'flex'; },
    speak(text) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = text.match(/[أ-ي]/) ? 'ar-SA' : 'fr-FR';
        window.speechSynthesis.speak(msg);
    },
    startListening() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Microphone non supporté.");
        const recog = new SpeechRecognition();
        recog.onstart = () => document.getElementById('mic-icon').style.color = 'red';
        recog.onresult = (e) => {
            document.getElementById('chat-input').value = e.results[0][0].transcript;
            this.sendMessage();
        };
        recog.onend = () => document.getElementById('mic-icon').style.color = 'inherit';
        recog.start();
    },
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim().toLowerCase();
        if (!text) return;
        this.append('user', input.value); input.value = "";
        
        setTimeout(async () => {
            let reply = "Désolé, je ne comprends pas. / عذراً، لم أفهمك.";
            if (text.includes('salut') || text.includes('bonjour') || text.includes('سلام')) reply = "Bonjour ! Je suis EventBot. Je peux vous aider à explorer Fès. 🕌";
            else if (text.includes('événement') || text.includes('حدث')) {
                const res = await api.request('/events');
                reply = res.success ? `Il y a ${res.data.length} événements prévus à Fès. Regardez la liste !` : reply;
            } else if (text.includes('gratuit')) reply = "Oui, il y a des événements gratuits ! Cherchez le badge 'GRATUIT'.";
            this.append('bot', reply); this.speak(reply);
        }, 600);
    },
    append(side, text) {
        const container = document.getElementById('chat-messages');
        container.innerHTML += `<div class="mb-2 ${side==='user'?'text-end':''}"><small class="p-2 rounded d-inline-block ${side==='user'?'bg-primary text-white':'bg-white shadow-sm border-start border-primary border-3'}">${text}</small></div>`;
        container.scrollTop = container.scrollHeight;
    }
};

// 5. التحكم في الواجهة (UI Controller)
window.ui = {
    renderEvents(list) {
        const container = document.getElementById('events-container');
        if (!container) return;
        container.innerHTML = list.map(e => {
            const date = new Date(e.start_date);
            return `
            <div class="col-md-4 mb-4" data-aos="fade-up">
                <div class="card event-card border-0 shadow-sm">
                    <div class="card-img-container position-relative">
                        <div class="date-badge">
                            <span class="day">${date.getDate()}</span>
                            <span class="month">${date.toLocaleString('fr-FR', { month: 'short' })}</span>
                        </div>
                        <img src="${e.image_url}" class="card-img-top">
                        ${e.price == 0 ? '<span class="badge bg-success position-absolute top-0 end-0 m-3 shadow">GRATUIT</span>' : ''}
                    </div>
                    <div class="card-body">
                        <span class="badge bg-primary rounded-pill mb-2" style="font-size:10px">${e.category?.name || 'Fès'}</span>
                        <h6 class="fw-bold text-truncate">${e.title}</h6>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="fw-bold text-primary small">${e.formatted_price}</span>
                            <div class="btn-group">
                                <button onclick="ui.showEventDetails(${e.id})" class="btn btn-outline-primary btn-sm rounded-pill px-3 me-1">Détails</button>
                                <button onclick="bookingFlow.initiateBooking(${e.id})" class="btn btn-primary btn-sm rounded-pill px-3">Réserver</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    async showEventDetails(eventId) {
        state.currentEventId = eventId;
        const res = await api.request(`/events/${eventId}`);
        if (res.success) {
            const e = res.data;
            document.getElementById('detail-title').innerText = e.title;
            document.getElementById('detail-image').src = e.image_url;
            document.getElementById('detail-description').innerText = e.description;
            document.getElementById('detail-venue').innerText = e.venue_address;
            document.getElementById('detail-price').innerText = e.formatted_price;
            reviewManager.renderReviews(e.reviews);

            document.getElementById('detail-reserve-btn').onclick = () => {
                bootstrap.Modal.getOrCreateInstance('#eventDetailsModal').hide();
                bookingFlow.initiateBooking(e.id);
            };

            new bootstrap.Modal('#eventDetailsModal').show();
            setTimeout(() => this.initMap(e.latitude || 34.03, e.longitude || -5.00, e.title), 500);
        }
    },

    initMap(lat, lng, title) {
        if (state.leafletMap) state.leafletMap.remove();
        state.leafletMap = L.map('map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM' }).addTo(state.leafletMap);
        L.marker([lat, lng]).addTo(state.leafletMap).bindPopup(title).openPopup();
        setTimeout(() => state.leafletMap.invalidateSize(), 200);
    },

    updateAuthUI() {
        const authSec = document.getElementById('auth-section');
        const fab = document.getElementById('add-event-fab');
        const user = state.user;
        if (state.token && user) {
            if (user.role !== 'user') fab?.classList.remove('d-none');
            authSec.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-light dropdown-toggle rounded-pill btn-sm px-3 shadow-sm border" data-bs-toggle="dropdown">
                        Hi, ${user.name}
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
                <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion</button>
                <button class="btn btn-outline-primary btn-sm rounded-pill px-3 ms-2 shadow-sm" data-bs-toggle="modal" data-bs-target="#registerModal">S'inscrire</button>`;
        }
    },

    showEventModal() { new bootstrap.Modal('#addEventModal').show(); }
};

// 6. نظام الحجز والدفع والـ PDF (Booking Flow)
window.bookingFlow = {
    selectedEvent: null,
    async initiateBooking(id) {
        if (!state.token) { new bootstrap.Modal('#loginModal').show(); return; }
        state.currentEventId = id;
        const res = await api.request(`/events/${id}`);
        if (res.success) {
            this.selectedEvent = res.data;
            if (parseFloat(this.selectedEvent.price) === 0) {
                if (confirm(`Confirmer votre réservation GRATUITE ?`)) this.executeBooking();
            } else {
                document.getElementById('payment-event-info').innerHTML = `<strong>${this.selectedEvent.title}</strong><br>Total: ${this.selectedEvent.formatted_price}`;
                new bootstrap.Modal('#paymentModal').show();
            }
        }
    },
    async executeBooking() {
        const res = await api.request('/bookings', 'POST', {
            event_id: state.currentEventId, quantity: 1, 
            attendee_name: state.user.name, attendee_email: state.user.email
        });
        if (res.success) {
            bootstrap.Modal.getOrCreateInstance('#paymentModal').hide();
            this.showTicket(res.booking_number);
        } else alert(res.message);
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
            new bootstrap.Modal('#ticketModal').show();
        }
    },
    downloadPDF() {
        const el = document.getElementById('ticket-to-print');
        const num = document.getElementById('ticket-number').innerText;
        html2pdf().set({ 
            margin: 10, filename: `Ticket-${num}.pdf`, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(el).save();
    }
};

// 7. المصادقة والأحداث (Auth & Events)
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
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        const res = await api.request('/events');
        if (res.success) ui.renderEvents(res.data);
    },
    async filterByCategory(id, el) {
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        if(el) el.classList.add('active');
        const res = await api.request(`/events?category_id=${id}`);
        if (res.success) ui.renderEvents(res.data);
    },
    async search(query, date) {
        let url = `/events?search=${query}`;
        if (date) url += `&date=${date}`;
        const res = await api.request(url);
        if (res.success) ui.renderEvents(res.data);
    },
    async create(e) {
        e.preventDefault();
        const res = await api.request('/events', 'POST', new FormData(e.target), true);
        if (res.success) { Swal.fire('Publié !', 'L\'événement est en ligne.', 'success').then(()=>location.reload()); }
    }
};

// 8. التشغيل والربط النهائي (Initialization)
document.addEventListener('DOMContentLoaded', () => {
    ui.updateAuthUI();
    reviewManager.initStars();
    events.fetchAll();
    
    // تحميل الأصناف
    api.request('/categories').then(res => {
        if (res.success) {
            const nav = document.getElementById('categories-nav');
            if(nav) nav.innerHTML = `<div class="category-pill active" onclick="events.fetchAll()">Tout</div>` + 
                res.data.map(c => `<div class="category-pill" onclick="events.filterByCategory(${c.id}, this)">${c.name}</div>`).join('');
            const sel = document.getElementById('category-select');
            if(sel) sel.innerHTML = res.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    });

    // ربط النماذج
    document.getElementById('login-form')?.addEventListener('submit', auth.login);
    document.getElementById('register-form')?.addEventListener('submit', auth.register);
    document.getElementById('payment-form')?.addEventListener('submit', (e) => { e.preventDefault(); bookingFlow.executeBooking(); });
    document.getElementById('event-form')?.addEventListener('submit', events.create);
    document.getElementById('search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        events.search(document.getElementById('search-input').value, document.getElementById('date-input').value);
    });
    
    // ربط البوت
    document.getElementById('chat-bubble')?.addEventListener('click', () => botManager.toggle());
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if(e.key==='Enter') botManager.sendMessage(); });
});