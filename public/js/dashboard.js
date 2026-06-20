/**
 * Dashboard Logic - EventHub
 */

const dash = {
    // 1. فحص التوثيق عند الدخول
    init() {
        if (!state.token) {
            window.location.href = 'index.html';
            return;
        }
        document.getElementById('user-name').innerText = state.user.name;
        document.getElementById('user-role').innerText = state.user.role.toUpperCase();
        
        // إخفاء "Mes Événements" إذا كان المستخدم عادياً
        if (state.user.role === 'user') {
            document.getElementById('link-events').style.display = 'none';
        }
        
        this.loadStats();
    },

    // 2. تحميل إحصائيات سريعة
    async loadStats() {
        // إذا كان آدمن، نجلب إحصائيات الآدمن
        if (state.user.role === 'admin') {
            const res = await api.request('/admin/stats');
            if (res.success) {
                document.getElementById('stat-bookings').innerText = res.data.total_bookings;
                document.getElementById('stat-money').innerText = res.data.total_revenue + ' MAD';
                document.getElementById('stat-events').innerText = res.data.total_events;
            }
        } else {
            // للمستخدم العادي، نحسب عدد حجوزاته
            const res = await api.request('/my-bookings');
            if (res.success) {
                document.getElementById('stat-bookings').innerText = res.data.length;
                const totalSpent = res.data.reduce((acc, b) => acc + parseFloat(b.total_amount), 0);
                document.getElementById('stat-money').innerText = totalSpent + ' MAD';
            }
        }
    },

    // 3. التبديل بين التبويبات
    async showTab(type) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById('tab-title').innerText = 
            type === 'events' ? 'Mes Événements' : (type === 'bookings' ? 'Mes Réservations' : 'Vue d\'ensemble');

        if (type === 'overview') {
            document.getElementById('tab-overview').style.display = 'flex';
            document.getElementById('tab-data').style.display = 'none';
            return;
        }

        document.getElementById('tab-overview').style.display = 'none';
        document.getElementById('tab-data').style.display = 'block';

        if (type === 'bookings') this.loadBookings();
        if (type === 'events') this.loadEvents();
    },

    // 4. عرض الحجوزات في جدول
    async loadBookings() {
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        head.innerHTML = `<tr><th>N°</th><th>Événement</th><th>Date</th><th>Montant</th><th>Actions</th></tr>`;
        
        const res = await api.request('/my-bookings');
        if (res.success) {
            body.innerHTML = res.data.map(b => `
                <tr>
                    <td><small class="text-primary fw-bold">${b.booking_number}</small></td>
                    <td>${b.event.title}</td>
                    <td>${new Date(b.event.start_date).toLocaleDateString()}</td>
                    <td>${b.total_amount} MAD</td>
                    <td>
                        <button onclick="bookingFlow.showTicket('${b.booking_number}')" class="btn btn-sm btn-dark">
                            <i class="fas fa-ticket-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => dash.init());