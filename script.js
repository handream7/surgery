// Firebase v12 모듈
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";

// 1) Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCAQHhcbDSHcHSG_SxLDV_Uymjz8QjzTns",
  authDomain: "surgery-776f4.firebaseapp.com",
  projectId: "surgery-776f4",
  storageBucket: "surgery-776f4.firebasestorage.app",
  messagingSenderId: "283907532079",
  appId: "1:283907532079:web:9572105708c0e12363edda",
  measurementId: "G-9ESKPFQCM7",
};

// 2) 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
try { getAnalytics(app); } catch (_) {}

// 3) DOM 요소
const names = ["강민성", "김아형", "노현영", "이승현", "장유정", "진한별", "조휘규", "홍은비"].sort();
const dates = ["09-29(월)", "09-30(화)", "10-01(수)", "10-02(목)", "10-13(월)", "10-14(화)", "10-15(수)", "10-16(목)", "10-17(금)"];

const container      = document.querySelector('.container');
const openPopupBtn   = document.getElementById('open-popup-btn');
const inputPopup     = document.getElementById('input-popup');
const memoPopup      = document.getElementById('memo-popup');
const closeBtn       = document.querySelector('.close-btn');
const closeMemoBtn   = document.querySelector('.close-memo-btn');
const logForm        = document.getElementById('log-form');
const tableHeader    = document.getElementById('table-header');
const tableBody      = document.getElementById('table-body');
const tableFooter    = document.getElementById('table-footer');
const nameSelect        = document.getElementById('name-select');
const dateSelect        = document.getElementById('date-select');
const startTimeHour     = document.getElementById('start-time-hour');
const startTimeMinute   = document.getElementById('start-time-minute');
const endTimeHour       = document.getElementById('end-time-hour');
const endTimeMinute     = document.getElementById('end-time-minute');
const durationSpan      = document.getElementById('duration');
const memoTextarea      = document.getElementById('memo');
const memoContentP      = document.getElementById('memo-content');
const startNowBtn       = document.getElementById('start-now-btn');
const endNowBtn         = document.getElementById('end-now-btn');
const editModeBtn         = document.getElementById('edit-mode-btn');
const popupTitle          = document.getElementById('popup-title');
const submitBtn           = document.getElementById('submit-btn');
const deleteBtn           = document.getElementById('delete-btn');
const editingDocIdInput   = document.getElementById('editing-doc-id');
const selectEditPopup     = document.getElementById('select-edit-popup');
const closeSelectEditBtn  = document.querySelector('.close-select-edit-btn');
const selectEditList      = document.getElementById('select-edit-list');


let auth;
let rankingChart;
let allLogs = [];
let isEditMode = false;
let updateTimer; 

function populateSelect(sel, options) { sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join(''); }
function calculateDuration() {
  const start = parseInt(startTimeHour.value)*60 + parseInt(startTimeMinute.value);
  const end   = parseInt(endTimeHour.value)*60   + parseInt(endTimeMinute.value);
  if (start > end) { durationSpan.textContent = "마감 시간이 시작 시간보다 빠릅니다."; return; }
  const diff = end - start;
  const h = Math.floor(diff/60), m = diff%60;
  durationSpan.textContent = `${h}h ${m}m (${diff}분)`;
}
function initStaticTable() {
  tableHeader.innerHTML = '<th>날짜</th>';
  names.forEach(n => { tableHeader.innerHTML += `<th>${n}</th>`; });
  tableBody.innerHTML = '';
  dates.forEach(d => {
    let row = `<tr data-date="${d}"><td class="date-col">${d}</td>`;
    names.forEach(n => { row += `<td data-name="${n}" data-date="${d}"></td>`; });
    row += '</tr>';
    tableBody.innerHTML += row;
  });
  populateSelect(nameSelect, names);
  populateSelect(dateSelect, dates);
  populateSelect(startTimeHour, Array.from({length:24}, (_,i)=>String(i).padStart(2,'0')));
  populateSelect(startTimeMinute, Array.from({length:60}, (_,i)=>String(i).padStart(2,'0')));
  populateSelect(endTimeHour, Array.from({length:24}, (_,i)=>String(i).padStart(2,'0')));
  populateSelect(endTimeMinute, Array.from({length:60}, (_,i)=>String(i).padStart(2,'0')));
}

function resetFormToCreateMode() {
  logForm.reset();
  editingDocIdInput.value = '';
  popupTitle.textContent = '참관 기록 입력';
  submitBtn.textContent = '확인';
  deleteBtn.style.display = 'none';
  durationSpan.textContent = "0h 0m (0분)";
}

