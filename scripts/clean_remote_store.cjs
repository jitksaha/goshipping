const fs = require('fs');
const path = require('path');

// 1. Rebuild and sanitize user accounts in .auth_store.json
const authStorePath = path.resolve(__dirname, '../.auth_store.json');
if (fs.existsSync(authStorePath)) {
  try {
    const d = JSON.parse(fs.readFileSync(authStorePath, 'utf8'));
    const accountsMap = new Map();

    // Preserve existing accounts
    if (Array.isArray(d.accounts)) {
      for (const a of d.accounts) {
        if (a && a.id) accountsMap.set(a.id, a);
      }
    }

    // Rebuild any missing accounts from active/stored sessions
    if (Array.isArray(d.sessions)) {
      for (const s of d.sessions) {
        if (s && s.user && s.user.id && !accountsMap.has(s.user.id)) {
          accountsMap.set(s.user.id, {
            id: s.user.id,
            email: s.user.email || '',
            fullName: s.user.fullName || 'Valued User',
            role: s.user.role || 'customer',
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

    d.accounts = Array.from(accountsMap.values());
    fs.writeFileSync(authStorePath, JSON.stringify(d, null, 2), 'utf8');
    console.log(`[CleanRemoteStore] Preserved ${d.accounts.length} accounts in .auth_store.json`);
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

// If POS ledger is empty, seed user's order INV-TEST-20261
const hasTestOrder = posRecords.some(
  (r) =>
    (r.orderId && r.orderId.toUpperCase() === 'INV-TEST-20261') ||
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
