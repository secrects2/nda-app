// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 

const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let bgImage = null;

// 初始化畫布
function initCanvas() {
    // 設定畫布解析度
    canvas.width = 800;
    canvas.height = 1130; // A4 比例
    loadRemoteTemplate(); // 嘗試載入雲端背景
}

// 載入雲端背景圖
async function loadRemoteTemplate() {
    document.getElementById('status').innerText = "正在讀取合約...";
    try {
        let res = await fetch(API_URL);
        let data = await res.json();
        if(data.status === 'success') {
            bgImage = new Image();
            bgImage.onload = () => {
                ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
                document.getElementById('status').innerText = "";
            };
            bgImage.src = data.imageBase64;
        } else {
            document.getElementById('status').innerText = "尚未設定合約，請管理員上傳。";
        }
    } catch(e) {
        console.log(e);
    }
}

// 繪圖功能
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

canvas.addEventListener('mousedown', start); canvas.addEventListener('mouseup', end); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', start, {passive: false}); canvas.addEventListener('touchend', end); canvas.addEventListener('touchmove', draw, {passive: false});

// 清除
function clearPad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
}

// 管理員上傳
async function uploadTemplate() {
    let file = document.getElementById('upload-input').files[0];
    if(!file) return alert("請選檔案");
    
    let reader = new FileReader();
    reader.onload = async function(e) {
        document.getElementById('status').innerText = "上傳中...";
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "upload_template", fileData: e.target.result })
        });
        alert("上傳成功！重新整理頁面即可看到。");
        location.reload();
    }
    reader.readAsDataURL(file);
}

// 送出簽名
async function submitSign() {
    let name = document.getElementById('signer-name').value;
    if(!name) return alert("請輸入姓名");
    
    document.getElementById('status').innerText = "處理中...";
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'px', [canvas.width, canvas.height]);
    doc.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, canvas.width, canvas.height);
    
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "sign_document", 
            name: name, 
            pdfData: doc.output('datauristring') 
        })
    });
    
    alert("簽署完成！");
    location.reload();
}

initCanvas();
