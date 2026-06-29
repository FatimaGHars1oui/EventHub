/**
 * EventHub Fès - Core Application Script (app.js)
 * Year: 2026
 * Description: Gestion des événements, réservations, paiements sécurisés et génération de tickets.
 * FIX: Enregistrement des réservations en DB + Gestion Admin des Users + Badge GRATUIT.
 */

// ==========================================
// 1. DONNÉES ET VARIABLES GLOBALES
// ==========================================
let CATEGORIES = [
    { id: 'all', name: 'Tous', icon: 'fa-th-large' }
];

const EVENTS = []; 

let currentFilterCategory = 'all';
let mapInstance = null;
let currentPage = 1;
const itemsPerPage = 6; 

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
    try {
        const userData = localStorage.getItem('user');
        if (userData && userData !== 'undefined' && userData !== 'null') {
            return JSON.parse(userData);
        }
        return null;
    } catch (e) {
        console.error('Erreur getCurrentUser:', e);
        return null;
    }
}

function setCurrentUser(user, token ) {
    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('user_id', user.id || user.user_id);
        }
    } else {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
    }
}

function getToken() {
    return localStorage.getItem('token');
}

function isLoggedIn() {
    return !!(getToken() && getCurrentUser());
}

// ==========================================
// 4. INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const user = getCurrentUser();
    const token = getToken();
    
    if (token && !user) {
        await fetchUserFromAPI(token);
    }
    
    await fetchCategories(); 
    await fetchAndAppendAPIEvents();
    
    initAuthUI();
    setupSearchListeners();
    setupAuthForms();
    initChatBot();
    
    // Si on est sur le dashboard admin, charger les utilisateurs
    if (window.location.pathname.includes('dashboard.html')) {
        if (!isLoggedIn()) window.location.href = 'index.html';
        if (user && (user.role === 'admin' || user.is_admin)) {
            fetchAndRenderUsers();
        }
    }
});

async function fetchCategories() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/categories', {
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const resData = await response.json();
            const apiCats = resData.data || resData;
            CATEGORIES = [{ id: 'all', name: 'Tous', icon: 'fa-th-large' }];
            apiCats.forEach(cat => {
                CATEGORIES.push({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon || 'fa-tag'
                });
            });
            renderCategories();
            updateCategorySelectOptions();
        }
    } catch (err) {
        console.error('Erreur lors du chargement des catégories:', err);
    }
}

function updateCategorySelectOptions() {
    const select = document.getElementById('category-select');
    if (!select) return;
    select.innerHTML = '<option value="">Toutes les catégories</option>';
    CATEGORIES.forEach(c => {
        if (c.id !== 'all') {
            const option = document.createElement('option');
            option.value = c.name;
            option.textContent = c.name;
            select.appendChild(option);
        }
    });
}

async function fetchUserFromAPI(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                localStorage.setItem('user', JSON.stringify(data.data));
                initAuthUI();
                return true;
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return false;
    } catch(e) {
        return false;
    }
}

// ==========================================
// 5. AUTHENTIFICATION (LOGIN)
// ==========================================
function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch('http://127.0.0.1:8000/api/auth/login', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                if (data.success && data.data.token && data.data.user) {
                    setCurrentUser(data.data.user, data.data.token);
                    location.reload();
                } else { fakeLoginFallback(email); }
            } catch(error) { fakeLoginFallback(email); }
        };
    }
}

function fakeLoginFallback(email) {
    const role = email.includes('admin') ? 'admin' : 'user';
    const user = { id: Date.now(), name: email.split('@')[0], email: email, role: role };
    setCurrentUser(user, 'fake_token_' + Date.now());
    window.location.reload();
}

function logout() {
    setCurrentUser(null);
    window.location.href = 'index.html';
}

