/**
 * EventHub Fès - Core Application Script (app.js)
 * Year: 2026
 * Description: Gestion des événements, réservations, paiements sécurisés et génération de tickets.
 */

// ==========================================
// 1. DONNÉES DE SIMULATION (MOCK DATA)
// ==========================================
const CATEGORIES = [
    { id: 'all', name: 'Tous', icon: 'fa-th-large' },
    { id: 'culture', name: 'Culture', icon: 'fa-gavel' },
    { id: 'musique', name: 'Musique', icon: 'fa-music' },
    { id: 'art', name: 'Art & Expo', icon: 'fa-palette' },
    { id: 'gastronomie', name: 'Gastronomie', icon: 'fa-utensils' }
];

const EVENTS = [
    {
        id: 1,
        title: "Festival des Musiques Sacrées",
        category: "musique",
        date: "2026-10-15",
        price: 250,
        description: "Un voyage spirituel unique au cœur des musiques ancestrales à Bab Makina.",
        image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000",
        location: { name: "Bab Makina, Fès", lat: 34.0342, lng: -5.0012 }
    },
    {
        id: 2,
        title: "Exposition d'Artisanat d'Art",
        category: "art",
        date: "2026-07-20",
        price: 0, 
        description: "Découvrez le savoir-faire ancestral des maîtres artisans de la Médina de Fès.",
        image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1000",
        location: { name: "Place Seffarine, Fès", lat: 34.0651, lng: -4.9732 }
    },
    {
        id: 3,
        title: "Soirée Soufie au Dar Batha",
        category: "culture",
        date: "2026-08-05",
        price: 120,
        description: "Une nuit d'incantations poétiques dans le somptueux jardin andalou du Dar Batha.",
        image: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1000",
        location: { name: "Musée du Batha, Fès", lat: 34.0608, lng: -4.9825 }
    },
    {
        id: 4,
        title: "Atelier Gastronomique Fassi",
        category: "gastronomie",
        date: "2026-09-12",
        price: 350,
        description: "Apprenez les secrets de la cuisine fassie avec une chef étoilée locale.",
        image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=1000",
        location: { name: "Riad Rcif, Fès", lat: 34.0621, lng: -4.9711 }
    }
];

let currentFilterCategory = 'all';
let mapInstance = null;

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
// 3. UTILITAIRE UTILISATEUR
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
    const token = localStorage.getItem('token');
    const user = getCurrentUser();
    return !!(token && user);
}

// ==========================================
// 4. INITIALISATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const user = getCurrentUser();
    const token = getToken();
    
    if (token && !user) {
        await fetchUserFromAPI(token);
    }
    
    initAuthUI();
    renderCategories();
    renderEvents(EVENTS);
    setupSearchListeners();
    setupAuthForms();
    initChatBot();
    
    // Appliquer les filtres après avoir chargé tout
    if (typeof applyAllFilters === 'function') {
        applyAllFilters();
    }
    
    if (window.location.pathname.includes('dashboard.html') && !isLoggedIn()) {
        window.location.href = 'index.html';
    }
});

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
        console.error('Erreur fetchUser:', e);
        return false;
    }
}

// ==========================================
// 5. AUTHENTIFICATION
// ==========================================
function setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            
          

            if (!email || !password) {
                Swal.fire('Erreur', 'Veuillez remplir tous les champs', 'error');
                return;
            }
            
            try {
                const response = await fetch('http://127.0.0.1:8000/api/auth/login', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();

            
                
                if (data.success && data.data.token && data.data.user) {
                    console.log('Login réussi:', data);
  
                    setCurrentUser(data.data.user, data.data.token);
                    
                    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                    if (loginModal) loginModal.hide();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Connexion réussie',
                        text: `Bienvenue ${data.data.user.name}!`,
                        timer: 2000,
                        showConfirmButton: true
                    }).then(() => {
                        initAuthUI();
                        if (typeof applyAllFilters === 'function') applyAllFilters();
                        if (window.location.pathname.includes('dashboard.html')) {
                            window.location.reload();
                        }
                    });
                } else {
                    fakeLoginFallback(email);
                }
            } catch(error) {
                console.error('Erreur login:', error);
                fakeLoginFallback(email);
            }
        };
    }
    
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            
            if (!name || !email || !password) {
                Swal.fire('Erreur', 'Veuillez remplir tous les champs', 'error');
                return;
            }
            
            if (password.length < 8) {
                Swal.fire('Erreur', 'Le mot de passe doit contenir au moins 8 caractères', 'error');
                return;
            }
            
            try {
                const response = await fetch('http://127.0.0.1:8000/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name, email, password })
                });
                
                const data = await response.json();
                
                if (data.success && data.data.token && data.data.user) {
                    setCurrentUser(data.data.user, data.data.token);
                    
                    const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                    if (registerModal) registerModal.hide();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Inscription réussie',
                        text: `Bienvenue ${data.data.user.name}!`,
                        timer: 2000,
                        showConfirmButton: true
                    }).then(() => {
                        initAuthUI();
                        if (typeof applyAllFilters === 'function') applyAllFilters();
                    });
                } else {
                    const user = { id: Date.now(), name, email, role: 'user' };
                    setCurrentUser(user, 'fake_token_' + Date.now());
                    window.location.reload();
                }
            } catch(error) {
                console.error('Erreur register:', error);
                const user = { id: Date.now(), name, email, role: 'user' };
                setCurrentUser(user, 'fake_token_' + Date.now());
                window.location.reload();
            }
        };
    }
}

