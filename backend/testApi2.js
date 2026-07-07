import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const res = await axios.post('http://localhost:3001/api/orders/workflow/ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ/reschedule', {
      rescheduledFor: new Date().toISOString()
    });
    console.log("Success:", res.data);
  } catch (err) {
    if (err.response) {
      console.log("Error status:", err.response.status);
      console.log("Error data:", err.response.data);
    } else {
      console.log("Network error:", err.message);
    }
  }
}
run();
