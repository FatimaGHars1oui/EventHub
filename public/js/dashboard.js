/**
 * EventHub Fès - Dashboard JavaScript
 * Version: 2.0.0
 */

const API_URL = "http://localhost:8000/api";

// ============ State Management ============
const dashState = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    currentSection: 'overview'
};

// ============ Check Authentication ============
if (!dashState.token || !dashState.user) {
    window.location.href = 'index.html';
}

// ============ API Helper ============
const dashApi = {
    headers() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dashState.token}`
        };
    },

    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: this.headers()
        };

        if (data) options.body = JSON.stringify(data);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
            return await response.json();
        } catch (error) {
            console.error("Erreur API:", error);
            return { success: false, message: "Erreur de connexion au serveur" };
        }
    }
};

// ============ Navigation ============
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(sectionName);
    if (section) {
        section.classList.add('active');
    }

    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target?.classList.add('active');

    // Load data for section
    loadSectionData(sectionName);
}

async function loadSectionData(section) {
    switch(section) {
        case 'bookings':
            await loadBookings();
            break;
        case 'my-events':
            await loadMyEvents();
            break;
        case 'users':
            await loadUsers();
            break;
        case 'statistics':
            await loadStatistics();
            break;
    }
}

// ============ Bookings ============
async function loadBookings() {
    const res = await dashApi.request('/bookings/my-bookings');
    const tbody = document.getElementById('bookings-table');

    if (!tbody) return;

    if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(booking => `
            <tr>
                <td><strong>${booking.booking_number}</strong></td>
                <td>${booking.event?.title || 'Événement supprimé'}</td>
                <td>${new Date(booking.created_at).toLocaleDateString('fr-FR')}</td>
                <td><span class="badge bg-success">Confirmé</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="downloadBookingPDF('${booking.booking_number}')">
                        <i class="fas fa-download"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucune réservation trouvée</td></tr>`;
    }
}

function downloadBookingPDF(bookingNumber) {
    // Generate PDF
    const content = `
        <div style="padding: 20px; text-align: center;">
            <h2>EventHub Fès</h2>
            <p>N° Réservation: ${bookingNumber}</p>
        </div>
    `;

    const opt = {
        margin: 10,
        filename: `booking-${bookingNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4' }
    };

    html2pdf().set(opt).from(content).save();
}

// ============ My Events ============
async function loadMyEvents() {
    const res = await dashApi.request('/events/my-events');
    const tbody = document.getElementById('events-table');

    if (!tbody) return;

    if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(event => `
            <tr>
                <td><strong>${event.title}</strong></td>
                <td>${new Date(event.start_date).toLocaleDateString('fr-FR')}</td>
                <td><span class="badge bg-primary">${event.attendees_count || 0}</span></td>
                <td><span class="badge bg-info">Publié</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editEvent(${event.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${event.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun événement trouvé</td></tr>`;
    }
}

function editEvent(eventId) {
    Swal.fire('Modifier', `Modifier l'événement N° ${eventId}`, 'info');
}

async function deleteEvent(eventId) {
    const result = await Swal.fire({
        title: 'Confirmation de suppression',
        text: 'Voulez-vous vraiment supprimer cet événement ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
        const res = await dashApi.request(`/events/${eventId}`, 'DELETE');
        if (res.success) {
            Swal.fire('Supprimé', 'L\'événement a été supprimé avec succès', 'success');
            loadMyEvents();
        }
    }
}

// ============ Add Event ============
async function setupAddEventForm() {
    // Load categories
    const catRes = await dashApi.request('/categories');
    if (catRes.success) {
        const select = document.getElementById('category-select');
        if (select) {
            select.innerHTML = catRes.data.map(cat => 
                `<option value="${cat.id}">${cat.name}</option>`
            ).join('');
        }
    }

    // Form submission
    const form = document.getElementById('add-event-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            
            const res = await dashApi.request('/events', 'POST', Object.fromEntries(formData));
            if (res.success) {
                Swal.fire('Succès', 'L\'événement a été publié avec succès', 'success');
                form.reset();
            } else {
                Swal.fire('Erreur', res.message || 'Échec de la publication de l\'événement', 'error');
            }
        });
    }
}

// ============ Users (Admin Only) ============
async function loadUsers() {
    const res = await dashApi.request('/admin/users');
    const tbody = document.getElementById('users-table');

    if (!tbody) return;

    if (res.success && res.data.length > 0) {
        tbody.innerHTML = res.data.map(user => `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td><span class="badge bg-secondary">${user.role}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-warning" onclick="editUser(${user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun utilisateur trouvé</td></tr>`;
    }
}

function editUser(userId) {
    Swal.fire('Modifier', `Modifier l'utilisateur N° ${userId}`, 'info');
}

// ============ Statistics (Admin Only) ============
let bookingsChart = null;
let categoriesChart = null;

async function loadStatistics() {
    const res = await dashApi.request('/admin/statistics');
    
    if (res.success) {
        // Bookings Chart
        const bookingsCtx = document.getElementById('bookings-chart');
        if (bookingsCtx && res.data.bookings_by_month) {
            if (bookingsChart) bookingsChart.destroy();
            bookingsChart = new Chart(bookingsCtx, {
                type: 'line',
                data: {
                    labels: res.data.bookings_by_month.map(b => b.month),
                    datasets: [{
                        label: 'Réservations',
                        data: res.data.bookings_by_month.map(b => b.count),
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }

        // Categories Chart
        const categoriesCtx = document.getElementById('categories-chart');
        if (categoriesCtx && res.data.categories_distribution) {
            if (categoriesChart) categoriesChart.destroy();
            categoriesChart = new Chart(categoriesCtx, {
                type: 'doughnut',
                data: {
                    labels: res.data.categories_distribution.map(c => c.name),
                    datasets: [{
                        data: res.data.categories_distribution.map(c => c.count),
                        backgroundColor: ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
}

// ============ Initialize ============
function initDashboard() {
    // Update user info
    document.getElementById('user-name').textContent = dashState.user.name;
    document.getElementById('user-email').textContent = dashState.user.email;
    document.getElementById('welcome-msg').textContent = `Bonjour ${dashState.user.name}`;

    // Show/hide sections based on role
    if (dashState.user.role === 'organizer' || dashState.user.role === 'admin') {
        document.querySelectorAll('.organizer-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    if (dashState.user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    // Set up event form
    setupAddEventForm();

    // Load overview data
    loadOverview();
}

async function loadOverview() {
    const res = await dashApi.request('/dashboard/overview');
    
    if (res.success && res.data) {
        document.getElementById('total-bookings').textContent = res.data.total_bookings || 0;
        document.getElementById('total-events').textContent = res.data.total_events || 0;
        document.getElementById('user-rating').textContent = res.data.user_rating || '4.5';
        document.getElementById('followers').textContent = res.data.followers || 0;
    }
}

function logout() {
    Swal.fire({
        title: 'Déconnexion',
        text: 'Voulez-vous vraiment vous déconnecter ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    });
}

// ============ On Page Load ============
document.addEventListener('DOMContentLoaded', initDashboard);