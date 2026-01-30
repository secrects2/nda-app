// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 
; 

// 2. 請確認您的字型檔名 (需與 GitHub 上傳的一模一樣，區分大小寫)
const FONT_FILENAME = "./myfont.ttf"; 

// ==========================================
// ★ 系統全域變數
// ==========================================
const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let currentTemplate = null; // 存合約圖的 Base64
let globalSignatures = [];  // 存簽名資料

// ==========================================
// ★ 1. 系統初始化：讀取資料
// ==========================================
window.onload = async function() {
    // 初始化畫布解析度
    canvas.width = 500; 
    canvas.height = 300;

    try {
        let res = await fetch(API_URL);
        let data = await res.json();
        
        // --- A. 處理合約底圖 ---
        if (data.template) {
            document.getElementById('contract-img').src = data.template;
            currentTemplate = data.template;
        } else {
            document.getElementById('contract-img').alt = "管理者尚未上傳合約";
        }

        // --- B. 顯示合約名稱 ---
        if (data.docName) {
            document.getElementById('doc-title').innerText = "合約：" + data.docName;
        }

        // --- C. 顯示簽名列表 ---
        const list = document.getElementById('sig-list');
        list.innerHTML = "";
        
        if (data.signatures && data.signatures.length > 0) {
            globalSignatures = data.signatures; 

            data.signatures.forEach(sig => {
                let div = document.createElement('div');
                div.className = 'sig-card';
                // 這裡只顯示時間 (因為使用者沒輸入名字)
                div.innerHTML = `<img src="${sig.img}"><div class="sig-info">時間: ${sig.date}</div>`;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = "<p style='color:#999; grid-column: span 2;'>目前尚無人簽署</p>";
        }
    } catch(e) {
        console.error(e);
        document.getElementById('contract-img').alt = "無法連線至資料庫";
    }
}

// ==========================================
// ★ 2. 簽名板功能 (Canvas)
// ==========================================
function openModal() { document.getElementById('modal-sign').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-sign').style.display = 'none'; }
function clearPad() { ctx.clearRect(0,0,canvas.width, canvas.height); }

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

// 綁定畫布事件 (滑鼠 & 觸控)
canvas.addEventListener('mousedown', start); canvas.addEventListener('mouseup', end); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', start, {passive:false}); canvas.addEventListener('touchend', end); canvas.addEventListener('touchmove', draw, {passive:false});


// ==========================================
// ★ 3. 送出簽名 (免輸入名字版)
// ==========================================
// --- 送出簽名 (自動合成 PDF 版) ---
async function submitSign() {
    if (!currentTemplate) return alert("錯誤：找不到合約底圖，無法合成 PDF");

    let autoName = "已簽署"; 
    let btn = document.querySelector('#modal-sign .btn-sign');
    let originalText = btn.innerText;
    
    btn.innerText = "生成合約中..."; 
    btn.disabled = true;

    try {
        // 1. 準備簽名圖片 (給網頁預覽用)
        let sigData = canvas.toDataURL('image/png', 0.5); 

        // 2. 準備合成 PDF (給存檔用)
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // (A) 放入合約底圖
        const imgProps = doc.getImageProperties(currentTemplate);
        const pdfWidth = 190;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);

        // (B) 放入使用者的簽名
        // 我們把簽名放在 PDF 的下方固定位置，或是另起一頁
        // 為了簡單與自動化，我們這裡示範「另起一頁」放簽名，保證不遮擋合約
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Signature Page", 10, 20);
        
        // 簽名圖
        doc.addImage(sigData, 'PNG', 10, 40, 50, 30);
        
        // 加上時間戳記 (使用標準字型，避免中文亂碼問題)
        // 因為是自動存檔，我們用英文時間格式即可，這樣速度最快且不需載入字型
        let timeStr = new Date().toLocaleString('en-US', { hour12: false });
        doc.setFontSize(10);
        doc.text("Signed at: " + timeStr, 10, 80);

        // (C) 輸出 PDF Base64
        let pdfData = doc.output('datauristring');

        // 3. 傳送給後端
        btn.innerText = "上傳雲端中...";
        
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "sign_document", 
                name: autoName,
                signatureData: sigData, // 傳送圖片 (存F欄)
                pdfData: pdfData        // 傳送PDF (存C欄)
            })
        });

        alert("✅ 簽署完成！完整合約已存入雲端。");
        location.reload(); 

    } catch(e) {
        console.error(e);
        alert("失敗：" + e.message);
        btn.innerText = originalText; 
        btn.disabled = false;
    }
}


