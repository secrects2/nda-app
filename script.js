// !!! 請將下方網址換成您第一步複製的 Google Apps Script 網址 !!!
const API_URL = "https://script.google.com/macros/s/AKfycbwsa8d5bJAXUgqVAFbn11bYBGViv29hj-ABRgKAOz9w4pcN_yifl539RLiEXaX1U-DsVA/exec"; 



const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let currentTemplate = null; // 存合約圖的 Base64
let globalSignatures = []; // 存簽名資料

// --- 初始化：讀取合約與簽名 ---
window.onload = async function() {
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

        // 2. 顯示簽名列表
        const list = document.getElementById('sig-list');
        list.innerHTML = "";
        
        if (data.signatures && data.signatures.length > 0) {
            globalSignatures = data.signatures; 

            data.signatures.forEach(sig => {
                let div = document.createElement('div');
                div.className = 'sig-card';
                // 顯示簽名圖與時間，不顯示名字
                div.innerHTML = `<img src="${sig.img}"><div class="sig-info">時間: ${sig.date}</div>`;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = "<p style='color:#999;'>目前尚無人簽署</p>";
        }
    } catch(e) {
        console.error(e);
        document.getElementById('contract-img').alt = "無法連線至資料庫";
    }
}

// --- 簽名板控制 ---
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

// --- 送出簽名 (無須姓名版) ---
async function submitSign() {
    let autoName = "已簽署"; // 自動代號
    let sigData = canvas.toDataURL('image/png', 0.5); 
    
    let btn = document.querySelector('#modal-sign .btn-sign');
    btn.innerText = "傳送中..."; btn.disabled = true;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "sign_document", 
                name: autoName,
                signatureData: sigData
            })
        });
        alert("✅ 簽名成功！");
        location.reload(); 
    } catch(e) {
        alert("失敗：" + e);
        btn.innerText = "確認送出"; btn.disabled = false;
    }
}

// --- 下載字型工具 ---
async function loadFont(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("字型下載失敗");
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

// --- 下載 PDF ---
async function downloadMergedPDF() {
    if (!currentTemplate) return alert("錯誤：找不到合約底圖");
    
    const btn = document.querySelector('.btn-download');
    const originalText = btn.innerText;
    btn.innerText = "載入字型中..."; 
    btn.disabled = true;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 載入自定義字型 (請確認檔名是否為 myfont.ttf 且已上傳 GitHub)
    const fontUrl = "./myfont.ttf"; 
    const fontBase64 = await loadFont(fontUrl);
    
    if (fontBase64) {
        doc.addFileToVFS("CustomFont.ttf", fontBase64);
        doc.addFont("CustomFont.ttf", "CustomFont", "normal");
        doc.setFont("CustomFont");
    } else {
        alert("⚠️ 字型載入失敗，中文將無法顯示");
    }

    btn.innerText = "生成 PDF...";

    // 1. 合約圖
    const imgProps = doc.getImageProperties(currentTemplate);
    const pdfWidth = 190;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);

    // 2. 簽名列表
    doc.addPage();
    doc.setFontSize(16);
    doc.text("簽署紀錄表 (Signatures)", 10, 20);

    let yPos = 40;
    if(typeof globalSignatures !== 'undefined'){
        globalSignatures.forEach((sig) => {
            if (yPos > 260) { doc.addPage(); yPos = 20; }
            doc.setLineWidth(0.5);
            doc.line(10, yPos - 5, 200, yPos - 5);
            
            // 簽名圖
            doc.addImage(sig.img, 'PNG', 10, yPos, 50, 30);
            
            // 文字資訊
            doc.setFontSize(12);
            doc.text(`Signed at: ${sig.date}`, 70, yPos + 15);
            yPos += 40; 
        });
    }

    doc.save("Completed_Contract.pdf");
    btn.innerText = originalText;
    btn.disabled = false;
}

// --- 管理者功能：登入 ---
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

// --- 管理者功能：登出 ---
function logout() {
    document.getElementById('admin-panel').style.display = "none";
    alert("已登出");
}

// --- 管理者功能：上傳 PDF 轉圖 ---
async function uploadTemplate() {
    let fileInput = document.getElementById('upload-input');
    let file = fileInput.files[0];
    if(!file) return alert("請先選擇 PDF 檔案！");
    if(file.type !== 'application/pdf') return alert("請上傳 PDF 格式！");
    
    // ★ 新增步驟：詢問專案/合約名稱
    let docName = prompt("請為這份新合約命名 (例如：2026人事規章)：", "新合約");
    if (!docName) return; // 如果按取消就不上傳

    let btn = document.querySelector('#admin-panel button');
    let originalText = btn.innerText;
    btn.innerText = "轉換中...";
    btn.disabled = true;

    try {
        const fileData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(fileData).promise;
        const page = await pdf.getPage(1); 
        const viewport = page.getViewport({ scale: 2 });
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        
        await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;
        
        const imageBase64 = tempCanvas.toDataURL('image/jpeg', 0.8);
        
        btn.innerText = "上傳中...";
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "upload_template", 
                fileData: imageBase64,
                docName: docName  // ★ 傳送名稱給後端
            })
        });

        alert("✅ 系統已切換至新文件：[" + docName + "]\n舊的簽名資料已安全保存在資料庫中。\n頁面將重新整理顯示空白簽名表。");
        location.reload();
    } catch (error) {
        console.error(error);
        alert("失敗：" + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}






// --- 管理者功能：清空簽名 ---
function clearSignatures() {
    if(!confirm("⚠️ 確定要清空所有簽名嗎？")) return;
    fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "clear_signatures" }) 
    })
    .then(() => { alert("已清空"); location.reload(); })
    .catch(err => alert("錯誤：" + err));
}
