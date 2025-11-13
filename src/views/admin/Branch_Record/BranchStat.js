import React, { useEffect, useState } from 'react';
import './BranchStat.css'; // CSS for styling
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  ArcElement, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { useSelector } from 'react-redux';
import { TextField, Button, Box } from '@mui/material';
import { format } from 'date-fns';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const BranchStat = () => {
  const [data, setData] = useState(null);
  const [waitingTimes, setWaitingTimes] = useState([]);
  const [busyHours, setBusyHours] = useState({});
  const [busyDays, setBusyDays] = useState({});
  const [transactionTypeCounts, setTransactionTypeCounts] = useState({});
  const [transactionStatusCounts, setTransactionStatusCounts] = useState({});
  const [additionalStats, setAdditionalStats] = useState({});
  const accessToken = useSelector((state) => state.user.accessToken);

  // Date Range States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Fetch data from backend API whenever startDate or endDate changes
    fetchBranchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchBranchData = () => {
    // Construct the fetch URL with query parameters if dates are selected
    let url = 'http://localhost:5000/api/zsmart_branch_requests/branch_transactions';
    const params = [];
    if (startDate) params.push(`start=${startDate}`);
    if (endDate) params.push(`end=${endDate}`);
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    fetch(url, {
      headers: { 
        'Content-Type': 'application/json', 
        'x-access-token': accessToken 
      },
    })
      .then(response => response.json())
      .then(json => {
        if (!json.error) {
          setData(json.data);
          processStatistics(json.data);
        }
      })
      .catch(error => console.error('Error fetching branch statistics:', error));
  };

  const processStatistics = (data) => {
    // Calculate waiting times in minutes based on request_date and assigned_date
    const times = data.transactions.map(tx => {
      const requestDate = new Date(tx.request_date);
      const assignedDate = new Date(tx.assigned_date);
      const diffMs = assignedDate - requestDate;
      return Math.round(diffMs / 60000); // Convert to minutes
    });
    setWaitingTimes(times);

    // Calculate busiest hours based on request_date
    const timeSlots = generateTimeSlots(data.transactions);
    setBusyHours(timeSlots);

    // Calculate busiest days based on request_date
    const dayCounts = calculateBusyDays(data.transactions);
    setBusyDays(dayCounts);

    // Transaction types count
    setTransactionTypeCounts(data.summary.byType);

    // Transaction status count
    setTransactionStatusCounts(data.summary.byStatus);

    // Additional Statistics
    setAdditionalStats(calculateAdditionalStats(data.transactions));
  };

  // Function to generate descriptive time slots (e.g., 8:00 AM - 10:35 AM)
  const generateTimeSlots = (transactions) => {
    if (transactions.length === 0) return {};

    // Sort transactions by request_date
    const sortedTx = transactions.sort((a, b) => new Date(a.request_date) - new Date(b.request_date));

    const firstTime = new Date(sortedTx[0].request_date);
    const lastTime = new Date(sortedTx[sortedTx.length - 1].request_date);

    // Define the slot duration (e.g., 2 hours)
    const slotDuration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    const slots = {};
    let slotStart = new Date(firstTime);
    let slotEnd = new Date(slotStart.getTime() + slotDuration);

    while (slotStart <= lastTime) {
      const label = `${format(slotStart, 'h:mm a')} - ${format(slotEnd, 'h:mm a')}`;
      slots[label] = 0;

      // Increment slot
      slotStart = slotEnd;
      slotEnd = new Date(slotStart.getTime() + slotDuration);
    }

    // Assign transactions to slots
    transactions.forEach(tx => {
      const requestDate = new Date(tx.request_date);
      const txTime = requestDate;

      for (let slot in slots) {
        const [start, end] = slot.split(' - ').map(time => {
          const date = new Date(requestDate);
          const [hours, minutes] = convertTo24Hour(time).split(':').map(Number);
          date.setHours(hours, minutes, 0, 0);
          return date;
        });

        if (txTime >= start && txTime < end) {
          slots[slot] += 1;
          break;
        }
      }
    });

    return slots;
  };

  // Helper function to convert 12-hour format to 24-hour for comparison
  const convertTo24Hour = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');

    if (modifier === 'PM' && hours !== '12') {
      hours = parseInt(hours, 10) + 12;
    }
    if (modifier === 'AM' && hours === '12') {
      hours = '00';
    }

    return `${hours}:${minutes}`;
  };

  // Utility function to calculate busy days
  const calculateBusyDays = (transactions) => {
    const dayCount = {};
    transactions.forEach((tx) => {
      const date = new Date(tx.request_date);
      const day = format(date, 'EEEE'); // Full day name
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    return dayCount;
  };

  // Utility function to calculate additional statistics
  const calculateAdditionalStats = (transactions) => {
    const stats = {
      totalAmount: 0,
      averageAmount: 0,
      maxAmount: 0,
      minAmount: Number.MAX_VALUE,
      totalTransactions: transactions.length,
      incomingAmount: 0,
      outgoingAmount: 0
    };

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount_in_figures) || 0;
      
      // Track total amount
      stats.totalAmount += amount;
      
      // Track max and min amounts
      if (amount > stats.maxAmount) stats.maxAmount = amount;
      if (amount < stats.minAmount) stats.minAmount = amount;
      
      // Track incoming and outgoing amounts based on transaction type
      if (tx.transaction_type?.toLowerCase().includes('deposit') || 
          tx.transaction_type?.toLowerCase().includes('incoming')) {
        stats.incomingAmount += amount;
      } else if (tx.transaction_type?.toLowerCase().includes('withdrawal') || 
                 tx.transaction_type?.toLowerCase().includes('outgoing')) {
        stats.outgoingAmount += amount;
      }
    });

    // Calculate average amount
    stats.averageAmount = transactions.length > 0 ? stats.totalAmount / transactions.length : 0;

    return stats;
  };

  if (!data) {
    return <div>Loading...</div>;
  }

  // Calculate min, max, avg waiting times
  const minWaiting = Math.min(...waitingTimes);
  const maxWaiting = Math.max(...waitingTimes);
  const avgWaiting = (waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length).toFixed(2);

  // Prepare data for busy hours chart
  const busyHoursData = {
    labels: Object.keys(busyHours),
    datasets: [
      {
        label: 'Number of Requests',
        data: Object.values(busyHours),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  };

  // Prepare data for transaction types pie chart
  const transactionTypeData = {
    labels: Object.keys(transactionTypeCounts),
    datasets: [
      {
        label: 'Transaction Types',
        data: Object.values(transactionTypeCounts),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#8A2BE2',
          '#00FA9A',
        ],
      },
    ],
  };

  // Prepare data for busy days chart
  const busyDaysData = {
    labels: Object.keys(busyDays),
    datasets: [
      {
        label: 'Number of Requests',
        data: Object.values(busyDays),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
      },
    ],
  };

  // Prepare data for transactions by status doughnut chart
  const transactionStatusData = {
    labels: Object.keys(transactionStatusCounts),
    datasets: [
      {
        label: 'Transaction Status',
        data: Object.values(transactionStatusCounts),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
        ],
      },
    ],
  };

  // Handler for resetting date filters
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="branch-stat-container">
      <h2>Branch Statistics</h2>

      {/* Date Range Filter */}
      <Box className="date-filter" sx={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
        <TextField
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Button variant="outlined" color="primary" onClick={resetFilters}>
          Reset
        </Button>
      </Box>

      {/* Statistics Cards */}
      <div className="stats-cards">
        <div className="card">
          <h3>Minimum Waiting Time</h3>
          <p>{minWaiting} minutes</p>
        </div>
        <div className="card">
          <h3>Maximum Waiting Time</h3>
          <p>{maxWaiting} minutes</p>
        </div>
        <div className="card">
          <h3>Average Waiting Time</h3>
          <p>{avgWaiting} minutes</p>
        </div>
        <div className="card">
          <h3>Total Transactions</h3>
          <p>{additionalStats.totalTransactions}</p>
        </div>
        <div className="card">
          <h3>Total Amount</h3>
          <p>ETB {additionalStats.totalAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Average Amount</h3>
          <p>ETB {additionalStats.averageAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Maximum Transaction Amount</h3>
          <p>ETB {additionalStats.maxAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Minimum Transaction Amount</h3>
          <p>ETB {additionalStats.minAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Incoming Amount</h3>
          <p>ETB {additionalStats.incomingAmount.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Outgoing Amount</h3>
          <p>ETB {additionalStats.outgoingAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <h3>Busy Hours</h3>
          <Bar 
            data={busyHoursData} 
            options={{
              responsive: true,
              plugins: {
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `Requests: ${context.parsed.y}`;
                    }
                  }
                },
                legend: {
                  display: false,
                }
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Time Range',
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: 'Number of Requests',
                  },
                  ticks: {
                    precision:0
                  }
                },
              },
            }} 
          />
        </div>
        <div className="chart-card">
          <h3>Busy Days</h3>
          <Bar 
            data={busyDaysData} 
            options={{
              responsive: true,
              plugins: {
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      return `Requests: ${context.parsed.y}`;
                    }
                  }
                },
                legend: {
                  display: false,
                }
              },
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'Day of the Week',
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: 'Number of Requests',
                  },
                  ticks: {
                    precision:0
                  }
                },
              },
            }} 
          />
        </div>
        <div className="chart-card">
          <h3>Transaction Types</h3>
          <Pie 
            data={transactionTypeData} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom',
                },
              },
            }} 
          />
        </div>
        <div className="chart-card">
          <h3>Transactions by Status</h3>
          <Doughnut 
            data={transactionStatusData} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom',
                },
              },
            }} 
          />
        </div>
      </div>

      {/* Additional Statistics */}
      <div className="additional-stats">
        <h3>Additional Statistics</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(transactionStatusCounts).map(([status, count]) => (
              <tr key={status}>
                <td>{status.charAt(0).toUpperCase() + status.slice(1)}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BranchStat;