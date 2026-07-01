/**
 * EventHub Fès - Core Application Script (app.js)
 * Year: 2026
 * Version: Finale Commerciale (Seats, Quantity, Anti-Duplicate)
 */

// ==========================================
// 1. DONNÉES ET VARIABLES GLOBALES
// ==========================================
let CATEGORIES = [{ id: 'all', name: 'Tous', icon: 'fa-th-large' }];
const EVENTS = []; 
let currentFilterCategory = 'all';
let mapInstance = null;
let currentPage = 1;
const itemsPerPage = 6; 

// Injecter une animation CSS subtile pour les cartes et le Skeleton
(function injectStyles() {
    if (!document.getElementById('ehub-dynamic-styles')) {
        const style = document.createElement('style');
        style.id = 'ehub-dynamic-styles';
        style.textContent = `
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } } 
            .event-card { animation: fadeInUp 0.4s ease-out forwards; }
            .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 1rem; height: 350px; }
            @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }
})();

// ==========================================
// 2. CHARGEMENT DES BIBLIOTHÈQUES (QR & PDF)
// ==========================================
(function loadLibs() {
    const scripts = [
        { id: 'qr-js', src: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js' },
        { id: 'pdf-js', src: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js' }
    ];
    scripts.forEach(s => {
        if (!document.getElementById(s.id)) {
            const sc = document.createElement('script');
            sc.id = s.id;
            sc.src = s.src;
            document.head.appendChild(sc);
        }
    });
})();

// ==========================================
// 3. UTILITAIRES UTILISATEUR & AUTH
// ==========================================
function getCurrentUser() {
    try { const u = localStorage.getItem('user'); return (u && u !== 'undefined' && u !== 'null') ? JSON.parse(u) : null; } catch (e) { return null; }
}

function setCurrentUser(user, token) {
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        if (token) { localStorage.setItem('token', token); localStorage.setItem('user_id', user.id || user.user_id); }
    } else {
        localStorage.removeItem('user'); localStorage.removeItem('token'); localStorage.removeItem('user_id');
    }
}

function getToken() { return localStorage.getItem('token'); }
function isLoggedIn() { return !!(getToken() && getCurrentUser()); }

// ==========================================
// 4. UTILITAIRES GÉNÉRALES
// ==========================================
function formatDate(d) {
    if (!d) return "Date à confirmer";
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) { clearTimeout(timeoutId); timeoutId = setTimeout(() => func.apply(this, args), delay); };
}

// ==========================================
// 5. INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const user = getCurrentUser();
    const token = getToken();
    
    if (token && !user) await fetchUserFromAPI(token);
    await fetchCategories(); 
    await fetchAndAppendAPIEvents();

    // Vérification du retour de Stripe
    (function checkPaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const eventId = urlParams.get('event_id');

        if (paymentStatus === 'success' && eventId) {
            window.history.replaceState({}, document.title, window.location.pathname);
            const event = EVENTS.find(e => e.id == eventId);
            const currentUser = getCurrentUser();
            if (event && currentUser) {
                // استرجاع عدد الأشخاص الذي حفظناه قبل التوجه لبنك
                const qty = parseInt(localStorage.getItem('pending_booking_qty')) || 1;
                localStorage.removeItem('pending_booking_qty');
                
                saveReservationToDB(event, currentUser, qty);
                saveBookingLocally(event.id, qty);
                
                setTimeout(() => {
                    Swal.fire({ icon: 'success', title: 'Paiement Réussi !', text: 'Votre paiement a été validé.', confirmButtonText: 'Voir mon ticket' })
                    .then(() => generateTicket(event, currentUser, qty));
                }, 500);
            }
        } else if (paymentStatus === 'cancelled') {
            window.history.replaceState({}, document.title, window.location.pathname);
            Swal.fire('Annulé', 'Paiement annulé.', 'info');
        }
    })();
    
    initAuthUI();
    setupSearchListeners();
    setupAuthForms();
    initChatBot();
    
    if (window.location.pathname.includes('dashboard.html')) {
        if (!isLoggedIn()) window.location.href = 'index.html';
        if (user && (user.role === 'admin' || user.is_admin)) fetchAndRenderUsers();
    }
});

// ==========================================
// 6. FETCH DATA (API)
// ==========================================
async function fetchCategories() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/categories', { headers: { 'Accept': 'application/json' } });
        if (response.ok) {
            const resData = await response.json();
            const apiCats = resData.data || resData;
            CATEGORIES = [{ id: 'all', name: 'Tous', icon: 'fa-th-large' }];
            apiCats.forEach(cat => CATEGORIES.push({ id: cat.id, name: cat.name, icon: cat.icon || 'fa-tag' }));
            renderCategories();
            updateCategorySelectOptions();
        }
    } catch (err) { console.error('Erreur catégories:', err); }
}

function updateCategorySelectOptions() {
    const select = document.getElementById('category-select');
    if (!select) return;
    select.innerHTML = '<option value="">Toutes les catégories</option>';
    CATEGORIES.forEach(c => { if (c.id !== 'all') { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; select.appendChild(o); } });
}

async function fetchUserFromAPI(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/user', { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } });
        if (response.ok) { const data = await response.json(); if (data.success && data.data) { localStorage.setItem('user', JSON.stringify(data.data)); initAuthUI(); return true; } }
        setCurrentUser(null); return false;
    } catch(e) { return false; }
}

async function fetchAndAppendAPIEvents() {
    const container = document.getElementById('events-container');
    if (container) container.innerHTML = `
        <div class="col-md-6 col-lg-4 mb-4"><div class="skeleton"></div></div>
        <div class="col-md-6 col-lg-4 mb-4"><div class="skeleton"></div></div>
        <div class="col-md-6 col-lg-4 mb-4"><div class="skeleton"></div></div>`;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/events', { headers: { 'Accept': 'application/json' } });
        if (response.ok) {
            const resData = await response.json();
            const realEvents = resData.data || resData;
            EVENTS.length = 0;
            if (Array.isArray(realEvents)) {
                realEvents.forEach(apiEv => {
                    let imgPath = apiEv.image;
                    if (imgPath && !imgPath.startsWith('http')) imgPath = `http://127.0.0.1:8000/storage/${imgPath}`;
                    EVENTS.push({
                        id: apiEv.id, title: apiEv.title,
                        category: (apiEv.category && typeof apiEv.category === 'object') ? apiEv.category.name : (apiEv.category || 'Général'),
                        date: apiEv.start_date || apiEv.event_date || apiEv.date || apiEv.created_at,
                        price: parseFloat(apiEv.price) || 0, description: apiEv.description,
                        image: imgPath || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000",
                        location: typeof apiEv.location === 'string' ? JSON.parse(apiEv.location) : (apiEv.location || { name: "Fès", lat: 34.0342, lng: -5.0012 }),
                        seats: apiEv.seats
                    });
                });
                renderEvents(EVENTS);
            }
        }
    } catch (err) {
        if(container) container.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Erreur de connexion au serveur.</p></div>';
    }
}

// ==========================================
// 7. AUTHENTIFICATION
// ==========================================
function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch('http://127.0.0.1:8000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ email, password }) });
                const data = await response.json();
                if (data.success && data.data.token && data.data.user) { setCurrentUser(data.data.user, data.data.token); location.reload(); }
                else { Swal.fire('Erreur', 'Identifiants incorrects.', 'error'); }
            } catch(error) { Swal.fire('Erreur Serveur', 'Impossible de contacter le serveur.', 'error'); }
        };
    }
}
function logout() { setCurrentUser(null); window.location.href = 'index.html'; }

// ==========================================
// 8. FILTRAGE ET RECHERCHE
// ==========================================
function applyAllFilters(resetPage = true) {
    if (resetPage) currentPage = 1; 
    const query = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase().trim() : '';
    const dateQuery = document.getElementById('date-input') ? document.getElementById('date-input').value : '';
    let selectedCatName = document.getElementById('category-select') ? document.getElementById('category-select').value : "";
    if (!selectedCatName && currentFilterCategory !== 'all') { const catObj = CATEGORIES.find(c => c.id == currentFilterCategory); if (catObj) selectedCatName = catObj.name; }

    const filtered = EVENTS.filter(e => {
        const matchText = e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query);
        const matchCategory = !selectedCatName || selectedCatName === 'Tous' || e.category === selectedCatName;
        const matchDate = !dateQuery || (e.date && e.date.includes(dateQuery));
        return matchText && matchCategory && matchDate;
    });
    renderEvents(filtered);
}

function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const dateInput = document.getElementById('date-input');
    if (searchInput) searchInput.addEventListener('input', debounce(() => applyAllFilters(true), 300));
    if (categorySelect) categorySelect.addEventListener('change', (e) => { const catObj = CATEGORIES.find(c => c.name === e.target.value); currentFilterCategory = catObj ? catObj.id : 'all'; renderCategories(); applyAllFilters(true); });
    if (dateInput) dateInput.addEventListener('change', () => applyAllFilters(true));
}

