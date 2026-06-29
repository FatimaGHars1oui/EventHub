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
        authContainer.innerHTML = `<div class="dropdown"><button class="btn btn-primary rounded-pill dropdown-toggle px-4" data-bs-toggle="dropdown"><i class="fas fa-user-circle me-2"></i>${escapeHtml(user.name)}</button><ul class="dropdown-menu dropdown-menu-end border-0 shadow mt-2"><li><button class="dropdown-item" onclick="window.location.href='dashboard.html'"><i class="fas fa-tachometer-alt me-2"></i>Tableau de bord</button></li><li><button class="dropdown-item text-danger" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Déconnexion</button></li></ul></div>`;
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
// 12. GÉNÉRATION DE TICKET (QR Fix + Partage + Quantité)
// ==========================================
function generateTicket(event, user, quantity = 1) {
    const titleEl = document.getElementById('ticket-event-title'); if (!titleEl) return;
    const totalPrice = event.price * quantity;
    
    titleEl.innerText = event.title;
    document.getElementById('ticket-user-name').innerText = user?.name || 'Utilisateur';
    document.getElementById('ticket-user-email').innerText = user?.email || '';
    document.getElementById('ticket-event-date').innerText = formatDate(event.date);
    document.getElementById('ticket-event-location').innerText = event.location.name;
    
    // عرض السعر الإجمالي وعدد الأشخاص
    let priceText = totalPrice === 0 ? 'GRATUIT' : totalPrice + ' DH';
    if (quantity > 1) priceText += ` (${quantity} pers.)`;
    document.getElementById('ticket-price-badge').innerText = priceText;

    const qrBox = document.getElementById("modal-qrcode-target");
    qrBox.innerHTML = "";
    new QRCode(qrBox, { text: `TICKET-${event.id}-${user?.id}-${quantity}-${Date.now()}`, width: 120, height: 120 });

    new bootstrap.Modal(document.getElementById('ticketModal')).show();

    document.getElementById('download-ticket-btn').onclick = function() {
        const element = document.getElementById('ticket-print-area');
        const qrContainer = document.getElementById("modal-qrcode-target");
        const canvas = qrContainer.querySelector('canvas');
        const oldImg = qrContainer.querySelector('img');
        
        if (canvas) {
            const imgSrc = canvas.toDataURL('image/png');
            const tempImg = document.createElement('img');
            tempImg.src = imgSrc; tempImg.style.width = '120px'; tempImg.style.height = '120px'; tempImg.style.display = 'block'; tempImg.style.margin = 'auto';
            canvas.style.display = 'none'; if(oldImg) oldImg.style.display = 'none';
            qrContainer.appendChild(tempImg);
            html2pdf().from(element).save().finally(() => { canvas.style.display = 'block'; if(oldImg) oldImg.style.display = 'block'; tempImg.remove(); });
        } else { html2pdf().from(element).save(); }
    };

    const shareBtn = document.getElementById('share-ticket-btn');
    if (shareBtn) {
        shareBtn.onclick = function() {
            const text = `Je viens de réserver ${quantity} place(s) pour "${event.title}" via EventHub Fès ! Réservez vite.`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        };
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
function initChatBot() {
    const chatForm = document.getElementById('chat-form'); const chatInput = document.getElementById('chat-input'); const chatMessages = document.getElementById('chat-messages');
    if (chatForm && chatInput && chatMessages) {
        chatForm.onsubmit = (e) => { e.preventDefault(); const message = chatInput.value.trim(); if (!message) return; appendChatMessage('user', message); chatInput.value = ''; setTimeout(() => appendChatMessage('bot', getBotResponse(message)), 600); };
    }
    function appendChatMessage(sender, text) { const div = document.createElement('div'); div.className = `mb-2 ${sender === 'user' ? 'text-end' : 'text-start'}`; const bgColor = sender === 'user' ? 'bg-primary text-white' : 'bg-light text-dark shadow-sm'; div.innerHTML = `<div class="d-inline-block p-2 px-3 ${bgColor}" style="border-radius:10px; max-width:85%; font-size:0.9rem;">${escapeHtml(text)}</div>`; chatMessages.appendChild(div); chatMessages.scrollTop = chatMessages.scrollHeight; }
    function getBotResponse(input) { const msg = input.toLowerCase(); if (msg.includes('bonjour') || msg.includes('salam')) return "Bonjour ! Comment puis-je vous aider aujourd'hui ?"; if (msg.includes('événement') || msg.includes('event')) return `Nous avons actuellement ${EVENTS.length} événements disponibles.`; if (msg.includes('gratuit')) return "Oui, nous avons des événements gratuits !"; return "Pour une aide spécifique, contactez-nous au +212 5XX-XXXXXX."; }
}

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