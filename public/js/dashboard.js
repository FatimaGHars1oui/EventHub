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

async function initBookingsChart() {
    const ctx1 = document.getElementById('bookings-chart')?.getContext('2d');
    if (!ctx1 || typeof Chart === 'undefined') return;

    if (bookingsChart) bookingsChart.destroy();
    
    // جلب بيانات الحجوزات الحقيقية لآخر 7 أيام
    const res = await fetchWithAuth('/stats/overview-chart');
    let chartLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    let chartData = [0, 0, 0, 0, 0, 0, 0];

    if (res && res.ok) {
        const result = await res.json();
        if (result.data && result.data.labels) {
            chartLabels = result.data.labels;
            chartData = result.data.values;
        }
    }

    bookingsChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{ label: 'Réservations', data: chartData, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4, fill: true }]
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
    // تعديل هنا: التأكد من الوصول للمصفوفة سواء كانت مباشرة أو داخل Paginator
    const data = (result.data && Array.isArray(result.data.data)) ? result.data.data : (result.data || []);

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
// 5. Mes Événements (Organizer + Admin) - CRUD شامل
// ==========================================
async function loadMyEvents() {
    const tbody = document.getElementById('events-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let myEvents = [];

    try {
        let page = 1, lastPage = 1;
        do {
            const res = await fetch(`${API_URL}/events?page=${page}`);
            const result = await res.json();
            const events = result.data || [];
            
            if (user.role === 'admin') {
                myEvents = myEvents.concat(events);
            } else {
                myEvents = myEvents.concat(events.filter(ev => ev.organizer && ev.organizer.id === user.id));
            }
            
            lastPage = result.pagination?.last_page || 1;
            page++;
        } while (page <= lastPage && page <= 5);
    } catch (err) {
        console.error("Erreur chargement événements:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erreur de chargement</td></tr>';
        return;
    }

    if (myEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Aucun événement pour le moment.</td></tr>';
        return;
    }

    tbody.innerHTML = myEvents.map(ev => `
        <tr>
            <td class="fw-bold">${ev.title}</td>
            <td>${ev.category ? ev.category.name : '-'}</td>
            <td>${new Date(ev.start_date).toLocaleDateString('fr-FR')}</td>
            <td>${ev.city || '-'}</td>
            <td>${ev.is_free ? 'Gratuit' : `${ev.price} DH`}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-warning" onclick="editEvent(${ev.id}, '${escapeHtml(ev.title)}', '${escapeHtml(ev.city || '')}', ${ev.price || 0}, ${ev.category ? ev.category.id : 'null'}, '${ev.start_date ? ev.start_date.substring(0,10) : ''}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${ev.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// دالة مساعدة لحماية نصوص HTML عند تمريرها كـ Parameters
function escapeHtml(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function editEvent(id, currentTitle, currentCity, currentPrice, currentCategoryId, currentDate) {
    // جلب الأصناف أولاً لكي نعرضها في القائمة المنسدلة للتعديل
    let categoriesOptions = '';
    try {
        const catRes = await fetch(`${API_URL}/categories`);
        const catResult = await catRes.json();
        categoriesOptions = (catResult.data || []).map(c => 
            `<option value="${c.id}" ${c.id == currentCategoryId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
    } catch (err) {
        console.error("Erreur catégories", err);
    }

    const { value: formValues } = await Swal.fire({
        title: 'Modifier l\'événement',
        html: `
            <div class="text-start mb-2"><label class="small fw-bold">Titre :</label>
            <input id="swal-title" class="swal2-input m-0 w-100" value="${currentTitle}"></div>
            
            <div class="text-start mb-2"><label class="small fw-bold">Ville :</label>
            <input id="swal-city" class="swal2-input m-0 w-100" value="${currentCity}"></div>
            
            <div class="text-start mb-2"><label class="small fw-bold">Prix (DH) :</label>
            <input id="swal-price" type="number" class="swal2-input m-0 w-100" value="${currentPrice}"></div>
            
            <div class="text-start mb-2"><label class="small fw-bold">Date :</label>
            <input id="swal-date" type="date" class="swal2-input m-0 w-100" value="${currentDate}"></div>
            
            <div class="text-start mb-2"><label class="small fw-bold">Catégorie :</label>
            <select id="swal-category" class="swal2-input m-0 w-100" style="display: block;">
                ${categoriesOptions}
            </select></div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Enregistrer',
        cancelButtonText: 'Annuler',
        preConfirm: () => {
            return {
                title: document.getElementById('swal-title').value,
                city: document.getElementById('swal-city').value,
                price: document.getElementById('swal-price').value,
                start_date: document.getElementById('swal-date').value,
                category_id: document.getElementById('swal-category').value
            }
        }
    });

    if (!formValues) return;

    // إرسال طلب التعديل (PUT / PATCH) عبر API
    const res = await fetchWithAuth(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formValues)
    });

    if (res && res.ok) {
        Swal.fire('Succès', 'Événement modifié avec succès !', 'success');
        loadMyEvents(); // تحديث الجدول تلقائياً
    } else {
        Swal.fire('Erreur', 'Impossible de modifier l\'événement', 'error');
    }
}

async function deleteEvent(id) {
    const confirmResult = await Swal.fire({
        title: 'Supprimer cet événement ?',
        text: 'Toutes les réservations associées seront impactées.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });

    if (!confirmResult.isConfirmed) return;

    const res = await fetchWithAuth(`/events/${id}`, { method: 'DELETE' });
    
    if (res && res.ok) {
        Swal.fire('Supprimé', 'L\'événement a été supprimé.', 'success');
        loadMyEvents(); // تحديث الجدول تلقائياً
    } else {
        Swal.fire('Erreur', 'Erreur lors de la suppression de l\'événement', 'error');
    }
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



// أضف هذا في دالة loadAdminStats بعد رسم البيانات الأخرى
const topEvents = d.top_events || [];
const topEventsTable = document.getElementById('top-events-table');
if (topEventsTable && topEvents.length > 0) {
    topEventsTable.innerHTML = topEvents.map((ev, index) => `
        <tr>
            <td class="fw-bold">${index + 1}</td>
            <td>${ev.title}</td>
            <td><span class="badge bg-primary">${ev.total_bookings || 0}</span></td>
            <td class="fw-bold text-success">${ev.total_revenue || 0} DH</td>
        </tr>
    `).join('');
} else if (topEventsTable) {
    topEventsTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Aucune donnée</td></tr>';
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

// ==========================================
// 10. نافذة ماسح QR المتقدمة (Admin Premium UI)
// ==========================================
(function initPremiumQRScanner() {
    // 1. تحميل المكتبة اللازمة
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    document.head.appendChild(script);

    // 2. إضافة التنسيقات الجمالية (CSS)
    const style = document.createElement('style');
    style.innerHTML = `
        .scanner-modal .modal-content {
            background: #1a1d21;
            color: white;
            border: 1px solid #3d444d;
            border-radius: 20px;
        }
        .scanner-container {
            position: relative;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            border-radius: 15px;
            overflow: hidden;
            border: 2px solid #6366f1;
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }
        #reader {
            width: 100% !important;
            border: none !important;
        }
        /* خط المسح المتحرك */
        .scan-line {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: #22c55e;
            box-shadow: 0 0 15px #22c55e;
            z-index: 10;
            animation: moveScanLine 2s linear infinite;
        }
        @keyframes moveScanLine {
            0% { top: 0; }
            100% { top: 100%; }
        }
        .scan-btn-float {
            position: fixed;
            bottom: 30px;
            left: 30px;
            z-index: 1050;
            padding: 15px 25px;
            font-weight: 600;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(99, 102, 241, 0.4);
        }
        .scan-btn-float:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 25px rgba(99, 102, 241, 0.6);
        }
    `;
    document.head.appendChild(style);

    script.onload = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') return;

        // 3. إنشاء النافذة (HTML Modal)
        const modalHTML = `
            <div class="modal fade scanner-modal" id="adminScannerModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content text-center">
                        <div class="modal-header border-0 pb-0">
                            <h5 class="modal-title w-100 fw-bold">Vérification du Ticket</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" id="btn-close-scanner"></button>
                        </div>
                        <div class="modal-body p-4">
                            <p class="text-muted small mb-4">Placez le QR code à l'intérieur du cadre pour scanner</p>
                            <div class="scanner-container">
                                <div class="scan-line"></div>
                                <div id="reader"></div>
                            </div>
                            <div id="scanner-status" class="mt-3 small text-info">Initialisation de la caméra...</div>
                        </div>
                        <div class="modal-footer border-0 justify-content-center pb-4">
                            <button type="button" class="btn btn-outline-light rounded-pill px-4" data-bs-dismiss="modal">Annuler</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="btn btn-primary rounded-pill scan-btn-float fw-bold" id="trigger-scan-btn">
                <i class="fas fa-expand me-2"></i> SCANNER TICKET
            </button>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        let html5QrCode;
        const scannerModal = new bootstrap.Modal(document.getElementById('adminScannerModal'));

        document.getElementById('trigger-scan-btn').onclick = () => {
            scannerModal.show();
            document.getElementById('scanner-status').innerText = "Caméra active...";
            
            html5QrCode = new Html5Qrcode("reader");
            const config = { fps: 15, qrbox: { width: 250, height: 250 } };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    html5QrCode.stop();
                    scannerModal.hide();
                    
                    Swal.fire({
                        title: 'Ticket Validé !',
                        html: `
                            <div class="text-start">
                                <p class="mb-1 text-muted small">Données du ticket :</p>
                                <div class="p-3 bg-light rounded border text-dark font-monospace">${decodedText}</div>
                            </div>
                        `,
                        icon: 'success',
                        confirmButtonText: 'Terminer',
                        confirmButtonColor: '#22c55e'
                    });
                }
            ).catch(err => {
                document.getElementById('scanner-status').innerHTML = `<span class="text-danger">Erreur: Caméra introuvable</span>`;
            });
        };

        document.getElementById('adminScannerModal').addEventListener('hidden.bs.modal', () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop();
            }
        });
    };


    // ==========================================
