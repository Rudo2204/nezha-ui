const SCRIPT_VERSION = 'v20250617-modified';
// == Style Injection Module ==
// Inject custom CSS to hide specific elements
function injectCustomCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* Hide all divs under parent with classes mt-4 w-full mx-auto */
    .mt-4.w-full.mx-auto > div {
      display: none;
    }
  `;
  document.head.appendChild(style);
}
injectCustomCSS();

// == Utility Functions Module ==
const utils = (() => {
  /**
   * Format file size with automatic unit conversion
   * @param {number} bytes - Number of bytes
   * @returns {{value: string, unit: string}} Formatted value and unit
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return { value: '0', unit: 'B' };
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1000 && unitIndex < units.length - 1) {
      size /= 1000;
      unitIndex++;
    }
    return {
      value: size.toFixed(unitIndex === 0 ? 0 : 2),
      unit: units[unitIndex]
    };
  }

  /**
   * Calculate percentage, supports large numbers with automatic scaling
   * @param {number} used - Used amount
   * @param {number} total - Total amount
   * @returns {string} Percentage string with 2 decimal places
   */
  function calculatePercentage(used, total) {
    used = Number(used);
    total = Number(total);
    // Scale large numbers to prevent overflow
    if (used > 1e15 || total > 1e15) {
      used /= 1e10;
      total /= 1e10;
    }
    return total === 0 ? '0.00' : ((used / total) * 100).toFixed(2);
  }

  /**
   * Format date string to yyyy-MM-dd format
   * @param {string} dateString - Date string
   * @returns {string} Formatted date
   */
  function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * Safely set text content of child element to avoid null reference errors
   * @param {HTMLElement} parent - Parent element
   * @param {string} selector - Child element selector
   * @param {string} text - Text to set
   */
  function safeSetTextContent(parent, selector, text) {
    const el = parent.querySelector(selector);
    if (el) el.textContent = text;
  }

  /**
   * Return gradient HSL color based on percentage (green→orange→red)
   * @param {number} percentage - Percentage from 0 to 100
   * @returns {string} HSL color string
   */
  function getHslGradientColor(percentage) {
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const lerp = (start, end, t) => start + (end - start) * t;
    const p = clamp(Number(percentage), 0, 100);
    let h, s, l;

    if (p <= 35) {
      const t = p / 35;
      h = lerp(142, 32, t);  // Green to orange
      s = lerp(69, 85, t);
      l = lerp(45, 55, t);
    } else if (p <= 85) {
      const t = (p - 35) / 50;
      h = lerp(32, 0, t);    // Orange to red
      s = lerp(85, 75, t);
      l = lerp(55, 50, t);
    } else {
      const t = (p - 85) / 15;
      h = 0;                 // Darken red
      s = 75;
      l = lerp(50, 45, t);
    }
    return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
  }

  /**
   * Toggle content with fade-out/fade-in opacity transition
   * @param {HTMLElement} element - Target element
   * @param {string} newContent - New HTML content
   * @param {number} duration - Animation duration in milliseconds
   */
  function fadeOutIn(element, newContent, duration = 500) {
    element.style.transition = `opacity ${duration / 2}ms`;
    element.style.opacity = '0';
    setTimeout(() => {
      element.innerHTML = newContent;
      element.style.transition = `opacity ${duration / 2}ms`;
      element.style.opacity = '1';
    }, duration / 2);
  }

  return {
    formatFileSize,
    calculatePercentage,
    formatDate,
    safeSetTextContent,
    getHslGradientColor,
    fadeOutIn
  };
})();

// == Traffic Statistics Rendering Module ==
const trafficRenderer = (() => {
  const toggleElements = [];  // Store elements and their contents for periodic toggling

  /**
   * Render traffic statistics entries
   * @param {Object} trafficData - Traffic data returned from backend
   * @param {Object} config - Configuration options
   */
  function renderTrafficStats(trafficData, config) {
    const serverMap = new Map();

    // Parse traffic data and aggregate by server name
    for (const cycleId in trafficData) {
      const cycle = trafficData[cycleId];
      if (!cycle.server_name || !cycle.transfer) continue;
      for (const serverId in cycle.server_name) {
        const serverName = cycle.server_name[serverId];
        const transfer = cycle.transfer[serverId];
        const max = cycle.max;
        const from = cycle.from;
        const to = cycle.to;
        const next_update = cycle.next_update[serverId];
        if (serverName && transfer !== undefined && max && from && to) {
          serverMap.set(serverName, {
            id: serverId,
            transfer,
            max,
            name: cycle.name,
            from,
            to,
            next_update
          });
        }
      }
    }

    serverMap.forEach((serverData, serverName) => {
      // Find corresponding display area
      const targetElement = Array.from(document.querySelectorAll('section.grid.items-center.gap-2'))
        .find(section => {
          const firstText = section.querySelector('p')?.textContent.trim();
          return firstText === serverName.trim();
        });
      if (!targetElement) return;

      // Format data
      const usedFormatted = utils.formatFileSize(serverData.transfer);
      const totalFormatted = utils.formatFileSize(serverData.max);
      const percentage = utils.calculatePercentage(serverData.transfer, serverData.max);
      const fromFormatted = utils.formatDate(serverData.from);
      const toFormatted = utils.formatDate(serverData.to);
      // const nextUpdateFormatted = new Date(serverData.next_update).toLocaleString("zh-CN", { timeZone: Temporal.Now.timeZoneId() });
      const nextUpdateFormatted = new Date(serverData.next_update).toLocaleString("zh-CN", { timeZone: "Asia/Ho_Chi_Minh" });
      const uniqueClassName = 'traffic-stats-for-server-' + serverData.id;
      const progressColor = utils.getHslGradientColor(percentage);
      const containerDiv = targetElement.closest('div');
      if (!containerDiv) return;

      // Logging function
      const log = (...args) => { if (config.enableLog) console.log('[renderTrafficStats]', ...args); };

      // Check if traffic entry element already exists
      const existing = Array.from(containerDiv.querySelectorAll('.new-inserted-element'))
        .find(el => el.classList.contains(uniqueClassName));

      if (!config.showTrafficStats) {
        // Remove element when not displaying
        if (existing) {
          existing.remove();
          log(`Removed traffic entry: ${serverName}`);
        }
        return;
      }

      if (existing) {
        // Update existing element content
        utils.safeSetTextContent(existing, '.used-traffic', usedFormatted.value);
        utils.safeSetTextContent(existing, '.used-unit', usedFormatted.unit);
        utils.safeSetTextContent(existing, '.total-traffic', totalFormatted.value);
        utils.safeSetTextContent(existing, '.total-unit', totalFormatted.unit);
        utils.safeSetTextContent(existing, '.from-date', fromFormatted);
        utils.safeSetTextContent(existing, '.to-date', toFormatted);
        utils.safeSetTextContent(existing, '.percentage-value', percentage + '%');
        utils.safeSetTextContent(existing, '.next-update', `next update: ${nextUpdateFormatted}`);

        const progressBar = existing.querySelector('.progress-bar');
        if (progressBar) {
          progressBar.style.width = percentage + '%';
          progressBar.style.backgroundColor = progressColor;
        }
        log(`Updated traffic entry: ${serverName}`);
      } else {
        // Insert new traffic entry element
        let oldSection = null;
        if (config.insertAfter) {
          oldSection = containerDiv.querySelector('section.flex.items-center.w-full.justify-between.gap-1')
            || containerDiv.querySelector('section.grid.items-center.gap-3');
        } else {
          oldSection = containerDiv.querySelector('section.grid.items-center.gap-3');
        }
        if (!oldSection) return;

        // Time range content for toggle display
        const defaultTimeInfoHTML = `<span class="from-date">${fromFormatted}</span>
                <span class="text-neutral-500 dark:text-neutral-400">-</span>
                <span class="to-date">${toFormatted}</span>`;
        const contents = [
          defaultTimeInfoHTML,
          // `<span class="text-[10px] font-medium text-neutral-800 dark:text-neutral-200 percentage-value">${percentage}%</span>`,
          `<span class="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">${nextUpdateFormatted}</span>`
        ];

        const newElement = document.createElement('div');
        newElement.classList.add('space-y-1.5', 'new-inserted-element', uniqueClassName);
        newElement.style.width = '100%';
        newElement.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-baseline gap-1">
              <span class="text-[10px] font-medium text-neutral-800 dark:text-neutral-200 used-traffic">${usedFormatted.value}</span>
              <span class="text-[10px] font-medium text-neutral-800 dark:text-neutral-200 used-unit">${usedFormatted.unit}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400">/ </span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400 total-traffic">${totalFormatted.value}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400 total-unit">${totalFormatted.unit}</span>
              <span class="text-[10px] font-medium text-neutral-800 dark:text-neutral-200 percentage-value"> (${percentage}%)</span>
            </div>
            <div class="text-[10px] font-medium text-neutral-600 dark:text-neutral-300 time-info" style="opacity:1; transition: opacity 0.3s;">
              ${defaultTimeInfoHTML}
            </div>
          </div>
          <div class="relative h-1.5">
            <div class="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 rounded-full"></div>
            <div class="absolute inset-0 bg-emerald-500 rounded-full transition-all duration-300 progress-bar" style="width: ${percentage}%; max-width: 100%; background-color: ${progressColor};"></div>
          </div>
        `;

        oldSection.after(newElement);
        log(`Inserted new traffic entry: ${serverName}`);

        // When toggle is enabled, save element and its content for periodic toggling
        if (config.toggleInterval > 0) {
          const timeInfoElement = newElement.querySelector('.time-info');
          if (timeInfoElement) {
            toggleElements.push({
              el: timeInfoElement,
              contents
            });
          }
        }
      }
    });
  }

  /**
   * Start periodic content toggle (for time, percentage carousel, etc.)
   * @param {number} toggleInterval - Toggle interval in milliseconds
   * @param {number} duration - Animation duration in milliseconds
   */
  function startToggleCycle(toggleInterval, duration) {
    if (toggleInterval <= 0) return;
    let toggleIndex = 0;

    setInterval(() => {
      toggleIndex++;
      toggleElements.forEach(({ el, contents }) => {
        if (!document.body.contains(el)) return;
        const index = toggleIndex % contents.length;
        utils.fadeOutIn(el, contents[index], duration);
      });
    }, toggleInterval);
  }

  return {
    renderTrafficStats,
    startToggleCycle
  };
})();

