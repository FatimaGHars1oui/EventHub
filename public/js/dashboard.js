/**
 * EventHub Fès - Dashboard Core Logic
 * Version: 4.0.0 (PFE Ultimate - Scanner & Charts Integrated)
 */

const dash = {
    // تخزين المراجع لتجنب تكرار التعريف
    charts: { bar: null, pie: null },
    html5QrCode: null,

    // 1. التهيئة عند الدخول
    init() {
        if (!state.token || !state.user) {
            window.location.href = 'index.html';
            return;
        }

        // عرض بيانات المستخدم
        document.getElementById('user-name').innerText = state.user.name;
        document.getElementById('user-role-badge').innerText = state.user.role;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${state.user.name}&background=4361ee&color=fff`;

        // إدارة الصلاحيات (ماذا يرى كل مستخدم)
        this.applyPermissions(state.user.role);
        
        // تحميل إحصائيات الصفحة الرئيسية للوحة
        this.loadOverview();
    },

    // 2. التحكم في القوائم بناءً على الدور
    applyPermissions(role) {
        const linkEvents = document.getElementById('link-events');
        const linkScanner = document.getElementById('link-scanner');
        const adminCharts = document.getElementById('admin-charts');

        if (role === 'user') {
            if (linkEvents) linkEvents.style.display = 'none';
            if (linkScanner) linkScanner.style.display = 'none';
            if (adminCharts) adminCharts.style.display = 'none';
        }
    },

    // 3. جلب الإحصائيات (Overview)
    async loadOverview() {
        const role = state.user.role;
        
        if (role === 'admin' || role === 'organizer') {
            const res = await api.request('/admin/stats');
            if (res.success) {
                const data = res.data;
                this.setStat('stat-count-1', data.total_bookings);
                this.setStat('stat-count-2', data.total_revenue + ' MAD');
                this.setStat('stat-count-3', data.total_events);
                
                // رسم الرسوم البيانية للآدمن
                if (role === 'admin') this.renderCharts(data);
            }
        } else {
            // إحصائيات المستخدم العادي
            const res = await api.request('/my-bookings');
            if (res.success) {
                const totalSpent = res.data.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
                this.setStat('stat-count-1', res.data.length);
                this.setStat('stat-count-2', totalSpent + ' MAD');
                this.setStat('stat-count-3', 'Actif');
            }
        }
    },

    // 4. رسم المخططات البيانية (Chart.js)
    renderCharts(data) {
        const barCtx = document.getElementById('barChart');
        const pieCtx = document.getElementById('pieChart');
        if (!barCtx || !pieCtx) return;

        // تدمير المخططات القديمة إذا كانت موجودة (مهم جداً)
        if (this.charts.bar) this.charts.bar.destroy();
        if (this.charts.pie) this.charts.pie.destroy();

        // إعدادات الخطوط
        Chart.defaults.color = '#64748b';
        Chart.defaults.font.family = "'Inter', sans-serif";

        // Bar Chart (Top Events)
        this.charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.popular_events.map(e => e.title.substring(0, 12) + '...'),
                datasets: [{
                    label: 'Réservations',
                    data: data.popular_events.map(e => e.current_attendees),
                    backgroundColor: '#4361ee',
                    borderRadius: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Pie Chart (Categories)
        this.charts.pie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: data.events_by_category.map(c => c.name),
                datasets: [{
                    data: data.events_by_category.map(c => c.count),
                    backgroundColor: ['#4361ee', '#4cc9f0', '#7209b7', '#f72585', '#ffb703'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
        });
    },

    // 5. التبديل بين التبويبات (Tabs Management)
    async showTab(type) {
        // إيقاف الكاميرا إذا كانت تعمل
        this.stopScanner();

        // تحديث الأزرار النشطة
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        event?.currentTarget?.classList.add('active');

        // إخفاء كافة الأقسام
        const tabs = ['tab-overview', 'tab-data', 'tab-scanner'];
        tabs.forEach(t => document.getElementById(t).style.display = 'none');

        // عرض القسم المطلوب
        if (type === 'overview') {
            document.getElementById('tab-overview').style.display = 'block';
            document.getElementById('tab-title').innerText = "Vue d'ensemble";
            this.loadOverview();
        } else if (type === 'scanner') {
            document.getElementById('tab-scanner').style.display = 'block';
            document.getElementById('tab-title').innerText = "Scanner de contrôle";
            this.startScanner();
        } else {
            document.getElementById('tab-data').style.display = 'block';
            if (type === 'bookings') this.loadBookingsTable();
            if (type === 'events') this.loadEventsTable();
        }
    },

    // 6. تشغيل ماسح الـ QR Code
    startScanner() {
        this.html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };

        this.html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                this.verifyTicket(decodedText);
                this.stopScanner(); // توقف مؤقت لتجنب التكرار
            }
        ).catch(err => console.error("Scanner Error:", err));
    },

    async verifyTicket(bookingNumber) {
        const res = await api.request('/bookings/check-in', 'POST', { booking_number: bookingNumber });

        if (res.success) {
            Swal.fire({ title: 'Accès Autorisé', text: res.message, icon: 'success' })
                .then(() => this.startScanner());
        } else {
            Swal.fire({ title: 'Erreur', text: res.message, icon: 'error' })
                .then(() => this.startScanner());
        }
    },

    stopScanner() {
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.stop().then(() => {
                document.getElementById("reader").innerHTML = "";
            });
        }
    },

    // 7. عرض جدول الحجوزات (للمستخدم)
    async loadBookingsTable() {
        document.getElementById('tab-title').innerText = "Mes Billets";
        document.getElementById('table-title').innerText = "Historique de vos réservations";
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');

        head.innerHTML = `<tr><th>REF</th><th>Événement</th><th>Date</th><th>Montant</th><th>Action</th></tr>`;
        body.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

        const res = await api.request('/my-bookings');
        if (res.success) {
            body.innerHTML = res.data.map(b => `
                <tr>
                    <td><span class="fw-bold text-primary">#${b.booking_number.split('-').pop()}</span></td>
                    <td><div class="fw-bold">${b.event.title}</div></td>
                    <td>${new Date(b.event.start_date).toLocaleDateString()}</td>
                    <td>${b.total_amount} MAD</td>
                    <td>
                        <button onclick="bookingFlow.showTicket('${b.booking_number}')" class="btn btn-sm btn-light border shadow-sm rounded-pill">
                            <i class="fas fa-qrcode"></i> Ticket
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    },

    // 8. عرض جدول الأحداث (للمنظم/الآدمن)
    async loadEventsTable() {
        document.getElementById('tab-title').innerText = "Mes Événements";
        document.getElementById('table-title').innerText = "Gestion des événements publiés";
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');

        head.innerHTML = `<tr><th>Image</th><th>Événement</th><th>Places</th><th>Prix</th><th>Action</th></tr>`;
        
        const res = await api.request('/events');
        if (res.success) {
            body.innerHTML = res.data.map(e => `
                <tr>
                    <td><img src="${e.image_url}" width="40" height="40" class="rounded shadow-sm"></td>
                    <td><div class="fw-bold">${e.title}</div><small>${e.city}</small></td>
                    <td>${e.current_attendees} / ${e.max_attendees || '∞'}</td>
                    <td>${e.formatted_price}</td>
                    <td>
                        <button class="btn btn-sm btn-white border text-danger" onclick="dash.deleteEvent(${e.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    },

    // مساعد لتحديث الأرقام
    setStat(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }
};

// تشغيل عند التحميل
document.addEventListener('DOMContentLoaded', () => dash.init());