function filterByCategory(id, name) {
    currentFilterCategory = id;
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) categorySelect.value = (id === 'all') ? "" : name;
    renderCategories(); applyAllFilters(true);
}

// ==========================================
// 9. RENDU DE L'INTERFACE (AVEC GESTION DES SIÈGES)
// ==========================================
function initAuthUI() {
    const user = getCurrentUser();
    const authContainer = document.getElementById('auth-buttons');
    if (user && authContainer) {
        const isAdmin = user.role === 'admin' || user.is_admin;
        authContainer.innerHTML = `
            <div class="dropdown" id="notifications-wrapper" style="display: none;">
                <button class="btn btn-outline-light border-0 position-relative rounded-circle p-2" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fas fa-bell fs-5"></i>
                    <span id="notif-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display: none;">0</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end p-0 shadow-lg" style="width: 350px; max-height: 400px; overflow-y: auto;">
                    <li class="p-3 border-bottom text-center"><h6 class="mb-0 fw-bold">Notifications</h6></li>
                    <div id="notifications-list"></div>
                </ul>
            </div>
            <button class="btn btn-outline-light rounded-pill px-3" onclick="toggleDarkMode()" title="Mode Nuit">
                <i class="fas fa-moon"></i>
            </button>
            <div class="dropdown">
                <button class="btn btn-primary rounded-pill dropdown-toggle px-4" data-bs-toggle="dropdown">
                    <i class="fas fa-user-circle me-2"></i>${escapeHtml(user.name)}
                </button>
                <ul class="dropdown-menu dropdown-menu-end border-0 shadow mt-2">
                    <li>
                        <a class="dropdown-item" href="profil.html">
                            <i class="fas fa-user me-2 text-primary"></i>Mon Profil
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="dashboard.html">
                            <i class="fas fa-tachometer-alt me-2 text-warning"></i>Tableau de bord
                        </a>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <button class="dropdown-item text-danger" onclick="logout()">
                            <i class="fas fa-sign-out-alt me-2"></i>Déconnexion
                        </button>
                    </li>
                </ul>
            </div>`;
    }
}

function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(c => `<div class="category-card ${c.id == currentFilterCategory ? 'active' : ''}" onclick="filterByCategory('${c.id}', '${c.name}')" role="button"><i class="fas ${c.icon} mb-2"></i><span class="small fw-bold">${escapeHtml(c.name)}</span></div>`).join('');
}