// 11. تزامن الوضع الليلي مع الصفحة الرئيسية
// ==========================================
function initDashboardDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
    // تحديث أيقونة الزر
    const btn = document.querySelector('.fa-moon, .fa-sun');
    if(btn) {
        btn.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('darkMode', !isDark);
    
    const btn = document.querySelector('.fa-moon, .fa-sun');
    if(btn) {
        btn.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// تشغيل الوضع الليلي فور فتح الداشبورد
document.addEventListener('DOMContentLoaded', initDashboardDarkMode);
})();

// ==========================================
// تصدير الجداول إلى Excel (Export Feature)
// ==========================================
function exportTableToCSV(tableId, filename = 'export.csv') {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const rowData = [];
        cols.forEach(col => rowData.push(`"${col.innerText.trim()}"`));
        csv.push(rowData.join(","));
    });
    
    const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function exportTableToExcel(tableId, filename = 'export.xlsx') {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const wb = XLSX.utils.table_to_booklet(table, { sheet: "Data" });
    XLSX.writeFile(wb, filename);
}

function openProfileSettings() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    Swal.fire({
        title: 'Modifier mon profil',
        html: `
            <input type="text" id="swal-name" class="swal2-input" placeholder="Nom complet" value="${user.name || ''}">
            <input type="email" id="swal-email" class="swal2-input" placeholder="Email" value="${user.email || ''}">
        `,
        showCancelButton: true,
        confirmButtonText: 'Enregistrer',
        cancelButtonText: 'Annuler',
        preConfirm: () => {
            const name = document.getElementById('swal-name').value;
            const email = document.getElementById('swal-email').value;
            if (!name || !email) {
                Swal.showValidationMessage('Veuillez remplir tous les champs');
                return false;
            }
            return { name, email };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const res = await fetchWithAuth('/auth/update-profile', {
                method: 'POST',
                body: JSON.stringify(result.value)
            });
            
            if (res && res.ok) {
                const data = await res.json();
                // تحديث البيانات محلياً فوراً بدون إعادة تحميل الصفحة
                const updatedUser = JSON.parse(localStorage.getItem('user'));
                updatedUser.name = result.value.name;
                updatedUser.email = result.value.email;
                localStorage.setItem('user', JSON.stringify(updatedUser));
                
                document.getElementById('welcome-msg').innerText = `Bonjour, ${result.value.name} 👋`;
                document.getElementById('user-email').innerText = result.value.email;
                
                Swal.fire('Succès', 'Profil mis à jour !', 'success');
            }
        }
    });
}

