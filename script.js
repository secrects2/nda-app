// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 


const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let bgImage = null;

// --- 1. 系統初始化 ---
function initCanvas() {
    canvas.width = 800;
    canvas.height = 1130; // A4 比例
    loadRemoteTemplate();
}

// 載入雲端背景
async function loadRemoteTemplate() {
    setStatus("正在載入文件...");
    try {
        let res = await fetch(API_URL);
        let data = await res.json();
        if(data.status === 'success') {
            bgImage = new Image();
            bgImage.onload = () => {
                ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
                setStatus("");
            };
            bgImage.src = data.imageBase64;
        } else {
            setStatus("等待管理者上傳文件...");
        }
    } catch(e) {
        console.error(e);
        setStatus("連線錯誤，請檢查網路");
    }
}

function setStatus(msg) {
    document.getElementById('status').innerText = msg;
}

// --- 2. 繪圖功能 ---
function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = e.clientX || e.touches[0].clientX;
    var clientY = e.clientY || e.touches[0].clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}
function start(e) { isDrawing = true; draw(e); }
function end() { isDrawing = false; ctx.beginPath(); }
function draw(e) {
    if(!isDrawing) return;
    e.preventDefault();
    var pos = getPos(e);
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
}
// 綁定事件
canvas.addEventListener('mousedown', start); canvas.addEventListener('mouseup', end); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', start, {passive: false}); canvas.addEventListener('touchend', end); canvas.addEventListener('touchmove', draw, {passive: false});

// --- 3. 按鈕功能 ---
function clearPad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
}

// 使用者送出簽名
async function submitSign() {
    let name = document.getElementById('signer-name').value;
    if(!name) return alert("請輸入姓名");
    
    setStatus("處理中，請稍候...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'px', [canvas.width, canvas.height]);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, canvas.width, canvas.height);
    
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "sign_document", 
                name: name, 
                pdfData: doc.output('datauristring') 
            })
        });
        alert("✅ 簽署完成！謝謝您。");
        location.reload(); // 重整頁面
    } catch (e) {
        alert("上傳失敗：" + e);
        setStatus("上傳失敗");
    }
}

// --- 4. 管理者登入邏輯 ---

// 開啟登入視窗
function openLogin() {
    document.getElementById('login-modal').style.display = 'flex';
}
// 關閉登入視窗
function closeLogin() {
    document.getElementById('login-modal').style.display = 'none';
}
// 登出
function logout() {
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('page-title').innerText = "請於下方簽署文件";
    alert("已登出");
}

// 驗證帳密
function checkLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    if (u === 'admin' && p === 'admin') {
        alert("登入成功！");
        closeLogin();
        // 顯示管理者區塊
        document.getElementById('admin-panel').style.display = 'block';
        // 更改標題提示
        document.getElementById('page-title').innerText = "預覽模式 (管理者)";
        // 清空輸入框以防萬一
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    } else {
        alert("帳號或密碼錯誤 ❌");
    }
}

// 管理者上傳背景
async function uploadTemplate() {
    let file = document.getElementById('upload-input').files[0];
    if(!file) return alert("請選檔案");
    
    let reader = new FileReader();
    reader.onload = async function(e) {
        setStatus("正在上傳底圖...");
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "upload_template", fileData: e.target.result })
        });
        alert("✅ 上傳成功！所有使用者重新整理後將看到新背景。");
        location.reload();
    }
    reader.readAsDataURL(file);
}

// 啟動
initCanvas();