function renderEvents(list) {
    const container = document.getElementById('events-container');
    if (!container) return;
    const totalPages = Math.ceil(list.length / itemsPerPage);
    const paginatedItems = list.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (paginatedItems.length === 0) { container.innerHTML = '<div class="col-12 text-center py-5 text-muted"><i class="fas fa-search fa-2x mb-3 d-block"></i>Aucun événement trouvé.</div>'; renderPaginationUI(0); return; }

    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    
    container.innerHTML = paginatedItems.map(e => {
        let seatsBadge = '';
        let isSoldOut = false;
        
        if (e.seats !== null && e.seats !== undefined) {
            if (e.seats <= 0) {
                isSoldOut = true;
                seatsBadge = `<div class="position-absolute top-0 start-0 end-0 bottom-0 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center" style="border-radius: 24px 24px 0 0; z-index: 5;"><span class="text-white fw-bold fs-4 bg-danger px-4 py-2 rounded-pill shadow">COMPLET</span></div>`;
            } else if (e.seats <= 10) {
                seatsBadge = `<span class="badge bg-danger position-absolute m-3 bottom-0 start-0" style="font-size:0.7rem; z-index:6;">Plus que ${e.seats} places!</span>`;
            } else {
                seatsBadge = `<span class="badge bg-light text-dark position-absolute m-3 bottom-0 start-0" style="font-size:0.7rem; z-index:6;"><i class="fas fa-chair me-1"></i>${e.seats} places</span>`;
            }
        }

        return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="event-card shadow-sm h-100 bg-white ${isSoldOut ? 'opacity-75' : ''}">
                <div class="card-img-wrapper position-relative">
                    <img src="${e.image}" alt="${escapeHtml(e.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1000'">
                    <span class="badge bg-primary position-absolute m-3 top-0 end-0" style="z-index:6;">${escapeHtml(e.category)}</span>
                    ${e.price === 0 ? '<span class="badge bg-success position-absolute" style="top:15px; left:15px; font-size:0.7rem; z-index:6;">GRATUIT</span>' : ''}
                    ${seatsBadge}
                    <span class="position-absolute m-3 bottom-0 end-0 bg-white rounded-circle p-2 shadow-sm" style="cursor:pointer; z-index:10;" onclick="event.stopPropagation(); toggleFavorite(${e.id})"><i class="fas fa-heart ${favorites.includes(e.id) ? 'text-danger' : 'text-muted'}"></i></span>
                </div>
                <div class="p-4">
                    <h5 class="fw-bold text-dark">${escapeHtml(e.title)}</h5>
                    <p class="text-muted small mb-3"><i class="fas fa-calendar-alt me-2"></i>${formatDate(e.date)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary fs-5">${e.price === 0 ? 'GRATUIT' : e.price + ' DH'}</span>
                        ${isSoldOut ? '<button class="btn btn-secondary rounded-pill px-3" disabled>Complet</button>' : `<button class="btn btn-outline-primary rounded-pill px-3" onclick="openDetails(${e.id})">Détails</button>`}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
    
    renderPaginationUI(totalPages);
}

function renderPaginationUI(totalPages) {
    let paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) { const eventsRow = document.getElementById('events-container'); if (eventsRow) { paginationContainer = document.createElement('div'); paginationContainer.id = 'pagination-container'; paginationContainer.className = 'col-12 d-flex justify-content-center mt-4 mb-5'; eventsRow.parentNode.insertBefore(paginationContainer, eventsRow.nextSibling); } else return; }
    if (totalPages <= 1) { paginationContainer.innerHTML = ''; return; }
    let html = `<nav><ul class="pagination pagination-rounded">`;
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></a></li>`;
    for (let i = 1; i <= totalPages; i++) html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${i})">${i}</a></li>`;
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></a></li>`;
    html += `</ul></nav>`; paginationContainer.innerHTML = html;
}

function changePage(page) { currentPage = page; applyAllFilters(false); window.scrollTo({ top: document.getElementById('events-container').offsetTop - 100, behavior: 'smooth' }); }

// ==========================================
// 10. DÉTAILS, MAPS & COMPTE À REBOURS
// ==========================================
let countdownInterval = null;
function startCountdown(eventDateStr, elementId) {
    const el = document.getElementById(elementId); if (!el) return; if (countdownInterval) clearInterval(countdownInterval);
    function updateCounter() {
        const distance = new Date(eventDateStr).getTime() - new Date().getTime();
        if (distance < 0) { el.innerHTML = '<span class="text-danger fw-bold">Événement terminé</span>'; clearInterval(countdownInterval); return; }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24)); const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((distance % (1000 * 60)) / 1000);
        el.innerHTML = `<div class="d-flex gap-2 justify-content-center mt-2"><div class="bg-dark text-white rounded-3 p-2 text-center" style="min-width: 50px;"><div class="fs-5 fw-bold">${d}</div><div class="small" style="font-size:0.6rem">JOURS</div></div><div class="bg-dark text-white rounded-3 p-2 text-center" style="min-width: 50px;"><div class="fs-5 fw-bold">${h}</div><div class="small" style="font-size:0.6rem">HEURES</div></div><div class="bg-dark text-white rounded-3 p-2 text-center" style="min-width: 50px;"><div class="fs-5 fw-bold">${m}</div><div class="small" style="font-size:0.6rem">MIN</div></div><div class="bg-dark text-white rounded-3 p-2 text-center" style="min-width: 50px;"><div class="fs-5 fw-bold">${s}</div><div class="small" style="font-size:0.6rem">SEC</div></div></div>`;
    }
    updateCounter(); countdownInterval = setInterval(updateCounter, 1000);
}

function openDetails(id) {
    const event = EVENTS.find(e => e.id === id); if (!event) return;
    if (event.seats !== null && event.seats !== undefined && event.seats <= 0) { Swal.fire('Désolé', 'Cet événement est complet.', 'info'); return; }

    document.getElementById('detail-title').innerText = event.title;
    document.getElementById('detail-description').innerText = event.description;
    document.getElementById('detail-date').innerText = formatDate(event.date);
    document.getElementById('detail-price').innerText = event.price === 0 ? 'Gratuit' : event.price + ' DH / personne';
    document.getElementById('detail-image').src = event.image;

    const user = getCurrentUser();
    const bArea = document.getElementById('booking-area');
    if (bArea) bArea.innerHTML = user ? `<button class="btn btn-success rounded-pill py-2 fw-bold w-100" onclick="bookNow(${event.id})">Réserver ma place</button>` : `<button class="btn btn-primary rounded-pill py-2 w-100" data-bs-toggle="modal" data-bs-target="#authChoiceModal">Se connecter pour réserver</button>`;
    
    const actionsArea = document.getElementById('detail-actions');
    if (actionsArea) actionsArea.innerHTML = `<div class="d-flex gap-2 mt-3"><a href="https://wa.me/?text=Regarde cet événement: ${encodeURIComponent(event.title)} - ${encodeURIComponent(window.location.href)}" target="_blank" class="btn btn-outline-success btn-sm flex-grow-1 rounded-pill"><i class="fab fa-whatsapp me-1"></i>Partager</a><button class="btn btn-outline-danger btn-sm flex-grow-1 rounded-pill" onclick="addToGoogleCalendar(${event.id})"><i class="fas fa-calendar-plus me-1"></i>Calendrier</button></div>`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('eventDetailsModal')).show();
    startCountdown(event.date, 'detail-countdown-target');

    setTimeout(() => {
        if (mapInstance) mapInstance.remove();
        mapInstance = L.map('map').setView([event.location.lat, event.location.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        L.marker([event.location.lat, event.location.lng]).addTo(mapInstance).bindPopup(event.location.name).openPopup();
    }, 500);
}

// ==========================================
// 11. PAIEMENT, RÉSERVATION & QUANTITÉ
// ==========================================
async function saveReservationToDB(event, user, quantity = 1) {
    const token = getToken();
    try {
        const response = await fetch('http://127.0.0.1:8000/api/bookings', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, 
            body: JSON.stringify({ event_id: event.id, quantity: quantity, attendee_name: user.name, attendee_email: user.email }) 
        });
        return await response.json();
    } catch (err) { console.error("Erreur API Booking:", err); return { success: false }; }
}

// حفظ الحجز محلياً لمنع التكرار
function saveBookingLocally(eventId, quantity) {
    let bookings = JSON.parse(localStorage.getItem('my_bookings') || '[]');
    if (!bookings.find(b => b.event_id == eventId)) {
        bookings.push({ event_id: eventId, quantity: quantity, date: new Date().toISOString() });
        localStorage.setItem('my_bookings', JSON.stringify(bookings));
    }
}

function bookNow(id) {
    const event = EVENTS.find(e => e.id == id); 
    const user = getCurrentUser(); 
    if (!event) return;

    // 1. التحقق من الحجز المسبق
    const myBookings = JSON.parse(localStorage.getItem('my_bookings') || '[]');
    const existingBooking = myBookings.find(b => b.event_id == id);

    if (existingBooking) {
        Swal.fire({
            title: 'Déjà réservé !',
            html: `<div class="text-start p-3 bg-light rounded">
                <p class="fw-bold text-primary mb-1">${escapeHtml(event.title)}</p>
                <p class="text-muted small mb-0"><i class="fas fa-calendar me-1"></i>${formatDate(event.date)}</p>
                <p class="text-muted small mb-0"><i class="fas fa-users me-1"></i>Nombre de places réservées: ${existingBooking.quantity}</p>
            </div>`,
            icon: 'info',
            confirmButtonText: 'D\'accord'
        });
        return;
    }

    // إغلاق المودال أولاً
    const modalEl = document.getElementById('eventDetailsModal'); 
    const modalInstance = bootstrap.Modal.getInstance(modalEl); 
    if (modalInstance) modalInstance.hide();

    // 2. إذا كان الحجز مدفوعاً (طلب العدد وحساب المبلغ)
    if (event.price > 0) {
        Swal.fire({
            title: 'Réserver',
            html: `
                <p class="text-muted mb-3">Prix unitaire: <strong>${event.price} DH</strong></p>
                <label class="form-label text-start w-100 fw-bold">Nombre de personnes</label>
                <input type="number" id="swal-quantity" class="form-control form-control-lg text-center" value="1" min="1" max="${event.seats && event.seats > 0 ? event.seats : 999}">
                <p class="mt-3 mb-0 text-primary fw-bold fs-5">Total: <span id="swal-total">${event.price}</span> DH</p>
            `,
            showCancelButton: true,
            confirmButtonText: 'Payer maintenant',
            cancelButtonText: 'Annuler',
            preConfirm: () => {
                const qty = parseInt(document.getElementById('swal-quantity').value);
                if (!qty || qty < 1) {
                    Swal.showValidationMessage('Veuillez entrer un nombre valide');
                    return false;
                }
                if (event.seats !== null && event.seats !== undefined && qty > event.seats) {
                    Swal.showValidationMessage(`Il ne reste que ${event.seats} places disponibles.`);
                    return false;
                }
                return qty;
            },
            didOpen: () => {
                const qtyInput = document.getElementById('swal-quantity');
                const totalSpan = document.getElementById('swal-total');
                qtyInput.oninput = () => {
                    let q = parseInt(qtyInput.value) || 0;
                    if (q < 1) q = 1;
                    totalSpan.innerText = (q * event.price);
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                processPayment(event, user, result.value);
            }
        });
    } 
    // 3. إذا كان مجانياً
    else {
        Swal.fire({
            title: 'Entrée gratuite',
            input: 'number',
            inputLabel: 'Combien de personnes ?',
            inputValue: 1,
            inputAttributes: { min: 1, max: event.seats && event.seats > 0 ? event.seats : 999 },
            showCancelButton: true,
            confirmButtonText: 'Confirmer',
        }).then(async (result) => {
            if (result.isConfirmed) {
                const qty = parseInt(result.value) || 1;
                await saveReservationToDB(event, user, qty);
                saveBookingLocally(event.id, qty);
                generateTicket(event, user, qty);
            }
        });
    }
}

function processPayment(event, user, quantity = 1) {
    Swal.fire({ title: 'Redirection vers la banque...', text: 'Veuillez patienter.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const token = getToken();
    
    fetch('http://127.0.0.1:8000/api/pay', { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }, 
        body: JSON.stringify({ event_id: event.id, quantity: quantity }) 
    })
    .then(response => response.json())
    .then(data => { 
        Swal.close(); 
        if (data.url) { 
            // حفظ العدد مؤقتاً لاسترجاعه بعد العودة من Stripe
            localStorage.setItem('pending_booking_qty', quantity);
            window.location.href = data.url; 
        } else { 
            Swal.fire('Erreur', data.error || 'Impossible de lancer le paiement.', 'error'); 
        } 
    })
    .catch(error => { Swal.close(); Swal.fire('Erreur', 'Une erreur de connexion est survenue.', 'error'); });
}

// ==========================================
// 12. GÉNÉRATION DE TICKET (VERSION PDF ROBUSTE)
// ==========================================
function generateTicket(event, user, quantity = 1) {
    const titleEl = document.getElementById('ticket-event-title'); if (!titleEl) return;
    const totalPrice = event.price * quantity;
    
    // 1. Mise à jour du Modal (juste pour l'affichage à l'écran)
    titleEl.innerText = event.title;
    document.getElementById('ticket-user-name').innerText = user?.name || 'Utilisateur';
    document.getElementById('ticket-user-email').innerText = user?.email || '';
    document.getElementById('ticket-event-date').innerText = formatDate(event.date);
    document.getElementById('ticket-event-location').innerText = event.location.name;
    
    let priceText = totalPrice === 0 ? 'GRATUIT' : totalPrice + ' DH';
    if (quantity > 1) priceText += ` (${quantity} pers.)`;
    document.getElementById('ticket-price-badge').innerText = priceText;

    const qrBox = document.getElementById("modal-qrcode-target");
    qrBox.innerHTML = ""; 
    
    new QRCode(qrBox, { 
        text: `TICKET-${event.id}-${user?.id}-${quantity}-${Date.now()}`, 
        width: 150, 
        height: 150,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    new bootstrap.Modal(document.getElementById('ticketModal')).show();

    // 2. Bouton de téléchargement
    document.getElementById('download-ticket-btn').onclick = function() {
        const btn = document.getElementById('download-ticket-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Génération en cours...';
        btn.disabled = true;

        // Petit délai pour s'assurer que le QR est bien dessiné
        setTimeout(() => {
            generateStandalonePDF(event, user, quantity, priceText).finally(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        }, 1000);
    };

    // 3. Partage WhatsApp
    const shareBtn = document.getElementById('share-ticket-btn');
    if (shareBtn) {
        shareBtn.onclick = function() {
            const text = `Je viens de réserver ${quantity} place(s) pour "${event.title}" via EventHub Fès !`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        };
    }
}

// ==========================================
// FONCTION INDÉPENDANTE POUR LE PDF (SANS PASSER PAR LE MODAL)
// ==========================================
async function generateStandalonePDF(event, user, quantity, priceText) {
    const qrContainer = document.getElementById("modal-qrcode-target");
    const canvas = qrContainer.querySelector('canvas');
    
    // استخراج QR كـ Base64
    let qrImageSrc = '';
    if (canvas && canvas.width > 0 && canvas.height > 0) {
        qrImageSrc = canvas.toDataURL('image/png');
    } else {
        const img = qrContainer.querySelector('img');
        if (img && img.src) qrImageSrc = img.src;
    }

    if (!qrImageSrc) {
        Swal.fire('Erreur', 'Impossible de lire le code QR. Réessayez.', 'error');
        return;
    }

    // ✅ العنصر visible لكن محطوط ورا كلشي (مش خارج الشاشة)
    const tempDiv = document.createElement('div');
    tempDiv.id = 'temp-pdf-ticket';
    tempDiv.style.cssText = `
        width: 400px; 
        padding: 30px; 
        font-family: Arial, Helvetica, sans-serif; 
        background: #ffffff; 
        color: #333333; 
        position: fixed; 
        left: 0; 
        top: 0; 
        z-index: -9999;
        opacity: 1;
        visibility: visible;
        display: block;
    `;

    tempDiv.innerHTML = `
        <div style="text-align: center; border-bottom: 3px solid #0d6efd; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="margin: 0; color: #0d6efd; font-size: 26px; font-weight: bold;">EventHub Fès</h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 13px; letter-spacing: 2px;">TICKET OFFICIEL</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; color: #000;">${escapeHtml(event.title)}</h2>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
            <tr>
                <td style="padding: 10px 0; color: #666; width: 35%; border-bottom: 1px solid #eee;">Nom :</td>
                <td style="padding: 10px 0; font-weight: bold; border-bottom: 1px solid #eee;">${escapeHtml(user?.name || 'N/A')}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Email :</td>
                <td style="padding: 10px 0; font-weight: bold; border-bottom: 1px solid #eee;">${escapeHtml(user?.email || 'N/A')}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Date :</td>
                <td style="padding: 10px 0; font-weight: bold; border-bottom: 1px solid #eee;">${formatDate(event.date)}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #eee;">Lieu :</td>
                <td style="padding: 10px 0; font-weight: bold; border-bottom: 1px solid #eee;">${escapeHtml(event.location.name)}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666;">Places :</td>
                <td style="padding: 10px 0; font-weight: bold;">${quantity} personne(s)</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666;">Tarif :</td>
                <td style="padding: 10px 0; font-weight: bold; color: #0d6efd; font-size: 18px;">${priceText}</td>
            </tr>
        </table>

        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 2px dashed #ddd;">
            <img src="${qrImageSrc}" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #999;">Présentez ce code QR à l'entrée de l'événement</p>
        </div>
    `;

    document.body.appendChild(tempDiv);

    const opt = {
        margin: 0.3,
        filename: `Ticket_${event.title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false, 
            backgroundColor: '#ffffff',
            // ✅ المفتاح: onclone كيخلي العنصر visible فالنسخة اللي html2canvas كيخدم عليها
            onclone: function(clonedDoc) {
                const el = clonedDoc.getElementById('temp-pdf-ticket');
                if (el) {
                    el.style.position = 'fixed';
                    el.style.left = '0';
                    el.style.top = '0';
                    el.style.zIndex = '99999';
                    el.style.opacity = '1';
                    el.style.visibility = 'visible';
                    el.style.display = 'block';
                    el.style.width = '400px';
                }
                // تأكد أن الصورة مازالت حاضرة
                const imgs = el ? el.querySelectorAll('img') : [];
                imgs.forEach(img => {
                    if (!img.complete || !img.naturalWidth) {
                        img.src = img.src; // force reload
                    }
                });
            }
        },
        jsPDF: { unit: 'mm', format: [150, 230], orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(tempDiv).save();
    } catch (error) {
        console.error("Erreur PDF:", error);
        Swal.fire('Erreur', 'Une erreur est survenue lors du téléchargement.', 'error');
    } finally {
        const el = document.getElementById('temp-pdf-ticket');
        if (el) el.remove();
    }
}

// ==========================================
// 13. FONCTIONNALITÉS SUPPLÉMENTAIRES
// ==========================================
function toggleFavorite(id) {
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favs.includes(id)) { favs = favs.filter(f => f !== id); showToast('Retiré des favoris', 'error'); } else { favs.push(id); showToast('Ajouté aux favoris !', 'success'); }
    localStorage.setItem('favorites', JSON.stringify(favs)); applyAllFilters(false);
}

function addToGoogleCalendar(eventId) {
    const event = EVENTS.find(e => e.id === eventId); if (!event) return;
    const dateObj = new Date(event.date);
    const startDate = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location.name)}`, '_blank');
}

// ==========================================
// 14. GESTION ADMIN
// ==========================================
async function fetchAndRenderUsers() {
    const container = document.getElementById('admin-users-table'); if (!container) return;
    try {
        const response = await fetch('http://127.0.0.1:8000/api/users', { headers: { 'Authorization': `Bearer ${getToken()}`, 'Accept': 'application/json' } });
        if (response.ok) { const data = await response.json(); const users = data.data || data; container.innerHTML = users.map(u => `<tr><td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="badge bg-secondary">${u.role || 'user'}</span></td><td><button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
    } catch (e) { console.error("Erreur chargement users:", e); }
}

