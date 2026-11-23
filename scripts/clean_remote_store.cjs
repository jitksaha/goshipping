const fs = require('fs');
const path = require('path');

// 1. Rebuild and sanitize user accounts in .auth_store.json
// STRICT INVARIANT: Keep ONLY sr.shaishob@gmail.com as Super Admin, remove all other admin/staff accounts.
const authStorePath = path.resolve(__dirname, '../.auth_store.json');
if (fs.existsSync(authStorePath)) {
  try {
    const d = JSON.parse(fs.readFileSync(authStorePath, 'utf8'));
    const accountsMap = new Map();

    // Rebuild any missing accounts from active/stored sessions
    if (Array.isArray(d.sessions)) {
      for (const s of d.sessions) {
        if (s && s.user && s.user.id) {
          const userEmail = (s.user.email || '').toLowerCase().trim();
          const isStaff = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(s.user.role);
          const isShaishob = userEmail === 'sr.shaishob@gmail.com';

          // Demote any non-shaishob staff account to customer, or drop if mock admin
          if (isStaff && !isShaishob) {
            if (userEmail === 'admin@goshipping.com' || userEmail === 'ops@goshipping.com' || userEmail === 'warehouse@goshipping.com' || userEmail === 'sales@goshipping.com') {
              continue; // Drop mock admins completely
            }
            s.user.role = 'customer';
          }

          if (!accountsMap.has(s.user.id)) {
            accountsMap.set(s.user.id, {
              id: s.user.id,
              email: s.user.email || '',
              fullName: s.user.fullName || 'Valued User',
              role: isShaishob ? 'super_admin' : (s.user.role === 'customer' ? 'customer' : 'customer'),
              status: s.user.status || 'active',
              phone: s.user.phone || '',
              companyName: s.user.companyName || '',
              address: s.user.address || '',
              binNumber: s.user.binNumber || '',
              avatarUrl: s.user.avatarUrl
            });
          }
        }
      }
    }

    // Preserve existing accounts (filtering out any non-shaishob admins)
    if (Array.isArray(d.accounts)) {
      for (const a of d.accounts) {
        if (!a || !a.id) continue;
        const userEmail = (a.email || '').toLowerCase().trim();
        const isStaff = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(a.role);
        const isShaishob = userEmail === 'sr.shaishob@gmail.com';

        if (isStaff && !isShaishob) {
          if (userEmail === 'admin@goshipping.com' || userEmail === 'ops@goshipping.com' || userEmail === 'warehouse@goshipping.com' || userEmail === 'sales@goshipping.com') {
            continue; // Remove old mock admins
          }
          a.role = 'customer'; // Convert any other to regular customer
        }

        accountsMap.set(a.id, a);
      }
    }

    // Ensure sr.shaishob@gmail.com is strictly registered as Super Admin
    accountsMap.set('usr-shaishob-01', {
      id: 'usr-shaishob-01',
      email: 'sr.shaishob@gmail.com',
      fullName: 'Saimur Rahman Shaishob',
      role: 'super_admin',
      status: 'active'
    });

    // Clean sessions: remove stale mock admin sessions, ensure shaishob has active valid session
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const cleanSessions = [];
    let hasShaishobSession = false;

    if (Array.isArray(d.sessions)) {
      for (const s of d.sessions) {
        if (!s || !s.user) continue;
        const sEmail = (s.user.email || '').toLowerCase().trim();
        const isStaff = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'].includes(s.user.role);
        const isShaishob = sEmail === 'sr.shaishob@gmail.com';

        if (isStaff && !isShaishob) {
          continue; // Remove all other admin sessions
        }

        if (isShaishob) {
          hasShaishobSession = true;
          s.user.role = 'super_admin';
          s.expiresAt = thirtyDaysAhead; // Keep session valid
        }

        cleanSessions.push(s);
      }
    }

    if (!hasShaishobSession) {
      cleanSessions.unshift({
        sessionId: 'sess-shaishob-superadmin-master',
        user: {
          id: 'usr-shaishob-01',
          email: 'sr.shaishob@gmail.com',
          fullName: 'Saimur Rahman Shaishob',
          role: 'super_admin',
          status: 'active'
        },
        expiresAt: thirtyDaysAhead
      });
    }

    // Clean passwords: ensure Shaishob's password is set, remove removed admins
    const cleanPasswords = { ...(d.passwords || {}) };
    cleanPasswords['sr.shaishob@gmail.com'] = 'Saimur#2000#';
    delete cleanPasswords['admin@goshipping.com'];
    delete cleanPasswords['ops@goshipping.com'];
    delete cleanPasswords['warehouse@goshipping.com'];
    delete cleanPasswords['sales@goshipping.com'];

    d.accounts = Array.from(accountsMap.values());
    d.sessions = cleanSessions;
    d.passwords = cleanPasswords;

    fs.writeFileSync(authStorePath, JSON.stringify(d, null, 2), 'utf8');
    console.log(`[CleanRemoteStore] Preserved ${d.accounts.length} accounts in .auth_store.json (Sole Super Admin: sr.shaishob@gmail.com)`);
  } catch (e) {
    console.error('[CleanRemoteStore] Error sanitizing auth accounts:', e);
  }
}

// 2. Ensure POS Ledger store has active orders and deduplicate
const posStorePath = path.resolve(__dirname, '../.pos_ledger_store.json');
let posRecords = [];
try {
  if (fs.existsSync(posStorePath)) {
    const raw = fs.readFileSync(posStorePath, 'utf8');
    posRecords = JSON.parse(raw);
    if (!Array.isArray(posRecords)) posRecords = [];
  }
} catch (e) {
  posRecords = [];
}