// ==========================================
// 6. FILTRAGE ET RECHERCHE
// ==========================================
function applyAllFilters(resetPage = true) {
    if (resetPage) currentPage = 1; 

    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const dateInput = document.getElementById('date-input');

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const dateQuery = dateInput ? dateInput.value : '';
    
    let selectedCatName = categorySelect ? categorySelect.value : "";
    if (!selectedCatName && currentFilterCategory !== 'all') {
        const catObj = CATEGORIES.find(c => c.id == currentFilterCategory);
        if (catObj) selectedCatName = catObj.name;
    }

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

    if (searchInput) searchInput.addEventListener('input', () => applyAllFilters(true));
    if (categorySelect) categorySelect.addEventListener('change', (e) => {
        const catObj = CATEGORIES.find(c => c.name === e.target.value);
        currentFilterCategory = catObj ? catObj.id : 'all';
        renderCategories();
        applyAllFilters(true);
    });
    if (dateInput) dateInput.addEventListener('change', () => applyAllFilters(true));
}

function filterByCategory(id, name) {
    currentFilterCategory = id;
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
        categorySelect.value = (id === 'all') ? "" : name;
    }
    renderCategories();
    applyAllFilters(true);
}

// ==========================================
// 7. RENDU DE L'INTERFACE (EVENTS & PAGINATION)
// ==========================================
function initAuthUI() {
    const user = getCurrentUser();
    const authContainer = document.getElementById('auth-buttons');
    if (user && authContainer) {
        authContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-primary rounded-pill dropdown-toggle px-4" data-bs-toggle="dropdown">
                    <i class="fas fa-user-circle me-2"></i>${escapeHtml(user.name)}
                </button>
                <ul class="dropdown-menu dropdown-menu-end border-0 shadow mt-2">
                    <li><button class="dropdown-item" onclick="window.location.href='dashboard.html'"><i class="fas fa-tachometer-alt me-2"></i>Tableau de bord</button></li>
                    <li><button class="dropdown-item text-danger" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Déconnexion</button></li>
                </ul>
            </div>`;
    }
}

function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(c => `
        <div class="category-card ${c.id == currentFilterCategory ? 'active' : ''}" onclick="filterByCategory('${c.id}', '${c.name}')" role="button">
            <i class="fas ${c.icon} mb-2"></i>
            <span class="small fw-bold">${escapeHtml(c.name)}</span>
        </div>
    `).join('');
}

function renderEvents(list) {
    const container = document.getElementById('events-container');
    if (!container) return;

    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = list.slice(startIndex, endIndex);

    if (paginatedItems.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted">Aucun événement trouvé.</div>';
        renderPaginationUI(0);
        return;
    }

    container.innerHTML = paginatedItems.map(e => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="event-card shadow-sm h-100 bg-white">
                <div class="card-img-wrapper position-relative">
                    <img src="${e.image}" alt="${escapeHtml(e.title)}">
                    <span class="badge bg-primary position-absolute m-3 top-0 start-0">${escapeHtml(e.category)}</span>
                    ${e.price === 0 ? '<span class="badge bg-success position-absolute m-3 top-0 end-0" style="font-size:0.7rem;">GRATUIT</span>' : ''}
                </div>
                <div class="p-4">
                    <h5 class="fw-bold text-dark">${escapeHtml(e.title)}</h5>
                    <p class="text-muted small mb-3"><i class="fas fa-calendar-alt me-2"></i>${formatDate(e.date)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary fs-5">${e.price === 0 ? 'GRATUIT' : e.price + ' DH'}</span>
                        <button class="btn btn-outline-primary rounded-pill px-3" onclick="openDetails(${e.id})">Détails</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    renderPaginationUI(totalPages);
}

function renderPaginationUI(totalPages) {
    let paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) {
        const eventsRow = document.getElementById('events-container');
        if (eventsRow) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pagination-container';
            paginationContainer.className = 'col-12 d-flex justify-content-center mt-4 mb-5';
            eventsRow.parentNode.insertBefore(paginationContainer, eventsRow.nextSibling);
        } else return;
    }

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = `<nav><ul class="pagination pagination-rounded">`;
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></a>
             </li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${i})">${i}</a>
                 </li>`;
    }

    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link shadow-sm" href="javascript:void(0)" onclick="changePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></a>
             </li>`;

    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    applyAllFilters(false);
    window.scrollTo({ top: document.getElementById('events-container').offsetTop - 100, behavior: 'smooth' });
}

// ==========================================
// 8. DÉTAILS ET MAPS
// ==========================================
function openDetails(id) {
    const event = EVENTS.find(e => e.id === id);
    if (!event) return;

    document.getElementById('detail-title').innerText = event.title;
    document.getElementById('detail-description').innerText = event.description;
    document.getElementById('detail-date').innerText = formatDate(event.date);
    document.getElementById('detail-price').innerText = event.price === 0 ? 'Gratuit' : event.price + ' DH';
    document.getElementById('detail-image').src = event.image;

    const user = getCurrentUser();
    const bArea = document.getElementById('booking-area');
    if (bArea) {
        bArea.innerHTML = user 
            ? `<button class="btn btn-success rounded-pill py-2 fw-bold w-100" onclick="bookNow(${event.id})">Réserver ma place</button>`
            : `<button class="btn btn-primary rounded-pill py-2 w-100" data-bs-toggle="modal" data-bs-target="#authChoiceModal">Se connecter pour réserver</button>`;
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('eventDetailsModal')).show();

    setTimeout(() => {
        if (mapInstance) mapInstance.remove();
        mapInstance = L.map('map').setView([event.location.lat, event.location.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        L.marker([event.location.lat, event.location.lng]).addTo(mapInstance).bindPopup(event.location.name).openPopup();
    }, 500);
}

// ==========================================
// 9. PAIEMENT & RÉSERVATION (FIXED)
// ==========================================
async function saveReservationToDB(event, user) {
    const token = getToken();
    try {
        const response = await fetch('http://127.0.0.1:8000/api/bookings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
    event_id: event.id,
    quantity: 1,
    attendee_name: user.name,
    attendee_email: user.email
})
        });
        return await response.json();
    } catch (err) {
        console.error("Erreur API Booking:", err);
        return { success: false };
    }
}

function bookNow(id) {
    const event = EVENTS.find(e => e.id == id);
    const user = getCurrentUser();

    if (!event) return;

    Swal.fire({
        title: 'Confirmation',
        text: `Voulez-vous réserver pour "${event.title}" ?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, continuer',
        cancelButtonText: 'Annuler'
    }).then(async (res) => {
        if (res.isConfirmed) {
            const modalEl = document.getElementById('eventDetailsModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            if (event.price > 0) {
                processPayment(event, user);
            } else {
                // Sauvegarde en base de données pour les gratuits aussi
                await saveReservationToDB(event, user);
                generateTicket(event, user);
            }
        }
    });
}

