const getActiveTabURL = async () => {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
};
const getTime = (s) => { /*time formating function (for the video scrubber)*/
    s = Math.floor(s || 0); /* rounding secounds down to the nearest integer 123.3 to 123 also 123.7 to 123*/
    const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0; /* reformating (calculating) secounds into hours and minutes h = [s//3600] ,  m = [(s mod 3600)/60] */
    const mm = String(m).padStart(2, '0'), ss = String(s % 60).padStart(2, '0'); /*padding m:s into mm:ss*/
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`; /* final return>>> h:mm:ss*/
};

const formatDate = (timestamp) => { /*time-date formating function (for the real time)*/
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, '0');
    return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm}`;
};
//formatting each row of the jump point list 
const rowHtml = (bookmark, index) => {
    const timeText = getTime(bookmark.time);
    const descText = bookmark.desc ? bookmark.desc : `jump point at ${timeText}`;
    const dateText = bookmark.date ? formatDate(bookmark.date) : '';
    const combinedText = dateText ? `${descText} date ${dateText}` : descText;
    return `
        <div class="row" data-index="${index}">
            <div class="left">
                <a href="#" class="link" data-ts="${bookmark.time}">${combinedText}</a>
            </div>
            <div class="actions">
                <button style="font-size: 10px" class="action-btn rename-btn" data-index="${index}" title=" rename the jump point">rename</button>
                <button style="font-size: 10px"class="action-btn delete-btn" data-index="${index}" title="remove the jump point">remove</button>
            </div>
        </div>`;
};
// render the box of jump points list 
const renderList = (listEl, bookmarks) => {
    if (!bookmarks || bookmarks.length === 0) {
        listEl.innerHTML = `
            <div style="padding: 40px 20px; color: #8E8E93; text-align: center; font-size: 14px;">
                <div style="font-size: 20spx; margin-bottom: 8px;"></div>
                <div>no saved jump point yet</div>
                <div style="font-size: 12px; margin-top: 4px; color: #6b6b6e;">click the red button to save a jump point</div>
            </div>`;
        return;
    }
    listEl.innerHTML = bookmarks.map(rowHtml).join("");
};

const getVideoIdFromUrl = (url) => {
    const qp = url.split("?")[1];
    if (!qp) return null;
    const params = new URLSearchParams(qp);
    return params.get("v");
};


document.addEventListener("DOMContentLoaded", async () => {
    const listEl = document.getElementById("list");
    if (!listEl) return;
    let current = [];
    let videoId = null;

    try {
        const activeTab = await getActiveTabURL();
        videoId = activeTab && activeTab.url ? getVideoIdFromUrl(activeTab.url) : null;
        if (!videoId || !/youtube\.com\/watch/.test(activeTab.url)) {
            listEl.innerHTML = `
                <div style="padding: 40px 20px; color: #8E8E93; text-align: center; font-size: 14px;">
                    <div style="font-size: 24px; margin-bottom: 8px;"></div>
                    <div> open a youtube video first</div>
                    <div style="font-size: 12px; margin-top: 4px; color: #6b6b6e;">then click the red button to save a jump point</div>
                </div>`;
            return;
        }
        chrome.storage.sync.get([videoId], (data) => {
            if (chrome.runtime.lastError) {
                console.error('Error loading bookmarks:', chrome.runtime.lastError);
                listEl.innerHTML = `
                    <div style="padding: 40px 20px; color: #FF3B30; text-align: center; font-size: 14px;">
                        <div style="font-size: 24px; margin-bottom: 8px;"></div>
                        <div>error, jump points not loading </div>
                        <div style="font-size: 12px; margin-top: 4px; color: #8E8E93;">reload the tab and try again</div>
                    </div>`;
                return;
            }
            current = data[videoId] ? JSON.parse(data[videoId]) : [];
            renderList(listEl, current);
        });
    } catch (error) {
        listEl.innerHTML = `
            <div style="padding: 40px 20px; color: #FF3B30; text-align: center; font-size: 14px;">
                <div style="font-size: 24px; margin-bottom: 8px;"></div>
                <div>error, popup not loading</div>
                <div style="font-size: 12px; margin-top: 4px; color: #8E8E93;"> refresh the tab and try again</div>
            </div>`;
        return;
    }

    // listen for changes in storage to update list automatically
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && videoId && changes[videoId]) {
            current = changes[videoId].newValue ? JSON.parse(changes[videoId].newValue) : [];
            renderList(listEl, current);
        }
    });

    listEl.addEventListener('click', (e) => {
        // handle link clicks for jumping to timestamp
        const link = e.target.closest('.link');
        if (link) {
            e.preventDefault();
            const ts = parseFloat(link.getAttribute('data-ts')) || 0;
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'jumpToTimestamp', timestamp: ts });
            });
            return;
        }

        // handle button clicks
        const button = e.target.closest('.action-btn');
        if (!button) return;
        e.preventDefault();

        const idx = parseInt(button.getAttribute('data-index'), 10);

        if (button.classList.contains('rename-btn')) {
            const currentDesc = current[idx].desc || '';
            const newName = prompt('enter the new name of the jump point:', currentDesc);
            if (newName !== null && newName.trim() !== '') {
                const updated = current.slice();
                updated[idx] = { ...updated[idx], desc: newName.trim(), date: updated[idx].date || Date.now() };
                chrome.storage.sync.set({ [videoId]: JSON.stringify(updated) }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error updating bookmark:', chrome.runtime.lastError);
                        alert('error, updating jump point');
                    }
                });
            }
        }

        if (button.classList.contains('delete-btn')) {
            if (confirm('sure you want to delet that jump point؟')) {
                const updated = current.filter((_, i) => i !== idx);
                chrome.storage.sync.set({ [videoId]: JSON.stringify(updated) }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error deleting bookmark:', chrome.runtime.lastError);
                        alert('error, deleting jump point');
                    }
                });
            }
        }
    });
});
