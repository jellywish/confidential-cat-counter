/**
 * Collapsible drawer for crypto logging
 * Shows real-time crypto operations and debugging info
 */

class CryptoLogDrawer {
    constructor() {
        this.isOpen = false;
        this.unsubscribe = null;
        this.init();
    }

    init() {
        this.createElement();
        this.attachEventListeners();
        this.subscribeToCryptoLogger();
    }

    createElement() {
        // Create drawer container
        this.container = document.createElement('div');
        this.container.id = 'crypto-log-drawer';
        this.container.className = 'crypto-drawer closed';
        
        this.container.innerHTML = `
            <div class="crypto-drawer-header">
                <button id="crypto-drawer-toggle" class="drawer-toggle">
                    <span class="toggle-icon">📊</span>
                    <span class="toggle-text">Crypto Logs</span>
                    <span class="log-count badge">0</span>
                </button>
                <button id="crypto-clear-logs" class="clear-btn" title="Clear logs">🗑️</button>
            </div>
            <div class="crypto-drawer-content">
                <div class="crypto-drawer-controls">
                    <select id="crypto-log-filter" class="log-filter">
                        <option value="all">All Logs</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                    <button id="crypto-export-logs" class="export-btn">Export</button>
                </div>
                <div id="crypto-log-list" class="log-list"></div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.container);
    }

    attachEventListeners() {
        // Toggle drawer
        document.getElementById('crypto-drawer-toggle').addEventListener('click', () => {
            this.toggle();
        });

        // Clear logs
        document.getElementById('crypto-clear-logs').addEventListener('click', () => {
            window.cryptoLogger.clear();
            this.updateLogCount(0);
        });

        // Filter logs
        document.getElementById('crypto-log-filter').addEventListener('change', (e) => {
            this.filterLogs(e.target.value);
        });

        // Export logs
        document.getElementById('crypto-export-logs').addEventListener('click', () => {
            this.exportLogs();
        });
    }

    subscribeToCryptoLogger() {
        if (window.cryptoLogger) {
            this.unsubscribe = window.cryptoLogger.subscribe((logEntry) => {
                if (logEntry.type === 'clear') {
                    this.clearDisplay();
                } else {
                    this.addLogEntry(logEntry);
                    this.updateLogCount(window.cryptoLogger.getLogs().length);
                }
            });
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.className = `crypto-drawer ${this.isOpen ? 'open' : 'closed'}`;
        
        // Update toggle icon
        const icon = document.querySelector('.toggle-icon');
        icon.textContent = this.isOpen ? '📈' : '📊';
    }

    addLogEntry(logEntry) {
        const logList = document.getElementById('crypto-log-list');
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.level}`;
        logElement.dataset.level = logEntry.level;
        
        const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
        
        logElement.innerHTML = `
            <div class="log-header">
                <span class="log-time">${timestamp}</span>
                <span class="log-level log-level-${logEntry.level}">${logEntry.level.toUpperCase()}</span>
            </div>
            <div class="log-message">${logEntry.message}</div>
            ${Object.keys(logEntry.metadata).length > 0 ? 
                `<div class="log-metadata">${this.formatMetadata(logEntry.metadata)}</div>` : ''
            }
        `;

        // Add to top of list (most recent first)
        logList.insertBefore(logElement, logList.firstChild);

        // Limit displayed logs for performance
        const logs = logList.children;
        if (logs.length > 200) {
            logList.removeChild(logs[logs.length - 1]);
        }

        // Auto-scroll to top if drawer is open
        if (this.isOpen) {
            logList.scrollTop = 0;
        }
    }

    formatMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return '';
        }
        
        const formatted = Object.entries(metadata)
            .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
            .join('<br>');
        
        return `<details><summary>Details</summary>${formatted}</details>`;
    }

    clearDisplay() {
        document.getElementById('crypto-log-list').innerHTML = '';
    }

    updateLogCount(count) {
        document.querySelector('.log-count').textContent = count;
        document.querySelector('.log-count').className = 
            `log-count badge ${count > 0 ? 'has-logs' : ''}`;
    }

    filterLogs(filterType) {
        const logEntries = document.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            if (filterType === 'all' || entry.dataset.level === filterType) {
                entry.style.display = 'block';
            } else {
                entry.style.display = 'none';
            }
        });
    }

    exportLogs() {
        const logs = window.cryptoLogger.getLogs();
        const exportData = {
            exportTime: new Date().toISOString(),
            logCount: logs.length,
            logs: logs
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `crypto-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.container) {
            this.container.remove();
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CryptoLogDrawer();
    });
} else {
    new CryptoLogDrawer();
}

export default CryptoLogDrawer;
