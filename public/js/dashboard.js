/**
 * EventHub - Dashboard Logic (Unifié)
 * يتحكم فـ 3 أنواع ديال المستخدمين: Admin / Organizer / User
 * Gère l'UI, l'authentification et toutes les requêtes API du tableau de bord.
 */

var API_URL = "http://127.0.0.1:8000/api";
var bookingsChart = null;
var categoriesChart = null;
var currentUserRole = 'user';
var usersCurrentPage = 1;

document.addEventListener('DOMContentLoaded', (e) => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    console.log("Dashboard Init: Token:", token, "User:", userStr);

    // 1. التحقق من التوكن والبيانات (معالجة Corruption)
    if (!token) {
        console.warn("Session expirée ou invalide");


        logout();
        return;
    }

    try {
        const user = JSON.parse(userStr);
        initUI(user);
        showSection('overview');

        // ربط الـ Form ديال إضافة فعالية
        const addEventForm = document.getElementById('add-event-form');
        if (addEventForm) addEventForm.addEventListener('submit', handleAddEvent);

    } catch (e) {
        console.error("Critical error during init:", e);
        logout();
    }
});

// ==========================================
// 1. إعداد الواجهة (UI Management)
// ==========================================
function initUI(user) {
    if (!user) return;

    // حماية ضد خطأ toUpperCase (استخدام "user" كقيمة افتراضية)
    const role = (user.role || 'user').toLowerCase();
    currentUserRole = role;
    const name = user.name || 'Utilisateur';

    // تحديث المعلومات
    updateText('user-name', name);
    updateText('user-email', user.email || '');
    updateText('welcome-msg', `Bonjour, ${name} 👋`);
    updateText('user-role', role.toUpperCase());

    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

    // التحكم في الرتب: نخبيو كل شي بالأول
    document.querySelectorAll('.admin-only, .organizer-only').forEach(el => el.style.display = 'none');

    // Admin: عندو حقوق ديال الـ Organizer + حقوق ديالو الخاصة
    if (role === 'admin') {
        document.querySelectorAll('.admin-only, .organizer-only').forEach(el => el.style.display = 'block');
    } else if (role === 'organizer') {
        document.querySelectorAll('.organizer-only').forEach(el => el.style.display = 'block');
    }
}

function showSection(sectionId, evt) {
    const e = evt || window.event;

    // تبديل شكل الروابط
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  
    if (e && e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('active'); 

    // تبديل الأقسام
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // تحميل البيانات حسب القسم المفتوح
    switch (sectionId) {
        case 'overview': loadOverviewStats(); initBookingsChart(); break;
        case 'bookings': loadBookings(); break;
        case 'my-events': loadMyEvents(); break;
        case 'add-event': loadCategories(); break;
        case 'admin-stats': loadAdminStats(); break;
        case 'admin-users': loadUsers(1); break;
    }
}

// ==========================================
// 2. معالجة الطلبات (API Handling)
// ==========================================
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

        if (response.status === 401) {
            logout();
            return null;
        }
        return response;
    } catch (err) {
        console.error("Fetch Error:", err);
        return null;
    }
}

// ==========================================
// 3. Vue d'ensemble (Overview) - tous les rôles
// ==========================================
async function loadOverviewStats() {
    const res = await fetchWithAuth('/stats/overview');
    if (res && res.ok) {
        const result = await res.json();
        updateText('total-bookings', result.data.total_bookings ?? 0);
        updateText('total-events', result.data.total_events ?? 0);
    }
}

