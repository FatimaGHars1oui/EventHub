const API_URL = "http://127.0.0.1:8000/api";
let revenueChart = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'index.html';
        return;
    }

    setupUI(user);
    loadSection('overview'); // التحميل الافتراضي
});

// 1. إعداد الواجهة حسب الرتبة
function setupUI(user) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-role').innerText = user.role.toUpperCase();

    // إخفاء الأقسام غير المصرح بها
    if (user.role === 'admin') {
        document.querySelectorAll('.user-only').forEach(el => el.remove());
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.remove());
    }
}

// 2. التنقل بين الأقسام
async function loadSection(section) {
    // تمييز الرابط النشط
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    event?.currentTarget?.classList.add('active');

    // إخفاء كافة الأقسام وإظهار المطلوب
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');

    const user = JSON.parse(localStorage.getItem('user'));

    if (section === 'overview') {
        user.role === 'admin' ? loadAdminStats() : loadUserStats();
    } else if (section === 'bookings') {
        loadUserBookings();
    } else if (section === 'manage-events') {
        loadAdminEvents();
    } else if (section === 'scanner') {
        startQRScanner();
    }
}

// ==========================================
// قسم المستخدم (USER SECTION)
// ==========================================

async function loadUserStats() {
    const res = await fetchWithAuth(`${API_URL}/my-bookings`);
    const result = await res.json();
    if (result.success) {
        document.getElementById('total-bookings-count').innerText = result.data.length;
        const totalSpent = result.data.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
        document.getElementById('total-spent').innerText = totalSpent.toFixed(2) + ' MAD';
    }
}

async function loadUserBookings() {
    const res = await fetchWithAuth(`${API_URL}/my-bookings`);
    const result = await res.json();
    const tbody = document.getElementById('user-bookings-table');
    
    tbody.innerHTML = result.data.map(b => `
        <tr>
            <td>${b.event.title}</td>
            <td><span class="badge bg-info">${b.quantity} places</span></td>
            <td><span class="badge bg-${b.status === 'confirmed' ? 'success' : 'warning'}">${b.status}</span></td>
            <td>
                ${b.status === 'confirmed' ? 
                    `<button onclick="openReviewModal(${b.event_id})" class="btn btn-sm btn-outline-primary">Évaluer</button>` : 
                    `<button onclick="cancelBooking(${b.id})" class="btn btn-sm btn-outline-danger">Annuler</button>`
                }
            </td>
        </tr>
    `).join('');
}

// إلغاء الحجز
async function cancelBooking(id) {
    const confirm = await Swal.fire({ title: 'Annuler?', text: 'Voulez-vous annuler ce حجز?', icon: 'warning', showCancelButton: true });
    if (confirm.isConfirmed) {
        const res = await fetchWithAuth(`${API_URL}/bookings/${id}`, { method: 'DELETE' });
        if (res.ok) { Swal.fire('Annulé', '', 'success'); loadUserBookings(); }
    }
}

// تقييم الفعالية
function openReviewModal(eventId) {
    Swal.fire({
        title: 'Évaluer l\'événement',
        html: `
            <select id="rating-val" class="swal2-input">
                <option value="5">⭐⭐⭐⭐ stars</option>
                <option value="4">⭐⭐⭐⭐ stars</option>
                <option value="3">⭐⭐⭐ stars</option>
                <option value="2">⭐⭐ stars</option>
                <option value="1">⭐ star</option>
            </select>
            <textarea id="rating-comment" class="swal2-textarea" placeholder="Votre commentaire..."></textarea>
        `,
        confirmButtonText: 'Envoyer',
        preConfirm: () => {
            return {
                event_id: eventId,
                rating: document.getElementById('rating-val').value,
                comment: document.getElementById('rating-comment').value
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const res = await fetchWithAuth(`${API_URL}/reviews`, {
                method: 'POST',
                body: JSON.stringify(result.value)
            });
            if (res.ok) Swal.fire('Merci!', 'Votre avis compte pour nous.', 'success');
        }
    });
}

// ==========================================
// قسم الإدارة (ADMIN SECTION)
// ==========================================

async function loadAdminStats() {
    const res = await fetchWithAuth(`${API_URL}/admin/stats`);
    const result = await res.json();
    const data = result.data;

    document.getElementById('admin-total-revenue').innerText = data.total_revenue + ' MAD';
    document.getElementById('admin-total-users').innerText = data.total_users;

    // رسم مبيان الأرباح
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.bookings_trend.map(i => i.date),
            datasets: [{ label: 'Revenue', data: data.bookings_trend.map(i => i.count), borderColor: '#6366f1', fill: true }]
        }
    });
}

// إضافة فعالية جديدة
async function handleAddEvent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
    });
    if (res.ok) { Swal.fire('Succès', 'Événement ajouté!', 'success'); loadSection('manage-events'); }
}

// الـ Scanner للمنظم
function startQRScanner() {
    const html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
            const res = await fetchWithAuth(`${API_URL}/bookings/check-in`, {
                method: 'POST',
                body: JSON.stringify({ booking_number: decodedText })
            });
            const result = await res.json();
            Swal.fire(result.success ? 'Accès Autorisé' : 'Erreur', result.message, result.success ? 'success' : 'error');
            html5QrCode.stop();
        }
    );
}

// ==========================================
// وظائف مساعدة (HELPERS)
// ==========================================

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    return fetch(url, { ...defaultOptions, ...options });
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}