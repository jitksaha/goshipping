/**
 * =========================================================================
 * GoShipping Official POS Ledger & Order Synchronization Script
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0
 * Sheet / Tab Name: "Sheet1" (or "All-in-One")
 * Total Columns: 28 (Columns A to AB)
 * =========================================================================
 *
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1K7JQIwYXmKjy6CsLufuV-2Adljqg2qhJSwUQOboJUwQ/edit?gid=0#gid=0
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any code in the editor, and paste this entire script.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app" (click gear icon next to Select type if needed).
 * 6. Description: "GoShipping Live Ledger Webhook 2026".
 * 7. Execute as: "Me" (your Google account).
 * 8. Who has access: "Anyone" (allows GoShipping server to POST order data).
 * 9. Click "Deploy" and copy the Web App URL (ends with /exec).
 * 10. Paste the Web App URL into GoShipping Admin Terminal (or in .env as GOOGLE_SHEET_WEBHOOK_URL).
 * =========================================================================
 */

var HEADERS = [
  "Order ID",                          // 1 (A)
  "Order Date",                        // 2 (B)
  "CN Date",                           // 3 (C)
  "China Courier Tracking (SF/ZTO)",   // 4 (D)
  "Customer Name",                     // 5 (E)
  "Current Status",                    // 6 (F)
  "Mobile No",                         // 7 (G)
  "Importer / Client",                 // 8 (H)
  "Shipping Mark",                     // 9 (I)
  "Website Order No",                  // 10 (J)
  "Item / Product Details",            // 11 (K)
  "Supplier / Shop Name",              // 12 (L)
  "Quantity (Pcs)",                    // 13 (M)
  "Unit Price (RMB)",                  // 14 (N)
  "Total Purchase (RMB) [Auto]",       // 15 (O)
  "RMB Rate (BDT)",                    // 16 (P)
  "Purchase Cost (BDT) [Auto]",        // 17 (Q)
  "Purchase Cost Paid     [ Customer ]", // 18 (R)
  "Purchase Cost Due [Auto]",          // 19 (S)
  "Service Type",                      // 20 (T)
  "BD Date",                           // 21 (U)
  "BD Weight (KG)",                    // 22 (V)
  "Shipping Rate / KG (BDT)",          // 23 (W)
  "International Freight (BDT) [Auto]", // 24 (X)
  "Total Bill (BDT) [Auto]",           // 25 (Y)
  "Payment Status [Auto]",             // 26 (Z)
  "BD Tracking No",                    // 27 (AA)
  "Remark / Customer Update"           // 28 (AB)
];

/**
 * Initializes and styles the header row in the "Sheet1" / "All-in-One" sheet.
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("All-in-One") || ss.getActiveSheet();
  var firstCellVal = sheet.getRange(1, 1).getValue().toString().trim();

  // If row 1 is not already header, insert new row at top
  if (firstCellVal !== "Order ID") {
    sheet.insertRowBefore(1);
  }

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setBackground("#11181E")
             .setFontColor("#FFFFFF")
             .setFontWeight("bold")
             .setFontSize(10)
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle")
             .setWrap(true);

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  // Set plain text format for Order ID, Tracking numbers, Mobile to prevent formula errors
  sheet.getRange("A:A").setNumberFormat("@");
  sheet.getRange("D:D").setNumberFormat("@");
  sheet.getRange("G:G").setNumberFormat("@");
  sheet.getRange("I:I").setNumberFormat("@");
  sheet.getRange("J:J").setNumberFormat("@");
  sheet.getRange("AA:AA").setNumberFormat("@");

  for (var c = 1; c <= HEADERS.length; c++) {
    sheet.autoResizeColumn(c);
  }
}

/**
 * Custom Menu inside Google Sheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 GoShipping')
    .addItem('⚙️ Setup Sheet Headers & Styling', 'setupSheet')
    .addToUi();
}

/**
 * Webhook handler for incoming order data from GoShipping portal.
 */
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("All-in-One") || ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // If manual header setup action
    if (data.action === "setup_headers") {
      setupSheet();
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Headers initialized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var orderId = data.orderId;
    var lookupId = data.oldOrderId || data.previousOrderId || orderId;
    if (!orderId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing orderId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lastRow = sheet.getLastRow();
    var targetRow = -1;

    // 1. Search if order already exists in Column A (from row 2 down)
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var cellVal = String(ids[i][0]).trim();
        if (cellVal === String(lookupId).trim() || cellVal === String(orderId).trim()) {
          targetRow = i + 2;
          break;
        }
      }
    }

    // 2. If not found, find the first available row where Col A is empty
    if (targetRow === -1 && lastRow > 1) {
      var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < colA.length; j++) {
        var valA = String(colA[j][0] || '').trim();
        if (valA === '') {
          targetRow = j + 2;
          break;
        }
      }
    }

    // Format phone number to force string
    var mobile = data.mobileNo ? String(data.mobileNo) : '';
    if (mobile && !mobile.startsWith("'")) {
      mobile = "'" + mobile;
    }

    // Build the 28-column row array (matching GoShipping 2026 Spreadsheet A to AB)
    var rowValues = (data.rowValues && data.rowValues.length >= 28) ? data.rowValues.slice(0, 28) : [
      data.orderId || '',
      data.orderDate || '',
      data.cnDate || '',
      data.chinaCourierTracking || '',
      data.customerName || '',
      data.currentStatus || 'Processing',
      mobile,
      data.importerClient || '',
      data.shippingMark || '',
      data.websiteOrderNo || '',
      data.itemDetails || '',
      data.supplierName || 'Taobao',
      Number(data.quantity) || 1,
      Number(data.unitPriceRmb) || 0,
      Number(data.totalPurchaseRmb) || 0,
      Number(data.rmbRateBdt) || 19.5,
      Number(data.purchaseCostBdt) || 0,
      Number(data.purchaseCostPaidBdt) || 0,
      Number(data.purchaseCostDueBdt) || 0,
      data.serviceType || 'Sourcing & Shipping',
      data.bdDate || '',
      Number(data.bdWeightKg) || 0,
      Number(data.shippingRatePerKgBdt) || 850,
      Number(data.internationalFreightBdt) || 0,
      Number(data.totalBillBdt) || 0,
      data.paymentStatus || 'Due',
      data.bdTrackingNo || '',
      data.remark || ''
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
      targetRow = sheet.getLastRow();
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      orderId: orderId,
      row: targetRow,
      action: targetRow > 0 ? 'updated' : 'appended'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