async function deleteUser(id) {
    const confirm = await Swal.fire({ title: 'Supprimer ?', text: "Cette action est irréversible !", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Oui, supprimer' });
    if (confirm.isConfirmed) {
        try { const response = await fetch(`http://127.0.0.1:8000/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } }); if (response.ok) { Swal.fire('Supprimé!', 'Supprimé.', 'success'); fetchAndRenderUsers(); } } catch (e) { Swal.fire('Erreur', 'Impossible de supprimer.', 'error'); }
    }
}

// ==========================================
// 15. CHATBOT
// ==========================================
// ==========================================
// CHATBOT AVANCÉ - EventHub Fès (Version FR)
// ==========================================

const ChatBot = {
    // État de la conversation
    state: {
        context: null,           // Contexte actuel (search, booking, help...)
        lastSearchResults: [],   // Derniers résultats de recherche
        selectedEvent: null,     // Événement sélectionné
        messageHistory: [],      // Historique de la conversation
        userName: null,          // Nom de l'utilisateur
        step: 0,                 // Étape dans la conversation multi-étapes
        bookingData: {}          // Données de réservation temporaires
    },

    // ==========================================
    // 1. BASE DE CONNAISSANCES
    // ==========================================
    knowledge: {
        greetings: {
            patterns: ['bonjour', 'salut', 'hello', 'hi', 'hey', 'coucou', 'bonsoir'],
            responses: [
                "Bonjour ! 👋 Je suis l'assistant EventHub Fès. Comment puis-je vous aider ?",
                "Salut ! 💫 Qu'est-ce que je peux faire pour vous ? Vous pouvez me demander des infos sur les événements, les réservations, ou autre chose.",
                "Bonjour et bienvenue ! 🎉 Que puis-je faire pour vous aujourd'hui ?"
            ]
        },
        
        events: {
            patterns: ['événement', 'event', 'activité', 'programme', 'quoi', 'quoi de prévu', 'liste', 'voir'],
            responses: () => {
                const freeEvents = EVENTS.filter(e => e.price === 0);
                const paidEvents = EVENTS.filter(e => e.price > 0);
                const upcomingEvents = EVENTS.filter(e => new Date(e.date) > new Date());
                
                return `📊 **Résumé des événements :**\n\n` +
                    `• Total des événements : ${EVENTS.length}\n` +
                    `• À venir : ${upcomingEvents.length}\n` +
                    `• Gratuits : ${freeEvents.length} 🎉\n` +
                    `• Payants : ${paidEvents.length} 💰\n\n` +
                    `Voulez-vous voir les détails ? Dites-moi "Événements gratuits" ou "Événements cette semaine"`;
            }
        },

        freeEvents: {
            patterns: ['gratuit', 'gratuite', 'gratuits', 'free', 'sans payer', '0 dh', 'pas cher', 'pas payant'],
            responses: () => {
                const free = EVENTS.filter(e => e.price === 0);
                if (free.length === 0) return "⚠️ Il n'y a pas d'événements gratuits pour le moment. Mais nous avons des événements à petits prix ! Dites-moi 'Événements pas chers'";
                
                let response = "🎉 **Événements gratuits :**\n\n";
                free.slice(0, 5).forEach((e, i) => {
                    response += `${i + 1}. **${e.title}**\n   📅 ${formatDate(e.date)}\n\n`;
                });
                response += "Voulez-vous réserver l'un d'entre eux ? Dites-moi son numéro !";
                ChatBot.state.context = 'free-events-list';
                ChatBot.state.lastSearchResults = free;
                return response;
            }
        },

        searchByCategory: {
            patterns: ['musique', 'music', 'concert', 'sport', 'culture', 'art', 'exposition', 'technologie', 'tech', 'digital', 'food', 'gastronomie', 'cuisine', 'informatique'],
            responses: (match) => {
                const normalizedMatch = match.toLowerCase();
                const categoryMap = {
                    'musique': ['musique', 'music', 'concert'],
                    'sport': ['sport', 'football', 'basket', 'course'],
                    'culture': ['culture', 'art', 'exposition', 'histoire'],
                    'technologie': ['technologie', 'tech', 'digital', 'informatique'],
                    'gastronomie': ['food', 'gastronomie', 'cuisine', 'repas']
                };
                
                let foundCategory = null;
                for (const [cat, keywords] of Object.entries(categoryMap)) {
                    if (keywords.some(k => normalizedMatch.includes(k))) {
                        foundCategory = cat;
                        break;
                    }
                }
                
                if (!foundCategory) return "Je n'ai pas compris la catégorie. Vous pouvez dire : musique, sport, culture, technologie ou gastronomie.";
                
                const results = EVENTS.filter(e => 
                    e.category.toLowerCase().includes(foundCategory) ||
                    e.title.toLowerCase().includes(foundCategory)
                );
                
                if (results.length === 0) return `⚠️ Aucun événement trouvé dans la catégorie "${foundCategory}" pour le moment.`;
                
                ChatBot.state.context = 'category-search';
                ChatBot.state.lastSearchResults = results;
                
                let response = `📋 **Événements ${foundCategory} :**\n\n`;
                results.slice(0, 5).forEach((e, i) => {
                    response += `${i + 1}. **${e.title}** - ${e.price === 0 ? 'Gratuit' : e.price + ' DH'}\n   📅 ${formatDate(e.date)}\n\n`;
                });
                response += "Dites-moi le numéro de l'événement pour voir les détails !";
                return response;
            }
        },

        pricing: {
            patterns: ['prix', 'coût', 'combien', 'tarif', 'payer', 'coûte', 'budget', 'cher'],
            responses: [
                "💰 Les prix varient selon l'événement :\n\n• Événements gratuits : 0 DH 🎉\n• Événements culturels : 20-50 DH\n• Concerts : 50-200 DH\n• Ateliers : 100-500 DH\n\nVoulez-vous connaître le prix d'un événement précis ? Dites-moi son nom !",
                "Les prix commencent à 0 DH pour les événements gratuits et peuvent aller jusqu'à 500 DH pour les ateliers spécialisés. Quel est votre budget ?"
            ]
        },

        booking: {
            patterns: ['réserver', 'réservation', 'réserver', 'book', 'inscrire', 'acheter', 'billet', 'ticket'],
            responses: () => {
                const user = getCurrentUser();
                if (!user) {
                    return "🔒 Vous devez être connecté pour réserver !\n\n👉 [Cliquez ici pour vous connecter](javascript:showLoginModal())\n\nOu dites-moi 'Comment réserver' pour une explication.";
                }
                
                if (EVENTS.length === 0) return "⚠️ Aucun événement disponible pour le moment.";
                
                ChatBot.state.context = 'booking-flow';
                ChatBot.state.step = 1;
                
                let response = "📝 **Étapes de réservation :**\n\n";
                response += "1️⃣ Sélection de l'événement\n";
                response += "2️⃣ Choix du nombre de personnes\n";
                response += "3️⃣ Paiement (si payant)\n";
                response += "4️⃣ Réception du billet avec QR Code\n\n";
                response += "Voulez-vous commencer ? Dites-moi quel type d'événement vous recherchez (musique, sport, culture...)";
                return response;
            }
        },

        howToBook: {
            patterns: ['comment réserver', 'comment faire', 'procédure', 'démarche', 'aide réservation', 'expliquer réservation'],
            responses: `📖 **Explication de la réservation étape par étape :**\n\n
1️⃣ **Parcourir les événements** - Utilisez la recherche ou les filtres\n
2️⃣ **Cliquez sur "Détails"** - Voir les informations complètes\n
3️⃣ **Cliquez sur "Réserver"** - Choisissez le nombre de personnes\n
4️⃣ **Payez** - Via Stripe (100% sécurisé)\n
5️⃣ **Recevez votre billet** - Avec QR Code + PDF\n\n
💡 *Note : Pour les événements gratuits, le billet est généré immédiatement !*`
        },

        myBookings: {
            patterns: ['mes réservations', 'mes billets', 'mes tickets', 'historique', 'réservations passées'],
            responses: () => {
                const user = getCurrentUser();
                if (!user) return "🔒 Vous devez être connecté pour voir vos réservations.";
                
                const bookings = JSON.parse(localStorage.getItem('my_bookings') || '[]');
                if (bookings.length === 0) return "📭 Vous n'avez encore réservé aucun événement. Voulez-vous que je vous montre les événements disponibles ?";
                
                let response = "🎫 **Vos réservations :**\n\n";
                bookings.forEach((b, i) => {
                    const event = EVENTS.find(e => e.id === b.event_id);
                    if (event) {
                        response += `${i + 1}. **${event.title}**\n   📅 ${formatDate(event.date)} | 👥 ${b.quantity} personne(s)\n\n`;
                    }
                });
                return response;
            }
        },

        location: {
            patterns: ['où', 'lieu', 'adresse', 'localisation', 'emplacement', 'accès', 'comment venir', 'situé'],
            responses: [
                "📍 La plupart de nos événements se déroulent à Fès :\n\n• **La Médina** (Fès El Bali)\n• **Ville Nouvelle** (Fès Jdid)\n• **Centre-ville**\n\nChaque événement dispose d'une carte détaillée dans sa page de détails ! 🗺️",
                "Notre service est actuellement disponible uniquement à Fès 🕌\n\nVoulez-vous connaître le lieu d'un événement précis ? Dites-moi son nom !"
            ]
        },

        contact: {
            patterns: ['contact', 'appeler', 'téléphone', 'phone', 'email', 'whatsapp', 'aider', 'help', 'support', 'assistance'],
            responses: `📞 **Nos coordonnées :**\n\n
📱 WhatsApp : +212 5XX-XXXXXX\n
📧 Email : contact@eventhub-fes.ma\n
📍 Adresse : Fès, Maroc\n
⏰ Horaires : 9h - 18h (Lundi - Vendredi)\n\n
Ou écrivez-moi ici et j'essaierai de vous aider ! 😊`
        },

        cancel: {
            patterns: ['annuler', 'retour', 'revenir', 'début', 'quitter', 'stop', 'non merci'],
            responses: () => {
                ChatBot.state.context = null;
                ChatBot.state.step = 0;
                return "👌 Retour au début. Que puis-je faire pour vous ?";
            }
        },

        thanks: {
            patterns: ['merci', 'merci beaucoup', 'thank', 'thanks', 'super', 'génial', 'parfait', 'excellent'],
            responses: [
                "De rien ! 😊 Ravi d'avoir pu vous aider. Autre chose ?",
                "Il n'y a pas de quoi ! 💫 Je suis là à tout moment si vous avez besoin.",
                "Avec plaisir ! 🙏 N'hésitez pas si vous avez d'autres questions."
            ]
        },

        goodbye: {
            patterns: ['au revoir', 'bye', 'à bientôt', 'bonne journée', 'bonne soirée', 'ciao', 'adieu'],
            responses: [
                "Au revoir ! 👋 Au plaisir de vous voir à nos événements ! 🎉",
                "À bientôt ! 💫 N'oubliez pas de nous suivre sur les réseaux sociaux !",
                "Ciao ! 🤝 Nous espérons que vous passerez un excellent moment !"
            ]
        }
    },

    // ==========================================
    // 2. RÉPONSES PAR DÉFAUT INTELLIGENTES
    // ==========================================
    fallbackResponses: [
        "Je n'ai pas bien compris 😅 Pourriez-vous reformuler votre question ?\n\nOu choisissez parmi ces sujets :\n• Événements\n• Réservation\n• Prix\n• Contact",
        "Question pas très claire pour moi 🤔 Essayez de demander :\n- 'Quels sont les événements ?'\n- 'Comment réserver ?'\n- 'Y a-t-il des événements gratuits ?'",
        "Je suis spécialisé dans les questions sur les événements 🎯 Essayez de me demander un événement précis ou comment réserver !"
    ],

    // ==========================================
    // 3. BOUTONS RAPIDES (QUICK REPLIES)
    // ==========================================
    quickReplies: [
        { text: '📋 Événements', action: 'events', icon: 'fa-calendar' },
        { text: '🎉 Gratuits', action: 'freeEvents', icon: 'fa-gift' },
        { text: '📝 Comment réserver ?', action: 'howToBook', icon: 'fa-question-circle' },
        { text: '🎫 Mes réservations', action: 'myBookings', icon: 'fa-ticket-alt' },
        { text: '📞 Contact', action: 'contact', icon: 'fa-phone' }
    ],

    // ==========================================
    // 4. INITIALISATION
    // ==========================================
    init() {
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        const chatToggle = document.getElementById('chat-toggle');
        const chatWindow = document.getElementById('chat-window');

        if (!chatForm || !chatInput || !chatMessages) return;

        // Ouvrir/Fermer la fenêtre
        if (chatToggle && chatWindow) {
            chatToggle.onclick = () => {
                chatWindow.classList.toggle('d-none');
                if (!chatWindow.classList.contains('d-none')) {
                    chatInput.focus();
                    if (ChatBot.state.messageHistory.length === 0) {
                        ChatBot.sendWelcomeMessage();
                    }
                }
            };
        }

        // Envoi du message
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;
            
            ChatBot.processMessage(message);
            chatInput.value = '';
            chatInput.focus();
        };

        // Suggestions pendant la frappe
        chatInput.addEventListener('input', debounce((e) => {
            ChatBot.showSuggestions(e.target.value);
        }, 300));
    },

    // ==========================================
    // 5. TRAITEMENT DES MESSAGES
    // ==========================================
    processMessage(message) {
        ChatBot.state.messageHistory.push({ sender: 'user', text: message, time: new Date() });
        ChatBot.appendMessage('user', message);
        ChatBot.hideSuggestions();
        ChatBot.showTypingIndicator();
        
        const delay = 500 + Math.random() * 800;
        
        setTimeout(() => {
            ChatBot.hideTypingIndicator();
            const response = ChatBot.generateResponse(message);
            ChatBot.appendMessage('bot', response);
            ChatBot.state.messageHistory.push({ sender: 'bot', text: response, time: new Date() });
        }, delay);
    },

    // ==========================================
    // 6. GÉNÉRATION DES RÉPONSES
    // ==========================================
    generateResponse(input) {
        const normalizedInput = input.toLowerCase().trim();
        
        // Vérifier le contexte actuel
        if (ChatBot.state.context) {
            const contextResponse = ChatBot.handleContext(normalizedInput);
            if (contextResponse) return contextResponse;
        }

        // Chercher dans la base de connaissances
        for (const [intent, data] of Object.entries(ChatBot.knowledge)) {
            const isMatch = data.patterns.some(pattern => 
                normalizedInput.includes(pattern.toLowerCase())
            );
            
            if (isMatch) {
                if (typeof data.responses === 'function') {
                    return data.responses(normalizedInput);
                }
                return data.responses[Math.floor(Math.random() * data.responses.length)];
            }
        }

        // Recherche directe dans les événements
        const directMatch = ChatBot.searchEventByTitle(normalizedInput);
        if (directMatch) return directMatch;

        // Vérification des numéros (sélection depuis une liste)
        if (/^\d+$/.test(normalizedInput)) {
            return ChatBot.handleNumberSelection(parseInt(normalizedInput));
        }

        // Réponse par défaut
        return ChatBot.fallbackResponses[Math.floor(Math.random() * ChatBot.fallbackResponses.length)];
    },

    // ==========================================
    // 7. GESTION DU CONTEXTE
    // ==========================================
    handleContext(input) {
        switch (ChatBot.state.context) {
            case 'free-events-list':
            case 'category-search':
                return ChatBot.handleNumberSelection(parseInt(input));
                
            case 'booking-flow':
                return ChatBot.handleBookingFlow(input);
                
            default:
                return null;
        }
    },

    handleNumberSelection(num) {
        const results = ChatBot.state.lastSearchResults;
        
        if (!results || isNaN(num) || num < 1 || num > results.length) {
            ChatBot.state.context = null;
            return "⚠️ Numéro invalide. Retour au début. Que voulez-vous faire ?";
        }

        const event = results[num - 1];
        ChatBot.state.selectedEvent = event;
        ChatBot.state.context = null;

        let response = `🎯 **${event.title}**\n\n`;
        response += `📂 Catégorie : ${event.category}\n`;
        response += `📅 Date : ${formatDate(event.date)}\n`;
        response += `💰 Prix : ${event.price === 0 ? 'Gratuit' : event.price + ' DH'}\n`;
        response += `📍 Lieu : ${event.location.name}\n`;
        
        if (event.seats !== null && event.seats !== undefined) {
            response += `💺 Places : ${event.seats <= 0 ? 'Complet 😔' : event.seats + ' disponibles'}\n`;
        }
        
        response += `\nVoulez-vous réserver cet événement ? Dites "Oui" ou cliquez sur le bouton 👇`;
        
        setTimeout(() => {
            ChatBot.appendActionButton(`✅ Réserver "${event.title}"`, `openDetails(${event.id})`);
        }, 100);
        
        return response;
    },

    handleBookingFlow(input) {
        const step = ChatBot.state.step;
        
        if (input.includes('annuler') || input.includes('non')) {
            ChatBot.state.context = null;
            ChatBot.state.step = 0;
            return "👌 Processus de réservation annulé.";
        }

        switch (step) {
            case 1:
                const results = EVENTS.filter(e => 
                    e.title.toLowerCase().includes(input) || 
                    e.category.toLowerCase().includes(input)
                );
                
                if (results.length === 0) {
                    return "⚠️ Aucun événement trouvé avec ce nom. Essayez un autre mot ou dites 'Annuler'.";
                }
                
                ChatBot.state.lastSearchResults = results;
                ChatBot.state.step = 2;
                
                let response = "Choisissez l'événement :\n\n";
                results.slice(0, 5).forEach((e, i) => {
                    response += `${i + 1}. **${e.title}** (${e.price === 0 ? 'Gratuit' : e.price + ' DH'})\n`;
                });
                return response;

            case 2:
                const selectedEvent = ChatBot.state.lastSearchResults[parseInt(input) - 1];
                if (!selectedEvent) return "Numéro invalide. Veuillez réessayer.";
                
                ChatBot.state.bookingData.event = selectedEvent;
                ChatBot.state.step = 3;
                
                return `Vous avez sélectionné **${selectedEvent.title}** ✅\n\nCombien de personnes souhaitez-vous réserver ? (1-10)`;

            case 3:
                const qty = parseInt(input);
                if (isNaN(qty) || qty < 1 || qty > 10) {
                    return "⚠️ Veuillez entrer un nombre entre 1 et 10.";
                }
                
                ChatBot.state.bookingData.quantity = qty;
                const event = ChatBot.state.bookingData.event;
                const total = event.price * qty;
                
                ChatBot.state.step = 4;
                
                let confirmMsg = `📝 **Confirmation de réservation :**\n\n`;
                confirmMsg += `📌 Événement : ${event.title}\n`;
                confirmMsg += `👥 Nombre de personnes : ${qty}\n`;
                confirmMsg += `💰 Montant : ${total === 0 ? 'Gratuit' : total + ' DH'}\n\n`;
                confirmMsg += `Confirmez-vous ? (Oui/Non)`;
                return confirmMsg;

            case 4:
                if (input.includes('oui') || input.includes('yes') || input.includes('oui')) {
                    ChatBot.state.context = null;
                    ChatBot.state.step = 0;
                    
                    const user = getCurrentUser();
                    const bookEvent = ChatBot.state.bookingData.event;
                    const bookQty = ChatBot.state.bookingData.quantity;
                    
                    if (bookEvent.price === 0) {
                        saveReservationToDB(bookEvent, user, bookQty);
                        saveBookingLocally(bookEvent.id, bookQty);
                        return `🎉 **Réservation réussie !**\n\nVotre billet est prêt ! Voulez-vous le voir ou le recevoir par WhatsApp ?`;
                    } else {
                        setTimeout(() => {
                            ChatBot.appendActionButton('💳 Payer maintenant', `processPayment(EVENTS.find(e=>e.id===${bookEvent.id}), getCurrentUser(), ${bookQty})`);
                        }, 100);
                        return `💰 Montant : ${bookEvent.price * bookQty} DH\n\nCliquez sur le bouton pour payer en toute sécurité via Stripe.`;
                    }
                } else {
                    ChatBot.state.context = null;
                    ChatBot.state.step = 0;
                    return "👌 Réservation annulée. Autre chose ?";
                }

            default:
                return null;
        }
    },

    // ==========================================
    // 8. RECHERCHE DIRECTE DANS LES ÉVÉNEMENTS
    // ==========================================
    searchEventByTitle(input) {
        // Supprimer les mots vides français
        const stopWords = ['quoi', 'comment', 'où', 'pourquoi', 'est', 'un', 'une', 'de', 'le', 'la', 'les', 'et', 'je', 'tu', 'il', 'nous', 'vous', 'ils', 'ce', 'cet', 'cette'];
        const cleanInput = stopWords.reduce((str, word) => str.replace(word, ''), input).trim();
        
        if (cleanInput.length < 2) return null;
        
        const matches = EVENTS.filter(e => 
            e.title.toLowerCase().includes(cleanInput) ||
            e.description.toLowerCase().includes(cleanInput)
        );
        
        if (matches.length === 0) return null;
        if (matches.length === 1) {
            const e = matches[0];
            return `🎯 J'ai trouvé cet événement :\n\n**${e.title}**\n📅 ${formatDate(e.date)}\n💰 ${e.price === 0 ? 'Gratuit' : e.price + ' DH'}\n\nVoulez-vous réserver ?`;
        }
        
        ChatBot.state.context = 'category-search';
        ChatBot.state.lastSearchResults = matches;
        
        let response = `🔍 J'ai trouvé ${matches.length} événements :\n\n`;
        matches.slice(0, 5).forEach((e, i) => {
            response += `${i + 1}. **${e.title}**\n`;
        });
        response += "\nDites-moi son numéro pour voir les détails !";
        return response;
    },

    // ==========================================
    // 9. INTERFACE UTILISATEUR AMÉLIORÉE
    // ==========================================
    appendMessage(sender, text) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const div = document.createElement('div');
        div.className = `mb-3 ${sender === 'user' ? 'text-end' : 'text-start'}`;
        
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        if (sender === 'user') {
            div.innerHTML = `
                <div class="d-inline-block bg-primary text-white p-3 px-4" 
                     style="border-radius: 18px 18px 4px 18px; max-width: 85%; font-size: 0.9rem; line-height: 1.5;">
                    ${escapeHtml(text)}
                </div>
                <div class="text-muted small mt-1">${time}</div>
            `;
        } else {
            div.innerHTML = `
                <div class="d-flex align-items-start gap-2">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" 
                         style="width: 32px; height: 32px; font-size: 0.8rem;">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div>
                        <div class="bg-light text-dark p-3 px-4 shadow-sm" 
                             style="border-radius: 18px 18px 18px 4px; max-width: 85%; font-size: 0.9rem; line-height: 1.6; white-space: pre-line;">
                            ${ChatBot.formatBotMessage(text)}
                        </div>
                        <div class="text-muted small mt-1">${time}</div>
                    </div>
                </div>
            `;
        }
        
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    formatBotMessage(text) {
        // Convertir un Markdown simple en HTML
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary text-decoration-underline" onclick="event.preventDefault(); $2">$1</a>');
    },

    appendActionButton(text, onclick) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const div = document.createElement('div');
        div.className = 'mb-3 text-start ms-4';
        div.innerHTML = `
            <button class="btn btn-success btn-sm rounded-pill px-4 py-2 shadow-sm" 
                    onclick="${onclick}; this.parentElement.remove();">
                ${text}
            </button>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    appendQuickReplies(replies) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const container = document.createElement('div');
        container.className = 'd-flex flex-wrap gap-2 mb-3 ms-4';
        container.id = 'quick-replies-container';
        
        replies.forEach(reply => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary btn-sm rounded-pill px-3 py-1';
            btn.innerHTML = `<i class="fas ${reply.icon} me-1"></i>${reply.text}`;
            btn.onclick = () => {
                container.remove();
                const queryMap = {
                    'freeEvents': 'Événements gratuits',
                    'howToBook': 'Comment réserver',
                    'myBookings': 'Mes réservations',
                    'contact': 'Contact',
                    'events': 'Quels sont les événements'
                };
                ChatBot.processMessage(queryMap[reply.action] || reply.text);
            };
            container.appendChild(btn);
        });
        
        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    // ==========================================
    // 10. INDICATEUR DE FRAPPE
    // ==========================================
    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const div = document.createElement('div');
        div.id = 'typing-indicator';
        div.className = 'mb-3 text-start';
        div.innerHTML = `
            <div class="d-flex align-items-start gap-2">
                <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" 
                     style="width: 32px; height: 32px; font-size: 0.8rem;">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="bg-light p-3 px-4 shadow-sm" style="border-radius: 18px 18px 18px 4px;">
                    <div class="d-flex gap-1">
                        <span class="bg-secondary rounded-circle" style="width:8px;height:8px;animation:typingBounce 1s infinite;"></span>
                        <span class="bg-secondary rounded-circle" style="width:8px;height:8px;animation:typingBounce 1s infinite 0.2s;"></span>
                        <span class="bg-secondary rounded-circle" style="width:8px;height:8px;animation:typingBounce 1s infinite 0.4s;"></span>
                    </div>
                </div>
            </div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    },

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    },

    // ==========================================
    // 11. SUGGESTIONS PENDANT LA FRAPPE
    // ==========================================
    showSuggestions(input) {
        ChatBot.hideSuggestions();
        
        if (input.length < 2) return;
        
        const suggestions = [
            { text: 'Les événements disponibles', query: 'Quels sont les événements' },
            { text: 'Événements gratuits', query: 'Événements gratuits' },
            { text: 'Comment réserver ?', query: 'Comment réserver' },
            { text: 'Mes réservations', query: 'Mes réservations' },
            { text: 'Prix des billets', query: 'Quel est le prix' },
            { text: 'Lieu des événements', query: 'Où se déroulent les événements' },
            { text: 'Nous contacter', query: 'Contact' }
        ].filter(s => s.text.toLowerCase().includes(input.toLowerCase()) || s.query.toLowerCase().includes(input.toLowerCase()));
        
        if (suggestions.length === 0) return;
        
        const chatInput = document.getElementById('chat-input');
        const container = document.createElement('div');
        container.id = 'chat-suggestions';
        container.className = 'position-absolute bg-white border rounded-3 shadow-lg overflow-hidden';
        container.style.cssText = `bottom: 100%; left: 10px; right: 10px; z-index: 10; max-height: 150px; overflow-y: auto;`;
        
        suggestions.slice(0, 4).forEach(s => {
            const item = document.createElement('div');
            item.className = 'p-2 px-3 text-start small';
            item.style.cssText = 'cursor: pointer;';
            item.onmouseover = () => item.style.background = '#f0f0f0';
            item.onmouseout = () => item.style.background = 'white';
            item.textContent = s.text;
            item.onclick = () => {
                chatInput.value = s.query;
                ChatBot.hideSuggestions();
            };
            container.appendChild(item);
        });
        
        chatInput.parentElement.style.position = 'relative';
        chatInput.parentElement.appendChild(container);
    },

    hideSuggestions() {
        const el = document.getElementById('chat-suggestions');
        if (el) el.remove();
    },

    // ==========================================
    // 12. MESSAGE DE BIENVENUE
    // ==========================================
    sendWelcomeMessage() {
        const user = getCurrentUser();
        const name = user?.name || '';
        
        let welcome = name ? `Bonjour ${name} ! 👋` : "Bonjour ! 👋";
        welcome += "\n\nJe suis l'assistant virtuel EventHub Fès 🤖\nVous pouvez me demander :";
        
        ChatBot.appendMessage('bot', welcome);
        
        setTimeout(() => {
            ChatBot.appendQuickReplies(ChatBot.quickReplies);
        }, 300);
    }
};

