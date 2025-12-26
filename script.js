// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 



const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let currentTemplate = null; // 存合約圖的 Base64
// ... 前面的變數宣告 ...
let globalSignatures = []; // ★ 新增這個全域變數，用來存簽名資料
// --- 初始化：讀取合約與簽名 ---
window.onload = async function() {
    // ... (保留原本的 canvas 設定) ...
    canvas.width = 500; 
    canvas.height = 300;

    try {
        let res = await fetch(API_URL);
        let data = await res.json();
        
        // 1. 處理合約底圖 (保留原本邏輯)
        if (data.template) {
            document.getElementById('contract-img').src = data.template;
            currentTemplate = data.template;
        }

        // 2. 處理簽名列表
        const list = document.getElementById('sig-list');
        list.innerHTML = "";
        
        // ★ 修改這裡：把抓到的資料存進全域變數 globalSignatures
        if (data.signatures && data.signatures.length > 0) {
            globalSignatures = data.signatures; // <--- 關鍵！存起來給下載功能用

            data.signatures.forEach(sig => {
                // ... (保留原本產生 HTML 卡片的代碼) ...
                let div = document.createElement('div');
                div.className = 'sig-card';
                div.innerHTML = `<img src="${sig.img}"><div class="sig-info"><strong>${sig.name}</strong><br>${sig.date}</div>`;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = "<p style='color:#999;'>目前尚無人簽署</p>";
        }
    } catch(e) {
        console.error(e);
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
// --- 下載完整整合版 PDF ---
function downloadMergedPDF() {
    if (!currentTemplate) return alert("錯誤：找不到合約底圖");
    
    // 顯示提示
    const btn = document.querySelector('.btn-download');
    const originalText = btn.innerText;
    btn.innerText = "生成中...";
    btn.disabled = true;

    // 1. 初始化 jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(); // 預設 A4 直向 (210mm x 297mm)

    // 2. 第一頁：放入合約底圖
    // 計算圖片比例以填滿 A4 寬度 (190mm，留 10mm邊距)
    const imgProps = doc.getImageProperties(currentTemplate);
    const pdfWidth = 190;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);

    // 3. 第二頁開始：條列所有簽名
    // 如果想要簽名直接接在合約下面，可以判斷 pdfHeight 是否還夠位置
    // 這裡為了排版整齊，我們統一「新增一頁」來放簽名
    doc.addPage(); 
    
    doc.setFontSize(16);
    doc.text("簽署紀錄表 (Signatures)", 10, 20);
    
    let yPos = 40; // 初始 Y 座標

    // 遍歷所有簽名
    globalSignatures.forEach((sig, index) => {
        // 檢查是否需要換頁 (如果 Y 座標超過 260mm)
        if (yPos > 260) {
            doc.addPage();
            yPos = 20; // 重置 Y 座標
        }

        // A. 畫分隔線
        doc.setLineWidth(0.5);
        doc.line(10, yPos - 5, 200, yPos - 5);

        // B. 放入簽名圖片 (x=10, 寬=50, 高=30)
        // 注意：這裡直接使用後端傳來的 Base64 圖片
        doc.addImage(sig.img, 'PNG', 10, yPos, 50, 30);

        // C. 放入文字資訊 (姓名、日期)
        doc.setFontSize(12);
        doc.text(`姓名: ${sig.name}`, 70, yPos + 10);
        doc.text(`時間: ${sig.date}`, 70, yPos + 20);
        
        // 往下移動座標，準備畫下一個
        yPos += 40; 
    });

    // 4. 存檔
    doc.save("Completed_Contract_Full.pdf");

    // 恢復按鈕
    btn.innerText = originalText;
    btn.disabled = false;
}
