document.addEventListener('DOMContentLoaded', function () {
    // -------------------------------------------------------------------------
    // 1. Firebase 설정: 여기에 본인의 Firebase 구성 객체를 붙여넣으세요.
    // -------------------------------------------------------------------------
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID", // 중요: 이 부분을 채워주세요!
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // Firebase 앱 초기화
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    // -------------------------------------------------------------------------
    // 2. 기본 데이터 및 DOM 요소
    // -------------------------------------------------------------------------
    const names = ["강민성", "김아형", "노현영", "이승현", "진한별", "조휘규", "홍은비"].sort();
    const dates = ["09-29(월)", "09-30(화)", "10-01(수)", "10-02(목)", "10-06(월)", "10-07(화)", "10-08(수)", "10-09(목)", "10-10(금)"];

    const openPopupBtn = document.getElementById('open-popup-btn');
    const inputPopup = document.getElementById('input-popup');
    const memoPopup = document.getElementById('memo-popup');
    const closeBtn = document.querySelector('.close-btn');
    const closeMemoBtn = document.querySelector('.close-memo-btn');
    const logForm = document.getElementById('log-form');
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');

    const nameSelect = document.getElementById('name-select');
    const dateSelect = document.getElementById('date-select');
    const startTimeHour = document.getElementById('start-time-hour');
    const startTimeMinute = document.getElementById('start-time-minute');
    const endTimeHour = document.getElementById('end-time-hour');
    const endTimeMinute = document.getElementById('end-time-minute');
    const durationSpan = document.getElementById('duration');
    const memoTextarea = document.getElementById('memo');
    const memoContentP = document.getElementById('memo-content');
    
    let rankingChart; // 차트 인스턴스 저장 변수

    // -------------------------------------------------------------------------
    // 3. 팝업 및 폼 초기화 함수
    // -------------------------------------------------------------------------
    function init() {
        // 테이블 헤더 생성
        tableHeader.innerHTML = '<th>날짜</th>';
        names.forEach(name => {
            tableHeader.innerHTML += `<th>${name}</th>`;
        });

        // 테이블 바디 생성
        tableBody.innerHTML = '';
        dates.forEach(date => {
            let row = `<tr data-date="${date}"><td class="date-col">${date}</td>`;
            names.forEach(name => {
                row += `<td data-name="${name}" data-date="${date}"></td>`;
            });
            row += '</tr>';
            tableBody.innerHTML += row;
        });
        
        // 폼 드롭다운 채우기
        populateSelect(nameSelect, names);
        populateSelect(dateSelect, dates);
        populateSelect(startTimeHour, Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')));
        populateSelect(startTimeMinute, Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')));
        populateSelect(endTimeHour, Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')));
        populateSelect(endTimeMinute, Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')));

        // 실시간 데이터 리스너 연결
        listenForUpdates();
    }

    function populateSelect(selectElement, options) {
        selectElement.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join('');
    }
    
    // -------------------------------------------------------------------------
    // 4. 시간 계산 로직
    // -------------------------------------------------------------------------
    function calculateDuration() {
        const start = parseInt(startTimeHour.value) * 60 + parseInt(startTimeMinute.value);
        const end = parseInt(endTimeHour.value) * 60 + parseInt(endTimeMinute.value);
        
        if (start > end) {
            durationSpan.textContent = "마감 시간이 시작 시간보다 빠릅니다.";
            return;
        }

        const diffMinutes = end - start;
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        
        durationSpan.textContent = `${hours}시간 ${minutes}분 (${diffMinutes}분)`;
    }

    // -------------------------------------------------------------------------
    // 5. 이벤트 리스너
    // -------------------------------------------------------------------------
    openPopupBtn.addEventListener('click', () => inputPopup.style.display = 'block');
    closeBtn.addEventListener('click', () => inputPopup.style.display = 'none');
    closeMemoBtn.addEventListener('click', () => memoPopup.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === inputPopup) inputPopup.style.display = 'none';
        if (e.target === memoPopup) memoPopup.style.display = 'none';
    });

    [startTimeHour, startTimeMinute, endTimeHour, endTimeMinute].forEach(el => {
        el.addEventListener('change', calculateDuration);
    });

    logForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const start = parseInt(startTimeHour.value) * 60 + parseInt(startTimeMinute.value);
        const end = parseInt(endTimeHour.value) * 60 + parseInt(endTimeMinute.value);
        
        if (start > end) {
            alert("마감 시간이 시작 시간보다 빠를 수 없습니다.");
            return;
        }

        const durationInMinutes = end - start;
        const hours = Math.floor(durationInMinutes / 60);
        const minutes = durationInMinutes % 60;

        const record = {
            name: nameSelect.value,
            date: dateSelect.value,
            startTime: `${startTimeHour.value}:${startTimeMinute.value}`,
            endTime: `${endTimeHour.value}:${endTimeMinute.value}`,
            duration: `${hours}시간 ${minutes}분`,
            durationInMinutes: durationInMinutes,
            memo: memoTextarea.value || '내용 없음',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Firestore에 데이터 추가
        db.collection("logs").add(record)
            .then(() => {
                logForm.reset();
                durationSpan.textContent = "0시간 0분 (0분)";
                inputPopup.style.display = "none";
            })
            .catch((error) => {
                console.error("Error adding document: ", error);
            });
    });

    tableBody.addEventListener('click', function(e) {
        if (e.target.tagName === 'TD' && e.target.dataset.memo) {
            memoContentP.textContent = e.target.dataset.memo;
            memoPopup.style.display = 'block';
        }
    });

    // -------------------------------------------------------------------------
    // 6. Firestore 실시간 연동 및 화면 업데이트
    // -------------------------------------------------------------------------
    function listenForUpdates() {
        db.collection("logs").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
            const allLogs = [];
            snapshot.forEach((doc) => {
                allLogs.push(doc.data());
            });
            updateTable(allLogs);
            updateRanking(allLogs);
        });
    }

    function updateTable(logs) {
        // 테이블 초기화
        document.querySelectorAll('#log-table td[data-name]').forEach(cell => {
            cell.textContent = '';
            cell.removeAttribute('data-memo');
        });

        logs.forEach(log => {
            const cell = document.querySelector(`td[data-name="${log.name}"][data-date="${log.date}"]`);
            if (cell) {
                // 동일 날짜, 동일 인물 기록이 여러 개일 경우 시간 합산
                const currentMinutes = cell.dataset.totalMinutes ? parseInt(cell.dataset.totalMinutes) : 0;
                const newTotalMinutes = currentMinutes + log.durationInMinutes;
                
                const hours = Math.floor(newTotalMinutes / 60);
                const minutes = newTotalMinutes % 60;

                cell.textContent = `${hours}시간 ${minutes}분`;
                cell.dataset.totalMinutes = newTotalMinutes;

                // 메모는 최신 기록으로 덮어쓰거나, 합쳐서 보여줄 수 있음 (여기서는 합치기)
                const existingMemo = cell.dataset.memo ? cell.dataset.memo + '\n---\n' : '';
                cell.dataset.memo = existingMemo + `[${log.startTime}~${log.endTime}] ${log.memo}`;
            }
        });
    }

    // -------------------------------------------------------------------------
    // 7. 랭킹 차트 업데이트
    // -------------------------------------------------------------------------
    function updateRanking(logs) {
        const rankingData = {};
        names.forEach(name => rankingData[name] = 0);

        logs.forEach(log => {
            if (rankingData.hasOwnProperty(log.name)) {
                rankingData[log.name] += log.durationInMinutes;
            }
        });
        
        const sortedRanking = Object.entries(rankingData).sort(([, a], [, b]) => b - a);
        
        const labels = sortedRanking.map(item => item[0]);
        const data = sortedRanking.map(item => item[1]);

        const chartCtx = document.getElementById('ranking-chart').getContext('2d');
        
        if(rankingChart) {
            rankingChart.destroy(); // 기존 차트 파괴
        }

        rankingChart = new Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '총 참관 시간 (분)',
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)',
                        'rgba(99, 255, 132, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                        'rgba(99, 255, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // y축을 기준으로 가로 막대 그래프 생성
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    datalabels: { // 데이터 레이블 플러그인 설정
                        anchor: 'end',
                        align: 'end',
                        formatter: (value) => {
                            if (value === 0) return '';
                            const hours = Math.floor(value / 60);
                            const minutes = value % 60;
                            if (hours > 0) {
                                return `${hours}시간 ${minutes}분`;
                            }
                            return `${minutes}분`;
                        },
                        color: '#555',
                        font: {
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '시간 (분)'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuad'
                }
            },
            plugins: [ChartDataLabels] // 플러그인 등록
        });
    }

    // 페이지 로드 시 초기화 함수 실행
    init();
});