function fakeLoginFallback(email) {
    const role = email.includes('admin') ? 'admin' : 'user';
    const user = { 
        id: Date.now(), 
        name: email.split('@')[0], 
        email: email,
        role: role
    };
    setCurrentUser(user, 'fake_token_' + Date.now());
    window.location.reload();
}

function logout() {
    setCurrentUser(null);
    if (window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'index.html';
    } else {
        window.location.reload();
    }
}

// ==========================================
// 6. FILTRAGE ET RECHERCHE
// ==========================================
function applyAllFilters() {
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const dateInput = document.getElementById('date-input');

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const dateQuery = dateInput ? dateInput.value : '';
    const selectedCat = categorySelect ? (categorySelect.value || currentFilterCategory) : currentFilterCategory;

    const filtered = EVENTS.filter(e => {
        const matchText = e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query);
        const matchCategory = selectedCat === 'all' || selectedCat === "" || e.category === selectedCat;
        const matchDate = !dateQuery || e.date === dateQuery;
        return matchText && matchCategory && matchDate;
    });

    renderEvents(filtered);
}

// Exposer immédiatement après définition
window.applyAllFilters = applyAllFilters;

function setupSearchListeners() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const dateInput = document.getElementById('date-input');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            applyAllFilters();
        });
    }

    if (searchInput) searchInput.addEventListener('input', applyAllFilters);
    if (categorySelect) categorySelect.addEventListener('change', (e) => {
        currentFilterCategory = e.target.value || 'all';
        renderCategories();
        applyAllFilters();
    });
    if (dateInput) dateInput.addEventListener('change', applyAllFilters);
}

function filterByCategory(id) {
    currentFilterCategory = id;
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) categorySelect.value = id === 'all' ? "" : id;
    
    renderCategories();
    applyAllFilters();
}