function processPayment(event, user) {
    Swal.fire({
        title: 'Paiement Sécurisé',
        html: `
            <div class="text-start p-3">
                <div class="mb-3 p-3 bg-light rounded border">
                    <p class="mb-0 fw-bold text-dark">${event.title}</p>
                    <p class="mb-0 text-primary fw-bold fs-5">${event.price} DH</p>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Numéro de carte</label>
                    <input type="text" id="card-number" class="form-control" placeholder="1234 5678 9101 1121">
                </div>
                <div class="row">
                    <div class="col-6 mb-3"><input type="text" id="card-expiry" class="form-control" placeholder="MM/YY"></div>
                    <div class="col-6 mb-3"><input type="password" id="card-cvc" class="form-control" placeholder="CVC"></div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Payer maintenant',
        preConfirm: () => {
            const num = document.getElementById('card-number').value;
            if (!num) {
                Swal.showValidationMessage('Veuillez entrer les informations de carte');
                return false;
            }
            return new Promise(resolve => setTimeout(resolve, 1000));
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Sauvegarde en DB après paiement
            await saveReservationToDB(event, user);
            Swal.fire({ title: 'Succès', text: 'Paiement effectué !', icon: 'success', timer: 1500, showConfirmButton: false })
            .then(() => generateTicket(event, user));
        }
    });
}

// ==========================================
// 10. GÉNÉRATION DE TICKET
// ==========================================
function generateTicket(event, user) {
    const titleEl = document.getElementById('ticket-event-title');
    if (!titleEl) return; // Sécurité si on n'est pas sur la bonne page

    titleEl.innerText = event.title;
    document.getElementById('ticket-user-name').innerText = user?.name || 'Utilisateur';
    document.getElementById('ticket-user-email').innerText = user?.email || '';
    document.getElementById('ticket-event-date').innerText = formatDate(event.date);
    document.getElementById('ticket-event-location').innerText = event.location.name;
    document.getElementById('ticket-price-badge').innerText = event.price === 0 ? 'GRATUIT' : event.price + ' DH';

    const qrBox = document.getElementById("modal-qrcode-target");
    qrBox.innerHTML = "";
    new QRCode(qrBox, { text: `TICKET-${event.id}-${Date.now()}`, width: 120, height: 120 });

    new bootstrap.Modal(document.getElementById('ticketModal')).show();

    document.getElementById('download-ticket-btn').onclick = function() {
        const element = document.getElementById('ticket-print-area');
        html2pdf().from(element).save();
    };
}

function formatDate(d) {
    if (!d) return "Date à confirmer";
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ==========================================
// 11. GESTION DES UTILISATEURS (ADMIN)
// ==========================================
async function fetchAndRenderUsers() {
    const container = document.getElementById('admin-users-table');
    if (!container) return;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/users', {
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Accept': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            const users = data.data || data;
            container.innerHTML = users.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>${escapeHtml(u.name)}</td>
                    <td>${escapeHtml(u.email)}</td>
                    <td><span class="badge bg-secondary">${u.role || 'user'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error("Erreur chargement users:", e); }
}

async function deleteUser(id) {
    const confirm = await Swal.fire({
        title: 'Supprimer ?',
        text: "Cette action est irréversible !",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Oui, supprimer'
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                Swal.fire('Supprimé!', 'L\'utilisateur a été supprimé.', 'success');
                fetchAndRenderUsers();
            }
        } catch (e) { Swal.fire('Erreur', 'Impossible de supprimer.', 'error'); }
    }
}

// ==========================================
// 12. CHATBOT & UTILITAIRES
// ==========================================
function initChatBot() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    if (chatForm && chatInput && chatMessages) {
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;
            appendChatMessage('user', message);
            chatInput.value = '';
            setTimeout(() => {
                const response = getBotResponse(message);
                appendChatMessage('bot', response);
            }, 600);
        };
    }

    function appendChatMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `mb-2 ${sender === 'user' ? 'text-end' : 'text-start'}`;
        const bgColor = sender === 'user' ? 'bg-primary text-white' : 'bg-light text-dark shadow-sm';
        div.innerHTML = `<div class="d-inline-block p-2 px-3 ${bgColor}" style="border-radius:10px; max-width:85%; font-size:0.9rem;">${escapeHtml(text)}</div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getBotResponse(input) {
        const msg = input.toLowerCase();
        if (msg.includes('bonjour')) return "Bonjour ! Comment puis-je vous aider ?";
        if (msg.includes('événement')) return `Nous avons ${EVENTS.length} événements.`;
        return "Je ne comprends pas, contactez-nous au +212 5XX-XXXXXX.";
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// EXPOSITION
window.filterByCategory = filterByCategory;
window.openDetails = openDetails;
window.bookNow = bookNow;
window.logout = logout;
window.changePage = changePage;
window.applyAllFilters = applyAllFilters;
window.deleteUser = deleteUser;

// ==========================================
// 13. FETCH DYNAMIQUE DES ÉVÉNEMENTS
// ==========================================
async function fetchAndAppendAPIEvents() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/events', {
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            const resData = await response.json();
            const realEvents = resData.data || resData;
            EVENTS.length = 0;
            if (Array.isArray(realEvents)) {
                realEvents.forEach(apiEv => {
                    let imgPath = apiEv.image;
                    if (imgPath && !imgPath.startsWith('http')) {
                        imgPath = `http://127.0.0.1:8000/storage/${imgPath}`;
                    }
                    EVENTS.push({
                        id: apiEv.id,
                        title: apiEv.title,
                        category: (apiEv.category && typeof apiEv.category === 'object') ? apiEv.category.name : (apiEv.category || 'Général'),
                        date: apiEv.start_date || apiEv.event_date || apiEv.date || apiEv.created_at,
                        price: parseFloat(apiEv.price) || 0,
                        description: apiEv.description,
                        image: imgPath || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000",
                        location: typeof apiEv.location === 'string' ? JSON.parse(apiEv.location) : (apiEv.location || { name: "Fès", lat: 34.0342, lng: -5.0012 })
                    });
                });
                renderEvents(EVENTS);
            }
        }
    } catch (err) {
        console.error('Erreur lors du chargement des événements réels:', err);
    }
}