// Ensure test order has the exact user's orderId INV-TEST-20261
for (const r of posRecords) {
  if (r.trackingNumber === 'CN-TEST-20261' || r.orderId === 'GOS-20261') {
    r.orderId = 'INV-TEST-20261';
  }
}

// If POS ledger is empty, seed user's order INV-TEST-20261
const hasTestOrder = posRecords.some(
  (r) =>
    (r.orderId && (r.orderId.toUpperCase() === 'INV-TEST-20261' || r.orderId.toUpperCase() === 'GOS-20261')) ||
    (r.trackingNumber && r.trackingNumber.toUpperCase() === 'CN-TEST-20261') ||
    (r.chinaCourierTracking && r.chinaCourierTracking.toUpperCase() === 'CN-TEST-20261')
);

if (!hasTestOrder) {
  posRecords.unshift({
    id: 'pos-test-20261',
    orderId: 'INV-TEST-20261',
    orderDate: '2026-11-23',
    cnDate: '2026-11-23',
    bdDate: '',
    customerName: 'Deshi Shades',
    mobileNo: '+8801601111994',
    importerClient: 'Deshi Shades',
    shippingMark: 'DGN-TEST-20261',
    websiteOrderNo: '',
    itemDetails: 'Smart Watch',
    chinaCourierTracking: 'CN-TEST-20261',
    currentStatus: 'PURCHASED CHINA WAREHOUSE',
    supplierName: 'Alibaba',
    quantity: 100,
    unitPriceRmb: 0,
    totalPurchaseRmb: 0,
    rmbRateBdt: 19.5,
    purchaseCostBdt: 0,
    purchaseCostPaidBdt: 0,
    purchaseCostDueBdt: 105000,
    serviceType: 'Sourcing & Shipping',
    cnWeightKg: 100,
    bdWeightKg: 0,
    shippingRatePerKgBdt: 0,
    internationalFreightBdt: 0,
    packingFeeBdt: 0,
    deliveryAddress: 'Flat 2/B, 16, 16/1 Basubazar Lane , Dayaganj',
    totalBillBdt: 105000,
    paymentStatus: 'Due',
    trackingNumber: 'CN-TEST-20261',
    remark: '',
    profitEstimateBdt: 0,
    sheetSyncStatus: 'synced',
    sheetSyncedAt: new Date().toISOString(),
    createdAt: '2026-11-23T15:06:29.387Z',
    updatedAt: '2026-11-23T15:06:29.387Z'
  });
}

// Deduplicate POS store by orderId and trackingNumber
const uniquePosRecords = [];
const seenPosKeys = new Set();
for (const rec of posRecords) {
  const oKey = (rec.orderId || '').trim().toUpperCase();
  const tKey = (rec.trackingNumber || '').trim().toUpperCase();
  if (oKey && seenPosKeys.has(oKey)) continue;
  if (tKey && seenPosKeys.has(tKey)) continue;
  if (oKey) seenPosKeys.add(oKey);
  if (tKey) seenPosKeys.add(tKey);
  uniquePosRecords.push(rec);
}

fs.writeFileSync(posStorePath, JSON.stringify(uniquePosRecords, null, 2), 'utf8');
console.log(`[CleanRemoteStore] Saved ${uniquePosRecords.length} unique orders in .pos_ledger_store.json`);

// 3. Remove duplicate/orphan shipments in .shipments_store.json that match POS records
const shipmentsStorePath = path.resolve(__dirname, '../.shipments_store.json');
if (fs.existsSync(shipmentsStorePath)) {
  try {
    const rawShipments = JSON.parse(fs.readFileSync(shipmentsStorePath, 'utf8'));
    if (Array.isArray(rawShipments)) {
      // Build set of all POS tracking numbers and order IDs
      const posKeys = new Set();
      for (const p of uniquePosRecords) {
        if (p.orderId) posKeys.add(p.orderId.toUpperCase());
        if (p.trackingNumber) posKeys.add(p.trackingNumber.toUpperCase());
        if (p.chinaCourierTracking) posKeys.add(p.chinaCourierTracking.toUpperCase());
        if (p.shippingMark) posKeys.add(p.shippingMark.toUpperCase());
        if (p.shippingMark) posKeys.add(`MARK-${p.shippingMark.toUpperCase()}`);
        if (p.bdTrackingNo) posKeys.add(p.bdTrackingNo.toUpperCase());
      }

      // Filter out any standalone shipments that duplicate POS records
      const cleanedShipments = rawShipments.filter((s) => {
        const sTracking = (s.trackingNumber || '').toUpperCase();
        const sOrder = (s.orderId || s.bookingReference || '').toUpperCase();
        const sBol = (s.billOfLadingNumber || '').toUpperCase();
        if (posKeys.has(sTracking) || posKeys.has(sOrder) || posKeys.has(sBol)) {
          console.log(`[CleanRemoteStore] Pruned duplicate shipment record: ${s.id} (${s.trackingNumber} - ${s.productName})`);
          return false;
        }
        return true;
      });

      fs.writeFileSync(shipmentsStorePath, JSON.stringify(cleanedShipments, null, 2), 'utf8');
      console.log(`[CleanRemoteStore] Pruned duplicate shipments; remaining standalone: ${cleanedShipments.length}`);
    }
  } catch (e) {
    console.error('[CleanRemoteStore] Error pruning duplicate shipments:', e);
  }
}