// == Data Request and Cache Module ==
const trafficDataManager = (() => {
  let trafficCache = null;

  /**
   * Request traffic data with caching support
   * @param {string} apiUrl - API endpoint
   * @param {Object} config - Configuration options
   * @param {Function} callback - Callback after successful request, receives traffic data
   */
  function fetchTrafficData(apiUrl, config, callback) {
    const now = Date.now();
    // Use cached data
    if (trafficCache && (now - trafficCache.timestamp < config.interval)) {
      if (config.enableLog) console.log('[fetchTrafficData] Using cached data');
      callback(trafficCache.data);
      return;
    }

    if (config.enableLog) console.log('[fetchTrafficData] Requesting new data...');
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          if (config.enableLog) console.warn('[fetchTrafficData] Request successful but data is abnormal');
          return;
        }
        if (config.enableLog) console.log('[fetchTrafficData] Successfully fetched new data');
        const trafficData = data.data.cycle_transfer_stats;
        trafficCache = {
          timestamp: now,
          data: trafficData
        };
        callback(trafficData);
      })
      .catch(err => {
        if (config.enableLog) console.error('[fetchTrafficData] Request failed:', err);
      });
  }

  return {
    fetchTrafficData
  };
})();

// == DOM Change Monitoring Module ==
const domObserver = (() => {
  const TARGET_SELECTOR = 'section.server-card-list, section.server-inline-list';
  let currentSection = null;
  let childObserver = null;

  /**
   * DOM child node change callback, calls the provided function
   * @param {Function} onChangeCallback - Change handler function
   */
  function onDomChildListChange(onChangeCallback) {
    onChangeCallback();
  }

  /**
   * Monitor child node changes in specified section
   * @param {HTMLElement} section - Target section element
   * @param {Function} onChangeCallback - Change handler function
   */
  function observeSection(section, onChangeCallback) {
    if (childObserver) {
      childObserver.disconnect();
    }
    currentSection = section;
    childObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          onDomChildListChange(onChangeCallback);
          break;
        }
      }
    });
    childObserver.observe(currentSection, { childList: true, subtree: false });
    // Initial call
    onChangeCallback();
  }

  /**
   * Start top-level section monitoring to detect section switching
   * @param {Function} onChangeCallback - Callback when section changes
   * @returns {MutationObserver} sectionDetector instance
   */
  function startSectionDetector(onChangeCallback) {
    const sectionDetector = new MutationObserver(() => {
      const section = document.querySelector(TARGET_SELECTOR);
      if (section && section !== currentSection) {
        observeSection(section, onChangeCallback);
      }
    });
    const root = document.querySelector('main') || document.body;
    sectionDetector.observe(root, { childList: true, subtree: true });
    return sectionDetector;
  }

  /**
   * Disconnect all monitoring
   * @param {MutationObserver} sectionDetector - Top-level section monitor instance
   */
  function disconnectAll(sectionDetector) {
    if (childObserver) childObserver.disconnect();
    if (sectionDetector) sectionDetector.disconnect();
  }

  return {
    startSectionDetector,
    disconnectAll
  };
})();

