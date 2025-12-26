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

// --- 1. 讀取字型檔的工具函式 ---
async function loadFont(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("字型下載失敗");
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // 讀取到的結果是 "data:font/ttf;base64,AAAA..."
                // 我們只需要逗號後面的 Base64 字串
                const base64data = reader.result.split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error(e);
        return null;
    }
}

// --- 2. 下載完整 PDF (含字型載入) ---
async function downloadMergedPDF() {
    if (!currentTemplate) return alert("錯誤：找不到合約底圖");
    
    // 按鈕狀態提示
    const btn = document.querySelector('.btn-download');
    const originalText = btn.innerText;
    btn.innerText = "正在載入字型..."; 
    btn.disabled = true;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ==========================================
    // ★ 修改這裡：直接讀取同一目錄下的字型檔
    // ==========================================
    // "./myfont.ttf" 代表讀取跟網頁同一層的檔案
    // 請確認您上傳到 GitHub 的檔名真的是 myfont.ttf (大小寫要一樣)
    const fontUrl = "./NotoSansTC-Black.ttf"; 
    
    const fontBase64 = await loadFont(fontUrl);
    
    if (fontBase64) {
        // 1. 把字型加入虛擬檔案系統
        doc.addFileToVFS("CustomFont.ttf", fontBase64);
        // 2. 註冊字型 (檔名, 字型名, 樣式)
        doc.addFont("CustomFont.ttf", "CustomFont", "normal");
        // 3. 設定使用該字型
        doc.setFont("CustomFont");
    } else {
        alert("⚠️ 字型載入失敗，中文可能會顯示亂碼 (請檢查檔名是否正確)");
    }

    // --- 以下為生成 PDF 內容 (保持不變) ---
    btn.innerText = "生成 PDF 中...";

    // 1. 放合約圖
    const imgProps = doc.getImageProperties(currentTemplate);
    const pdfWidth = 190;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    doc.addImage(currentTemplate, 'PNG', 10, 10, pdfWidth, pdfHeight);

    // 2. 放簽名列表
    doc.addPage();
    doc.setFontSize(16);
    // 如果字型載入成功，這裡的中文就會正常顯示
    doc.text("簽署紀錄表 (Signatures)", 10, 20);

    let yPos = 40;
    
    // 使用全域變數 globalSignatures
    if(typeof globalSignatures !== 'undefined'){
        globalSignatures.forEach((sig) => {
            if (yPos > 260) { doc.addPage(); yPos = 20; }

            doc.setLineWidth(0.5);
            doc.line(10, yPos - 5, 200, yPos - 5);

            // 簽名圖片
            doc.addImage(sig.img, 'PNG', 10, yPos, 50, 30);

            // 文字資訊
            doc.setFontSize(12);
            doc.text(`姓名: ${sig.name}`, 70, yPos + 10);
            doc.text(`時間: ${sig.date}`, 70, yPos + 20);
            
            yPos += 40; 
        });
    }

    // 下載檔案
    doc.save("Completed_Contract_Full.pdf");

    // 恢復按鈕
    btn.innerText = originalText;
    btn.disabled = false;
}