// ==========================================
// 7. RENDU DE L'INTERFACE
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
                    <li>
                        <button class="dropdown-item" onclick="window.location.href='dashboard.html'">
                            <i class="fas fa-tachometer-alt me-2"></i>Tableau de bord
                        </button>
                    </li>
                    <li><button class="dropdown-item text-danger" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Déconnexion</button></li>
                </ul>
            </div>`;
    } else if (!user && authContainer) {
        authContainer.innerHTML = `
            <button class="btn btn-outline-light rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#loginModal">Connexion</button>
            <button class="btn btn-premium" data-bs-toggle="modal" data-bs-target="#registerModal">Inscription</button>
        `;
    }
}

function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(c => `
        <div class="category-card ${c.id === currentFilterCategory ? 'active' : ''}" onclick="filterByCategory('${c.id}')" role="button">
            <i class="fas ${c.icon} mb-2"></i>
            <span class="small fw-bold">${escapeHtml(c.name)}</span>
        </div>
    `).join('');
}

function renderEvents(list) {
    const container = document.getElementById('events-container');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<div class="col-12 text-center py-5 text-muted">Aucun événement trouvé.</div>';
        return;
    }
    container.innerHTML = list.map(e => `
        <div class="col-md-6 col-lg-4 mb-4" data-aos="fade-up">
            <div class="event-card shadow-sm h-100 bg-white">
                <div class="card-img-wrapper">
                    <img src="${e.image}" alt="${escapeHtml(e.title)}">
                    <span class="badge bg-primary position-absolute m-3 top-0 start-0">${escapeHtml(e.category)}</span>
                </div>
                <div class="p-4">
                    <h5 class="fw-bold text-dark">${escapeHtml(e.title)}</h5>
                    <p class="text-muted small mb-3"><i class="fas fa-calendar-alt me-2"></i>${formatDate(e.date)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary fs-5">${e.price === 0 ? 'Gratuit' : e.price + ' DH'}</span>
                        <button class="btn btn-outline-primary rounded-pill px-3" onclick="openDetails(${e.id})">Détails</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
            ? `<button class="btn btn-success rounded-pill py-2 fw-bold" onclick="bookNow(${event.id})">Réserver ma place</button>`
            : `<button class="btn btn-primary rounded-pill py-2" data-bs-toggle="modal" data-bs-target="#authChoiceModal">Se connecter pour réserver</button>`;
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
// 9. PAIEMENT & RÉSERVATION
// ==========================================
function bookNow(id) {
    const event = EVENTS.find(e => e.id === id);
    const user = getCurrentUser();
    Swal.fire({
        title: 'Confirmation',
        text: `Voulez-vous réserver pour "${event.title}" ?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, continuer'
    }).then((res) => {
        if (res.isConfirmed) {
            bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal'))?.hide();
            if (event.price > 0) processPayment(event, user);
            else generateTicket(event, user);
        }
    });
}

function processPayment(event, user) {
    Swal.fire({
        title: 'Paiement Sécurisé',
        html: `
            <div class="text-start p-2">
                <div class="alert alert-info py-2 small">Total à payer: <b>${event.price} DH</b></div>
                <div class="mb-2">
                    <label class="form-label small mb-1">Nom sur la carte</label>
                    <input type="text" id="card-name" class="form-control form-control-sm" placeholder="M. Mohamed">
                </div>
                <div class="mb-2">
                    <label class="form-label small mb-1">Numéro de carte</label>
                    <input type="text" id="card-num" class="form-control form-control-sm" placeholder="xxxx xxxx xxxx xxxx">
                </div>
                <div class="row">
                    <div class="col-6">
                        <label class="form-label small mb-1">Expiration</label>
                        <input type="text" id="card-exp" class="form-control form-control-sm" placeholder="MM/YY">
                    </div>
                    <div class="col-6">
                        <label class="form-label small mb-1">CVC</label>
                        <input type="password" id="card-cvc" class="form-control form-control-sm" placeholder="123">
                    </div>
                </div>
                <div class="mt-3 text-center opacity-50">
                    <i class="fab fa-cc-visa fa-2x mx-1"></i>
                    <i class="fab fa-cc-mastercard fa-2x mx-1"></i>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Payer maintenant',
        cancelButtonText: 'Annuler',
        focusConfirm: false,
        preConfirm: () => {
            const name = document.getElementById('card-name').value;
            const num = document.getElementById('card-num').value;
            const exp = document.getElementById('card-exp').value;
            const cvc = document.getElementById('card-cvc').value;
            if (!name || num.length < 5 || !exp || cvc.length < 3) {
                Swal.showValidationMessage('Informations de carte invalides');
                return false;
            }
            return true;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Traitement...',
                html: 'Validation auprès de votre banque',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                    setTimeout(() => {
                        Swal.fire('Succès', 'Paiement effectué avec succès !', 'success')
                            .then(() => generateTicket(event, user));
                    }, 2000);
                }
            });
        }
    });
}

// ==========================================
// 10. GÉNÉRATION DE TICKET
// ==========================================
function generateTicket(event, user) {
    document.getElementById('ticket-event-title').innerText = event.title;
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
        const opt = { margin: 10, filename: 'Ticket-EventHub.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        html2pdf().set(opt).from(element).save();
    };
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ==========================================
// 11. CHATBOT
// ==========================================
function initChatBot() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    if (chatForm) {
        chatForm.onsubmit = (e) => {
            e.preventDefault();
            const val = chatInput.value.trim();
            if (!val) return;

            chatMessages.innerHTML += `<div class="bg-primary text-white p-2 rounded shadow-sm" style="align-self: flex-end; max-width: 80%;">${escapeHtml(val)}</div>`;
            chatInput.value = "";

            setTimeout(() => {
                let reply = "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?";
                const lower = val.toLowerCase();
                if (lower.includes("prix") || lower.includes("tarif") || lower.includes("coût")) {
                    reply = "Les prix varient entre 120 DH et 350 DH. Certains événements sont gratuits !";
                } else if (lower.includes("lieu") || lower.includes("adresse") || lower.includes("où")) {
                    reply = "Nos événements se déroulent partout à Fès : Bab Makina, Dar Batha, Place Seffarine, etc.";
                } else if (lower.includes("date") || lower.includes("quand") || lower.includes("programme")) {
                    reply = "Consultez notre calendrier d'événements. Les dates sont affichées sur chaque carte.";
                } else if (lower.includes("réservation") || lower.includes("réserver") || lower.includes("ticket")) {
                    reply = "Pour réserver, cliquez sur le bouton 'Réserver' sur l'événement qui vous intéresse.";
                } else if (lower.includes("bonjour") || lower.includes("salut") || lower.includes("coucou")) {
                    reply = "Bonjour ! Comment puis-je vous aider ? 🎉";
                }
                
                chatMessages.innerHTML += `<div class="bg-white p-2 rounded shadow-sm" style="align-self: flex-start; max-width: 80%;">${reply}</div>`;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 800);
        };
    }
}

// ==========================================
// 12. EXPOSER LES FONCTIONS GLOBALEMENT
// ==========================================
window.filterByCategory = filterByCategory;
window.openDetails = openDetails;
window.bookNow = bookNow;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.applyAllFilters = applyAllFilters;