// ==========================================
// ★ 4. 下載 PDF (含字型載入)
// ==========================================
// 工具：下載字型檔並轉 Base64
async function loadFont(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("字型下載失敗 (請檢查 GitHub 檔名)");
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function downloadMergedPDF() {
    if (!currentTemplate) return alert("錯誤：找不到合約底圖");
    
    const btn = document.querySelector('.btn-download');
    const originalText = btn.innerText;
    btn.innerText = "載入字型中..."; 
    btn.disabled = true;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // A. 載入字型
    const fontBase64 = await loadFont(FONT_FILENAME);
    
    if (fontBase64) {
        doc.addFileToVFS("CustomFont.ttf", fontBase64);
        doc.addFont("CustomFont.ttf", "CustomFont", "normal");
        doc.setFont("CustomFont");
    } else {
        alert("⚠️ 字型載入失敗，中文將無法顯示");
    }

    btn.innerText = "生成 PDF...";

    // B. 放入合約圖 (Page 1)
    const imgProps = doc.getImageProperties(currentTemplate);
    const pdfWidth = 190;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);

    // C. 放入簽名列表 (Page 2+)
    doc.addPage();
    doc.setFontSize(16);
    doc.text("簽署紀錄表 (Signatures)", 10, 20);

    let yPos = 40;
    if(typeof globalSignatures !== 'undefined'){
        globalSignatures.forEach((sig) => {
            // 自動換頁
            if (yPos > 260) { doc.addPage(); yPos = 20; }
            
            doc.setLineWidth(0.5);
            doc.line(10, yPos - 5, 200, yPos - 5);
            
            // 簽名圖
            doc.addImage(sig.img, 'PNG', 10, yPos, 50, 30);
            
            // 文字資訊 (只顯示時間)
            doc.setFontSize(12);
            doc.text(`Signed at: ${sig.date}`, 70, yPos + 15);
            
            yPos += 40; 
        });
    }

    doc.save("Completed_Contract.pdf");
    btn.innerText = originalText;
    btn.disabled = false;
}


// ==========================================
// ★ 5. 管理者功能 (Admin)
// ==========================================

// A. 登入
function checkAdmin() {
    let p = prompt("請輸入管理員密碼 (預設 admin):");
    if (p === "admin") {
        let panel = document.getElementById('admin-panel');
        if (panel) {
            panel.style.display = "block";
            alert("✅ 登入成功！");
            window.scrollTo(0, 0);
        }
    } else if (p !== null) { 
        alert("密碼錯誤 ❌");
    }
}

// B. 登出
function logout() {
    document.getElementById('admin-panel').style.display = "none";
    alert("已登出");
}

// C. 清空 (建議保留，以免需要強制重置)
function clearSignatures() {
    if(!confirm("⚠️ 警告：這會清空「目前合約」的所有簽名！確定嗎？")) return;
    fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "clear_signatures" }) 
    })
    .then(() => { alert("已清空"); location.reload(); })
    .catch(err => alert("錯誤：" + err));
}

// D. 上傳 PDF 轉圖 (版本管理核心)
async function uploadTemplate() {
    let fileInput = document.getElementById('upload-input');
    let file = fileInput.files[0];
    if(!file) return alert("請先選擇 PDF 檔案！");
    if(file.type !== 'application/pdf') return alert("請上傳 PDF 格式！");
    
    // ★ 詢問新合約名稱 (這是關鍵)
    let docName = prompt("請為這份新合約命名 (例如：2026年保密條款)：", "新合約");
    if (!docName) return; 

    let btn = document.querySelector('#admin-panel button');
    let originalText = btn.innerText;
    btn.innerText = "轉換中...";
    btn.disabled = true;

    try {
        // 1. PDF 轉 Image
        const fileData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(fileData).promise;
        const page = await pdf.getPage(1); // 取第一頁
        const viewport = page.getViewport({ scale: 2 });
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        
        await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;
        const imageBase64 = tempCanvas.toDataURL('image/jpeg', 0.8);
        
        // 2. 上傳到後端 (帶上 docName)
        btn.innerText = "上傳中...";
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "upload_template", 
                fileData: imageBase64,
                docName: docName 
            })
        });

        alert("✅ 系統已切換至新文件：[" + docName + "]\n舊簽名資料已存檔，頁面將重置。");
        location.reload();

    } catch (error) {
        console.error(error);
        alert("失敗：" + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
