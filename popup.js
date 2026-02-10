document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const tabAdd = document.getElementById('tab-add');
    const tabList = document.getElementById('tab-list');
    const viewAdd = document.getElementById('view-add');
    const viewList = document.getElementById('view-list');

    const videoTitle = document.getElementById('video-title');
    const videoUrl = document.getElementById('video-url');
    const categorySelect = document.getElementById('category-select');
    const btnAddCategory = document.getElementById('btn-add-category');
    const newCategoryGroup = document.getElementById('new-category-group');
    const newCategoryInput = document.getElementById('new-category-input');
    const btnSaveCategory = document.getElementById('btn-save-category');
    const btnCancelCategory = document.getElementById('btn-cancel-category');
    const memoInput = document.getElementById('memo-input');
    const btnSave = document.getElementById('btn-save');
    const statusMsg = document.getElementById('status-msg');

    const filterCategory = document.getElementById('filter-category');
    const memoList = document.getElementById('memo-list');
    const emptyState = document.getElementById('empty-state');
    const btnSyncReset = document.getElementById('btn-sync-reset');
    const btnKeepHistory = document.getElementById('btn-keep-history');

    // State
    let currentVideo = null;
    let categories = ['General', 'Study', 'Fun', 'Music']; // Default categories

    // Initialization
    loadCategories();
    getCurrentTab();
    checkDailyReset();

    // Tab Switching
    tabAdd.addEventListener('click', () => {
        switchTab('add');
    });

    tabList.addEventListener('click', () => {
        switchTab('list');
        loadMemos(); // Reload list when switching
    });

    function switchTab(tab) {
        if (tab === 'add') {
            tabAdd.classList.add('active');
            tabList.classList.remove('active');
            viewAdd.classList.remove('hidden');
            viewList.classList.add('hidden');
        } else {
            tabList.classList.add('active');
            tabAdd.classList.remove('active');
            viewList.classList.remove('hidden');
            viewAdd.classList.add('hidden');
        }
    }

    // --- Daily Reset Logic ---
    function checkDailyReset() {
        const today = new Date().toLocaleDateString();
        chrome.storage.local.get(['lastResetDate', 'memos'], (result) => {
            const lastReset = result.lastResetDate;
            const memos = result.memos || [];

            if (lastReset && lastReset !== today && memos.length > 0) {
                // It's a new day and there are old memos
                btnSyncReset.classList.add('pulse'); // Visual hint
                btnSyncReset.title = "New day detected! Sync and clear your list.";
            } else if (!lastReset) {
                chrome.storage.local.set({ lastResetDate: today });
            }
        });
    }

    // --- Google Keep Sync Logic ---
    btnKeepHistory.addEventListener('click', () => {
        const keepSearchUrl = "https://keep.google.com/#search/text=YouTube%20Memo";
        window.open(keepSearchUrl, '_blank');
    });

    btnSyncReset.addEventListener('click', () => {
        chrome.storage.local.get(['memos'], (result) => {
            const memos = result.memos || [];
            if (memos.length === 0) {
                alert("No memos to sync!");
                return;
            }

            const today = new Date().toLocaleDateString();
            let keepText = `📅 [YouTube Backup] - ${today}\n\n`;

            // Group by category
            const categoriesInMemos = [...new Set(memos.map(m => m.category))];
            let categoryHashtags = "";

            categoriesInMemos.forEach(cat => {
                keepText += `📁 [[ ${cat} ]]\n`;
                memos.filter(m => m.category === cat).forEach(m => {
                    keepText += `• ${m.title}\n  🔗 ${m.url}\n`;
                    if (m.memo) keepText += `  📝 메모: ${m.memo}\n`;
                });
                keepText += `\n`;

                // hashtag generation (removing spaces)
                categoryHashtags += ` #${cat.replace(/\s+/g, '')}`;
            });

            // Global hashtags
            keepText += `---\n#데일리체크리스트 #YouTubeMemo${categoryHashtags}`;

            // Copy to clipboard
            navigator.clipboard.writeText(keepText).then(() => {
                showSyncGuide(today);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert("Failed to copy list to clipboard.");
            });
        });
    });

    function showSyncGuide(date) {
        const guide = document.createElement('div');
        guide.id = 'sync-guide';
        guide.innerHTML = `
            <div class="guide-content">
                <span class="guide-icon">📋</span>
                <h3>복사 완료!</h3>
                <p>오늘의 리스트가 클립보드에<br>정갈하게 정리되었습니다.</p>
                <div class="guide-steps">
                    <div class="guide-step"><span>1.</span> <span>잠시 후 열리는 구글 킵에서 <b>'새 메모'</b>를 만드세요.</span></div>
                    <div class="guide-step"><span>2.</span> <span><b>Ctrl + V</b>로 내용을 붙여넣으세요.</span></div>
                    <div class="guide-step"><span>3.</span> <span>하단의 해시태그를 확인하고 라벨로 변환하세요!</span></div>
                </div>
                <button id="btn-guide-confirm" class="btn-confirm">알겠습니다. 초기화할게요!</button>
            </div>
        `;
        document.body.appendChild(guide);

        document.getElementById('btn-guide-confirm').addEventListener('click', () => {
            chrome.storage.local.set({
                memos: [],
                lastResetDate: date
            }, () => {
                const keepUrl = "https://keep.google.com/";
                window.open(keepUrl, '_blank');
                loadMemos();
                btnSyncReset.classList.remove('pulse');
                guide.remove();
            });
        });
    }

    // --- Add Memo Section Logic ---

    // Get current tab info
    function getCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            const tab = tabs[0];

            if (tab.url && tab.url.includes('youtube.com/watch')) {
                currentVideo = {
                    title: tab.title.replace(' - YouTube', ''),
                    url: tab.url,
                    id: getVideoIdAndParams(tab.url)
                };
                videoTitle.textContent = currentVideo.title;
                videoUrl.textContent = currentVideo.url;
                btnSave.disabled = false;
            } else {
                videoTitle.textContent = "Not a YouTube Video";
                videoUrl.textContent = "Please navigate to a YouTube video page.";
                btnSave.disabled = true;
            }
        });
    }

    function getVideoIdAndParams(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v') || 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    // Category Management
    function loadCategories() {
        chrome.storage.local.get(['categories'], (result) => {
            if (result.categories && Array.isArray(result.categories)) {
                categories = result.categories;
            } else {
                // Save defaults if not exists
                chrome.storage.local.set({ categories: categories });
            }
            populateCategoryDropdowns();
        });
    }

    function populateCategoryDropdowns() {
        // Clear options
        categorySelect.innerHTML = '';
        filterCategory.innerHTML = '<option value="All">All Categories</option>';

        categories.forEach(cat => {
            // Add view dropdown
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);

            // Filter dropdown
            const filterOption = document.createElement('option');
            filterOption.value = cat;
            filterOption.textContent = cat;
            filterCategory.appendChild(filterOption);
        });
    }

    btnAddCategory.addEventListener('click', () => {
        newCategoryGroup.classList.remove('hidden');
        newCategoryInput.focus();
    });

    btnCancelCategory.addEventListener('click', () => {
        newCategoryGroup.classList.add('hidden');
        newCategoryInput.value = '';
    });

    btnSaveCategory.addEventListener('click', () => {
        const newCat = newCategoryInput.value.trim();
        if (newCat && !categories.includes(newCat)) {
            categories.push(newCat);
            chrome.storage.local.set({ categories: categories }, () => {
                populateCategoryDropdowns();
                categorySelect.value = newCat; // Select new category
                newCategoryGroup.classList.add('hidden');
                newCategoryInput.value = '';
            });
        }
    });

    // Save Memo
    btnSave.addEventListener('click', () => {
        if (!currentVideo) return;

        const memoData = {
            id: Date.now().toString(),
            videoId: currentVideo.id,
            title: currentVideo.title,
            url: currentVideo.url,
            category: categorySelect.value,
            memo: memoInput.value.trim(),
            timestamp: Date.now(),
            dateString: new Date().toISOString()
        };

        chrome.storage.local.get(['memos'], (result) => {
            const memos = result.memos || [];
            memos.push(memoData);
            chrome.storage.local.set({ memos: memos }, () => {
                showStatus('Memo saved successfully!', 'success');
                memoInput.value = ''; // Clear input
                setTimeout(() => { statusMsg.textContent = ''; }, 2000);
            });
        });
    });

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = type;
    }

    // --- My List Section Logic ---

    // Load and Render Memos
    function loadMemos() {
        chrome.storage.local.get(['memos'], (result) => {
            const memos = result.memos || [];
            renderMemos(memos);
        });
    }

    function renderMemos(memos) {
        const filterVal = filterCategory.value;
        // 1. Filter
        let filtered = memos.filter(m => {
            return filterVal === 'All' || m.category === filterVal;
        });

        // 3. Render
        memoList.innerHTML = '';
        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            filtered.forEach(memo => {
                const li = document.createElement('li');
                li.className = 'memo-item';

                // Set thumbnail background if videoId exists
                if (memo.videoId && memo.videoId !== 'unknown') {
                    const thumbUrl = `https://img.youtube.com/vi/${memo.videoId}/mqdefault.jpg`;
                    li.style.backgroundImage = `url(${thumbUrl})`;
                }

                li.innerHTML = `
                    <div class="memo-item-content">
                        <div class="memo-header">
                            <span class="memo-category">${escapeHtml(memo.category)}</span>
                            <span class="memo-date">${new Date(memo.timestamp).toLocaleDateString()}</span>
                        </div>
                        <a href="${memo.url}" target="_blank" class="memo-title" title="${escapeHtml(memo.title)}">${escapeHtml(memo.title)}</a>
                        <div class="memo-text">${escapeHtml(memo.memo)}</div>
                        <div class="memo-actions">
                             <button class="btn-small btn-delete" data-id="${memo.id}">Delete</button>
                        </div>
                    </div>
                `;
                memoList.appendChild(li);
            });

            // Add Event Listeners for Delete buttons
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    deleteMemo(id);
                });
            });
        }
    }

    function deleteMemo(id) {
        if (!confirm('Are you sure you want to delete this memo?')) return;

        chrome.storage.local.get(['memos'], (result) => {
            let memos = result.memos || [];
            memos = memos.filter(m => m.id !== id);
            chrome.storage.local.set({ memos: memos }, () => {
                loadMemos(); // Re-render
            });
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // List Controls Change Events
    filterCategory.addEventListener('change', loadMemos);

});
