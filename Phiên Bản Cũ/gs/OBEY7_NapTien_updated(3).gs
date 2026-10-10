/** OBEY 7 — Google Apps Script nạp Pi
 * 1) Dán toàn bộ vào Extensions > Apps Script của Google Sheet.
 * 2) Chạy setupSheets() một lần và cấp quyền.
 * 3) Deploy > New deployment > Web app; Execute as: Me; Who has access: Anyone.
 * 4) Dán URL /exec vào APPS_SCRIPT_URL trong naptien.html.
 * 5) Admin duyệt: trong sheet NapTien, sửa cột G (Mã admin duyệt) thành đúng mã giao dịch ở cột C.
 *    Không cần nhập số Pi thủ công; script tự cộng vào sheet SoDuPi.
 */
const CFG = {
  TOPUP_SHEET: 'NapTien',
  BALANCE_SHEET: 'SoDuPi',
  MONTHLY_SHEET: 'ThuongThang',
  INITIAL_ADMIN_CODE: 'XXXXXXXXXXXXXX',
  HEADERS: ['Thời gian', 'Tên nhân vật', 'Mã giao dịch', 'Số tiền VND', 'Pi yêu cầu', 'Mã admin gửi lên', 'Mã admin duyệt', 'Trạng thái', 'Pi đã cộng', 'User-Agent', 'Tháng tính thưởng', 'Pi thưởng tháng', 'Các mốc đã nhận']
};
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.TOPUP_SHEET);
  if (!sh) sh = ss.insertSheet(CFG.TOPUP_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(CFG.HEADERS);
  sh.getRange(1,1,1,CFG.HEADERS.length).setValues([CFG.HEADERS]);
  sh.setFrozenRows(1); sh.getRange(1,1,1,CFG.HEADERS.length).setFontWeight('bold').setBackground('#172033').setFontColor('#ffe6a1');
  sh.autoResizeColumns(1, CFG.HEADERS.length);
  let bal = ss.getSheetByName(CFG.BALANCE_SHEET);
  if (!bal) bal = ss.insertSheet(CFG.BALANCE_SHEET);
  if (bal.getLastRow() === 0) bal.appendRow(['Tên nhân vật', 'Tổng Pi đã duyệt', 'Cập nhật gần nhất']);
  bal.setFrozenRows(1); bal.getRange(1,1,1,3).setFontWeight('bold').setBackground('#172033').setFontColor('#ffe6a1');
  bal.autoResizeColumns(1,3);
  let monthly = ss.getSheetByName(CFG.MONTHLY_SHEET);
  if (!monthly) monthly = ss.insertSheet(CFG.MONTHLY_SHEET);
  if (monthly.getLastRow() === 0) monthly.appendRow(['Tháng YYYY-MM', 'Tên nhân vật', 'Tổng nạp tháng VND', 'Mốc đã nhận', 'Tổng Pi thưởng']);
  monthly.setFrozenRows(1); monthly.getRange(1,1,1,5).setFontWeight('bold').setBackground('#172033').setFontColor('#ffe6a1'); monthly.autoResizeColumns(1,5);
}
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'submit') return json_({ok:false,error:'INVALID_ACTION'});
    const name = String(body.characterName || '').trim();
    const tx = String(body.transactionCode || '').trim().toUpperCase();
    const amount = Number(body.amountVnd);
    const pi = Number(body.pi);
    if (!name || !/^[A-Z0-9]{9}$/.test(tx) || ![10000,20000,50000,100000,200000,500000,1000000,2000000,5000000].includes(amount) || pi !== amount) return json_({ok:false,error:'INVALID_DATA'});
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(CFG.TOPUP_SHEET);
    if (!sh) { setupSheets(); sh = ss.getSheetByName(CFG.TOPUP_SHEET); }
    const existing = findTxRow_(sh, tx);
    if (existing) return json_({ok:true,duplicate:true,transactionCode:tx});
    sh.appendRow([new Date(), name, tx, amount, pi, String(body.adminCode || CFG.INITIAL_ADMIN_CODE), '', 'ĐANG CHỜ', 0, String(body.userAgent || '').slice(0,300)]);
    return json_({ok:true,transactionCode:tx,status:'ĐANG CHỜ'});
  } catch (err) { return json_({ok:false,error:String(err)}); }
}
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action !== 'status') return json_({ok:true,service:'OBEY7_NAPTIEN'});
  const tx = String((e.parameter && e.parameter.tx) || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{9}$/.test(tx)) return json_({status:'NOT_FOUND'});
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.TOPUP_SHEET);
  if (!sh || sh.getLastRow() < 2) return json_({status:'NOT_FOUND'});
  const row = findTxRow_(sh, tx);
  if (!row) return json_({status:'NOT_FOUND'});
  const values = sh.getRange(row,1,1,CFG.HEADERS.length).getValues()[0];
  return json_({status:normalizeStatus_(values[7]),transactionCode:tx,characterName:String(values[1]),pi:Number(values[8])||Number(values[4])||0,creditedPi:Number(values[8])||0,monthlyBonus:Number(values[11])||0});
}
/** Installable edit trigger is not required for a simple onEdit, but install it if you prefer. */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== CFG.TOPUP_SHEET || e.range.getRow() < 2 || e.range.getColumn() !== 7) return;
  const row = e.range.getRow();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const tx = String(sh.getRange(row,3).getDisplayValue()).trim().toUpperCase();
    const adminCode = String(sh.getRange(row,7).getDisplayValue()).trim().toUpperCase();
    const status = String(sh.getRange(row,8).getDisplayValue()).trim();
    if (!tx || !adminCode || status === 'ĐÃ DUYỆT' || status === 'TỪ CHỐI') return;
    if (adminCode === 'REJECT') { sh.getRange(row,8).setValue('TỪ CHỐI'); return; }
    if (adminCode !== tx) { sh.getRange(row,8).setValue('MÃ DUYỆT KHÔNG KHỚP'); return; }
    const name = String(sh.getRange(row,2).getDisplayValue()).trim();
    const pi = Number(sh.getRange(row,5).getValue());
    const amountVnd = Number(sh.getRange(row,4).getValue());
    if (!name || !pi || amountVnd !== pi || ![10000,20000,50000,100000,200000,500000,1000000,2000000,5000000].includes(pi)) { sh.getRange(row,8).setValue('LỖI DỮ LIỆU'); return; }
    // Cộng dồn theo tháng dương lịch và cấp từng mốc thưởng đúng một lần/tháng.
    const reward = applyMonthlyReward_(name, amountVnd);
    const totalPi = pi + reward.bonusPi;
    updateBalance_(name, totalPi);
    sh.getRange(row,8).setValue('ĐÃ DUYỆT');
    sh.getRange(row,9).setValue(totalPi);
    sh.getRange(row,11).setValue(reward.monthKey);
    sh.getRange(row,12).setValue(reward.bonusPi);
    sh.getRange(row,13).setValue(reward.newlyReached.join(', '));
    sh.getRange(row,1).setNote('Đã cộng '+pi+' Pi vào SoDuPi lúc '+new Date().toLocaleString());
  } finally { lock.releaseLock(); }
}
function applyMonthlyReward_(name, amountVnd) {
  const tiers = [
    {amount:50000, bonus:500}, {amount:100000, bonus:1500},
    {amount:200000, bonus:4000}, {amount:500000, bonus:12000},
    {amount:1000000, bonus:30000}, {amount:2000000, bonus:80000},
    {amount:5000000, bonus:250000}
  ];
  const now = new Date();
  const monthKey = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.MONTHLY_SHEET);
  if (!sh) { setupSheets(); sh = ss.getSheetByName(CFG.MONTHLY_SHEET); }
  const last = sh.getLastRow();
  const target = name.trim().toLowerCase();
  let row = 0, total = 0, achieved = [];
  if (last >= 2) {
    const rows = sh.getRange(2,1,last-1,5).getDisplayValues();
    for (let i=0;i<rows.length;i++) {
      if (rows[i][0] === monthKey && String(rows[i][1]).trim().toLowerCase() === target) {
        row = i+2; total = Number(rows[i][2]) || 0;
        achieved = String(rows[i][3] || '').split(',').map(x=>Number(x.trim())).filter(Boolean);
        break;
      }
    }
  }
  const before = total;
  total += amountVnd;
  let bonusPi = 0;
  const newlyReached = [];
  tiers.forEach(tier => {
    if (before < tier.amount && total >= tier.amount && !achieved.includes(tier.amount)) {
      bonusPi += tier.bonus; achieved.push(tier.amount); newlyReached.push(tier.amount + ' VND');
    }
  });
  const bonusTotal = (row ? Number(sh.getRange(row,5).getValue()) || 0 : 0) + bonusPi;
  const values = [monthKey, name, total, achieved.join(', '), bonusTotal];
  if (row) sh.getRange(row,1,1,5).setValues([values]); else sh.appendRow(values);
  return {monthKey, bonusPi, newlyReached};
}