function initBookingsChart() {
    const ctx1 = document.getElementById('bookings-chart')?.getContext('2d');
    if (!ctx1 || typeof Chart === 'undefined') return;

    if (bookingsChart) bookingsChart.destroy();
    bookingsChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [{ label: 'Réservations', data: [5, 12, 8, 15, 20, 25, 18], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// ==========================================
// 4. Mes Réservations - tous les rôles
// ==========================================
async function loadBookings() {
    const tbody = document.getElementById('bookings-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    const res = await fetchWithAuth('/my-bookings');
    if (!res || !res.ok) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erreur de chargement</td></tr>';
        return;
    }

    const result = await res.json();
    const data = result.data || [];

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Aucune réservation trouvée.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(b => `
        <tr>
            <td class="fw-bold">#${b.id}</td>
            <td>${b.event ? b.event.title : 'N/A'}</td>
            <td>${new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
            <td><span class="badge bg-${b.status === 'confirmed' ? 'success' : 'warning'}">${b.status}</span></td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="viewTicket('${b.booking_number || b.id}')">Détails</button></td>
        </tr>
    `).join('');
}

function viewTicket(ref) {
    Swal.fire('Billet', `Référence de la réservation: <b>${ref}</b>`, 'info');
}

// ==========================================
// 5. Mes Événements (Organizer + Admin)
// ==========================================
async function loadMyEvents() {
    const tbody = document.getElementById('events-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let myEvents = [];

    try {
        let page = 1, lastPage = 1;
        // الـ API ماعندهاش endpoint مخصص لـ "événements ديالي"، فكنجمعو الصفحات
        // العامة ونفلتريو حسب organizer_id فالـ Front (limite: 5 صفحات = 60 événement)
        do {
            const res = await fetch(`${API_URL}/events?page=${page}`);
            const result = await res.json();
            const events = result.data || [];
            myEvents = myEvents.concat(events.filter(ev => ev.organizer && ev.organizer.id === user.id));
            lastPage = result.pagination?.last_page || 1;
            page++;
        } while (page <= lastPage && page <= 5);
    } catch (err) {
        console.error("Erreur chargement événements:", err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erreur de chargement</td></tr>';
        return;
    }

    if (myEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Aucun événement pour le moment.</td></tr>';
        return;
    }

    tbody.innerHTML = myEvents.map(ev => `
        <tr>
            <td class="fw-bold">${ev.title}</td>
            <td>${ev.category ? ev.category.name : '-'}</td>
            <td>${new Date(ev.start_date).toLocaleDateString('fr-FR')}</td>
            <td>${ev.city || '-'}</td>
            <td>${ev.is_free ? 'Gratuit' : `${ev.price} DH`}</td>
        </tr>
    `).join('');
}

// ==========================================
// 6. Ajouter un événement (Organizer + Admin)
// ==========================================
async function loadCategories() {
    const select = document.getElementById('category-select');
    if (!select || select.options.length > 0) return;
    try {
        const res = await fetch(`${API_URL}/categories`);
        const result = await res.json();
        select.innerHTML = '<option value="">-- Choisir une catégorie --</option>' +
            (result.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (err) {
        console.error("Erreur chargement catégories:", err);
    }
}

async function handleAddEvent(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Publication...';

    const formData = new FormData(form);
    const res = await fetchWithAuth('/events', { method: 'POST', body: formData });

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (!res) return;
    const result = await res.json();

    if (res.ok && result.success) {
        Swal.fire('Succès', result.message || 'Événement créé !', 'success');
        form.reset();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('[onclick*="my-events"]').forEach(l => l.classList.add('active'));
        showSection('my-events');
    } else {
        const errMsg = result.errors
            ? Object.values(result.errors).flat().join('\n')
            : (result.message || 'Erreur lors de la création de l\'événement');
        Swal.fire('Erreur', errMsg, 'error');
    }
}

// ==========================================
// 7. Statistiques globales (Admin uniquement)
// ==========================================
async function loadAdminStats() {
    const res = await fetchWithAuth('/admin/stats');
    if (!res || !res.ok) return;
    const result = await res.json();
    if (!result.success) return;

    const d = result.data;

    updateText('admin-total-events', d.counters.total_events ?? 0);
    updateText('admin-total-users', d.counters.total_users ?? 0);
    updateText('admin-total-bookings', d.counters.total_bookings ?? 0);
    updateText('admin-total-revenue', `${d.counters.total_revenue ?? 0} DH`);

    // رسم بياني: توزيع الفعاليات حسب الصنف
    const ctxCat = document.getElementById('categories-chart')?.getContext('2d');
    if (ctxCat && typeof Chart !== 'undefined') {
        if (categoriesChart) categoriesChart.destroy();
        categoriesChart = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: (d.events_by_category || []).map(c => c.label),
                datasets: [{
                    data: (d.events_by_category || []).map(c => c.value),
                    backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899']
                }]
            },
            options: { responsive: true }
        });
    }

    // جدول: آخر الحجوزات
    const tbody = document.getElementById('admin-recent-bookings');
    if (tbody) {
        const recent = d.recent_bookings || [];
        tbody.innerHTML = recent.length
            ? recent.map(b => `
                <tr>
                    <td>#${b.id}</td>
                    <td>${b.user ? b.user.name : 'N/A'}</td>
                    <td>${b.event ? b.event.title : 'N/A'}</td>
                    <td>${new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="text-center text-muted py-3">Aucune réservation récente.</td></tr>';
    }
}

// ==========================================
// 8. Gestion des Utilisateurs (Admin uniquement)
// ==========================================
async function loadUsers(page = 1) {
    const tbody = document.getElementById('users-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    const res = await fetchWithAuth(`/admin/users?page=${page}`);
    if (!res || !res.ok) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erreur de chargement</td></tr>';
        return;
    }

    const result = await res.json();
    const paginator = result.data || {};
    const users = paginator.data || [];

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Aucun utilisateur trouvé.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td>#${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="badge bg-${u.role === 'admin' ? 'danger' : (u.role === 'organizer' ? 'info' : 'secondary')}">${u.role}</span></td>
            <td>
                ${u.role === 'admin'
                    ? '<span class="text-muted small">Protégé</span>'
                    : `<button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>`}
            </td>
        </tr>
    `).join('');

    renderUsersPagination(paginator);
}

function renderUsersPagination(paginator) {
    const container = document.getElementById('users-pagination');
    if (!container) return;

    const current = paginator.current_page || 1;
    const last = paginator.last_page || 1;
    usersCurrentPage = current;

    container.innerHTML = `
        <button class="btn btn-sm btn-outline-secondary" ${current <= 1 ? 'disabled' : ''} onclick="loadUsers(${current - 1})">
            <i class="fas fa-chevron-left"></i> Précédent
        </button>
        <span class="px-3 small text-muted">Page ${current} / ${last}</span>
        <button class="btn btn-sm btn-outline-secondary" ${current >= last ? 'disabled' : ''} onclick="loadUsers(${current + 1})">
            Suivant <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

async function deleteUser(id) {
    const confirmResult = await Swal.fire({
        title: 'Supprimer cet utilisateur ?',
        text: 'Cette action est irréversible.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });
    if (!confirmResult.isConfirmed) return;

    const res = await fetchWithAuth(`/admin/users/${id}`, { method: 'DELETE' });
    if (!res) return;
    const result = await res.json();

    if (res.ok && result.success) {
        Swal.fire('Supprimé', result.message || 'Utilisateur supprimé avec succès', 'success');
        loadUsers(usersCurrentPage);
    } else {
        Swal.fire('Erreur', result.message || 'Impossible de supprimer cet utilisateur', 'error');
    }
}

// ==========================================
// 9. المساعدون (Helpers)
// ==========================================
function updateText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}