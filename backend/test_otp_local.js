import axios from "axios";

async function run() {
  try {
    const res = await axios.post("http://localhost:3001/api/seller/verification/send-otp", {
      channel: "email",
      email: "prathmeshjawade2@gmail.com"
    });
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  } catch (err) {
    console.error("Error status:", err.response?.status);
    console.error("Error data:", err.response?.data || err.message);
  }
}
run();
