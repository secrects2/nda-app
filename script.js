// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 



const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let currentTemplate = null; // 存合約圖的 Base64

// --- 初始化：讀取合約與簽名 ---
window.onload = async function() {
    // 設定 Canvas 解析度 (讓簽名不模糊)
    canvas.width = 500; 
    canvas.height = 300;
    
    try {
        let res = await fetch(API_URL);
        let data = await res.json();
        
        // 1. 顯示合約底圖
        if (data.template) {
            document.getElementById('contract-img').src = data.template;
            currentTemplate = data.template;
        } else {
            document.getElementById('contract-img').alt = "管理者尚未上傳合約";
        }

        // 2. 顯示已簽署列表
        const list = document.getElementById('sig-list');
        list.innerHTML = ""; // 清空 Loading
        
        if (data.signatures && data.signatures.length > 0) {
            data.signatures.forEach(sig => {
                let div = document.createElement('div');
                div.className = 'sig-card';
                div.innerHTML = `
                    <img src="${sig.img}">
                    <div class="sig-info">
                        <strong>${sig.name}</strong><br>
                        ${sig.date}
                    </div>
                `;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = "<p style='color:#999; grid-column: span 2;'>目前尚無人簽署</p>";
        }
        
    } catch(e) {
        document.getElementById('loading-text').innerText = "讀取失敗，請重新整理";
    }
}

// --- 簽名板 (Modal) 控制 ---
function openModal() { document.getElementById('modal-sign').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-sign').style.display = 'none'; }
function clearPad() { ctx.clearRect(0,0,canvas.width, canvas.height); }

// --- 繪圖邏輯 ---
function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = e.clientX || e.touches[0].clientX;
    var clientY = e.clientY || e.touches[0].clientY;
    return { x: (clientX - rect.left)*scaleX, y: (clientY - rect.top)*scaleY };
}
function start(e) { isDrawing=true; draw(e); }
function end() { isDrawing=false; ctx.beginPath(); }
function draw(e) {
    if(!isDrawing) return; e.preventDefault();
    var pos = getPos(e);
    ctx.lineWidth=4; ctx.lineCap='round'; 
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
}
canvas.addEventListener('mousedown', start); canvas.addEventListener('mouseup', end); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchend', end); canvas.addEventListener('touchmove', draw, {passive:false});

// --- 送出簽名 ---
async function submitSign() {
    let name = document.getElementById('signer-name').value;
    if(!name) return alert("請輸入姓名");
    
    // 取得簽名圖片 (轉小一點以節省空間)
    let sigData = canvas.toDataURL('image/png', 0.5); 
    
    // 按鈕變更狀態
    let btn = document.querySelector('#modal-sign .btn-sign');
    btn.innerText = "傳送中..."; btn.disabled = true;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "sign_document", 
                name: name, 
                signatureData: sigData
            })
        });
        alert("✅ 簽名成功！");
        location.reload(); // 重整看結果
    } catch(e) {
        alert("失敗：" + e);
        btn.innerText = "確認送出"; btn.disabled = false;
    }
}

// --- 下載完整 PDF (合約 + 簽名) ---
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 1. 加入合約圖
    // 假設合約是 A4 比例，寬 190mm (留邊距), 高自動
    let imgProps = doc.getImageProperties(currentTemplate);
    let pdfWidth = 190; 
    let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);
    
    // 2. 加入簽名 (如果不夠放，就新增一頁)
    let yPos = pdfHeight + 20; // 從圖片下方開始
    
    // 抓取網頁上的所有簽名卡片
    let cards = document.querySelectorAll('.sig-card');
    
    doc.setFontSize(16);
    doc.text("Signatures:", 10, yPos);
    yPos += 10;

    cards.forEach((card, index) => {
        // 檢查是否需要換頁
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        let img = card.querySelector('img').src;
        let txt = card.querySelector('.sig-info').innerText;
        
        // 畫簽名圖
        doc.addImage(img, 'PNG', 20, yPos, 40, 20);
        // 寫名字與日期
        doc.setFontSize(10);
        doc.text(txt, 70, yPos + 10);
        
        yPos += 30; // 往下移
    });
    
    doc.save("Completed_Contract.pdf");
}

// --- 管理者功能 ---
function checkAdmin() {
    let p = prompt("請輸入管理員密碼:");
    if(p === "admin") document.getElementById('admin-panel').style.display = "block";
}
function logout() { location.reload(); }

function clearSignatures() {
    if(!confirm("確定要清空所有簽名嗎？")) return;
    fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "clear_signatures" }) })
    .then(() => { alert("已清空"); location.reload(); });
}

async function uploadTemplate() {
    let file = document.getElementById('upload-input').files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "upload_template", fileData: e.target.result })
        });
        alert("合約已更新"); location.reload();
    }
    reader.readAsDataURL(file);
}
