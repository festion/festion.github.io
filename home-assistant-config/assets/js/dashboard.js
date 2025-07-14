class DeploymentDashboard {
    constructor() {
        this.deployments = [];
        this.charts = {};
        this.init();
    }

    async init() {
        try {
            await this.loadDeployments();
            this.updateStats();
            this.createCharts();
            this.updateTable();
            this.updateLastUpdated();
            
            // Auto-refresh every 5 minutes
            setInterval(() => {
                this.refresh();
            }, 300000);
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to load deployment data');
        }
    }

    async loadDeployments() {
        try {
            const response = await fetch('data/deployments.json');
            if (!response.ok) {
                throw new Error('Failed to load deployments data');
            }
            const data = await response.json();
            this.deployments = data.deployments || [];
        } catch (error) {
            console.warn('No deployment data found, using empty dataset');
            this.deployments = [];
        }
    }

    async refresh() {
        try {
            await this.loadDeployments();
            this.updateStats();
            this.updateCharts();
            this.updateTable();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    }

    updateStats() {
        const totalDeployments = this.deployments.length;
        const successfulDeployments = this.deployments.filter(d => d.status === 'success').length;
        const successRate = totalDeployments > 0 ? Math.round((successfulDeployments / totalDeployments) * 100) : 0;
        
        const uniqueDeployers = new Set(this.deployments.map(d => d.user)).size;
        
        const lastDeployment = this.deployments.length > 0 ? 
            this.formatTimeAgo(new Date(this.deployments[0].timestamp)) : 'Never';

        document.getElementById('totalDeployments').textContent = totalDeployments;
        document.getElementById('successRate').textContent = `${successRate}%`;
        document.getElementById('lastDeployment').textContent = lastDeployment;
        document.getElementById('activeDeployers').textContent = uniqueDeployers;
    }

    createCharts() {
        this.createTrendChart();
        this.createStatusChart();
    }

    updateCharts() {
        if (this.charts.trend) {
            this.charts.trend.destroy();
        }
        if (this.charts.status) {
            this.charts.status.destroy();
        }
        this.createCharts();
    }

    createTrendChart() {
        const ctx = document.getElementById('deploymentTrendChart').getContext('2d');
        
        // Get last 30 days of data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentDeployments = this.deployments.filter(d => 
            new Date(d.timestamp) >= thirtyDaysAgo
        );

        // Group by date
        const deploymentsByDate = {};
        recentDeployments.forEach(deployment => {
            const date = new Date(deployment.timestamp).toDateString();
            if (!deploymentsByDate[date]) {
                deploymentsByDate[date] = 0;
            }
            deploymentsByDate[date]++;
        });

        // Create labels for last 30 days
        const labels = [];
        const data = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            labels.push(date.toLocaleDateString());
            data.push(deploymentsByDate[dateStr] || 0);
        }

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Deployments',
                    data: data,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    createStatusChart() {
        const ctx = document.getElementById('statusDistributionChart').getContext('2d');
        
        const statusCounts = {
            success: this.deployments.filter(d => d.status === 'success').length,
            failure: this.deployments.filter(d => d.status === 'failure').length,
            cancelled: this.deployments.filter(d => d.status === 'cancelled').length
        };

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Success', 'Failure', 'Cancelled'],
                datasets: [{
                    data: [statusCounts.success, statusCounts.failure, statusCounts.cancelled],
                    backgroundColor: ['#4CAF50', '#F44336', '#FF9800']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateTable() {
        const tableBody = document.getElementById('deploymentsTableBody');
        
        if (this.deployments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading">No deployment data available</td></tr>';
            return;
        }

        const recentDeployments = this.deployments.slice(0, 20);
        
        tableBody.innerHTML = recentDeployments.map(deployment => `
            <tr>
                <td>${this.formatDate(deployment.timestamp)}</td>
                <td><span class="status-badge status-${deployment.status}">${deployment.status}</span></td>
                <td><code class="commit-hash">${deployment.commit.substring(0, 7)}</code></td>
                <td>${deployment.user}</td>
                <td><a href="${deployment.workflow_url}" class="workflow-link" target="_blank">View</a></td>
            </tr>
        `).join('');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffInHours < 1) {
            return 'Less than an hour ago';
        } else if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
        } else {
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
        }
    }

    updateLastUpdated() {
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
    }

    showError(message) {
        const tableBody = document.getElementById('deploymentsTableBody');
        tableBody.innerHTML = `<tr><td colspan="5" class="loading">Error: ${message}</td></tr>`;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DeploymentDashboard();
});