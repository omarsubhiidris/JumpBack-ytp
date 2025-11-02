chrome.runtime.onInstalled.addListener(() => {
  console.log("JumpBack-ytp extension installed");
});

function updateActionPopup(tabId, tabUrl) {
  const isYouTube = tabUrl.includes("youtube.com");
  if (isYouTube) {
    chrome.action.setPopup({ tabId, popup: "popup.html" });
    chrome.action.enable(tabId);
  } else {
    chrome.action.setPopup({ tabId, popup: "" });
    chrome.action.disable(tabId);
  }
}

// Single listener for tab updates to handle both video detection and popup updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab || !tab.url) return;
  
  // Handle popup updates
  if (changeInfo.url || changeInfo.status === "complete") {
    updateActionPopup(tabId, tab.url);
  }
  
  // Handle video detection and message sending
  if (tab.url.includes("youtube.com/watch")) {
    try {
      const queryParameters = tab.url.split("?")[1];
      if (!queryParameters) return;
      
      const urlParameters = new URLSearchParams(queryParameters);
      const videoId = urlParameters.get('v');
      
      if (videoId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'NEW',
          videoId: videoId,
        }).catch(error => {
          // Ignore errors if content script isn't ready yet
          console.log("Content script not ready:", error.message);
        });
      }
    } catch (error) {
      console.error("Error processing YouTube URL:", error);
    }
  }
});

// Listen for tab activation (ex: switching tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      updateActionPopup(activeInfo.tabId, tab.url);
    }
  });
});