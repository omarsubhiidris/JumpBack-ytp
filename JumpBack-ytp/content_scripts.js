/* focus points 
1- json basics [ objects(key/value pairs) , nested ojects , .parse , .stringfy ]
2- addEventlistener
3- export / import {  } from './#.js' 
4- chrome.runtime
5- asynchronous JS (async / await , promises , callbacks)
6- DOM manupilation [ CreateElement , (.append , appendChild) , (innerText,textContent) , innerHTML
   , (.remove , .removeChild) , (.set , .get, .remove(Attribute)) , element.dataset.key ,
   ((classList) .add , .remove , .toggle("class name" , boolean)) , element.style.#css property ] 
7- inactivating service worker 
*/
//(major release: 0 ) . (minor release: 1 ) . (batch release: 0 )
(()/*IIFE*/ => {
    let currentVideo = null; /* will hold the current video id*/
    let currentVideoBookmarks = []  /*will store the bookmarks the user adds to the current video*/
    let youtubeLeftControls; /* will store the element containing the left controls in YouTube*/
    let youtubePlayer;  /*will store the video element itself*/

    const getTime = (s) => { /*time formating function*/
        s = Math.floor(s || 0); /* rounding secounds down to the nearest integer 123.3 to 123 also 123.7 to 123*/
        const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0; /* reformating (calculating) secounds into hours and minutes h = [s//3600] ,  m = [(s mod 3600)/60] */
        const mm = String(m).padStart(2, '0'), ss = String(s % 60).padStart(2, '0'); /*padding m:s into mm:ss*/
        return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`; /* final return>>> h:mm:ss*/
    };
    // reading changes 
    chrome.runtime.onMessage.addListener((message /* sender,sendResponse */) => {
        const { type, value, videoId, action, timestamp } = message || {};
        // passing current video url (start: bookmarks fetching , btn injection , bookmarks saving )
        if (type === 'NEW' && videoId) {
            currentVideo = videoId;
            newVideoLoaded();
        }
        // jumping to the jump point (message from popup.js)
        if (action === 'jumpToTimestamp' && timestamp !== undefined) {
            if (youtubePlayer) {
                youtubePlayer.currentTime = timestamp;
            }
        }
    });
    // fetch existing bookmarks for the currentVideo from chrome.storage.sync
    const fetchBookmarks = () => { 
        return new Promise((resolve)=>{
            chrome.storage.sync.get([currentVideo],(obj)=>{
                resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]):[]) /* if there’s data for the current video, it parses it from JSON into an array; otherwise, it returns an empty array */
            })
        })
    }
    const newVideoLoaded = async () => { /*wake only when currentVideo = videoId (case of watching a video)*/
        currentVideoBookmarks = await fetchBookmarks(); /*(won't move until fetching bookmarks is done)*/

        // wait for youtube controls and player to be ready
        const waitForControls = () => {
            return new Promise((resolve) => {
                const checkControls = () => {
                    youtubeLeftControls = document.getElementsByClassName('ytp-left-controls')[0];
                    youtubePlayer = document.getElementsByClassName('video-stream')[0];
                    if (youtubeLeftControls && youtubePlayer) {
                        resolve();
                    } else {
                        setTimeout(checkControls, 100);
                    }
                };
                checkControls();
            });
        };

        try {
            await waitForControls();
        } catch (error) {
            console.error("Failed to find YouTube controls:", error);
            return;
        }

        // remove any stray duplicate buttons that might be present
        document.querySelectorAll('#jumpback-bookmark-btn, .bookmark-btn').forEach((el) => {
            // if there is a bookmarked reference we want to keep it; otherwise remove
            if (el && el.id !== 'jumpback-bookmark-btn') {
                el.remove();
            }
        });

        // if somehow we already created and stored a bookmarkBtn and it's still in the DOM, reuse it
        if (window.jumpbackBookmarkBtn && document.body.contains(window.jumpbackBookmarkBtn)) {
            // ensure it's inside current left controls
            if (!youtubeLeftControls.contains(window.jumpbackBookmarkBtn)) youtubeLeftControls.appendChild(window.jumpbackBookmarkBtn);
            return;
        }

        // create the bookmark button and store on window to prevent duplicates across injections
        const btn = document.createElement('div');
        btn.id = 'jumpback-bookmark-btn';
        btn.className = 'bookmark-btn';
        btn.title = 'Save a Jump Point';
        btn.style.width = '12px';
        btn.style.height = '12px';
        btn.style.borderRadius = '50%';
        btn.style.backgroundColor = '#ff3b30';
        btn.style.boxShadow = '0 0 0 5px rgba(255,59,48,0.4)';
        btn.style.cursor = 'pointer';
        btn.style.alignSelf = 'center';
        btn.style.display = 'inline-block';

        // helper to detect chapters
        function hasChapters() {
            const progressBar = document.querySelector('.ytp-progress-bar');
            if (!progressBar) return false;
            const chapterMarkers = progressBar.querySelector('.ytp-chapter-container, .ytp-marker-timeline');
            const chapterButton = document.querySelector('.ytp-chapter-button');
            return !!chapterMarkers || !!chapterButton;
        }
        // helper to reposition the btn when chapter
        function updateButtonPosition() {
            const chapterContainer = document.querySelector('.ytp-chapter-container');
            if (chapterContainer) {
                chapterContainer.style.width = '320px';
                chapterContainer.style.height = '48px';
                chapterContainer.style.minWidth = '320px';
                chapterContainer.style.maxWidth = '320px';
                chapterContainer.style.flex = '0 0 320px';
                chapterContainer.style.boxSizing = 'border-box';
                const chapterTitle = chapterContainer.querySelector('.ytp-chapter-title');
                if (chapterTitle) {
                    chapterTitle.style.maxWidth = '100%';
                    chapterTitle.style.overflow = 'hidden';
                    chapterTitle.style.textOverflow = 'ellipsis';
                    chapterTitle.style.whiteSpace = 'nowrap';
                }
                // ensure button appended to controls
                if (btn.parentElement !== youtubeLeftControls) youtubeLeftControls.appendChild(btn);
            } else if (youtubeLeftControls) {
                // reset any adjustments made to chapter containers 
                const prevChapterContainers = document.querySelectorAll('.ytp-chapter-container');
                prevChapterContainers.forEach((el)=>{ 
                    el.style.paddingRight = '';
                    el.style.width = '';
                    el.style.height = '';
                    el.style.minWidth = '';
                    el.style.maxWidth = '';
                    el.style.flex = '';
                    el.style.boxSizing = '';
                    const innerTitle = el.querySelector('.ytp-chapter-title');
                    if (innerTitle) {
                        innerTitle.style.maxWidth = '';
                        innerTitle.style.overflow = '';
                        innerTitle.style.textOverflow = '';
                        innerTitle.style.whiteSpace = '';
                    }
                });
                btn.style.margin = '0 0 0 10px';
                if (btn.parentElement !== youtubeLeftControls) {
                    youtubeLeftControls.appendChild(btn);
                }
            }
        }
        updateButtonPosition();

        // handler to avoid duplicates
        try {
            if (window.jumpbackBookmarkObserver) window.jumpbackBookmarkObserver.disconnect();
        } catch (e) { /* ignore */ }
        // create and save observer so we don't create multiple observers on repeated injections
        window.jumpbackBookmarkObserver = new MutationObserver(updateButtonPosition);
        window.jumpbackBookmarkObserver.observe(document.body, { childList: true, subtree: true });

        // click handler for saving bookmarks
        btn.addEventListener('click', async () => {
            try {
                if (!youtubePlayer || !currentVideo) return;
                const currentTime = youtubePlayer.currentTime;
                const newBookmark = {
                    time: currentTime,
                    desc: 'jump point saved at ' + getTime(currentTime),
                    date: Date.now()
                };

                currentVideoBookmarks = [...currentVideoBookmarks, newBookmark];
                const sortedBookmarks = currentVideoBookmarks.sort((a, b) => a.time - b.time);

                chrome.storage.sync.set({ [currentVideo]: JSON.stringify(sortedBookmarks) }, () => {
                    if (chrome.runtime.lastError) console.error('Error saving bookmarks:', chrome.runtime.lastError);
                });
            } catch (error) {
                console.error('Error adding bookmark:', error);
            }
        });

        // store the button reference globally so subsequent injections reuse it
        window.jumpbackBookmarkBtn = btn;

        // append the button into left controls
        if (btn.parentElement !== youtubeLeftControls) youtubeLeftControls.appendChild(btn);
    };
})();