// ==========================================
// CSS REQUIS
// ==========================================
(function injectChatStyles() {
    if (!document.getElementById('chatbot-styles')) {
        const style = document.createElement('style');
        style.id = 'chatbot-styles';
        style.textContent = `
            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-5px); }
            }
            
            #chat-window {
                position: fixed;
                bottom: 90px;
                right: 25px;
                width: 380px;
                height: 500px;
                z-index: 9999;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            @media (max-width: 480px) {
                #chat-window {
                    width: calc(100% - 20px);
                    right: 10px;
                    bottom: 80px;
                    height: 70vh;
                }
            }
            
            #chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                background: #f8f9fa;
            }
            
            #chat-toggle {
                position: fixed;
                bottom: 25px;
                right: 25px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                z-index: 9998;
                border: none;
                font-size: 1.5rem;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            
            #chat-toggle:hover {
                transform: scale(1.1);
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            }
            
            #chat-form {
                padding: 10px 15px;
                background: white;
                border-top: 1px solid #eee;
            }
            
            #chat-input {
                border: 2px solid #e0e0e0;
                border-radius: 25px;
                padding: 10px 20px;
                transition: border-color 0.3s;
            }
            
            #chat-input:focus {
                border-color: #0d6efd;
                outline: none;
            }
            
            .chat-header {
                background: linear-gradient(135deg, #0d6efd, #6610f2);
                color: white;
                padding: 15px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .chat-header .online-dot {
                width: 10px;
                height: 10px;
                background: #198754;
                border-radius: 50%;
                display: inline-block;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
})();

// ==========================================
// HTML REQUIS (À ajouter dans vos pages HTML)
// ==========================================
/*
<!-- Bouton d'ouverture du chat -->
<button id="chat-toggle" class="btn btn-primary shadow-lg">
    <i class="fas fa-comments"></i>
</button>

<!-- Fenêtre de chat -->
<div id="chat-window" class="d-none bg-white">
    <div class="chat-header">
        <div class="position-relative">
            <div class="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;">
                <i class="fas fa-robot fs-5"></i>
            </div>
            <span class="online-dot position-absolute" style="bottom:0;right:0;border:2px solid white;"></span>
        </div>
        <div>
            <h6 class="mb-0 fw-bold">Assistant EventHub</h6>
            <small class="opacity-75">En ligne • Fès</small>
        </div>
        <button class="btn btn-sm btn-outline-light ms-auto rounded-circle" onclick="document.getElementById('chat-window').classList.add('d-none')">
            <i class="fas fa-times"></i>
        </button>
    </div>
    
    <div id="chat-messages"></div>
    
    <form id="chat-form" class="d-flex gap-2">
        <input type="text" id="chat-input" class="form-control flex-grow-1" placeholder="Écrivez votre message..." autocomplete="off">
        <button type="submit" class="btn btn-primary rounded-circle" style="width:45px;height:45px;">
            <i class="fas fa-paper-plane"></i>
        </button>
    </form>
</div>
*/

// ==========================================
// Remplacement de l'ancien initChatBot
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    ChatBot.init();
});

// ==========================================
// 16. MODE NUIT & UI PRO
// ==========================================
function initDarkMode() { if (localStorage.getItem('darkMode') === 'true') document.documentElement.setAttribute('data-bs-theme', 'dark'); }
function toggleDarkMode() { const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark'; document.documentElement.setAttribute('data-bs-theme', isDark ? 'light' : 'dark'); localStorage.setItem('darkMode', !isDark); }

function showToast(message, type = 'success') {
    let container = document.getElementById('ehub-toast-container'); if (!container) { container = document.createElement('div'); container.id = 'ehub-toast-container'; container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;'; document.body.appendChild(container); }
    const bgColor = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary'; const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    const toast = document.createElement('div'); toast.className = `${bgColor} text-white px-4 py-3 rounded-4 shadow-lg d-flex align-items-center gap-2`; toast.style.cssText = 'animation: slideInRight 0.3s ease-out; min-width: 250px;'; toast.innerHTML = `<i class="fas ${icon}"></i><span class="fw-bold small">${message}</span>`;
    container.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function initScrollToTop() {
    const btn = document.createElement('button'); btn.id = 'scroll-to-top-btn'; btn.innerHTML = '<i class="fas fa-chevron-up"></i>'; btn.className = 'btn btn-primary shadow-lg rounded-circle'; btn.style.cssText = 'position: fixed; bottom: 30px; left: 30px; width: 50px; height: 50px; display: none; z-index: 9998; transition: opacity 0.3s;'; btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' }); document.body.appendChild(btn);
    window.addEventListener('scroll', () => { if (window.scrollY > 400) { btn.style.display = 'flex'; btn.style.justifyContent = 'center'; btn.style.alignItems = 'center'; } else { btn.style.display = 'none'; } });
}

document.addEventListener("DOMContentLoaded", () => { initDarkMode(); initScrollToTop(); });


// ==========================================
// 18. SYSTEME DE NOTIFICATIONS (BELL)
// ==========================================
let notificationsInterval = null;

function initNotifications() {
    if (!isLoggedIn()) return;
    
    // إظهار حاوية الإشعارات وإخفاء أزرار الضيف
    const wrapper = document.getElementById('notifications-wrapper');
    const guestBtns = document.querySelectorAll('.auth-guest-btn');
    if(wrapper) wrapper.style.display = 'block';
    guestBtns.forEach(btn => btn.style.display = 'none');

    loadNotifications(); // تحميلها فوراً
    
    // تحديث الإشعارات كل 60 ثانية (بدون إرهاق السيرفر)
    if (notificationsInterval) clearInterval(notificationsInterval);
    notificationsInterval = setInterval(loadNotifications, 60000);
}

async function loadNotifications() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch('http://127.0.0.1:8000/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (!res.ok) return;
        const result = await res.json();
        
        const list = document.getElementById('notifications-list');
        const badge = document.getElementById('notif-badge');
        
        if (!list) return;

        // تحديث الرقم على الجرس
        const unreadCount = result.unread_count || 0;
        if (badge) {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        // عرض القائمة
        if (result.data.length === 0) {
            list.innerHTML = '<li class="text-center text-muted p-4 small">Aucune notification</li>';
            return;
        }

        list.innerHTML = result.data.map(notif => {
            const data = notif.data;
            const isUnread = notif.read_at === null;
            const bgClass = isUnread ? 'bg-light' : '';
            const fwClass = isUnread ? 'fw-bold' : '';
            const iconColor = data.color === 'success' ? 'text-success' : 'text-primary';
            const timeAgo = getTimeAgo(notif.created_at);

            return `
                <li class="dropdown-item d-flex align-items-start gap-3 p-3 border-bottom ${bgClass} cursor-pointer" onclick="markNotificationRead(${notif.id}, this)">
                    <i class="fas ${data.icon || 'fa-info-circle'} ${iconColor} mt-1"></i>
                    <div class="flex-grow-1">
                        <p class="mb-1 small ${fwClass}">${data.message || 'Nouvelle activité'}</p>
                        <span class="text-muted" style="font-size: 0.7rem;">${timeAgo}</span>
                    </div>
                    ${isUnread ? '<span class="bg-primary rounded-circle" style="width: 8px; height: 8px; margin-top: 8px;"></span>' : ''}
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error("Erreur notifications:", err);
    }
}

async function markNotificationRead(id, element) {
    const token = getToken();
    try {
        await fetch(`http://127.0.0.1:8000/api/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // تحديث الشكل فوراً بدون إعادة تحميل كل شيء
        if (element) {
            element.classList.remove('bg-light');
            element.querySelector('.fw-bold')?.classList.remove('fw-bold');
            const dot = element.querySelector('.bg-primary.rounded-circle');
            if(dot) dot.remove();
        }
        
        // تقليل رقم الجرس بـ 1
        const badge = document.getElementById('notif-badge');
        if (badge && parseInt(badge.innerText) > 0) {
            let count = parseInt(badge.innerText) - 1;
            badge.innerText = count;
            if (count === 0) badge.style.display = 'none';
        }
    } catch (err) {}
}

// دالة مساعدة لتحويل التاريخ إلى "منذ 5 دقائق"
function getTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} j`;
}

// تعديل دالة initAuthUI لكي تستدعي الإشعارات عند تسجيل الدخول
const originalInitAuthUI = initAuthUI;
initAuthUI = function() {
    originalInitAuthUI();
    initNotifications();
};


// ==========================================
// FIX: MODALES CONNEXION / INSCRIPTION + REGISTER
// ==========================================

function showLoginModal() {
    const choiceModal = document.getElementById('authChoiceModal');
    if (choiceModal) {
        const instance = bootstrap.Modal.getInstance(choiceModal);
        if (instance) instance.hide();
    }
    setTimeout(() => {
        const loginEl = document.getElementById('loginModal');
        if (loginEl) {
            bootstrap.Modal.getOrCreateInstance(loginEl).show();
        } else if (choiceModal) {
            const loginTab = document.getElementById('login-tab');
            if (loginTab) new bootstrap.Tab(loginTab).show();
            bootstrap.Modal.getOrCreateInstance(choiceModal).show();
        }
    }, 300);
}

function showRegisterModal() {
    const choiceModal = document.getElementById('authChoiceModal');
    if (choiceModal) {
        const instance = bootstrap.Modal.getInstance(choiceModal);
        if (instance) instance.hide();
    }
    setTimeout(() => {
        const registerEl = document.getElementById('registerModal');
        if (registerEl) {
            bootstrap.Modal.getOrCreateInstance(registerEl).show();
        } else if (choiceModal) {
            const registerTab = document.getElementById('register-tab');
            if (registerTab) new bootstrap.Tab(registerTab).show();
            bootstrap.Modal.getOrCreateInstance(choiceModal).show();
        }
    }, 300);
}



function setupRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const password_confirmation = document.getElementById('register-password-confirm') ? document.getElementById('register-password-confirm').value : password;

        if (!name || !email || !password) {
            Swal.fire('Erreur', 'Veuillez remplir tous les champs.', 'error');
            return;
        }
        if (password !== password_confirmation) {
            Swal.fire('Erreur', 'Les mots de passe ne correspondent pas.', 'error');
            return;
        }
        if (password.length < 6) {
            Swal.fire('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ name, email, password, password_confirmation })
            });

            const data = await response.json();

            if (response.ok && (data.success || data.token)) {
                if (data.data && data.data.token && data.data.user) {
                    setCurrentUser(data.data.user, data.data.token);
                } else if (data.token && data.user) {
                    setCurrentUser(data.user, data.token);
                }

                const regModal = document.getElementById('registerModal');
                if (regModal) { const inst = bootstrap.Modal.getInstance(regModal); if (inst) inst.hide(); }

                Swal.fire({ icon: 'success', title: 'Bienvenue !', text: 'Compte créé avec succès.' }).then(() => location.reload());
            } else {
                let errorMsg = 'Erreur lors de l\'inscription.';
                if (data.message) errorMsg = data.message;
                else if (data.errors) {
                    errorMsg = typeof data.errors === 'object' ? Object.values(data.errors).flat().join('\n') : data.errors;
                }
                Swal.fire('Erreur', errorMsg, 'error');
            }
        } catch (error) {
            console.error('Erreur inscription:', error);
            Swal.fire('Erreur Serveur', 'Impossible de contacter le serveur.', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupRegisterForm();

        document.querySelectorAll('.btn-connexion, [data-auth-action="login"], .go-to-login').forEach(btn => {
            btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showLoginModal(); });
        });
        document.querySelectorAll('.btn-inscription, [data-auth-action="register"], .go-to-register').forEach(btn => {
            btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showRegisterModal(); });
        });
    }, 1000);
});

window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;

// ==========================================
// 17. EXPOSITION GLOBALE
// ==========================================
window.filterByCategory = filterByCategory;
window.openDetails = openDetails;
window.bookNow = bookNow;
window.logout = logout;
window.changePage = changePage;
window.applyAllFilters = applyAllFilters;
window.deleteUser = deleteUser;
window.toggleFavorite = toggleFavorite;
window.addToGoogleCalendar = addToGoogleCalendar;
window.toggleDarkMode = toggleDarkMode;