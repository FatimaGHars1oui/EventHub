/**
 * EventHub Fès - Dashboard Manager (Logiciel de gestion)
 * Version: 6.5.0 (PFE Final Release - Logical Split Admin/User)
 */

window.dashManager = {
    charts: { bar: null, pie: null },
    scanner: null,

    // 1. التهيئة (Initialization)
    async init() {
        if (!state.token || !state.user) {
            window.location.href = 'index.html';
            return;
        }

        // إعداد معلومات الملف الشخصي في الهيدر
        document.getElementById('user-name').innerText = state.user.name;
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${state.user.name}&background=4361ee&color=fff`;
        document.getElementById('user-role-badge').innerText = state.user.role;
        document.getElementById('display-role').innerText = (state.user.role === 'admin') ? 'Administrateur' : 'Utilisateur';

        // تطبيق الفصل المنطقي بين الأدوار
        this.applyPermissions(state.user.role);
        
        // تحميل الإحصائيات الافتراضية (نظرة عامة)
        this.loadOverview();
    },

    // 2. التحكم في العناصر المعروضة حسب الدور (Logic Split)
    applyPermissions(role) {
        if (role === 'admin') {
            // إظهار عناصر الآدمن فقط
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
            // إخفاء عناصر المستخدم العادي التي لا يحتاجها الآدمن
            document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
        } else {
            // للمستخدم العادي: إخفاء كل ما يخص الإدارة
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.user-only').forEach(el => el.style.display = 'block');
            
            // تغيير تسمية الإحصائيات (من أرباح إلى مصاريف)
            document.getElementById('stat-label-2').innerText = "Total Dépensé";
        }
    },

    // 3. التنقل بين الأقسام (Section Switcher)
    async showSection(sectionId) {
        this.stopScanner(); // إيقاف الكاميرا دائماً عند الانتقال

        // تحديث الأزرار في القائمة الجانبية
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        if (event && event.currentTarget) event.currentTarget.classList.add('active');

        // إخفاء كافة الأقسام
        const sections = ['section-overview', 'section-validation', 'section-data', 'tab-scanner'];
        sections.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });

        // عرض القسم المختار
        if (sectionId === 'overview') {
            document.getElementById('section-overview').style.display = 'block';
            document.getElementById('section-title').innerText = "Tableau de Bord";
            this.loadOverview();
        } else if (sectionId === 'validation') {
            document.getElementById('section-validation').style.display = 'block';
            document.getElementById('section-title').innerText = "Approbation";
            this.loadPendingEvents();
        } else if (sectionId === 'scanner') {
            document.getElementById('tab-scanner').style.display = 'block';
            document.getElementById('section-title').innerText = "Scanner de Tickets";
            this.startScanner();
        } else {
            document.getElementById('section-data').style.display = 'block';
            if (sectionId === 'users') this.loadUsersTable();
            if (sectionId === 'events') this.loadAllEventsTable();
            if (sectionId === 'bookings') this.loadMyBookingsTable();
        }
    },

    // 4. جلب الإحصائيات الحية
    async loadOverview() {
        const role = state.user.role;
        
        if (role === 'admin') {
            const res = await api.request('/admin/stats');
            if (res.success) {
                const d = res.data;
                document.getElementById('stat-count-1').innerText = d.total_bookings;
                document.getElementById('stat-count-2').innerText = d.total_revenue + ' MAD';
                document.getElementById('stat-count-3').innerText = 'Actif';
                this.renderCharts(d);
            }
        } else {
            const res = await api.request('/my-bookings');
            if (res.success) {
                const totalSpent = res.data.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
                document.getElementById('stat-count-1').innerText = res.data.length;
                document.getElementById('stat-count-2').innerText = totalSpent + ' MAD';
            }
        }
    },

    // 5. رسم المخططات البيانية (للآدمن فقط)
    renderCharts(data) {
        const barCtx = document.getElementById('barChart');
        const pieCtx = document.getElementById('pieChart');
        if (!barCtx) return;

        if (this.charts.bar) this.charts.bar.destroy();
        this.charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.popular_events.map(e => e.title.substring(0, 10) + '...'),
                datasets: [{ label: 'Billets vendus', data: data.popular_events.map(e => e.current_attendees), backgroundColor: '#4361ee', borderRadius: 10 }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        if (this.charts.pie) this.charts.pie.destroy();
        this.charts.pie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: data.events_by_category.map(c => c.name),
                datasets: [{ data: data.events_by_category.map(c => c.count), backgroundColor: ['#4361ee', '#4cc9f0', '#7209b7', '#f72585'] }]
            },
            options: { cutout: '80%', maintainAspectRatio: false }
        });
    },

    // 6. عرض جدول حجوزات المستخدم (التبويب الخاص بالمستخدم)
    async loadMyBookingsTable() {
        document.getElementById('table-title').innerText = "Mes Billets & Réservations";
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');

        head.innerHTML = `<tr><th>REF</th><th>Événement</th><th>Date</th><th>Montant</th><th>Actions</th></tr>`;
        body.innerHTML = '<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

        const res = await api.request('/my-bookings');
        if (res.success) {
            if (res.data.length === 0) { body.innerHTML = '<tr><td colspan="5" class="text-center py-5">Aucun billet trouvé.</td></tr>'; return; }
            body.innerHTML = res.data.map(b => `
                <tr>
                    <td class="fw-bold text-primary">#${b.booking_number.split('-').pop()}</td>
                    <td>${b.event.title}</td>
                    <td>${new Date(b.event.start_date).toLocaleDateString()}</td>
                    <td><span class="badge bg-success bg-opacity-10 text-success">${b.total_amount} MAD</span></td>
                    <td>
                        <button onclick="bookingFlow.showTicket('${b.booking_number}')" class="btn btn-sm btn-dark rounded-pill px-3">
                            <i class="fas fa-qrcode me-1"></i> Ticket
                        </button>
                    </td>
                </tr>`).join('');
        }
    },

    // 7. عرض جدول المستخدمين (للآدمن فقط)
    async loadUsersTable() {
        document.getElementById('table-title').innerText = "Gestion des Utilisateurs";
        const res = await api.request('/admin/users');
        const head = document.getElementById('table-head');
        const body = document.getElementById('table-body');
        
        head.innerHTML = `<tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Actions</th></tr>`;
        if (res.success) {
            body.innerHTML = res.data.map(u => `
                <tr>
                    <td><img src="https://ui-avatars.com/api/?name=${u.name}" class="rounded-circle me-2" width="30"> <strong>${u.name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge bg-light text-dark border small">${u.role}</span></td>
                    <td><button class="btn btn-sm text-danger" onclick="dashManager.deleteUser(${u.id})"><i class="fas fa-trash"></i></button></td>
                </tr>`).join('');
        }
    },

    // 8. نظام المسح (Scanner QR)
    startScanner() {
        this.scanner = new Html5Qrcode("reader");
        this.scanner.start({ facingMode: "environment" }, { fps: 15, qrbox: 250 }, (decodedText) => {
            this.handleCheckIn(decodedText);
            this.stopScanner();
        }).catch(err => console.error("Scanner Error:", err));
    },

    async handleCheckIn(bookingNumber) {
        const res = await api.request('/bookings/check-in', 'POST', { booking_number: bookingNumber });
        if (res.success) {
            Swal.fire({ title: 'Succès !', text: res.message, icon: 'success' }).then(() => this.startScanner());
        } else {
            Swal.fire({ title: 'Erreur', text: res.message, icon: 'error' }).then(() => this.startScanner());
        }
    },

    stopScanner() {
        if (this.scanner && this.scanner.isScanning) {
            this.scanner.stop().then(() => { document.getElementById("reader").innerHTML = ""; });
        }
    }
};

// تشغيل اللوحة عند التحميل
document.addEventListener('DOMContentLoaded', () => dashManager.init());