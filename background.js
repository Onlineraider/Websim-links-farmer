let currentTabIndex = 0;
let urlsToOpen = [];
let currentProcess = null;
let remainingSeconds = 0;
let settings = {
  mode: 'sequential', // 'sequential' or 'parallel'
  numberOfTabs: 1,
  waitTime: 30 // Wait time in seconds between tabs
};

// Initialize status in storage
chrome.storage.local.set({
  currentStatus: 'Ready',
  currentProgress: '',
  isRunning: false,
  remainingSeconds: 0
});

// Function to send status updates
function updateStatus(status, progress = '', seconds = 0) {
  remainingSeconds = seconds;
  chrome.storage.local.set({
    currentStatus: status,
    currentProgress: progress,
    isRunning: true,
    remainingSeconds: seconds
  });
}

// Function to update remaining seconds
function updateRemainingSeconds() {
  if (remainingSeconds > 0) {
    remainingSeconds--;
    chrome.storage.local.set({
      remainingSeconds: remainingSeconds
    });
    setTimeout(updateRemainingSeconds, 1000);
  }
}

// Function to stop the process
function stopProcess() {
  if (currentProcess) {
    clearTimeout(currentProcess);
    currentProcess = null;
  }
  chrome.storage.local.set({
    currentStatus: 'Cancelled',
    currentProgress: '',
    isRunning: false,
    remainingSeconds: 0
  });
  currentTabIndex = 0;
  urlsToOpen = [];
}

// Function to skip current step
function skipStep() {
  if (currentProcess) {
    clearTimeout(currentProcess);
    currentProcess = null;
  }
  if (currentTabIndex < urlsToOpen.length) {
    currentTabIndex++;
    openNextTab();
  }
}

// Function to continue the process
function continueProcess() {
  if (urlsToOpen.length > 0) {
    if (settings.mode === 'parallel') {
      updateStatus('Opening tabs in parallel...');
      // Open all tabs simultaneously
      for (let i = 0; i < Math.min(settings.numberOfTabs, urlsToOpen.length); i++) {
        chrome.tabs.create({ url: urlsToOpen[i] });
      }
      updateStatus('All tabs have been opened', '', 0);
      chrome.storage.local.set({
        isRunning: false
      });
    } else {
      openNextTab();
    }
  } else {
    updateStatus('No URLs found', '', 0);
    chrome.storage.local.set({
      isRunning: false
    });
  }
}

// Load settings from storage
chrome.storage.sync.get(['mode', 'numberOfTabs', 'waitTime'], (data) => {
  if (data.mode) settings.mode = data.mode;
  if (data.numberOfTabs) settings.numberOfTabs = data.numberOfTabs;
  if (data.waitTime) settings.waitTime = data.waitTime;
});

// Main function to start the process
async function startProcess() {
  updateStatus('Loading main page...');
  const mainTab = await chrome.tabs.create({ url: 'https://urls.on.websim.ai/' });
  
  // Always wait 45 seconds when opening the main page
  updateStatus('Wait 45 seconds...', '', 45);
  updateRemainingSeconds();
  currentProcess = setTimeout(async () => {
    // Collect URLs from main page after waiting time
    const urls = await chrome.scripting.executeScript({
      target: { tabId: mainTab.id },
      function: () => {
        const projectLinksDiv = document.getElementById('project-links');
        if (projectLinksDiv) {
          const links = Array.from(projectLinksDiv.querySelectorAll('a'));
          return links
            .map(link => link.href)
            .filter(href => href && href.includes('websim.ai/c/'));
        }
        return [];
      }
    });

    urlsToOpen = urls[0].result;
    if (urlsToOpen.length > 0) {
      updateStatus('Links collected', `Found: ${urlsToOpen.length} URLs`);
      continueProcess();
    } else {
      updateStatus('No URLs found', '', 0);
      chrome.storage.local.set({
        isRunning: false
      });
    }
  }, 45000);
}

// Function to sequentially open tabs
function openNextTab() {
  if (currentTabIndex >= Math.min(settings.numberOfTabs, urlsToOpen.length)) {
    currentTabIndex = 0;
    updateStatus('All tabs have been processed', '', 0);
    chrome.storage.local.set({
      isRunning: false
    });
    return;
  }

  updateStatus('Opening tab', `Tab ${currentTabIndex + 1} of ${Math.min(settings.numberOfTabs, urlsToOpen.length)}`, settings.waitTime);
  updateRemainingSeconds();
  chrome.tabs.create({ url: urlsToOpen[currentTabIndex] }, (tab) => {
    currentProcess = setTimeout(() => {
      chrome.tabs.remove(tab.id);
      currentTabIndex++;
      openNextTab();
    }, settings.waitTime * 1000);
  });
}

// Event Listener for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    startProcess();
    sendResponse({ status: 'started' });
  } else if (request.action === 'updateSettings') {
    settings = { ...settings, ...request.settings };
    chrome.storage.sync.set(settings);
    
    // If the tab count changes, stop the current process and reset everything
    if (request.settings.numberOfTabs && request.settings.numberOfTabs !== settings.numberOfTabs) {
      if (currentProcess) {
        clearTimeout(currentProcess);
        currentProcess = null;
      }
      currentTabIndex = 0;
      urlsToOpen = [];
      chrome.storage.local.set({
        currentStatus: 'Ready',
        currentProgress: '',
        isRunning: false,
        remainingSeconds: 0
      });
    }
    sendResponse({ status: 'settings updated' });
  } else if (request.action === 'getStatus') {
    chrome.storage.local.get(['currentStatus', 'currentProgress', 'isRunning', 'remainingSeconds'], (data) => {
      sendResponse({
        status: data.currentStatus || 'Ready',
        progress: data.currentProgress || '',
        isRunning: data.isRunning || false,
        remainingSeconds: data.remainingSeconds || 0
      });
    });
    return true;
  } else if (request.action === 'skip') {
    skipStep();
    sendResponse({ status: 'skipped' });
  } else if (request.action === 'stop') {
    stopProcess();
    sendResponse({ status: 'stopped' });
  }
  return true;
});