function initChart() {
    const ctx = document.getElementById('ranking-chart')?.getContext('2d');
    if (!ctx) return;

    const dataLabelsPlugin = (window && window.ChartDataLabels) ? window.ChartDataLabels : undefined;
    rankingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '총 참관 시간 (분)',
                data: [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)','rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)','rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)','rgba(255, 159, 64, 0.5)', 'rgba(99, 255, 132, 0.5)', 'rgba(201, 203, 207, 0.5)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)','rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)','rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)','rgba(255, 159, 64, 1)', 'rgba(99, 255, 132, 1)', 'rgba(201, 203, 207, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: dataLabelsPlugin ? {
                    anchor: 'end',
                    align: 'end',
                    formatter: (v) => {
                        if (!v) return '';
                        const h = Math.floor(v/60), m = v%60;
                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    },
                    color: '#555',
                    font: { weight: 'bold' }
                } : {}
            },
            scales: { 
                x: { beginAtZero: true, title: { display: true, text: '시간 (분)' } } 
            },
            // --- 수정된 부분 시작 ---
            animation: {
                x: { // X축(너비)에 대한 애니메이션만 설정
                    easing: 'easeInOutQuad',
                    duration: 2500, // 2.5초 동안
                    from: 0 // 0에서부터 시작하도록 명시
                },
                y: { // Y축(세로 위치)에 대한 애니메이션은 사용 안 함
                    duration: 0
                }
            }
            // --- 수정된 부분 끝 ---
        },
        plugins: dataLabelsPlugin ? [dataLabelsPlugin] : []
    });
}

function bindEvents() {
  openPopupBtn.addEventListener('click', () => {
    const password = prompt('암호를 입력하세요:');
    if (password === 'surgery123') {
      resetFormToCreateMode();
      inputPopup.style.display = 'block';
    } else if (password !== null) { alert('암호가 틀렸습니다.'); }
  });

  editModeBtn.addEventListener('click', () => {
    if (!isEditMode) {
      const password = prompt('암호를 입력하세요:');
      if (password === 'surgery123') {
        isEditMode = true;
        container.classList.add('edit-mode-on');
        editModeBtn.classList.add('active');
        editModeBtn.textContent = '수정 종료';
      } else if (password !== null) {
        alert('암호가 틀렸습니다.');
      }
    } else {
      isEditMode = false;
      container.classList.remove('edit-mode-on');
      editModeBtn.classList.remove('active');
      editModeBtn.textContent = '기록 수정';
    }
  });

  const closePopups = () => {
    inputPopup.style.display = 'none';
    memoPopup.style.display = 'none';
    selectEditPopup.style.display = 'none';
  };
  closeBtn.addEventListener('click', closePopups);
  closeMemoBtn.addEventListener('click', closePopups);
  closeSelectEditBtn.addEventListener('click', closePopups);
  window.addEventListener('click', (e) => {
    if (e.target === inputPopup || e.target === memoPopup || e.target === selectEditPopup) {
      closePopups();
    }
  });

  [startTimeHour, startTimeMinute, endTimeHour, endTimeMinute].forEach(el => {
    el.addEventListener('change', calculateDuration);
  });
  
  function setCurrentTime(hourSelect, minuteSelect) {
    const now = new Date();
    hourSelect.value = String(now.getHours()).padStart(2, '0');
    minuteSelect.value = String(now.getMinutes()).padStart(2, '0');
    hourSelect.dispatchEvent(new Event('change'));
  }
  startNowBtn.addEventListener('click', () => setCurrentTime(startTimeHour, startTimeMinute));
  endNowBtn.addEventListener('click', () => setCurrentTime(endTimeHour, endTimeMinute));

  logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = parseInt(startTimeHour.value) * 60 + parseInt(startTimeMinute.value);
    const end = parseInt(endTimeHour.value) * 60 + parseInt(endTimeMinute.value);
    if (start > end) return alert("마감 시간이 시작 시간보다 빠를 수 없습니다.");
    const durationInMinutes = end - start;
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    const record = {
      name: nameSelect.value,
      date: dateSelect.value,
      startTime: `${startTimeHour.value}:${startTimeMinute.value}`,
      endTime: `${endTimeHour.value}:${endTimeMinute.value}`,
      duration: `${hours}h ${minutes}m`,
      durationInMinutes,
      memo: memoTextarea.value || '내용 없음',
    };
    const docId = editingDocIdInput.value;
    try {
      if (docId) { 
        await updateDoc(doc(db, "logs", docId), record);
      } else { 
        record.timestamp = serverTimestamp();
        record.uid = (auth && auth.currentUser) ? auth.currentUser.uid : null;
        await addDoc(collection(db, "logs"), record);
      }
      resetFormToCreateMode();
      inputPopup.style.display = 'none';
    } catch (err) {
      console.error("문서 저장/수정 오류:", err);
      alert("오류가 발생했습니다.");
    }
  });

  tableBody.addEventListener('click', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    if (isEditMode) {
      const docIds = td.dataset.docIds ? JSON.parse(td.dataset.docIds) : [];
      if (docIds.length === 0) return;
      if (docIds.length === 1) { openEditPopup(docIds[0]); } 
      else { showEditSelectionPopup(docIds); }
    } else {
      if (td.dataset.memo) {
        memoContentP.textContent = td.dataset.memo;
        memoPopup.style.display = 'block';
      }
    }
  });

  deleteBtn.addEventListener('click', async () => {
    const docId = editingDocIdInput.value;
    if (docId && confirm('정말로 이 기록을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, "logs", docId));
        inputPopup.style.display = 'none';
        resetFormToCreateMode();
      } catch (err) {
        console.error("삭제 오류:", err);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  });
}

function showEditSelectionPopup(docIds) {
  selectEditList.innerHTML = '';
  const logsToShow = allLogs.filter(log => docIds.includes(log.id));
  logsToShow.forEach(log => {
    const item = document.createElement('div');
    item.className = 'select-item';
    item.textContent = `[${log.startTime}~${log.endTime}] ${log.memo}`;
    item.addEventListener('click', () => {
      openEditPopup(log.id);
      selectEditPopup.style.display = 'none';
    });
    selectEditList.appendChild(item);
  });
  selectEditPopup.style.display = 'block';
}

function openEditPopup(docId) {
  const log = allLogs.find(l => l.id === docId);
  if (!log) return;
  popupTitle.textContent = '참관 기록 수정';
  submitBtn.textContent = '수정';
  deleteBtn.style.display = 'block';
  editingDocIdInput.value = docId;
  nameSelect.value = log.name;
  dateSelect.value = log.date;
  [startTimeHour.value, startTimeMinute.value] = log.startTime.split(':');
  [endTimeHour.value, endTimeMinute.value] = log.endTime.split(':');
  memoTextarea.value = log.memo;
  calculateDuration();
  inputPopup.style.display = 'block';
}

function listenForUpdates() {
  const qLogs = query(collection(db, "logs"), orderBy("timestamp", "desc"));
  onSnapshot(qLogs, (snap) => {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
        allLogs = [];
        snap.forEach(doc => allLogs.push({ id: doc.id, ...doc.data() }));
        
        updateTable(allLogs);
        updateRanking(allLogs);
        updateTotals();
    }, 150);
  });
}