// == Main Program Entry Point ==
(function main() {
  // Default configuration
  const defaultConfig = {
    showTrafficStats: true,
    insertAfter: true,
    interval: 60000,
    toggleInterval: 5000,
    duration: 500,
    apiUrl: '/api/v1/service',
    enableLog: false
  };
  // Merge user custom configuration
  const config = Object.assign({}, defaultConfig, window.TrafficScriptConfig || {});
  if (config.enableLog) {
    console.log(`[TrafficScript] Version: ${SCRIPT_VERSION}`);
    console.log('[TrafficScript] Final configuration:', config);
  }
  /**
   * Fetch and refresh traffic statistics
   */
  function updateTrafficStats() {
    trafficDataManager.fetchTrafficData(config.apiUrl, config, trafficData => {
      trafficRenderer.renderTrafficStats(trafficData, config);
    });
  }

  /**
   * DOM change handler function, triggers refresh
   */
  function onDomChange() {
    if (config.enableLog) console.log('[main] DOM changed, refreshing traffic data');
    updateTrafficStats();
    if (!trafficTimer) startPeriodicRefresh();
  }

  // Timer handle to prevent duplicate starts
  let trafficTimer = null;

  /**
   * Start periodic refresh task
   */
  function startPeriodicRefresh() {
    if (!trafficTimer) {
      if (config.enableLog) console.log('[main] Starting periodic refresh task');
      trafficTimer = setInterval(() => {
        updateTrafficStats();
      }, config.interval);
    }
  }

  // Start content toggle carousel (for time, percentage, etc.)
  trafficRenderer.startToggleCycle(config.toggleInterval, config.duration);
  // Monitor section changes and child node changes
  const sectionDetector = domObserver.startSectionDetector(onDomChange);
  // Initial call
  onDomChange();

  // After 100ms delay, try to read user config and override
  setTimeout(() => {
    const newConfig = Object.assign({}, defaultConfig, window.TrafficScriptConfig || {});
    // Check if configuration changed (simple JSON string comparison)
    if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
      if (config.enableLog) console.log('[main] New configuration detected after 100ms, updating config and restarting tasks');
      config = newConfig;
      // Restart periodic refresh task
      startPeriodicRefresh();
      // Restart content toggle carousel (with new config)
      trafficRenderer.startToggleCycle(config.toggleInterval, config.duration);
      // Immediately refresh data
      updateTrafficStats();
    } else {
      if (config.enableLog) console.log('[main] No new configuration after 100ms, keeping original config');
    }
  }, 100);
  // Clean up monitoring and timers on page unload
  window.addEventListener('beforeunload', () => {
    domObserver.disconnectAll(sectionDetector);
    if (trafficTimer) clearInterval(trafficTimer);
  });
})();
