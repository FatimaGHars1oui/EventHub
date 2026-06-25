/**
 * FestivEvents - Dashboard Logic
 * Handles UI, Authentication, and API Requests
 */

// استخدام تعريف آمن لمتغير الـ API
var API_URL = "http://127.0.0.1:8000/api";
var bookingsChart = null;
var categoriesChart = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // 1. التحقق من التوكن والبيانات (معالجة Corruption)
    if (!token || !userStr || userStr === "undefined") {
        console.warn("Session expirée ou invalide");
        logout();
        return;
    }

    try {
        const user = JSON.parse(userStr);
        initUI(user);
        showSection('overview');
        
        // ربط الـ Form
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

    // حماية ضد خطأ toUpperCase (استخدام "USER" كقيمة افتراضية)
    const role = (user.role || 'user').toUpperCase();
    const name = user.name || 'Utilisateur';

    // تحديث المعلومات
    updateText('user-name', name);
    updateText('user-email', user.email || '');
    updateText('welcome-msg', `Bienvenue, ${name} 👋`);
    updateText('user-role', role);
    
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // التحكم في الرتب (Admin/Organizer/User)
    const lowerRole = role.toLowerCase();
    document.querySelectorAll('.admin-only, .organizer-only').forEach(el => el.style.display = 'none');

    if (lowerRole === 'admin') {
        document.querySelectorAll('.admin-only, .organizer-only').forEach(el => el.style.display = 'block');
    } else if (lowerRole === 'organizer') {
        document.querySelectorAll('.organizer-only').forEach(el => el.style.display = 'block');
    }
}

function showSection(sectionId) {
    // تبديل شكل الروابط
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    event?.target?.classList.add('active');

    // تبديل الأقسام
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // تحميل البيانات حسب القسم المفتوح
    switch (sectionId) {
        case 'overview': loadOverviewStats(); initCharts(); break;
        case 'bookings': loadBookings(); break;
        case 'add-event': loadCategories(); break;
    }
}

// ==========================================
// 2. معالجة الطلبات (API Handling)
// ==========================================
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
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

// جلب الإحصائيات (Overview)
async function loadOverviewStats() {
    const res = await fetchWithAuth('/stats/overview');
    if (res && res.ok) {
        const result = await res.json();
        updateText('total-bookings', result.data.total_bookings || 0);
        updateText('total-events', result.data.total_events || 0);
    }
}

// جلب الحجوزات (Bookings)
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
            <td><button class="btn btn-sm btn-outline-primary" onclick="viewTicket(${b.id})">Détails</button></td>
        </tr>
    `).join('');
}

// ==========================================
// 3. الرسوم البيانية (Charts)
// ==========================================
function initCharts() {
    const ctx1 = document.getElementById('bookings-chart')?.getContext('2d');
    if (!ctx1) return;

    if (bookingsChart) bookingsChart.destroy();
    bookingsChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [{ label: 'Réservations', data: [5, 12, 8, 15, 20, 25, 18], borderColor: '#6366f1', tension: 0.4 }]
        }
    });
}

// ==========================================
// 4. المساعدون (Helpers)
// ==========================================
function updateText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

async function loadCategories() {
    const select = document.getElementById('category-select');
    if (!select || select.options.length > 0) return;
    const res = await fetch(`${API_URL}/categories`);
    const result = await res.json();
    select.innerHTML = result.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function handleAddEvent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
    });
    if (res.ok) {
        Swal.fire('Succès', 'Événement créé!', 'success');
        e.target.reset();
        showSection('overview');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}