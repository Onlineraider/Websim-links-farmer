document.addEventListener('DOMContentLoaded', () => {
  // Load settings from storage
  chrome.storage.sync.get(['mode', 'numberOfTabs', 'waitTime'], (data) => {
    if (data.mode) document.getElementById('mode').value = data.mode;
    if (data.numberOfTabs) document.getElementById('numberOfTabs').value = data.numberOfTabs;
    if (data.waitTime) document.getElementById('waitTime').value = data.waitTime;
  });

  const statusText = document.getElementById('statusText');
  const progressText = document.getElementById('progressText');
  const startButton = document.getElementById('startButton');
  const skipButton = document.getElementById('skipButton');
  const stopButton = document.getElementById('stopButton');
  const numberOfTabsInput = document.getElementById('numberOfTabs');
  const waitTimeInput = document.getElementById('waitTime');
  const modeSelect = document.getElementById('mode');

  // Event listener for setting changes
  function updateSettings() {
    const settings = {
      mode: modeSelect.value,
      numberOfTabs: parseInt(numberOfTabsInput.value),
      waitTime: parseInt(waitTimeInput.value)
    };
    chrome.runtime.sendMessage({ action: 'updateSettings', settings: settings });
  }

  // Apply changes immediately
  numberOfTabsInput.addEventListener('input', updateSettings);
  waitTimeInput.addEventListener('input', updateSettings);
  modeSelect.addEventListener('change', updateSettings);

  // Initialize buttons
  function updateButtons(isRunning) {
    startButton.disabled = isRunning;
    skipButton.disabled = !isRunning;
    stopButton.disabled = !isRunning;
  }

  // Load current status
  function updateStatusDisplay() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response) {
        statusText.textContent = response.status;
        if (response.remainingSeconds > 0) {
          progressText.textContent = `${response.progress} (${response.remainingSeconds} seconds remaining)`;
        } else {
          progressText.textContent = response.progress;
        }
        updateButtons(response.isRunning);
      }
    });
  }

  // Update status when popup opens
  updateStatusDisplay();

  // Update status regularly
  const statusInterval = setInterval(updateStatusDisplay, 500);

  // Clean up interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(statusInterval);
  });

  // Start button event listener
  startButton.addEventListener('click', () => {
    const settings = {
      mode: document.getElementById('mode').value,
      numberOfTabs: parseInt(document.getElementById('numberOfTabs').value),
      waitTime: parseInt(document.getElementById('waitTime').value)
    };

    // Save settings
    chrome.storage.sync.set(settings);

    // Start process
    chrome.runtime.sendMessage({ action: 'start' }, (response) => {
      updateStatusDisplay();
    });
  });

  // Skip button event listener
  skipButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'skip' }, (response) => {
      updateStatusDisplay();
    });
  });

  // Stop button event listener
  stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stop' }, (response) => {
      updateStatusDisplay();
    });
  });
});