// ==========================================
// 12. مكتبة SheetJS للتصدير إلى Excel الحقيقي
// ==========================================
(function loadSheetJS() {
    if (typeof XLSX !== 'undefined') return; // تجنب التحميل المتكرر
    const s = document.createElement('script');
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    document.head.appendChild(s);
})();

// ==========================================
// 13. دالة التصدير إلى Excel (نسخة مصححة ومحسّنة)
// ==========================================
function exportToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        Swal.fire('Erreur', 'Tableau introuvable', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        Swal.fire('Chargement', 'Veuillez réessayer dans quelques secondes...', 'info');
        return;
    }

    // إزالة أعمدة الإجراءات (الأزرار) من التصدير
    const cleanTable = table.cloneNode(true);
    cleanTable.querySelectorAll('td:last-child, th:last-child').forEach(el => el.remove());

    const wb = XLSX.utils.table_to_book(cleanTable, { sheet: "Données" });

    // تعيين عرض الأعمدة تلقائياً
    const ws = wb.Sheets["Données"];
    const colWidths = [];
    if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let c = range.s.c; c <= range.e.c; c++) {
            let maxLen = 10;
            for (let r = range.s.r; r <= range.e.r; r++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })];
                if (cell && cell.v) {
                    const len = String(cell.v).length;
                    if (len > maxLen) maxLen = len;
                }
            }
            colWidths.push({ wch: maxLen + 3 });
        }
        ws['!cols'] = colWidths;
    }

    XLSX.writeFile(wb, filename);
}