function updateBalance_(name, pi) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.BALANCE_SHEET);
  if (!sh) { setupSheets(); sh = ss.getSheetByName(CFG.BALANCE_SHEET); }
  const last = sh.getLastRow();
  const target = name.trim().toLowerCase();
  if (last >= 2) {
    const names = sh.getRange(2,1,last-1,1).getDisplayValues();
    for (let i=0;i<names.length;i++) {
      if (String(names[i][0]).trim().toLowerCase() === target) {
        const r = i+2;
        sh.getRange(r,2).setValue((Number(sh.getRange(r,2).getValue())||0)+pi);
        sh.getRange(r,3).setValue(new Date());
        return;
      }
    }
  }
  sh.appendRow([name, pi, new Date()]);
}
function findTxRow_(sh, tx) {
  const last = sh.getLastRow(); if (last < 2) return 0;
  const values = sh.getRange(2,3,last-1,1).getDisplayValues();
  for (let i=0;i<values.length;i++) if (String(values[i][0]).trim().toUpperCase() === tx) return i+2;
  return 0;
}
function normalizeStatus_(s) {
  const v=String(s||'').trim();
  if (v==='ĐÃ DUYỆT') return 'APPROVED';
  if (v==='TỪ CHỐI') return 'REJECTED';
  if (v==='ĐANG CHỜ' || v==='MÃ DUYỆT KHÔNG KHỚP' || !v) return 'PENDING';
  return v;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