function updateTable(logs) {
  document.querySelectorAll('#log-table td[data-name]').forEach(td => {
    td.textContent = '';
    td.removeAttribute('data-memo');
    td.removeAttribute('data-total-minutes');
    td.removeAttribute('data-doc-ids');
  });

  logs.forEach(log => {
    const cell = document.querySelector(`td[data-name="${log.name}"][data-date="${log.date}"]`);
    if (!cell) return;
    const current = cell.dataset.totalMinutes ? parseInt(cell.dataset.totalMinutes) : 0;
    const add = Number.isFinite(log.durationInMinutes) ? log.durationInMinutes : 0;
    const newTotal = current + add;
    const h = Math.floor(newTotal/60), m = newTotal%60;
    cell.textContent = `${h}h ${m}m`;
    cell.dataset.totalMinutes = newTotal;
    const existingMemo = cell.dataset.memo ? (cell.dataset.memo + '\n---\n') : '';
    const memoLine = `[${log.startTime}~${log.endTime}] ${log.memo || ''}`;
    cell.dataset.memo = existingMemo + memoLine;
    const existingIds = cell.dataset.docIds ? JSON.parse(cell.dataset.docIds) : [];
    existingIds.push(log.id);
    cell.dataset.docIds = JSON.stringify(existingIds);
  });
}

function updateTotals() {
  let totalRowHtml = '<tr><td class="date-col">Total</td>';
  
  names.forEach(name => {
    const cells = document.querySelectorAll(`td[data-name="${name}"]`);
    let totalMinutesPerPerson = 0;
    cells.forEach(cell => {
      const minutes = parseInt(cell.dataset.totalMinutes, 10);
      if (!isNaN(minutes)) {
        totalMinutesPerPerson += minutes;
      }
    });

    const h = Math.floor(totalMinutesPerPerson / 60);
    const m = totalMinutesPerPerson % 60;
    totalRowHtml += `<td>${h}h ${m}m</td>`;
  });

  totalRowHtml += '</tr>';
  tableFooter.innerHTML = totalRowHtml;
}

function updateRanking(logs) {
    if (!rankingChart) return;

    const rankingData = {};
    names.forEach(n => rankingData[n] = 0);
    logs.forEach(l => {
        if (rankingData.hasOwnProperty(l.name)) {
            rankingData[l.name] += (Number.isFinite(l.durationInMinutes) ? l.durationInMinutes : 0);
        }
    });

    const sorted = Object.entries(rankingData).sort(([,a],[,b]) => b - a);
    
    rankingChart.data.labels = sorted.map(([n]) => n);
    rankingChart.data.datasets[0].data = sorted.map(([,v]) => v);
    
    rankingChart.update();
}

async function start() {
  try {
    auth = (await import("https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js")).getAuth(app);
    try { await signInAnonymously(auth); } catch (e) { console.warn('익명 로그인 실패(계속 진행):', e); }
  } catch (e) { console.warn('Auth 로드 실패(계속 진행):', e); }
  
  initStaticTable();
  initChart();
  bindEvents();
  listenForUpdates();
}

start().catch(err => {
  console.error('초기화 중 오류:', err);
  alert('초기화 중 오류가 발생했습니다. 콘솔을 확인하세요.');
});