// ==========================================
// 14. حقن أزرار التصدير في كل جدول تلقائياً
// ==========================================
(function injectExportButtons() {
    const exportConfigs = [
        { tableId: 'bookings-table', section: 'bookings', label: 'Réservations', filename: 'mes_reservations.xlsx' },
        { tableId: 'events-table', section: 'my-events', label: 'Événements', filename: 'mes_evenements.xlsx' },
        { tableId: 'admin-recent-bookings', section: 'admin-stats', label: 'Réservations récentes', filename: 'reservations_recentes.xlsx' },
        { tableId: 'top-events-table', section: 'admin-stats', label: 'Top événements', filename: 'top_evenements.xlsx' },
        { tableId: 'users-table', section: 'admin-users', label: 'Utilisateurs', filename: 'utilisateurs.xlsx' }
    ];

    const observer = new MutationObserver(() => {
        exportConfigs.forEach(cfg => {
            const section = document.getElementById(cfg.section);
            if (!section || !section.classList.contains('active')) return;

            const table = document.getElementById(cfg.tableId);
            if (!table || table.dataset.exportInjected) return;

            // إنشاء زر التصدير
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'd-flex justify-content-end mb-3';
            btnWrapper.innerHTML = `
                <button 
                    class="btn btn-success btn-sm" 
                    onclick="exportToExcel('${cfg.tableId}', '${cfg.filename}')"
                    title="Exporter vers Excel"
                >
                    <i class="fas fa-file-excel me-1"></i> Exporter ${cfg.label} (.xlsx)
                </button>
            `;

            table.parentNode.insertBefore(btnWrapper, table);
            table.dataset.exportInjected = 'true';
        });
    });

    // مراقبة كل تغيير في الداشبورد
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();

// ==========================================
// 15. اختصار لوحة المفاتيح: Ctrl+E للتصدير السريع
// ==========================================
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();

        // البحث عن الجدول النشط حالياً
        const activeSection = document.querySelector('.dashboard-section.active');
        if (!activeSection) return;

        const table = activeSection.querySelector('table');
        if (!table || !table.id) {
            Swal.fire('Info', 'Aucun tableau à exporter dans cette section', 'info');
            return;
        }

        const names = {
            'bookings-table': 'mes_reservations.xlsx',
            'events-table': 'mes_evenements.xlsx',
            'admin-recent-bookings': 'reservations_recentes.xlsx',
            'top-events-table': 'top_evenements.xlsx',
            'users-table': 'utilisateurs.xlsx'
        };

        exportToExcel(table.id, names[table.id] || 'export.xlsx');
    }
});