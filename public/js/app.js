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
            sc.id = s.id; sc.src = s.src;
            document.head.appendChild(sc);
        }
    });
})();

// ==========================================
// 3. INITIALISATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initAuthUI();
    renderCategories();
    renderEvents(EVENTS);
    setupSearchListeners();
});

function initAuthUI() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const authContainer = document.getElementById('auth-buttons');
    if (user && authContainer) {
        authContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-primary rounded-pill dropdown-toggle px-4" data-bs-toggle="dropdown">
                    <i class="fas fa-user-circle me-2"></i>${user.name}
                </button>
                <ul class="dropdown-menu dropdown-menu-end border-0 shadow mt-2">
                    <li><button class="dropdown-item text-danger" onclick="logout()"><i class="fas fa-sign-out-alt me-2"></i>Déconnexion</button></li>
                </ul>
            </div>`;
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.reload();
}

// ==========================================
// 4. FILTRAGE ET RECHERCHE (CORRIGÉ & SYNCHRONISÉ)
// ==========================================
function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    const dateInput = document.getElementById('date-input');

    const filterAll = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const selectedDate = dateInput ? dateInput.value : ""; 

        const filtered = EVENTS.filter(e => {
            const matchCategory = currentFilterCategory === 'all' || e.category === currentFilterCategory;
            const matchText = e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query);
            const matchDate = !selectedDate || e.date === selectedDate;

            return matchCategory && matchText && matchDate;
        });

        renderEvents(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', filterAll);
    if (dateInput) dateInput.addEventListener('change', filterAll);
}

function filterByCategory(id) {
    currentFilterCategory = id;
    renderCategories();
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.dispatchEvent(new Event('input'));
    } else {
        const dateInput = document.getElementById('date-input');
        if (dateInput) dateInput.dispatchEvent(new Event('change'));
    }
}

// ==========================================
// 5. RENDU DE L'INTERFACE
// ==========================================
function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(c => `
        <div class="category-card ${c.id === currentFilterCategory ? 'active' : ''}" onclick="filterByCategory('${c.id}')">
            <i class="fas ${c.icon} mb-2"></i>
            <span class="small fw-bold">${c.name}</span>
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
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="event-card shadow-sm h-100 bg-white">
                <div class="position-relative">
                    <img src="${e.image}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${e.title}">
                    <span class="badge bg-primary position-absolute m-3 top-0 start-0">${e.category}</span>
                </div>
                <div class="p-4">
                    <h5 class="fw-bold text-dark">${e.title}</h5>
                    <p class="text-muted small mb-3"><i class="fas fa-calendar-alt me-2"></i>${formatDate(e.date)}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-indigo fs-5">${e.price === 0 ? 'Gratuit' : e.price + ' DH'}</span>
                        <button class="btn btn-outline-primary rounded-pill px-3" onclick="openDetails(${e.id})">Détails</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 6. DÉTAILS ET MAPS
// ==========================================
function openDetails(id) {
    const event = EVENTS.find(e => e.id === id);
    if (!event) return;

    document.getElementById('detail-title').innerText = event.title;
    document.getElementById('detail-description').innerText = event.description;
    document.getElementById('detail-image').src = event.image;

    const user = localStorage.getItem('currentUser');
    const bArea = document.getElementById('booking-area');
    if (bArea) {
        bArea.innerHTML = user 
            ? `<button class="btn btn-success w-100 rounded-pill py-2 fw-bold" onclick="bookNow(${event.id})">Réserver ma place</button>`
            : `<button class="btn btn-primary w-100 rounded-pill py-2" data-bs-toggle="modal" data-bs-target="#loginModal">Se connecter pour réserver</button>`;
    }

    const modalElement = document.getElementById('eventDetailsModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();

    setTimeout(() => {
        if (mapInstance) mapInstance.remove();
        mapInstance = L.map('map').setView([event.location.lat, event.location.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        L.marker([event.location.lat, event.location.lng]).addTo(mapInstance).bindPopup(event.location.name).openPopup();
    }, 500);
}

// ==========================================
// 7. SYSTÈME DE PAIEMENT & RÉSERVATION
// ==========================================
function bookNow(id) {
    const event = EVENTS.find(e => e.id === id);
    const user = JSON.parse(localStorage.getItem('currentUser'));

    if (!event || !user) return;

    Swal.fire({
        title: 'Confirmation de réservation',
        text: `Voulez-vous réserver pour "${event.title}" ?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Continuer',
        cancelButtonText: 'Annuler'
    }).then((res) => {
        if (res.isConfirmed) {
            const detailModal = bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal'));
            if (detailModal) detailModal.hide();

            // فحص السعر لتحديد مسار الدفع
            if (event.price > 0) {
                processPayment(event, user);
            } else {
                generateTicket(event, user);
            }
        }
    });
}

function processPayment(event, user) {
    Swal.fire({
        title: 'Sélectionnez votre moyen de paiement',
        html: `
            <div class="text-center mb-3">
                <span class="fs-5 fw-bold text-primary">Montant à payer : ${event.price} DH</span>
            </div>
            <div class="d-flex flex-column gap-2 mt-3">
                <button id="pay-cmi" class="btn btn-outline-dark py-3 rounded-3 text-start d-flex align-items-center justify-content-between">
                    <span><i class="fas fa-credit-card me-3 text-primary"></i>Carte bancaire (CMI / Payzone)</span>
                    <i class="fas fa-chevron-right text-muted"></i>
                </button>
                <button id="pay-paypal" class="btn btn-outline-primary py-3 rounded-3 text-start d-flex align-items-center justify-content-between">
                    <span><i class="fab fa-paypal me-3 text-info"></i>Compte International PayPal</span>
                    <i class="fas fa-chevron-right text-muted"></i>
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Annuler',
        didOpen: () => {
            document.getElementById('pay-cmi').addEventListener('click', () => {
                openCreditCardForm(event, user);
            });
            document.getElementById('pay-paypal').addEventListener('click', () => {
                simulateExternalGateway("PayPal", event, user);
            });
        }
    });
}

function openCreditCardForm(event, user) {
    Swal.fire({
        title: 'Saisissez vos coordonnées bancaires',
        html: `
            <div class="text-start mt-2">
                <label class="form-label small text-muted">Nom sur la carte</label>
                <input type="text" class="form-control mb-3 rounded-pill" value="${user.name.toUpperCase()}" placeholder="NOM COMPLET">
                
                <label class="form-label small text-muted">Numéro de carte</label>
                <div class="input-group mb-3">
                    <span class="input-group-text bg-white border-end-0 rounded-start-pill"><i class="fas fa-credit-card text-muted"></i></span>
                    <input type="text" class="form-control border-start-0 rounded-end-pill" placeholder="4151 0000 0000 0000" maxlength="19">
                </div>

                <div class="row">
                    <div class="col-6">
                        <label class="form-label small text-muted">Expiration</label>
                        <input type="text" class="form-control rounded-pill text-center" placeholder="MM/AA" maxlength="5">
                    </div>
                    <div class="col-6">
                        <label class="form-label small text-muted">Code CVC</label>
                        <input type="password" class="form-control rounded-pill text-center" placeholder="123" maxlength="3">
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 mt-3 text-muted small">
                    <i class="fas fa-lock text-success"></i> Connexion chiffrée SSL 256-bits (Payzone Secure)
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: `<i class="fas fa-check-circle me-2"></i> Payer ${event.price} DH`,
        confirmButtonColor: '#34d399',
        cancelButtonText: 'Retour',
        showLoaderOnConfirm: true,
        preConfirm: () => {
            return new Promise((resolve) => {
                setTimeout(() => { resolve(true); }, 2000); 
            });
        }
    }).then((result) => {
        if (result.isConfirmed) {
            generateTicket(event, user);
        }
    });
}

function simulateExternalGateway(provider, event, user) {
    Swal.fire({
        title: `Connexion à ${provider}...`,
        html: 'Veuillez patienter pendant la redirection vers l\'espace sécurisé.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Paiement Accepté !',
                    text: `Votre transaction via ${provider} a été validée avec succès.`,
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    generateTicket(event, user);
                });
            }, 2000);
        }
    });
}

// ==========================================
// 8. SYSTÈME DE GÉNÉRATION DE TICKET
// ==========================================
function generateTicket(event, user) {
    document.getElementById('ticket-event-title').innerText = event.title;
    document.getElementById('ticket-user-name').innerText = user.name;
    document.getElementById('ticket-event-date').innerText = formatDate(event.date);
    document.getElementById('ticket-price-badge').innerText = event.price === 0 ? 'GRATUIT' : `${event.price} DH`;

    const qrBox = document.getElementById("modal-qrcode-target");
    if (qrBox) {
        qrBox.innerHTML = "";
        new QRCode(qrBox, { text: `E-HUB-${event.id}-${Date.now()}`, width: 130, height: 130 });
    }

    const ticketModalElement = document.getElementById('ticketModal');
    const ticketModalInstance = new bootstrap.Modal(ticketModalElement);
    ticketModalInstance.show();

    const btnPdf = document.getElementById('download-ticket-btn');
    if (btnPdf) {
        btnPdf.onclick = function() {
            btnPdf.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Génération...';
            btnPdf.disabled = true;

            const element = document.getElementById('ticket-print-area');
            const options = {
                margin: 10,
                filename: `Ticket_EventHub_${user.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 3, useCORS: true, scrollY: 0, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(options).from(element).save().then(() => {
                btnPdf.innerHTML = '<i class="fas fa-file-pdf me-2"></i>Télécharger mon Ticket';
                btnPdf.disabled = false;
                Swal.fire('Succès', 'Votre ticket est prêt !', 'success');
            }).catch(err => {
                console.error(err);
                btnPdf.disabled = false;
            });
        };
    }
}

// ==========================================
// 9. UTILS
// ==========================================
function formatDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}